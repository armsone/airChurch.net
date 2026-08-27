#!/usr/bin/env node

/**
 * discover-pck-tonghap.mjs
 *
 * 대한예수교장로회 통합(PCK) 공식 교회 주소록(new.pck.or.kr/address.php)에서
 * 공개된 교회 정보를 조회 지역 단위로 수집하고, 선택적으로 홈페이지에서
 * 공개 유튜브 채널 정보를 함께 확인하는 조사 전용 CLI.
 *
 * 개인정보(이메일·팩스·휴대전화)는 수집·출력하지 않는다.
 * 네트워크 의존 도구이므로 --max-pages로 범위를 제한해 먼저 검증할 것.
 */

import { writeFile } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";

const SOURCE_BASE = "https://new.pck.or.kr/address.php";
const USER_AGENT =
  "AirChurchDiscoveryBot/0.1 (public church directory research)";

const DEFAULT_REGIONS = [
  "서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종",
  "경기", "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주",
];

const DEFAULT_DELAY_MS = 700;
const DEFAULT_MAX_PAGES = 200; // 지역당 안전 상한(무한 페이지네이션 방지용 하드 캡)
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_CONCURRENCY = 2;
const DENOMINATION = "대한예수교장로회 통합";

function printHelp() {
  console.log(`discover-pck-tonghap.mjs

PCK 통합 교회 주소록(new.pck.or.kr)에서 공개 교회 정보를 조사 목적으로 수집합니다.
개인정보(이메일·팩스)는 수집하지 않습니다. 실행 전 --max-pages로 범위를 제한해 검증하세요.

사용법:
  node scripts/discover-pck-tonghap.mjs [옵션]

옵션:
  --region <키워드>      조회할 지역 키워드. 여러 번 지정 가능. 생략 시 17개 광역 지역 기본값 사용.
  --max-pages <n>        지역당 최대 조회 페이지 수 (기본: ${DEFAULT_MAX_PAGES})
  --delay-ms <n>         같은 도메인 요청 간 최소 지연(ms) (기본: ${DEFAULT_DELAY_MS}, 최소 700 권장)
  --output <path>        결과 JSON을 저장할 파일 경로. 생략 시 표준출력에 출력.
  --enrich-youtube       검증된 홈페이지에서 공개 유튜브 채널 정보를 추가로 조사(선택, 느려짐).
  --help                 이 도움말을 출력하고 종료.

예시:
  node scripts/discover-pck-tonghap.mjs --region 서울 --max-pages 2
  node scripts/discover-pck-tonghap.mjs --output out/pck-tonghap.json --enrich-youtube
`);
}

function parseArgs(argv) {
  const args = {
    regions: [],
    maxPages: DEFAULT_MAX_PAGES,
    delayMs: DEFAULT_DELAY_MS,
    output: null,
    enrichYoutube: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    switch (token) {
      case "--region":
        args.regions.push(argv[++i]);
        break;
      case "--max-pages": {
        const n = Number.parseInt(argv[++i], 10);
        if (Number.isFinite(n) && n > 0) args.maxPages = n;
        break;
      }
      case "--delay-ms": {
        const n = Number.parseInt(argv[++i], 10);
        if (Number.isFinite(n) && n >= 0) args.delayMs = n;
        break;
      }
      case "--output":
        args.output = argv[++i];
        break;
      case "--enrich-youtube":
        args.enrichYoutube = true;
        break;
      case "--help":
      case "-h":
        args.help = true;
        break;
      default:
        // 알 수 없는 인자는 조용히 무시하지 않고 사용자에게 알린다.
        console.error(`[경고] 알 수 없는 인자를 무시합니다: ${token}`);
    }
  }

  if (args.regions.length === 0) args.regions = [...DEFAULT_REGIONS];
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

/** 같은 도메인에 대한 요청 간격을 보장하는 간단한 게이트키퍼 */
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

async function fetchWithTimeout(url, { timeoutMs = REQUEST_TIMEOUT_MS } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": USER_AGENT, Accept: "text/html,*/*" },
      redirect: "follow",
    });
  } finally {
    clearTimeout(timer);
  }
}

/** 429/5xx에 한해 1회만 백오프 재시도. 그 외 상태코드는 즉시 실패로 취급. */
async function fetchWithRetry(url, options) {
  let response;
  try {
    response = await fetchWithTimeout(url, options);
  } catch (error) {
    return { ok: false, error, status: null };
  }

  if (response.status === 429 || response.status >= 500) {
    await sleep(1500);
    try {
      response = await fetchWithTimeout(url, options);
    } catch (error) {
      return { ok: false, error, status: null };
    }
  }

  return { ok: response.ok, status: response.status, response };
}

// ---------------------------------------------------------------------------
// HTML 파싱: 경량 정규식 기반. 공식 페이지 구조(rowspan=4, 4행 1레코드)에 맞춤.
// DOM 파서 의존성을 새로 추가하지 않기 위해 문자열 처리로 구현한다.
// ---------------------------------------------------------------------------

function stripTags(html) {
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function extractCells(rowHtml) {
  const cells = [];
  const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
  let match;
  while ((match = cellRegex.exec(rowHtml)) !== null) {
    cells.push(stripTags(match[1]));
  }
  return cells;
}

function extractHref(rowHtml) {
  const match = rowHtml.match(/href\s*=\s*["']([^"']+)["']/i);
  return match ? match[1].trim() : null;
}

/** church 테이블 tbody 안의 <tr>...</tr> 목록만 순서대로 추출 */
function extractRows(html) {
  const rows = [];
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let match;
  while ((match = rowRegex.exec(html)) !== null) {
    rows.push(match[0]);
  }
  return rows;
}

function normalizeChurchName(rawName) {
  const trimmed = rawName.trim();
  // "교회"가 이미 접미사면 중복 부여하지 않고, 없으면 한 번만 붙인다.
  if (trimmed.endsWith("교회")) return trimmed;
  return `${trimmed}교회`;
}

function formatPastor(rawPastor) {
  const trimmed = (rawPastor || "").trim();
  if (!trimmed) return null;
  if (trimmed.endsWith("목사")) return trimmed;
  return `${trimmed} 목사`;
}

const REGION_PREFIX_MAP = [
  ["서울특별시", "서울"],
  ["부산광역시", "부산"],
  ["대구광역시", "대구"],
  ["인천광역시", "인천"],
  ["광주광역시", "광주"],
  ["대전광역시", "대전"],
  ["울산광역시", "울산"],
  ["세종특별자치시", "세종"],
  ["경기도", "경기"],
  ["강원특별자치도", "강원"],
  ["강원도", "강원"],
  ["충청북도", "충북"],
  ["충청남도", "충남"],
  ["전북특별자치도", "전북"],
  ["전라북도", "전북"],
  ["전라남도", "전남"],
  ["경상북도", "경북"],
  ["경상남도", "경남"],
  ["제주특별자치도", "제주"],
  ["서울", "서울"],
  ["부산", "부산"],
  ["대구", "대구"],
  ["인천", "인천"],
  ["광주", "광주"],
  ["대전", "대전"],
  ["울산", "울산"],
  ["세종", "세종"],
  ["경기", "경기"],
  ["강원", "강원"],
  ["충북", "충북"],
  ["충남", "충남"],
  ["전북", "전북"],
  ["전남", "전남"],
  ["경북", "경북"],
  ["경남", "경남"],
  ["제주", "제주"],
];

/** 주소 문자열에서 "서울 영등포" 같은 AirChurch 표기 지역을 추정한다. 불확실하면 null. */
function inferAirChurchRegion(address) {
  if (!address) return null;
  const trimmed = address.trim();

  let city = null;
  let rest = trimmed;
  for (const [prefix, label] of REGION_PREFIX_MAP) {
    if (trimmed.startsWith(prefix)) {
      city = label;
      rest = trimmed.slice(prefix.length).trim();
      break;
    }
  }
  if (!city) return null;

  const districtMatch = rest.match(/^([가-힣]+?(?:시|군|구))(?=\s|$)/);
  const KEEP_SUFFIX_DISTRICTS = ["동구", "서구", "남구", "북구", "중구"];
  const district = districtMatch
    ? (KEEP_SUFFIX_DISTRICTS.includes(districtMatch[1])
        ? districtMatch[1]
        : districtMatch[1].replace(/(?:시|군|구)$/, ""))
    : null;

  return district ? `${city} ${district}` : city;
}

/**
 * 4행 1레코드 구조에서 후보 레코드를 추출한다.
 * 1행: 노회, 교회명, 우편번호, 주소, 담임목사, 전화
 * 2~4행: 홈페이지, 팩스, 이메일 (이메일·팩스는 저장하지 않는다)
 */
function parseRecordsFromHtml(html, regionKeyword, evidenceUrl) {
  const rows = extractRows(html);
  const records = [];

  for (let i = 0; i < rows.length; i += 1) {
    if (!/rowspan\s*=\s*["']?4["']?/i.test(rows[i])) continue;

    const headRow = rows[i];
    const homepageRow = rows[i + 1] || "";
    // FAX/EMAIL 행(rows[i+2], rows[i+3])은 의도적으로 파싱하지 않는다.

    const cells = extractCells(headRow);
    if (cells.length < 6) continue;

    const [presbytery, rawName, postalCode, address, rawPastor, tel] = cells;
    if (!rawName) continue;

    const homepageText = stripTags(homepageRow);
    const hasNoHomepage = /홈페이지가\s*없습니다/.test(homepageText);
    let homepage = null;
    if (!hasNoHomepage) {
      const href = extractHref(homepageRow);
      if (href && /^https?:\/\//i.test(href)) {
        homepage = href.trim();
      } else if (/^https?:\/\//i.test(homepageText)) {
        homepage = homepageText.trim();
      }
    }

    const publicPhone = tel.replace(/^TEL\s*:\s*/i, "").trim().replace(/^--$/, "");

    records.push({
      denomination: DENOMINATION,
      presbytery: presbytery || null,
      name: normalizeChurchName(rawName),
      rawName: rawName.trim(),
      postalCode: postalCode || null,
      address: address || null,
      region: inferAirChurchRegion(address) || `지역미상(${regionKeyword})`,
      pastor: formatPastor(rawPastor),
      phone: publicPhone && !/^01\d/.test(publicPhone.replace(/[-\s]/g, "")) ? publicPhone : null,
      homepage,
      sourceUrl: evidenceUrl,
      sourceRegionQuery: regionKeyword,
    });
  }

  return records;
}

function buildDirectoryUrl(regionKeyword, page) {
  const url = new URL(SOURCE_BASE);
  url.searchParams.set("flag", "churchAddress");
  url.searchParams.set("sch", regionKeyword);
  url.searchParams.set("page", String(page));
  return url.toString();
}

/** 페이지 내용의 안정적 서명. 동일 서명이 반복되면 페이지네이션 종료로 간주. */
function pageSignature(records) {
  return records.map((r) => `${r.rawName}|${r.address}|${r.phone}`).join("\n");
}

async function collectRegion(regionKeyword, { maxPages, rateGate }) {
  const records = [];
  const seenSignatures = new Set();
  let previousSignature = null;

  for (let page = 1; page <= maxPages; page += 1) {
    await rateGate();
    const url = buildDirectoryUrl(regionKeyword, page);
    const result = await fetchWithRetry(url);

    if (!result.ok) {
      const detail = result.status != null ? `HTTP ${result.status}` : String(result.error);
      throw new Error(`디렉터리 응답 실패 (${regionKeyword}, page=${page}): ${detail}`);
    }

    const html = await result.response.text();
    const pageRecords = parseRecordsFromHtml(html, regionKeyword, url);

    if (pageRecords.length === 0) {
      progress(`${regionKeyword} page ${page}: 레코드 없음 → 종료`);
      break;
    }

    const signature = pageSignature(pageRecords);
    if (signature === previousSignature || seenSignatures.has(signature)) {
      progress(`${regionKeyword} page ${page}: 동일 내용 반복 감지 → 페이지네이션 종료`);
      break;
    }
    seenSignatures.add(signature);
    previousSignature = signature;

    records.push(...pageRecords);
    progress(`${regionKeyword} page ${page}: ${pageRecords.length}건 수집 (누적 ${records.length}건)`);

    if (page === maxPages) {
      progress(`${regionKeyword}: --max-pages 상한(${maxPages}) 도달, 이후 페이지는 조회하지 않음`);
    }
  }

  return records;
}

function dedupeRecords(records) {
  const map = new Map();
  for (const record of records) {
    const key = `${record.rawName}|${record.address}|${record.phone}`;
    if (!map.has(key)) map.set(key, record);
  }
  return [...map.values()];
}

// ---------------------------------------------------------------------------
// 유튜브 채널 힌트 추출 (검증된 홈페이지 HTML에서만, 검색은 하지 않음)
// ---------------------------------------------------------------------------

function extractYoutubeHints(html) {
  const channelIdSet = new Set();
  let handleLead = null;

  const channelPathRegex = /youtube\.com\/channel\/(UC[a-zA-Z0-9_-]{20,})/g;
  const liveStreamRegex = /youtube\.com\/embed\/live_stream\?channel=(UC[a-zA-Z0-9_-]{20,})/g;
  const handleRegex = /youtube\.com\/(@[a-zA-Z0-9_.-]+)/;

  for (const regex of [channelPathRegex, liveStreamRegex]) {
    let match;
    while ((match = regex.exec(html)) !== null) {
      channelIdSet.add(match[1]);
    }
  }

  if (channelIdSet.size === 0) {
    const handleMatch = html.match(handleRegex);
    if (handleMatch) {
      handleLead = `https://www.youtube.com/${handleMatch[1]}`;
    }
  }

  return { channelIds: [...channelIdSet], handleLead };
}

async function enrichHomepage(record, rateGate) {
  if (!record.homepage) {
    return { ...record, homepageStatus: "not-provided", youtube: null };
  }

  await rateGate();
  const result = await fetchWithRetry(record.homepage, { timeoutMs: REQUEST_TIMEOUT_MS });

  if (!result.ok) {
    const status =
      result.error && result.error.name === "AbortError" ? "timeout" : "unavailable";
    return { ...record, homepageStatus: status, youtube: null };
  }

  let youtube = null;
  try {
    const html = await result.response.text();
    const hints = extractYoutubeHints(html);
    if (hints.channelIds.length > 0 || hints.handleLead) {
      youtube = hints;
    }
  } catch {
    // 본문 판독 실패는 홈페이지 자체는 살아있는 것으로 보고 ok 유지, youtube만 비움
  }

  return { ...record, homepageStatus: "ok", youtube };
}

/** 최대 동시성 N으로 작업 목록을 처리 */
async function runWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;

  async function runOne() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, runOne);
  await Promise.all(workers);
  return results;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  progress(
    `수집 시작: 지역 ${args.regions.length}개, 지역당 최대 ${args.maxPages}페이지, 지연 ${args.delayMs}ms`
  );

  const directoryGate = createRateGate(args.delayMs);
  const homepageGate = createRateGate(args.delayMs);

  let allRecords = [];
  for (const region of args.regions) {
    try {
      const regionRecords = await collectRegion(region, {
        maxPages: args.maxPages,
        rateGate: directoryGate,
      });
      allRecords.push(...regionRecords);
    } catch (error) {
      console.error(`${nowKstLabel("collector")} [오류] ${region} 조회 중단: ${error.message}`);
      throw error;
    }
  }

  allRecords = dedupeRecords(allRecords);
  progress(`전 지역 수집 완료, 중복 제거 후 ${allRecords.length}건`);

  if (args.enrichYoutube) {
    const homepageRecords = allRecords.filter((r) => r.homepage);
    progress(`홈페이지 보강 시작: 대상 ${homepageRecords.length}건 (동시성 ${MAX_CONCURRENCY})`);

    const enriched = await runWithConcurrency(
      allRecords,
      MAX_CONCURRENCY,
      (record) => enrichHomepage(record, homepageGate)
    );
    allRecords = enriched;
  } else {
    allRecords = allRecords.map((r) => ({
      ...r,
      homepageStatus: r.homepage ? "unverified" : "not-provided",
      youtube: null,
    }));
  }

  allRecords.sort((a, b) => {
    const regionCompare = (a.region || "").localeCompare(b.region || "", "ko");
    if (regionCompare !== 0) return regionCompare;
    return (a.name || "").localeCompare(b.name || "", "ko");
  });

  const output = allRecords.map((r) => ({
    denomination: r.denomination,
    presbytery: r.presbytery,
    name: r.name,
    rawName: r.rawName,
    postalCode: r.postalCode,
    address: r.address,
    region: r.region,
    pastor: r.pastor,
    phone: r.phone,
    homepage: r.homepage,
    homepageStatus: r.homepageStatus,
    youtubeChannelIds: r.youtube?.channelIds ?? [],
    youtubeHandleLead: r.youtube?.handleLead ?? null,
    evidence: { directorySourceUrl: r.sourceUrl, sourceRegionQuery: r.sourceRegionQuery },
  }));

  const homepageCount = output.filter((r) => r.homepage).length;
  const youtubeChannelIdCount = output.reduce(
    (sum, r) => sum + r.youtubeChannelIds.length,
    0
  );
  const youtubeHandleLeadCount = output.filter((r) => r.youtubeHandleLead).length;

  const result = {
    metadata: {
      source: SOURCE_BASE,
      generatedAt: new Date().toISOString(),
      regions: args.regions,
      recordCount: output.length,
      homepageCount,
      youtubeChannelIdCount,
      youtubeHandleLeadCount,
      enrichYoutube: args.enrichYoutube,
    },
    records: output,
  };

  const json = JSON.stringify(result, null, 2);

  if (args.output) {
    await writeFile(args.output, json, "utf8");
    progress(`결과를 파일에 저장했습니다: ${args.output}`);
  } else {
    console.log(json);
  }

  progress(
    `완료: 레코드 ${result.metadata.recordCount}건, 홈페이지 ${homepageCount}건, ` +
      `유튜브 채널ID ${youtubeChannelIdCount}건, 핸들 단서 ${youtubeHandleLeadCount}건`
  );
}

main().catch((error) => {
  console.error(`${nowKstLabel("collector")} [실패] ${error.message}`);
  process.exitCode = 1;
});
