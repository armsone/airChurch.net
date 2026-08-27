#!/usr/bin/env node

/**
 * collect-five-denomination-directories.mjs
 *
 * 다섯 개 교단(고신·백석·합신·대신·기장)의 공식 공개 명부 소스만을 사용해
 * discover-youtube-only.mjs의 --input으로 그대로 전달 가능한 정규화 JSON
 * (최상위 records 배열)을 생성하는 리서치 전용 CLI.
 *
 * - 고신: 공식 페이지에 게시된 Google My Maps KML을 의존성 없이 직접 파싱한다.
 * - 기장(PROK): 공식 지도 API(https://server.prok.or.kr/api/map/churches)를
 *   직접 호출해 전체 목록을 정규화한다. API 응답을 받지 못할 때만 공식 SPA
 *   루트 HTML과 동일 출처 JS 번들에서 명시적으로 존재하는 동일 출처
 *   JSON/API URL을 검사하는 보수적 발견 로직으로 폴백한다. 추측 경로
 *   브루트포스, 브라우저 자동화, 우회는 절대 하지 않는다.
 * - 백석·합신·대신: 전수 공개 명부를 확인하지 못했거나 로그인이 필요하므로
 *   우회 없이 구조화된 blocked 결과로 보고한다.
 *
 * 이 스크립트는 조사 결과만 생성하며 앱 소스나 데이터베이스를 절대 수정하지
 * 않는다. 개인정보(전화·팩스·이메일·우편번호)는 수집·출력하지 않는다.
 */

import { writeFile, rename } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";

const DEFAULT_DELAY_MS = 500;
const REQUEST_TIMEOUT_MS = 20_000;
const MAX_ATTEMPTS = 3;
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

const DENOMINATIONS = {
  kosin: {
    id: "kosin",
    name: "대한예수교장로회 고신",
    officialPage: "http://kosin.org/page_KHkm38",
  },
  baekseok: {
    id: "baekseok",
    name: "대한예수교장로회 백석",
    officialPage: "https://pgak.net/contacts",
  },
  hapshin: {
    id: "hapshin",
    name: "대한예수교장로회 합신",
    officialPage: "http://www.hapshin.org",
  },
  daeshin: {
    id: "daeshin",
    name: "대한예수교장로회 대신",
    officialPage: "http://www.ds1961.com",
  },
  prok: {
    id: "prok",
    name: "한국기독교장로회",
    officialPage: "https://map.prok.or.kr",
  },
};

const DEFAULT_ORDER = ["kosin", "baekseok", "hapshin", "daeshin", "prok"];

// ---------------------------------------------------------------------------
// 공통 유틸
// ---------------------------------------------------------------------------

function nowKstLabel(actorTag) {
  const kst = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  const hh = String(kst.getHours()).padStart(2, "0");
  const mm = String(kst.getMinutes()).padStart(2, "0");
  return `[${hh}:${mm} KST · ${actorTag}]`;
}

function progress(message) {
  console.error(`${nowKstLabel("collector")} ${message}`);
}

function clean(value) {
  return value == null ? "" : String(value).normalize("NFKC").replace(/\s+/g, " ").trim();
}

function djb2Hex(text) {
  let hash = 5381;
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) + hash + text.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

function stableRecordKey(denominationId, name, address, fallback) {
  const basis = `${denominationId}::${clean(name)}::${clean(address) || clean(fallback) || ""}`;
  return `${denominationId}-${djb2Hex(basis)}`;
}

const PLACEHOLDER_URLS = new Set(["", "-", "--", "없음", "x", "n/a"]);

function normalizeHomepage(value) {
  const raw = clean(value);
  if (!raw || PLACEHOLDER_URLS.has(raw.toLowerCase())) return null;
  const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(candidate);
    if (!url.hostname.includes(".")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function formatPastor(value) {
  const pastor = clean(value);
  if (!pastor) return "담임목사 확인 필요";
  return pastor.endsWith("목사") ? pastor : `${pastor} 목사`;
}

function regionFromAddress(value) {
  const address = clean(value)
    .replace(/^\(?\d{3}-?\d{0,4}\)?\s*/, "")
    .replace(/^(서울|부산|대구|인천|광주|대전|울산)시(?=[가-힣]+구\s)/, "$1시 ")
    .replace(/^(경기|강원|충북|충남|전북|전남|경북|경남|제주)도(?=[가-힣]+(?:시|군|구)\s)/, "$1도 ");
  const aliases = [
    [/^서울(?:특별시|시)?\s+([^\s]+)/, "서울"], [/^부산(?:광역시|시)?\s+([^\s]+)/, "부산"],
    [/^대구(?:광역시|시)?\s+([^\s]+)/, "대구"], [/^인천(?:광역시|시)?\s+([^\s]+)/, "인천"],
    [/^광주(?:광역시|시)?\s+([^\s]+)/, "광주"], [/^대전(?:광역시|시)?\s+([^\s]+)/, "대전"],
    [/^울산(?:광역시|시)?\s+([^\s]+)/, "울산"], [/^세종(?:특별자치시|시)?(?:\s+([^\s]+))?/, "세종"],
    [/^경기(?:도)?\s+([^\s]+)/, "경기"], [/^강원(?:특별자치도|도)?\s+([^\s]+)/, "강원"],
    [/^(?:충청북도|충북)\s+([^\s]+)/, "충북"], [/^(?:충청남도|충남)\s+([^\s]+)/, "충남"],
    [/^(?:전북특별자치도|전라북도|전북)\s+([^\s]+)/, "전북"], [/^(?:전라남도|전남)\s+([^\s]+)/, "전남"],
    [/^(?:경상북도|경북)\s+([^\s]+)/, "경북"], [/^(?:경상남도|경남)\s+([^\s]+)/, "경남"],
    [/^제주(?:특별자치도)?\s+([^\s]+)/, "제주"],
  ];
  for (const [pattern, province] of aliases) {
    const match = address.match(pattern);
    if (match) return match[1] ? `${province} ${match[1].replace(/[시군구]$/, "")}` : province;
  }
  return "지역 확인 필요";
}

/** 공유 최소 요청 간격 게이트 (정중한 수집 속도 보장) */
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

/** 타임아웃 + 제한된 재시도(429/5xx/네트워크 오류만 백오프 재시도)를 적용한 공용 fetch */
async function fetchWithRetry(url, options, rateGate, maxAttempts = MAX_ATTEMPTS) {
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    await rateGate();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: { "User-Agent": USER_AGENT, ...(options?.headers || {}) },
      });
      clearTimeout(timer);

      if (response.ok) return response;

      lastError = new Error(`HTTP ${response.status}`);
      if ((response.status === 429 || response.status >= 500) && attempt < maxAttempts) {
        const retryAfterMs = response.status === 429 ? parseRetryAfterMs(response) : null;
        await sleep(retryAfterMs ?? 1000 * 2 ** (attempt - 1));
        continue;
      }
      throw lastError;
    } catch (error) {
      clearTimeout(timer);
      lastError = error;
      if (attempt < maxAttempts) {
        await sleep(1000 * 2 ** (attempt - 1));
        continue;
      }
      throw lastError;
    }
  }
  throw lastError ?? new Error("알 수 없는 요청 실패");
}

// ---------------------------------------------------------------------------
// XML/KML 파싱 유틸 (의존성 없이 정규식 기반, 네임스페이스 접두사 허용)
// ---------------------------------------------------------------------------

function decodeXmlEntities(text) {
  if (!text) return "";
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&amp;/g, "&")
    .replace(/<[^>]+>/g, "")
    .trim();
}

function extractTag(block, tagName) {
  const regex = new RegExp(`<(?:\\w+:)?${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:\\w+:)?${tagName}>`, "i");
  const match = block.match(regex);
  return match ? decodeXmlEntities(match[1]) : null;
}

function extractPlacemarkBlocks(kmlText) {
  const regex = /<(?:\w+:)?Placemark(?:\s[^>]*)?>([\s\S]*?)<\/(?:\w+:)?Placemark>/gi;
  const blocks = [];
  let match;
  while ((match = regex.exec(kmlText)) !== null) {
    blocks.push(match[1]);
  }
  return blocks;
}

function extractExtendedDataFields(block) {
  const fields = {};
  const extendedMatch = block.match(/<(?:\w+:)?ExtendedData>([\s\S]*?)<\/(?:\w+:)?ExtendedData>/i);
  if (!extendedMatch) return fields;
  const extended = extendedMatch[1];

  const simpleDataRegex = /<(?:\w+:)?SimpleData\s+name="([^"]*)"\s*>([\s\S]*?)<\/(?:\w+:)?SimpleData>/gi;
  let m;
  while ((m = simpleDataRegex.exec(extended)) !== null) {
    fields[decodeXmlEntities(m[1])] = decodeXmlEntities(m[2]);
  }

  const dataRegex = /<(?:\w+:)?Data\s+name="([^"]*)"\s*>([\s\S]*?)<\/(?:\w+:)?Data>/gi;
  while ((m = dataRegex.exec(extended)) !== null) {
    const key = decodeXmlEntities(m[1]);
    const valueMatch = m[2].match(/<(?:\w+:)?value>([\s\S]*?)<\/(?:\w+:)?value>/i);
    fields[key] = valueMatch ? decodeXmlEntities(valueMatch[1]) : decodeXmlEntities(m[2]);
  }

  return fields;
}

function pickField(fields, candidateKeys) {
  for (const key of candidateKeys) {
    const directHit = Object.keys(fields).find((k) => k === key);
    if (directHit && clean(fields[directHit])) return fields[directHit];
  }
  for (const key of candidateKeys) {
    const looseHit = Object.keys(fields).find((k) => k.includes(key));
    if (looseHit && clean(fields[looseHit])) return fields[looseHit];
  }
  return null;
}

function parseKmlPlacemarks(kmlText) {
  return extractPlacemarkBlocks(kmlText).map((block) => {
    const name = extractTag(block, "name");
    const description = extractTag(block, "description");
    const coordinates = extractTag(block, "coordinates");
    const fields = extractExtendedDataFields(block);
    return { name, description, coordinates, fields };
  });
}

// ---------------------------------------------------------------------------
// 고신: 공식 KML 전수 파싱
// ---------------------------------------------------------------------------

const KOSIN_KML_URL =
  "https://www.google.com/maps/d/kml?mid=1LMloYxSboEOFOhuvdEMgwqjgB_pRxLQ&forcekml=1";

const PASTOR_FIELD_KEYS = ["담임목사", "목사", "담임"];
const ADDRESS_FIELD_KEYS = ["교회 주소", "주소", "address", "Address"];
const PRESBYTERY_FIELD_KEYS = ["노회"];
const HOMEPAGE_FIELD_KEYS = ["홈페이지", "homepage", "웹사이트"];

async function collectKosin(rateGate) {
  const denomination = DENOMINATIONS.kosin;
  progress(`[고신] 공식 KML 요청: ${KOSIN_KML_URL}`);
  const response = await fetchWithRetry(KOSIN_KML_URL, { headers: { Accept: "application/vnd.google-earth.kml+xml, text/xml, */*" } }, rateGate);
  const kmlText = await response.text();
  const placemarks = parseKmlPlacemarks(kmlText);
  progress(`[고신] Placemark ${placemarks.length}건 파싱 완료`);

  const records = placemarks
    .filter((p) => clean(p.name))
    .map((p) => {
      const name = clean(p.name);
      const address = clean(pickField(p.fields, ADDRESS_FIELD_KEYS)) || null;
      const pastorRaw = pickField(p.fields, PASTOR_FIELD_KEYS);
      const presbytery = clean(pickField(p.fields, PRESBYTERY_FIELD_KEYS)) || null;
      const homepage = normalizeHomepage(pickField(p.fields, HOMEPAGE_FIELD_KEYS));
      return {
        denomination: denomination.name,
        presbytery,
        name,
        rawName: name,
        address,
        region: regionFromAddress(address),
        pastor: formatPastor(pastorRaw),
        homepage,
        homepageStatus: homepage ? "unverified" : "not-provided",
        youtubeChannelIds: [],
        youtubeHandleLead: homepage && /(youtube\.com|youtu\.be)/i.test(homepage) ? homepage : null,
        evidence: {
          directorySourceUrl: denomination.officialPage,
          sourceApiUrl: KOSIN_KML_URL,
          sourceRegionQuery: null,
        },
        recordKey: stableRecordKey(denomination.id, name, address, p.coordinates),
      };
    });

  return {
    id: denomination.id,
    name: denomination.name,
    status: "ok",
    source: denomination.officialPage,
    sourceApi: KOSIN_KML_URL,
    rawPlacemarkCount: placemarks.length,
    count: records.length,
    records,
  };
}

// ---------------------------------------------------------------------------
// 백석 / 합신 / 대신: 우회 없이 blocked 결과 보고
// ---------------------------------------------------------------------------

function blockedResult(id, reason, note) {
  const denomination = DENOMINATIONS[id];
  return {
    id: denomination.id,
    name: denomination.name,
    status: "blocked",
    source: denomination.officialPage,
    sourceApi: null,
    reason,
    note,
    count: 0,
    records: [],
  };
}

async function collectBaekseok() {
  progress("[백석] 공식 명부는 로그인 후에만 열람 가능해 우회 없이 blocked 처리합니다.");
  return blockedResult(
    "baekseok",
    "login_required",
    "https://pgak.net/contacts 는 로그인 세션이 있어야 명부를 조회할 수 있어, 우회 없이는 공개 데이터를 수집할 수 없다."
  );
}

async function collectHapshin() {
  progress("[합신] 전수 공개 명부를 확인하지 못해 blocked 처리합니다.");
  return blockedResult(
    "hapshin",
    "public_complete_directory_unavailable",
    "http://www.hapshin.org 에서 전 교회를 망라하는 공개 명부(검색/다운로드 가능한 전수 목록)를 확인하지 못했다."
  );
}

async function collectDaeshin() {
  progress("[대신] 전수 공개 명부를 확인하지 못해 blocked 처리합니다.");
  return blockedResult(
    "daeshin",
    "public_complete_directory_unavailable",
    "http://www.ds1961.com 에서 전 교회를 망라하는 공개 명부(검색/다운로드 가능한 전수 목록)를 확인하지 못했다."
  );
}

// ---------------------------------------------------------------------------
// 기장(PROK): 공식 지도 API 우선 + 보수적 발견 로직 폴백
//
// 1순위: 공식 지도 API(server.prok.or.kr)의 전체 교회 목록 엔드포인트를
// 직접 호출한다. 폐교회/숨김 레코드는 명시적 플래그와 이름/주소 텍스트로
// 제외한다. 개인정보(전화·팩스·이메일·우편번호)는 응답에 있어도 수집하지
// 않으며, 1,589곳 각각에 대한 상세 API 추가 호출도 하지 않는다.
//
// API 호출이 실패할 때만, 공식 SPA 루트 HTML에서 동일 출처 JS 자산 URL을
// 추출하고 그 번들 텍스트 안에 "명시적으로 존재하는" 동일 출처 JSON/API/data
// URL 후보만 검사하는 보수적 발견 로직으로 폴백한다. 추측 경로 브루트포스,
// 헤드리스 브라우저, 제3자 소스는 사용하지 않는다.
// ---------------------------------------------------------------------------

const PROK_ROOT = "https://map.prok.or.kr";
const PROK_OFFICIAL_API_URL = "https://server.prok.or.kr/api/map/churches";
const MAX_SCRIPT_ASSETS_TO_INSPECT = 6;
const MAX_CANDIDATE_ENDPOINTS_TO_TEST = 8;

function sameOriginUrl(candidate, origin) {
  try {
    const resolved = new URL(candidate, origin);
    return new URL(origin).origin === resolved.origin ? resolved.toString() : null;
  } catch {
    return null;
  }
}

function extractScriptSrcs(html, origin) {
  const regex = /<script[^>]+src=["']([^"']+)["']/gi;
  const urls = new Set();
  let match;
  while ((match = regex.exec(html)) !== null) {
    const resolved = sameOriginUrl(match[1], origin);
    if (resolved) urls.add(resolved);
  }
  return [...urls];
}

/** 번들 텍스트 안에서 명시적으로 등장하는 동일 출처 JSON/API/data 경로 문자열만 추출 */
function extractCandidateEndpointsFromBundle(bundleText, origin) {
  const patterns = [
    /["'`](\/(?:api|data)[^"'`\s]*)["'`]/gi,
    /["'`]([^"'`\s]*\.json)["'`]/gi,
    /fetch\(\s*["'`]([^"'`\s]+)["'`]/gi,
    /axios\.[a-z]+\(\s*["'`]([^"'`\s]+)["'`]/gi,
  ];
  const candidates = new Set();
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(bundleText)) !== null) {
      const raw = match[1];
      if (!raw || raw.startsWith("http") && !raw.startsWith(origin)) continue;
      const resolved = sameOriginUrl(raw, origin);
      if (!resolved) continue;
      candidates.add(resolved);
    }
  }
  return [...candidates];
}

const DIRECTORY_KEYWORD_HINTS = ["church", "교회", "map", "list", "directory", "search"];

function looksLikeDirectoryEndpoint(url) {
  const lower = url.toLowerCase();
  return DIRECTORY_KEYWORD_HINTS.some((kw) => lower.includes(kw));
}

const NAME_KEY_HINTS = ["교회명", "name", "churchname", "church_name", "title"];
const ADDRESS_KEY_HINTS = ["주소", "address", "지역", "region", "location"];

function findJsonArray(value, depth = 0) {
  if (depth > 4 || value == null) return null;
  if (Array.isArray(value)) {
    if (value.length > 0 && typeof value[0] === "object" && value[0] !== null) return value;
    return null;
  }
  if (typeof value === "object") {
    for (const key of Object.keys(value)) {
      const found = findJsonArray(value[key], depth + 1);
      if (found) return found;
    }
  }
  return null;
}

function mapProkArrayToRecords(array, endpointUrl) {
  const sampleKeys = Object.keys(array[0] || {}).map((k) => k.toLowerCase());
  const nameKey = Object.keys(array[0] || {}).find((k) => NAME_KEY_HINTS.includes(k.toLowerCase()));
  const addressKey = Object.keys(array[0] || {}).find((k) => ADDRESS_KEY_HINTS.includes(k.toLowerCase()));
  if (!nameKey || !addressKey) return null;

  const denomination = DENOMINATIONS.prok;
  const records = array
    .filter((row) => clean(row[nameKey]))
    .map((row) => {
      const name = clean(row[nameKey]);
      const address = clean(row[addressKey]) || null;
      const homepage = normalizeHomepage(row.homepage || row.website || row.url);
      return {
        denomination: denomination.name,
        presbytery: null,
        name,
        rawName: name,
        address,
        region: regionFromAddress(address),
        pastor: formatPastor(row.pastor || row["담임목사"]),
        homepage,
        homepageStatus: homepage ? "unverified" : "not-provided",
        youtubeChannelIds: [],
        youtubeHandleLead: homepage && /(youtube\.com|youtu\.be)/i.test(homepage) ? homepage : null,
        evidence: {
          directorySourceUrl: denomination.officialPage,
          sourceApiUrl: endpointUrl,
          sourceRegionQuery: null,
        },
        recordKey: stableRecordKey(denomination.id, name, address, endpointUrl),
      };
    });
  return { records, matchedKeys: { nameKey, addressKey }, sampleKeys };
}

function isProkRowClosedOrHidden(row) {
  const rawName = clean(row?.name);
  const rawAddress = clean(row?.address);
  const isClosed = row?.is_closed === true;
  const delGu = row?.del_gu ?? row?.DelGu;
  const endDate = row?.end_date ?? row?.EndDate;
  const isHidden = Boolean(row?.is_hidden);
  const looksClosedByText = /\(폐교회\)/.test(rawName) || /\(폐교회\)/.test(rawAddress);
  return isClosed || delGu === "D" || Boolean(endDate) || isHidden || looksClosedByText;
}

function mapProkOfficialRow(row, denomination) {
  const rawName = clean(row.name);
  const name = rawName.endsWith("교회") ? rawName : `${rawName}교회`;
  const address = clean(row.address) || null;
  const homepage = normalizeHomepage(row.homepage_url);
  return {
    denomination: denomination.name,
    presbytery: clean(row.noh) || null,
    name,
    rawName,
    address,
    region: regionFromAddress(address),
    pastor: formatPastor(row.pastor_name),
    homepage,
    homepageStatus: homepage ? "unverified" : "not-provided",
    youtubeChannelIds: [],
    youtubeHandleLead: null,
    evidence: {
      directorySourceUrl: "https://map.prok.or.kr",
      sourceApiUrl: PROK_OFFICIAL_API_URL,
      sourceRegionQuery: null,
    },
    recordKey: stableRecordKey(denomination.id, name, address, row.chr_code),
  };
}

async function collectProkOfficialApi(rateGate) {
  const denomination = DENOMINATIONS.prok;
  progress(`[기장] 공식 지도 API 요청: ${PROK_OFFICIAL_API_URL}`);
  const response = await fetchWithRetry(
    PROK_OFFICIAL_API_URL,
    { headers: { Accept: "application/json" } },
    rateGate
  );
  const json = await response.json();
  const churches = Array.isArray(json?.churches) ? json.churches : null;
  if (!churches) {
    throw new Error("공식 API 응답에 churches 배열이 없습니다.");
  }

  const rawCount = churches.length;
  let excludedClosedCount = 0;
  const records = [];

  for (const row of churches) {
    if (isProkRowClosedOrHidden(row)) {
      excludedClosedCount += 1;
      continue;
    }
    if (!clean(row.name)) continue;
    records.push(mapProkOfficialRow(row, denomination));
  }

  progress(
    `[기장] 공식 API 목록 ${rawCount}건 중 폐교회/숨김 ${excludedClosedCount}건 제외, ${records.length}건 채택`
  );

  return {
    id: denomination.id,
    name: denomination.name,
    status: "ok",
    source: denomination.officialPage,
    sourceApi: PROK_OFFICIAL_API_URL,
    rawCount,
    excludedClosedCount,
    count: records.length,
    records,
    evidence: {
      directorySourceUrl: "https://map.prok.or.kr",
      sourceApiUrl: PROK_OFFICIAL_API_URL,
    },
  };
}

async function collectProkBundleDiscoveryFallback(rateGate) {
  const denomination = DENOMINATIONS.prok;
  const evidence = { inspectedScriptAssets: [], candidateEndpointsTested: [] };

  let rootHtml;
  try {
    progress(`[기장] 공식 SPA 루트 요청: ${PROK_ROOT}`);
    const rootResponse = await fetchWithRetry(PROK_ROOT, { headers: { Accept: "text/html" } }, rateGate);
    rootHtml = await rootResponse.text();
  } catch (error) {
    return {
      id: denomination.id,
      name: denomination.name,
      status: "blocked",
      source: denomination.officialPage,
      sourceApi: null,
      reason: "source_unreachable",
      note: `공식 루트 페이지 요청에 실패했다: ${error.message}`,
      count: 0,
      records: [],
      evidence,
    };
  }

  const scriptUrls = extractScriptSrcs(rootHtml, PROK_ROOT).slice(0, MAX_SCRIPT_ASSETS_TO_INSPECT);
  const candidateEndpoints = new Set();

  for (const scriptUrl of scriptUrls) {
    evidence.inspectedScriptAssets.push(scriptUrl);
    try {
      progress(`[기장] 동일 출처 JS 자산 검사: ${scriptUrl}`);
      const response = await fetchWithRetry(scriptUrl, { headers: { Accept: "*/*" } }, rateGate);
      const bundleText = await response.text();
      for (const candidate of extractCandidateEndpointsFromBundle(bundleText, PROK_ROOT)) {
        candidateEndpoints.add(candidate);
      }
    } catch (error) {
      progress(`[기장] JS 자산 요청 실패(무시하고 계속): ${scriptUrl} (${error.message})`);
    }
  }

  const rankedCandidates = [...candidateEndpoints]
    .sort((a, b) => Number(looksLikeDirectoryEndpoint(b)) - Number(looksLikeDirectoryEndpoint(a)))
    .slice(0, MAX_CANDIDATE_ENDPOINTS_TO_TEST);

  for (const endpointUrl of rankedCandidates) {
    evidence.candidateEndpointsTested.push(endpointUrl);
    try {
      progress(`[기장] 후보 엔드포인트 검증: ${endpointUrl}`);
      const response = await fetchWithRetry(endpointUrl, { headers: { Accept: "application/json" } }, rateGate);
      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("json")) continue;
      const json = await response.json();
      const array = findJsonArray(json);
      if (!array || array.length === 0) continue;
      const mapped = mapProkArrayToRecords(array, endpointUrl);
      if (!mapped || mapped.records.length === 0) continue;

      progress(`[기장] 공개 명부 엔드포인트 확인: ${endpointUrl} (${mapped.records.length}건)`);
      return {
        id: denomination.id,
        name: denomination.name,
        status: "ok",
        source: denomination.officialPage,
        sourceApi: endpointUrl,
        count: mapped.records.length,
        records: mapped.records,
        evidence: { ...evidence, matchedKeys: mapped.matchedKeys },
      };
    } catch (error) {
      progress(`[기장] 후보 엔드포인트 실패(무시하고 계속): ${endpointUrl} (${error.message})`);
    }
  }

  progress("[기장] 동일 출처 번들에서 매핑 가능한 공개 명부 엔드포인트를 확인하지 못했습니다.");
  return {
    id: denomination.id,
    name: denomination.name,
    status: "blocked",
    source: denomination.officialPage,
    sourceApi: null,
    reason: "endpoint_not_confirmed",
    note:
      "공식 SPA 루트의 동일 출처 JS 번들에서 교회명+주소/지역으로 매핑 가능한 " +
      "공개 JSON/API 엔드포인트를 확인하지 못했다. 추측 경로 브루트포스나 " +
      "브라우저 자동화는 사용하지 않았다.",
    count: 0,
    records: [],
    evidence,
  };
}

async function collectProk(rateGate) {
  try {
    return await collectProkOfficialApi(rateGate);
  } catch (error) {
    progress(`[기장] 공식 API 호출 실패, 보수적 발견 로직으로 폴백합니다: ${error.message}`);
    const fallback = await collectProkBundleDiscoveryFallback(rateGate);
    fallback.evidence = {
      ...fallback.evidence,
      officialApiUrl: PROK_OFFICIAL_API_URL,
      officialApiFailureReason: error.message,
    };
    if (fallback.status === "blocked") {
      fallback.note = `공식 API(${PROK_OFFICIAL_API_URL}) 호출 실패(${error.message})로 폴백했으나, ${fallback.note}`;
    }
    return fallback;
  }
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function printHelp() {
  console.log(`collect-five-denomination-directories.mjs

대한예수교장로회 고신/백석/합신/대신과 한국기독교장로회(기장)의 공식 공개
명부 소스만을 사용해 정규화 JSON을 생성하는 리서치 전용 CLI입니다.
로그인 우회, 브루트포스, 브라우저 자동화, 제3자 소스 스크래핑은 하지 않으며,
확인 불가한 교단은 blocked 상태로 구조화해 보고합니다. 앱 소스나 DB는
절대 수정하지 않습니다. 전화·팩스·이메일·우편번호는 수집·출력하지 않습니다.
출력 JSON의 최상위 records 배열은 discover-youtube-only.mjs의 --input
인자로 그대로 사용할 수 있습니다.

사용법:
  node scripts/collect-five-denomination-directories.mjs --output <result.json> [옵션]

옵션:
  --output <path>     필수. 결과 JSON을 저장할 파일 경로.
  --only <ids>        쉼표로 구분한 교단 식별자만 처리
                       (kosin, baekseok, hapshin, daeshin, prok). 기본: 전체.
  --delay-ms <n>      요청 간 최소 간격(ms) (기본: ${DEFAULT_DELAY_MS})
  --help              이 도움말을 출력하고 종료.

예시:
  node scripts/collect-five-denomination-directories.mjs --output out/five-denom.json
  node scripts/collect-five-denomination-directories.mjs --output out/kosin.json --only kosin
`);
}

function parseArgs(argv) {
  const args = { output: null, only: null, delayMs: DEFAULT_DELAY_MS, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    switch (token) {
      case "--output":
        args.output = argv[++i];
        break;
      case "--only":
        args.only = argv[++i];
        break;
      case "--delay-ms": {
        const n = Number.parseInt(argv[++i], 10);
        if (Number.isFinite(n) && n >= 0) args.delayMs = n;
        break;
      }
      case "--help":
      case "-h":
        args.help = true;
        break;
      default:
        console.error(`[경고] 알 수 없는 인자를 무시합니다: ${token}`);
    }
  }
  if (args.delayMs < DEFAULT_DELAY_MS) {
    console.error(`[경고] --delay-ms 값이 권장 최소치(${DEFAULT_DELAY_MS}ms)보다 낮습니다. ${DEFAULT_DELAY_MS}ms로 상향합니다.`);
    args.delayMs = DEFAULT_DELAY_MS;
  }
  return args;
}

function resolveTargetIds(onlyArg) {
  if (!onlyArg) return DEFAULT_ORDER;
  const requested = onlyArg.split(",").map((s) => s.trim()).filter(Boolean);
  const invalid = requested.filter((id) => !DENOMINATIONS[id]);
  if (invalid.length > 0) {
    throw new Error(`알 수 없는 --only 식별자: ${invalid.join(", ")} (허용: ${DEFAULT_ORDER.join(", ")})`);
  }
  return DEFAULT_ORDER.filter((id) => requested.includes(id));
}

async function saveOutputAtomic(outputPath, data) {
  const tmpPath = `${outputPath}.tmp`;
  await writeFile(tmpPath, JSON.stringify(data, null, 2), "utf8");
  await rename(tmpPath, outputPath);
}

function dedupeRecords(records) {
  const map = new Map();
  for (const record of records) {
    if (!record?.recordKey) continue;
    if (!map.has(record.recordKey)) map.set(record.recordKey, record);
  }
  return [...map.values()];
}

const COLLECTORS = {
  kosin: (rateGate) => collectKosin(rateGate),
  baekseok: () => collectBaekseok(),
  hapshin: () => collectHapshin(),
  daeshin: () => collectDaeshin(),
  prok: (rateGate) => collectProk(rateGate),
};

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  if (!args.output) {
    console.error("[오류] --output은 필수입니다. --help를 참고하세요.");
    process.exitCode = 1;
    return;
  }

  const targetIds = resolveTargetIds(args.only);
  const rateGate = createRateGate(args.delayMs);

  progress(`대상 교단: ${targetIds.map((id) => DENOMINATIONS[id].name).join(", ")}`);

  const denominationResults = [];
  for (const id of targetIds) {
    progress(`--- ${DENOMINATIONS[id].name} 처리 시작 ---`);
    try {
      const result = await COLLECTORS[id](rateGate);
      denominationResults.push(result);
      progress(
        `--- ${DENOMINATIONS[id].name} 처리 완료: status=${result.status}, count=${result.count} ---`
      );
    } catch (error) {
      progress(`--- ${DENOMINATIONS[id].name} 처리 실패: ${error.message} ---`);
      denominationResults.push({
        id,
        name: DENOMINATIONS[id].name,
        status: "error",
        source: DENOMINATIONS[id].officialPage,
        sourceApi: null,
        reason: "collection_failed",
        note: error.message,
        count: 0,
        records: [],
      });
    }
  }

  const allRecords = denominationResults.flatMap((r) => r.records || []);
  const records = dedupeRecords(allRecords);

  const output = {
    metadata: {
      generatedAt: new Date().toISOString(),
      generatedAtKst: nowKstLabel("collector"),
      requestedDenominations: targetIds,
      denominations: denominationResults.map(({ records, ...summary }) => summary),
      rawRecordCount: allRecords.length,
      dedupedRecordCount: records.length,
      okCount: denominationResults.filter((r) => r.status === "ok").length,
      blockedCount: denominationResults.filter((r) => r.status === "blocked").length,
      errorCount: denominationResults.filter((r) => r.status === "error").length,
    },
    records,
  };

  await saveOutputAtomic(args.output, output);

  progress(
    `완료: 교단 ${denominationResults.length}건 처리 ` +
      `(ok ${output.metadata.okCount}, blocked ${output.metadata.blockedCount}, error ${output.metadata.errorCount}), ` +
      `정규화 레코드 ${records.length}건. 결과 저장: ${args.output}`
  );
}

main().catch(async (error) => {
  console.error(`${nowKstLabel("collector")} [실패] ${error.message}`);
  process.exitCode = 1;
});
