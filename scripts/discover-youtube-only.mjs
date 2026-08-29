#!/usr/bin/env node

/**
 * discover-youtube-only.mjs
 *
 * scripts/discover-pck-tonghap.mjs가 생성한 PCK 파일럿 JSON을 읽어,
 * app/api/sermons/sync/route.ts의 `sources` 배열(실제 등록·동기화 대상)에
 * 이미 등록된 교회명만 제외한 뒤, 나머지 미등록 파일럿 교회 전체(담임목사
 * 미상, 기존 홈페이지 연결 유튜브 단서 보유 여부와 무관)를 YouTube InnerTube
 * 익명 검색 API(POST /youtubei/v1/search, JSON 응답)만으로 조사하는
 * 리서치 전용 CLI. (반복적인 GET /results HTML 요청은 리다이렉트 루프를
 * 유발해 사용하지 않는다.)
 *
 * 이 스크립트는 후보 조사만 수행하며 앱 소스나 데이터베이스를 절대 수정하지 않는다.
 * 개인정보(이메일·팩스·휴대전화)는 수집·출력하지 않는다.
 */

import { readFile, writeFile, rename } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";

const INNERTUBE_SEARCH_URL = "https://www.youtube.com/youtubei/v1/search";
const INNERTUBE_CLIENT_VERSION = "2.20240820.01.00";
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

const DEFAULT_DELAY_MS = 700;
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_CONCURRENCY = 2;
const RECENT_WINDOW_DAYS = 180;
const SEARCH_MAX_ATTEMPTS = 3;
const SERMON_KEYWORDS = ["설교", "예배", "말씀", "주일", "수요", "새벽", "기도회"];

function printHelp() {
  console.log(`discover-youtube-only.mjs

PCK 파일럿 JSON에서 route.ts의 sources 배열에 아직 등록되지 않은 교회 전체
(담임목사 미상, 기존 유튜브 단서 보유 여부 무관)를 YouTube InnerTube 익명
검색 API(JSON)만으로 조사하는 후보 발굴 전용 CLI입니다.
앱 소스나 DB는 절대 수정하지 않습니다. 개인정보(이메일·팩스·휴대전화)는 다루지 않습니다.

사용법:
  node scripts/discover-youtube-only.mjs --input <pilot.json> --output <result.json> [옵션]

옵션:
  --input <path>          필수. discover-pck-tonghap.mjs가 생성한 파일럿 JSON 경로.
  --output <path>         필수. 결과 JSON을 저장할 파일 경로.
  --sources <path|none>   기존 등록 교회명을 제외할 소스 파일. 이미 필터한 입력은 none 사용.
  --checkpoint <path>     체크포인트 파일 경로 (기본: <output>.checkpoint.json)
  --max-records <n>       처리할 최대 레코드 수 (테스트용 상한)
  --delay-ms <n>          YouTube 요청 간 최소 지연(ms) (기본/최소: ${DEFAULT_DELAY_MS})
  --resume                체크포인트에서 이어서 실행
  --help                  이 도움말을 출력하고 종료.

예시:
  node scripts/discover-youtube-only.mjs --input out/pck-tonghap.json --output out/youtube-only.json --max-records 20
`);
}

function parseArgs(argv) {
  const args = {
    input: null,
    output: null,
    sources: "app/api/sermons/sync/route.ts",
    checkpoint: null,
    maxRecords: null,
    delayMs: DEFAULT_DELAY_MS,
    resume: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    switch (token) {
      case "--input":
        args.input = argv[++i];
        break;
      case "--output":
        args.output = argv[++i];
        break;
      case "--sources":
        args.sources = argv[++i];
        break;
      case "--checkpoint":
        args.checkpoint = argv[++i];
        break;
      case "--max-records": {
        const n = Number.parseInt(argv[++i], 10);
        if (Number.isFinite(n) && n > 0) args.maxRecords = n;
        break;
      }
      case "--delay-ms": {
        const n = Number.parseInt(argv[++i], 10);
        if (Number.isFinite(n) && n >= 0) args.delayMs = n;
        break;
      }
      case "--resume":
        args.resume = true;
        break;
      case "--help":
      case "-h":
        args.help = true;
        break;
      default:
        console.error(`[경고] 알 수 없는 인자를 무시합니다: ${token}`);
    }
  }

  if (!args.checkpoint && args.output) {
    args.checkpoint = `${args.output}.checkpoint.json`;
  }

  if (args.delayMs < DEFAULT_DELAY_MS) {
    console.error(
      `[경고] --delay-ms 값이 권장 최소치(${DEFAULT_DELAY_MS}ms)보다 낮습니다. 정중한 수집을 위해 ${DEFAULT_DELAY_MS}ms로 상향합니다.`
    );
    args.delayMs = DEFAULT_DELAY_MS;
  }

  return args;
}

function nowKstLabel(actorTag) {
  const kst = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" })
  );
  const hh = String(kst.getHours()).padStart(2, "0");
  const mm = String(kst.getMinutes()).padStart(2, "0");
  return `[${hh}:${mm} KST · ${actorTag}]`;
}

function progress(message) {
  console.error(`${nowKstLabel("collector")} ${message}`);
}

/** 모든 YouTube 요청 간 최소 간격을 보장하는 공유 게이트 */
function createRateGate(delayMs) {
  let lastAt = 0;
  let queue = Promise.resolve();
  return function waitTurn() {
    const turn = queue.then(async () => {
      const elapsed = Date.now() - lastAt;
      if (elapsed < delayMs) await sleep(delayMs - elapsed);
      lastAt = Date.now();
    });
    queue = turn.catch(() => {});
    return turn;
  };
}

async function fetchInnerTubeSearch(query, { timeoutMs = REQUEST_TIMEOUT_MS } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(INNERTUBE_SEARCH_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "User-Agent": USER_AGENT,
        "X-YouTube-Client-Name": "1",
        "X-YouTube-Client-Version": INNERTUBE_CLIENT_VERSION,
        Origin: "https://www.youtube.com",
        "Accept-Language": "ko-KR,ko;q=0.9",
      },
      body: JSON.stringify({
        context: {
          client: {
            clientName: "WEB",
            clientVersion: INNERTUBE_CLIENT_VERSION,
            hl: "ko",
            gl: "KR",
          },
        },
        query,
      }),
    });
  } finally {
    clearTimeout(timer);
  }
}

function parseRetryAfterMs(response) {
  const header = response?.headers?.get?.("retry-after");
  if (!header) return null;
  const seconds = Number.parseInt(header, 10);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  const dateMs = Date.parse(header);
  if (!Number.isNaN(dateMs)) {
    const diffMs = dateMs - Date.now();
    return diffMs > 0 ? diffMs : 0;
  }
  return null;
}

/**
 * InnerTube 검색 요청. 최소 3회까지 시도하며, 매 시도마다 공유 rate gate를 통과한다.
 * 403은 일시적 차단에 대비해 지터가 포함된 상대적으로 긴 유계 지수 백오프(예: 10초, 20초)로 재시도한다.
 * 429는 Retry-After 헤더가 있으면 그 값을, 없으면 지수 백오프를 사용한다.
 * 5xx/네트워크 오류도 지수 백오프로 재시도한다. 그 외 상태코드는 즉시 실패로 취급한다.
 */
async function searchYoutubeWithRetry(query, rateGate, maxAttempts = SEARCH_MAX_ATTEMPTS) {
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    await rateGate();

    let response;
    try {
      response = await fetchInnerTubeSearch(query);
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) {
        await sleep(1000 * 2 ** (attempt - 1));
        continue;
      }
      throw new Error(`검색 실패 (${query}): ${error.message}`);
    }

    if (response.ok) {
      const json = await response.json();
      return parseSearchResults(json);
    }

    lastError = new Error(`HTTP ${response.status}`);

    const isRetryableStatus =
      response.status === 403 ||
      response.status === 429 ||
      response.status >= 500;

    if (isRetryableStatus && attempt < maxAttempts) {
      let delayMs;
      if (response.status === 403) {
        const baseBackoffMs = Math.min(60_000, 10_000 * 2 ** (attempt - 1));
        const jitterMs = Math.floor(Math.random() * 1_000);
        delayMs = baseBackoffMs + jitterMs;
      } else if (response.status === 429) {
        const retryAfterMs = parseRetryAfterMs(response);
        delayMs = retryAfterMs ?? 1000 * 2 ** (attempt - 1);
      } else {
        delayMs = 1000 * 2 ** (attempt - 1);
      }
      await sleep(delayMs);
      continue;
    }

    throw new Error(`검색 실패 (${query}): HTTP ${response.status}`);
  }

  throw new Error(`검색 실패 (${query}): ${lastError?.message ?? "unknown error"}`);
}

// ---------------------------------------------------------------------------
// 정규화 유틸
// ---------------------------------------------------------------------------

function normalizeForCompare(text) {
  if (!text) return "";
  return text
    .replace(/\s+/g, "")
    .replace(/[-.,·・"'‘’“”()\u005B\u005D{}!?~_/\\]/g, "")
    .trim();
}

function stripTrailingChurchSuffix(normalized) {
  return normalized.endsWith("교회") ? normalized.slice(0, -2) : normalized;
}

// 성공회 등 일부 교단은 "대한성공회 ○○교회"처럼 조직 접두어를 붙여 채널/영상
// 텍스트를 표기한다. 이 접두어는 소속을 나타낼 뿐 교회를 특정하지 않으므로
// 이름 비교 시에만 제거한다(다른 텍스트 비교 용도의 normalizeForCompare에는
// 영향 없음).
const CHURCH_ORG_PREFIXES = ["대한성공회"];

function stripChurchOrgPrefix(normalized) {
  for (const prefix of CHURCH_ORG_PREFIXES) {
    const normalizedPrefix = normalizeForCompare(prefix);
    if (normalizedPrefix && normalized.startsWith(normalizedPrefix)) {
      return normalized.slice(normalizedPrefix.length);
    }
  }
  return normalized;
}

// 디렉터리 표기의 "동탄교회(성 프란치스코)"처럼 괄호 안 성인명/부제 표기는
// 선택적 별칭일 뿐이다. 괄호 내용을 통째로 제거한 "기본 교회명"만으로 비교해,
// 성인명이 우연히 겹친다는 이유만으로 무관한 교회가 매칭되지 않도록 한다.
function stripParentheticalContent(text) {
  if (!text) return "";
  return text.replace(/[（(][^）)]*[）)]/g, "");
}

function normalizeChurchName(text) {
  const withoutParens = stripParentheticalContent(text);
  return stripChurchOrgPrefix(normalizeForCompare(withoutParens));
}

function namesMatch(a, b) {
  const na = normalizeChurchName(a);
  const nb = normalizeChurchName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  return stripTrailingChurchSuffix(na) === stripTrailingChurchSuffix(nb) &&
    stripTrailingChurchSuffix(na).length > 0;
}

// 디렉터리의 "김장환 주교"/"계성남 신부"에서 인명만 추출한다. 영상 제목은
// "김장환 엘리야 주교"처럼 인명과 직함 사이에 세례명이 끼어들 수 있으므로,
// 대상 인명 자체가 부분 문자열로 포함되는지만 확인하면 되도록 직함(목사/
// 신부/사제/주교)만 잘라낸다.
function stripPastorSuffix(pastor) {
  if (!pastor) return "";
  return pastor.replace(/\s*(?:담임)?(?:목사|신부|사제|주교)\s*$/, "").trim();
}

// ---------------------------------------------------------------------------
// 기존 등록 교회명 추출 (app/api/sermons/sync/route.ts)
//
// route.ts에는 실제로 등록·동기화되는 `sources` 배열 외에
// 아직 채널을 확정하지 못해 보류 중인 `heldSources`/`regionalHeldSources`
// 배열도 존재한다. 보류 배열의 이름은 "이미 등록됨"이 아니므로 제외 대상에서
// 반드시 빠져야 하며, 오직 `sources` 배열 안의 이름만 등록 완료로 취급한다.
// ---------------------------------------------------------------------------

function extractSourcesArrayBlock(sourceText) {
  const startMarker = "const sources:Source[]=[";
  const start = sourceText.indexOf(startMarker);
  if (start === -1) {
    throw new Error(
      "route.ts에서 'const sources:Source[]=[' 배열 선언을 찾지 못했습니다. --sources 경로 또는 파일 구조를 확인하세요."
    );
  }
  const contentStart = start + startMarker.length;
  const end = sourceText.indexOf("\n];", contentStart);
  if (end === -1) {
    throw new Error("route.ts의 sources 배열 종료 지점을 찾지 못했습니다.");
  }
  return sourceText.slice(contentStart, end);
}

function extractExistingNames(sourceText) {
  const sourcesBlock = extractSourcesArrayBlock(sourceText);
  const names = new Set();
  const regex = /name\s*:\s*"((?:[^"\\]|\\.)*)"/g;
  let match;
  while ((match = regex.exec(sourcesBlock)) !== null) {
    const raw = match[1].replace(/\\"/g, '"');
    names.add(raw.trim());
  }
  return names;
}

// ---------------------------------------------------------------------------
// 파일럿 레코드 로드 및 필터링
// ---------------------------------------------------------------------------

function pilotRecordKey(record) {
  return record.recordKey || `${record.denomination || ""}|${record.name}|${record.region || ""}|${record.address || ""}`;
}

function loadPilotRecords(pilotJson) {
  const records = Array.isArray(pilotJson?.records) ? pilotJson.records : [];
  return records;
}

function dedupeCanonicalRecords(records) {
  const map = new Map();
  for (const record of records) {
    if (!record?.name) continue;
    const key = pilotRecordKey(record);
    if (!map.has(key)) {
      map.set(key, record);
    }
  }
  return [...map.values()];
}

function alreadyHasYoutubeLead(record) {
  const hasChannelId =
    Array.isArray(record.youtubeChannelIds) && record.youtubeChannelIds.length > 0;
  const hasHandleLead = Boolean(record.youtubeHandleLead);
  return hasChannelId || hasHandleLead;
}

// ---------------------------------------------------------------------------
// YouTube InnerTube 검색 결과 파싱 (JSON 응답)
// ---------------------------------------------------------------------------

function collectTextRuns(textObj) {
  if (!textObj) return "";
  if (typeof textObj === "string") return textObj;
  if (typeof textObj.simpleText === "string") return textObj.simpleText;
  if (Array.isArray(textObj.runs)) {
    return textObj.runs.map((run) => run.text || "").join("");
  }
  return "";
}

/** InnerTube 검색 응답 트리를 재귀 순회하며 videoRenderer/channelRenderer만 수집 */
function collectSearchResults(node, out, seen, depth = 0) {
  if (!node || typeof node !== "object" || depth > 40) return;

  if (Array.isArray(node)) {
    for (const item of node) collectSearchResults(item, out, seen, depth + 1);
    return;
  }

  if (node.videoRenderer) {
    const vr = node.videoRenderer;
    const videoId = vr.videoId;
    if (videoId && !seen.videos.has(videoId)) {
      seen.videos.add(videoId);
      const descriptionSnippets = [
        collectTextRuns(vr.detailedMetadataSnippets?.[0]?.snippetText),
        collectTextRuns(vr.descriptionSnippet),
      ].filter(Boolean);

      out.videos.push({
        videoId,
        title: collectTextRuns(vr.title),
        channelId: vr.ownerText?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId || null,
        channelTitle: collectTextRuns(vr.ownerText) || collectTextRuns(vr.longBylineText),
        publishedTimeText: collectTextRuns(vr.publishedTimeText),
        descriptionSnippets,
      });
    }
  }

  if (node.channelRenderer) {
    const cr = node.channelRenderer;
    const channelId = cr.channelId;
    if (channelId && !seen.channels.has(channelId)) {
      seen.channels.add(channelId);
      const canonicalUrl =
        cr.navigationEndpoint?.browseEndpoint?.canonicalBaseUrl ||
        cr.navigationEndpoint?.commandMetadata?.webCommandMetadata?.url ||
        null;

      out.channels.push({
        channelId,
        title: collectTextRuns(cr.title),
        handleOrUrl: canonicalUrl,
      });
    }
  }

  for (const key of Object.keys(node)) {
    if (key === "videoRenderer" || key === "channelRenderer") continue;
    collectSearchResults(node[key], out, seen, depth + 1);
  }
}

function parseSearchResults(data) {
  if (!data) return { videos: [], channels: [] };

  const out = { videos: [], channels: [] };
  const seen = { videos: new Set(), channels: new Set() };
  collectSearchResults(data, out, seen);
  return out;
}

// ---------------------------------------------------------------------------
// 상대 게시 시각 → 대략적 경과일 변환 (보수적)
// ---------------------------------------------------------------------------

function estimateAgeDaysFromRelativeText(text) {
  if (!text) return null;

  const isoMatch = text.match(/\d{4}-\d{2}-\d{2}/);
  if (isoMatch) {
    const date = new Date(isoMatch[0]);
    if (!Number.isNaN(date.getTime())) {
      return Math.floor((Date.now() - date.getTime()) / 86_400_000);
    }
  }

  const relMatch = text.match(/(\d+)\s*(시간|일|주|개월|년)\s*전/);
  if (!relMatch) return null;

  const n = Number.parseInt(relMatch[1], 10);
  const unit = relMatch[2];
  const unitDays = {
    "시간": 1, // 시간 단위는 보수적으로 1일로 취급
    "일": 1,
    "주": 7,
    "개월": 30,
    "년": 365,
  };

  return n * (unitDays[unit] ?? null);
}

function isSermonLikeTitle(title) {
  if (!title) return false;
  return SERMON_KEYWORDS.some((kw) => title.includes(kw));
}

// ---------------------------------------------------------------------------
// 목사명/부서 채널/지역 충돌 판별 (보수적)
// ---------------------------------------------------------------------------

// "목사"/"담임목사"/"신부"/"사제"/"주교" 앞의 2~4음절 한글 토큰을 이름
// 후보로 추출한다. 직함·부서를 가리키는 일반 어휘는 이름이 아니므로 노이즈
// 목록으로 걸러낸다. 성공회 등에서는 인명과 직함 사이에 "엘리야"/"바우로"
// 같은 세례명이 끼어들 수 있어(예: "계성남 바우로 사제"), 직함 직전의
// 2~6음절 토큰 하나를 세례명 노이즈로 선택적으로 허용한다.
const PASTOR_ROLE_NOISE_WORDS = new Set([
  "담임", "위임", "원로", "협동", "전도", "심방", "행정", "선교", "교육",
  "수석", "부", "청년부", "교구", "당회장", "시무", "동사", "찬양", "미디어",
]);

function extractPastorNameCandidates(text) {
  if (!text) return [];
  const names = new Set();
  const regex = /([가-힣]{2,4})\s*(?:[가-힣]{2,6}\s+)?(?:담임)?(?:목사|신부|사제|주교)/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const candidate = match[1].trim();
    if (!candidate || candidate.length < 2) continue;
    if (PASTOR_ROLE_NOISE_WORDS.has(candidate)) continue;
    names.add(candidate);
  }
  return [...names];
}

/**
 * 대상 목사가 확인된 경우, 근거 텍스트에 대상 목사명이 전혀 언급되지 않고
 * 다른 목사명이 발견되면 명시적 불일치로 판정한다. 목사 미상 레코드는
 * 판정하지 않는다(null 반환).
 */
function detectPastorMismatch(record, evidenceTexts) {
  const targetPastor = stripPastorSuffix(record.pastor);
  if (!targetPastor) return null;

  const combinedText = evidenceTexts.join(" \n ");
  if (combinedText.includes(targetPastor)) return null;

  const otherNames = new Set();
  for (const text of evidenceTexts) {
    for (const name of extractPastorNameCandidates(text)) {
      if (name !== targetPastor) otherNames.add(name);
    }
  }
  if (otherNames.size === 0) return null;
  return [...otherNames][0];
}

const DEPARTMENT_CHANNEL_KEYWORDS = [
  "유아부", "유치부", "영아부", "초등부", "중등부", "고등부", "청년부",
  "대학부", "찬양대", "방송실", "미디어", "밴드", "교회학교", "주일학교", "소년부",
];

/**
 * 채널명 자체가 부서 채널이거나, 최근 영상 제목의 절반 이상이 부서 관련
 * 키워드를 포함하면(=본교회 채널이 아니라 부서 채널이 지배적 증거일 때)
 * 부서 채널로 판정한다.
 */
function detectDepartmentChannel(channelTitle, videos) {
  if (channelTitle) {
    const titleHit = DEPARTMENT_CHANNEL_KEYWORDS.find((kw) => channelTitle.includes(kw));
    if (titleHit) return titleHit;
  }
  if (!videos.length) return null;

  const hitCounts = new Map();
  for (const video of videos) {
    const text = video.title || "";
    for (const kw of DEPARTMENT_CHANNEL_KEYWORDS) {
      if (text.includes(kw)) hitCounts.set(kw, (hitCounts.get(kw) || 0) + 1);
    }
  }
  for (const [kw, count] of hitCounts.entries()) {
    if (count / videos.length >= 0.5) return kw;
  }
  return null;
}

// 대상 지역과 뚜렷이 구분되는 타 시/구/동 지명 토큰. 보수적으로 유지하기
// 위해, 대상 region 또는 address 문자열에 포함된 토큰과 겹치면 충돌로
// 취급하지 않는다.
const REGION_CONFLICT_TOKENS = [
  "서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종",
  "수원", "성남", "부천", "안양", "안산", "고양", "용인", "화성", "평택", "의정부",
  "계양구", "계양", "계산", "부평구", "부평", "남동구", "연수구", "미추홀구",
  "강남구", "강북구", "강서구", "강동구", "마포구", "영등포구", "종로구", "용산구",
  "성북구", "노원구", "도봉구", "은평구", "서대문구", "양천구", "구로구", "금천구",
  "동작구", "관악구", "송파구", "분당", "일산", "판교",
  "춘천", "원주", "속초", "동해", "삼척", "태백",
  "목포", "여수", "순천", "전주", "군산", "익산",
  "창원", "진주", "포항", "경주", "안동", "구미", "김해", "거제", "제주",
];

// 대상 지역 근거는 광역 region 문자열뿐 아니라 상세 address도 포함해야
// 한다. region이 "경기"처럼 광역 단위만 표기된 레코드는 address(예: "화성시
// ○○동")에 담긴 시/군/구 지명이 있어야만 "화성" 같은 토큰이 실제로는 같은
// 레코드를 가리킨다는 사실을 판별할 수 있다. address를 누락하면 같은 지역
// 교회를 지역 불일치로 오판(false positive)하게 된다.
function detectRegionConflict(record, evidenceTexts) {
  const regionTokens = [record.region || "", record.address || ""]
    .join(" ")
    .split(/\s+/)
    .map(normalizeForCompare)
    .filter(Boolean);
  if (regionTokens.length === 0) return null;

  // 성직자 이름 안의 지명 문자열(예: "계성남"의 "성남")을 지역 충돌로
  // 오인하지 않도록, 확인된 담당 성직자 이름은 지역 검사 텍스트에서 제외한다.
  const targetPastor = stripPastorSuffix(record.pastor);
  const rawEvidenceText = evidenceTexts.join(" \n ");
  const combinedText = targetPastor
    ? rawEvidenceText.replaceAll(targetPastor, "")
    : rawEvidenceText;
  for (const token of REGION_CONFLICT_TOKENS) {
    if (!combinedText.includes(token)) continue;
    const normalizedToken = normalizeForCompare(token);
    const isPartOfTargetRegion = regionTokens.some(
      (rt) => rt.includes(normalizedToken) || normalizedToken.includes(rt)
    );
    if (isPartOfTargetRegion) continue;
    return token;
  }
  return null;
}

function extractCityToken(region) {
  if (!region || region === "지역 확인 필요") return null;
  const parts = region.trim().split(/\s+/).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : null;
}

function collectEvidenceTexts(channelTitle, videos) {
  const texts = [channelTitle || ""];
  for (const video of videos) {
    if (video.title) texts.push(video.title);
    if (Array.isArray(video.descriptionSnippets)) texts.push(...video.descriptionSnippets);
  }
  return texts.filter(Boolean);
}

// ---------------------------------------------------------------------------
// 채널 후보 스코어링 (보수적)
// ---------------------------------------------------------------------------

function buildSearchQuery(record) {
  const pastorName = stripPastorSuffix(record.pastor);
  const parts = [record.name, pastorName, record.region, "예배"].filter(Boolean);
  return parts.join(" ");
}

function buildChurchScopedResults(searchResults) {
  const videosByChannel = new Map();
  for (const video of searchResults.videos) {
    if (!video.channelId) continue;
    if (!videosByChannel.has(video.channelId)) videosByChannel.set(video.channelId, []);
    videosByChannel.get(video.channelId).push(video);
  }
  return videosByChannel;
}

function scoreChannelCandidate(record, channelId, channelTitle, videos, handleOrUrl = null) {
  const signals = [];
  let score = 0;

  const nameMatchesTitle = namesMatch(channelTitle, record.name);
  if (nameMatchesTitle) {
    signals.push("channel_title_exact_match");
    score += 3;
  }

  const exactNameVideoCount = videos.filter((v) => namesMatch(v.title, record.name) ||
    (v.title && v.title.includes(record.name))).length;
  if (exactNameVideoCount >= 2) {
    signals.push("multiple_recent_titles_exact_name");
    score += 3;
  }

  const pastorName = stripPastorSuffix(record.pastor);
  const pastorMentioned = videos.some((v) =>
    (v.title && pastorName && v.title.includes(pastorName)) ||
    v.descriptionSnippets.some((s) => pastorName && s.includes(pastorName))
  );
  if (pastorMentioned) {
    signals.push("pastor_name_supporting");
    score += 1;
  }

  const regionMentioned = Boolean(
    record.region &&
      record.region !== "지역 확인 필요" &&
      videos.some(
        (v) =>
          (v.title && v.title.includes(record.region)) ||
          v.descriptionSnippets.some((s) => s.includes(record.region))
      )
  );
  if (regionMentioned) {
    signals.push("region_match_supporting");
    score += 1;
  }

  const cityToken = extractCityToken(record.region);
  const titleIncludesCityToken = Boolean(
    cityToken && channelTitle && channelTitle.includes(cityToken)
  );
  if (titleIncludesCityToken) {
    signals.push("channel_title_includes_city_token");
    score += 1;
  }

  const leadMatchesChannel = Boolean(
    (Array.isArray(record.youtubeChannelIds) && record.youtubeChannelIds.includes(channelId)) ||
    (record.youtubeHandleLead && handleOrUrl && handleOrUrl.includes(record.youtubeHandleLead))
  );
  if (leadMatchesChannel) {
    signals.push("existing_lead_match");
    score += 2;
  }

  // 소유권 근거(채널명/영상 제목의 정확한 교회명 일치)만으로는 후보로 인정하지
  // 않는다. 목사명·지역·기존 단서·도시 토큰 중 최소 하나의 독립 근거가 있어야
  // "passesOwnership"으로 취급한다.
  const ownershipNameEvidence = nameMatchesTitle || exactNameVideoCount >= 2;
  const independentSupport =
    pastorMentioned || regionMentioned || leadMatchesChannel || titleIncludesCityToken;
  const passesOwnership = ownershipNameEvidence && independentSupport;

  return {
    channelId,
    channelTitle,
    handleOrUrl,
    score,
    signals,
    ownershipNameEvidence,
    independentSupport,
    passesOwnership,
  };
}

function findRecentSermonVideo(videos) {
  for (const video of videos) {
    const ageDays = estimateAgeDaysFromRelativeText(video.publishedTimeText);
    if (ageDays !== null && ageDays <= RECENT_WINDOW_DAYS && isSermonLikeTitle(video.title)) {
      return { video, ageDays };
    }
  }
  return null;
}

function toEvidenceVideoList(videos) {
  return videos.slice(0, 5).map((v) => ({
    videoId: v.videoId,
    title: v.title,
    publishedTimeText: v.publishedTimeText,
    estimatedAgeDays: estimateAgeDaysFromRelativeText(v.publishedTimeText),
  }));
}

function evaluateRecord(record, searchResults) {
  const videosByChannel = buildChurchScopedResults(searchResults);

  const candidates = [];
  for (const [channelId, videos] of videosByChannel.entries()) {
    const channelTitle = videos[0]?.channelTitle || "";
    candidates.push(scoreChannelCandidate(record, channelId, channelTitle, videos));
  }

  for (const channel of searchResults.channels) {
    if (videosByChannel.has(channel.channelId)) continue;
    candidates.push(
      scoreChannelCandidate(record, channel.channelId, channel.title, [], channel.handleOrUrl)
    );
  }

  candidates.sort((a, b) => b.score - a.score);
  const best =
    candidates.find((c) => c.passesOwnership) ||
    candidates.find((c) => c.ownershipNameEvidence) ||
    candidates[0] ||
    null;

  if (!best) {
    return {
      status: "hold",
      holdReason: "no_channel_found",
      channel: null,
      recentCandidate: false,
      evidenceVideos: [],
    };
  }

  const channelVideos = videosByChannel.get(best.channelId) || [];

  if (!best.passesOwnership) {
    return {
      status: "hold",
      holdReason: best.ownershipNameEvidence ? "identity_support_missing" : "ownership_unverified",
      channel: best,
      recentCandidate: false,
      evidenceVideos: toEvidenceVideoList(channelVideos),
    };
  }

  const evidenceTexts = collectEvidenceTexts(best.channelTitle, channelVideos);

  const pastorMismatchName = detectPastorMismatch(record, evidenceTexts);
  if (pastorMismatchName) {
    return {
      status: "hold",
      holdReason: "pastor_mismatch",
      channel: best,
      recentCandidate: false,
      evidenceVideos: toEvidenceVideoList(channelVideos),
    };
  }

  const departmentKeyword = detectDepartmentChannel(best.channelTitle, channelVideos);
  if (departmentKeyword) {
    return {
      status: "hold",
      holdReason: "department_channel",
      channel: best,
      recentCandidate: false,
      evidenceVideos: toEvidenceVideoList(channelVideos),
    };
  }

  const regionConflictToken = detectRegionConflict(record, evidenceTexts);
  if (regionConflictToken) {
    return {
      status: "hold",
      holdReason: "region_mismatch",
      channel: best,
      recentCandidate: false,
      evidenceVideos: toEvidenceVideoList(channelVideos),
    };
  }

  const recentSermon = findRecentSermonVideo(channelVideos);

  return {
    status: recentSermon ? "candidate" : "hold",
    holdReason: recentSermon ? null : "no_recent_sermon_upload",
    channel: best,
    recentCandidate: Boolean(recentSermon),
    evidenceVideos: toEvidenceVideoList(channelVideos),
  };
}

// ---------------------------------------------------------------------------
// 체크포인트
// ---------------------------------------------------------------------------

async function saveCheckpointAtomic(checkpointPath, state) {
  const tmpPath = `${checkpointPath}.tmp`;
  await writeFile(tmpPath, JSON.stringify(state, null, 2), "utf8");
  await rename(tmpPath, checkpointPath);
}

async function loadCheckpoint(checkpointPath) {
  try {
    const text = await readFile(checkpointPath, "utf8");
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function saveOutputAtomic(outputPath, data) {
  const tmpPath = `${outputPath}.tmp`;
  await writeFile(tmpPath, JSON.stringify(data, null, 2), "utf8");
  await rename(tmpPath, outputPath);
}

// ---------------------------------------------------------------------------
// 메인
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  if (!args.input || !args.output) {
    console.error("[오류] --input과 --output은 필수입니다. --help를 참고하세요.");
    process.exitCode = 1;
    return;
  }

  const pilotText = await readFile(args.input, "utf8");
  const pilotJson = JSON.parse(pilotText);
  const existingNames = args.sources === "none"
    ? new Set()
    : extractExistingNames(await readFile(args.sources, "utf8"));

  const rawRecords = loadPilotRecords(pilotJson);
  const inputRecordCount = rawRecords.length;

  const afterExistingFilter = rawRecords.filter(
    (r) => r?.name && !existingNames.has(r.name)
  );
  const excludedExisting = inputRecordCount - afterExistingFilter.length;

  // 담임목사 미상 레코드와 홈페이지 연결 유튜브 단서가 이미 있는 레코드도
  // "미등록 파일럿 교회 전수 조사" 대상에서 제외하지 않는다. 이름+지역으로
  // 검색하고, 기존 단서는 참고 증거로만 결과에 함께 남긴다.
  const canonicalRecords = dedupeCanonicalRecords(afterExistingFilter);
  const dedupedSearchTargets = canonicalRecords.length;
  const missingPastorTargets = canonicalRecords.filter((r) => {
    const pastor = (r.pastor || "").trim();
    return !pastor || pastor === "담임목사 확인 필요";
  }).length;
  const existingLeadTargets = canonicalRecords.filter(alreadyHasYoutubeLead).length;

  let targets = canonicalRecords;
  if (args.maxRecords) {
    targets = targets.slice(0, args.maxRecords);
  }

  let checkpoint = null;
  const processedKeys = new Set();
  const results = [];

  if (args.resume) {
    checkpoint = await loadCheckpoint(args.checkpoint);
    if (checkpoint?.results) {
      let carriedErrors = 0;
      for (const r of checkpoint.results) {
        // 오류(error != null)로 끝난 행은 미해결로 간주하고, 이번 실행에서
        // 다시 시도해 기존 오류 결과를 교체한다(건너뛰지 않는다).
        if (r.error != null) {
          carriedErrors += 1;
          continue;
        }
        results.push(r);
        processedKeys.add(r.recordKey);
      }
      progress(
        `체크포인트에서 재개: 기존 완료 ${results.length}건, 재시도 대상(오류) ${carriedErrors}건`
      );
    }
  }

  const remaining = targets.filter((r) => !processedKeys.has(pilotRecordKey(r)));

  progress(
    `대상 확정: 입력 ${inputRecordCount}건 → 기등록 제외 ${excludedExisting}건, ` +
      `중복 제거 후 미등록 조사 대상 ${dedupedSearchTargets}건 ` +
      `(담임목사 미상 ${missingPastorTargets}건 포함, 기존 유튜브 단서 보유 ${existingLeadTargets}건 포함, 이번 실행 처리 예정 ${remaining.length}건)`
  );

  const rateGate = createRateGate(args.delayMs);

  let shuttingDown = false;
  async function handleSignal(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    progress(`${signal} 수신, 체크포인트 저장 후 종료합니다.`);
    await saveCheckpointAtomic(args.checkpoint, {
      savedAt: new Date().toISOString(),
      results,
    });
    process.exit(1);
  }
  process.on("SIGINT", () => handleSignal("SIGINT"));
  process.on("SIGTERM", () => handleSignal("SIGTERM"));

  async function processRecord(record) {
    const recordKey = pilotRecordKey(record);
    const query = buildSearchQuery(record);

    try {
      const searchResults = await searchYoutubeWithRetry(query, rateGate);
      const evaluation = evaluateRecord(record, searchResults);

      return {
        recordKey,
        query,
        name: record.name,
        pastor: record.pastor,
        region: record.region,
        address: record.address ?? null,
        denomination: record.denomination,
        status: evaluation.status,
        channelId: evaluation.channel?.channelId ?? null,
        channelTitle: evaluation.channel?.channelTitle ?? null,
        channelUrl: evaluation.channel?.channelId
          ? `https://www.youtube.com/channel/${evaluation.channel.channelId}`
          : null,
        score: evaluation.channel?.score ?? 0,
        signals: evaluation.channel?.signals ?? [],
        recentCandidate: evaluation.recentCandidate,
        evidenceVideos: evaluation.evidenceVideos,
        holdReason: evaluation.holdReason,
        sourceEvidence: {
          directorySourceUrl: record.evidence?.directorySourceUrl ?? null,
          sourceRegionQuery: record.evidence?.sourceRegionQuery ?? null,
          homepage: record.homepage ?? null,
          homepageStatus: record.homepageStatus ?? null,
          existingYoutubeChannelIds: record.youtubeChannelIds ?? null,
          existingYoutubeHandleLead: record.youtubeHandleLead ?? null,
        },
        error: null,
      };
    } catch (error) {
      // 네트워크/검색 오류는 판정을 내리지 못한 미해결(unresolved) 상태이며,
      // 조사를 마친 hold(보류)와는 구분한다. --resume 시 재시도 대상이 된다.
      return {
        recordKey,
        query,
        name: record.name,
        pastor: record.pastor,
        region: record.region,
        address: record.address ?? null,
        denomination: record.denomination,
        status: "error",
        channelId: null,
        channelTitle: null,
        channelUrl: null,
        score: 0,
        signals: [],
        recentCandidate: false,
        evidenceVideos: [],
        holdReason: null,
        sourceEvidence: {
          directorySourceUrl: record.evidence?.directorySourceUrl ?? null,
          sourceRegionQuery: record.evidence?.sourceRegionQuery ?? null,
          homepage: record.homepage ?? null,
          homepageStatus: record.homepageStatus ?? null,
          existingYoutubeChannelIds: record.youtubeChannelIds ?? null,
          existingYoutubeHandleLead: record.youtubeHandleLead ?? null,
        },
        error: error.message,
      };
    }
  }

  let cursor = 0;
  async function worker() {
    while (cursor < remaining.length && !shuttingDown) {
      const index = cursor;
      cursor += 1;
      const record = remaining[index];
      const result = await processRecord(record);
      results.push(result);
      processedKeys.add(result.recordKey);

      progress(
        `[${results.length}/${targets.length}] ${result.name}: ${result.status}` +
          (result.holdReason ? ` (${result.holdReason})` : "") +
          (result.error ? ` (오류: ${result.error})` : "")
      );

      if (results.length % 20 === 0) {
        await saveCheckpointAtomic(args.checkpoint, {
          savedAt: new Date().toISOString(),
          results,
        });
        progress(`체크포인트 저장: ${results.length}건 처리됨`);
      }
    }
  }

  const workerCount = Math.min(MAX_CONCURRENCY, remaining.length || 1);
  await Promise.all(Array.from({ length: workerCount }, worker));

  if (shuttingDown) return;

  await saveCheckpointAtomic(args.checkpoint, {
    savedAt: new Date().toISOString(),
    results,
  });

  const candidateCount = results.filter((r) => r.status === "candidate").length;
  const holdCount = results.filter((r) => r.status === "hold").length;
  // 오류 건수는 이번 실행 중 발생한 건이 아니라, 최종 results에 남아 있는
  // 미해결(error != null) 행 전체를 기준으로 산출한다.
  const errorCount = results.filter((r) => r.error != null).length;

  const output = {
    metadata: {
      input: args.input,
      sources: args.sources,
      inputRecords: inputRecordCount,
      excludedExisting,
      canonicalUnregisteredSearchTargets: dedupedSearchTargets,
      missingPastorTargets,
      existingYoutubeLeadTargets: existingLeadTargets,
      processed: results.length,
      candidate: candidateCount,
      hold: holdCount,
      errors: errorCount,
      generatedAt: new Date().toISOString(),
    },
    results,
  };

  await saveOutputAtomic(args.output, output);
  progress(
    `완료: 처리 ${results.length}건 (candidate ${candidateCount}, hold ${holdCount}, error ${errorCount}). ` +
      `결과 저장: ${args.output}`
  );
}

main().catch(async (error) => {
  console.error(`${nowKstLabel("collector")} [실패] ${error.message}`);
  process.exitCode = 1;
});
