#!/usr/bin/env node

/**
 * batch-register-remaining-denominations.mjs
 *
 * 공식 공개 전국 명부가 확인된 모든 잔여 교단을 매니페스트 기반으로 일괄 수집·정규화하고,
 * 13개 전체 교단의 공식 명부 상태(available/completed/blocked/error)를 머신러닝/자동화 파이프라인이
 * 읽을 수 있는 상태 보고서로 생성하는 체크포인트 지원 일괄 처리 프로그램.
 *
 * [지원 교단 13곳 매니페스트]
 * - 지원/수집 대상 (4):
 *   1. 대한예수교장로회 통합 (tonghap): 공식 전국 검색 (pck.or.kr/address.php)
 *   2. 기독교대한감리회 (kmc): 공식 전국 명부 (his.kmc.or.kr/address/church)
 *   3. 구세군대한본영 (salvation): 공식 조직 API (api.thesalvationarmy.or.kr/api/user/organization)
 *   4. 대한성공회 (anglican): 공식 도메인 디렉터리 링크 발견 및 3개 교구 명부 파싱 (anglicankr.church)
 *
 * - 공식 명부 차단 대상 (9) — 우회 없이 blocked 상태 및 사유 기록:
 *   5. 기독교대한성결교회 (kehc): login_required (교단 전산망 로그인 필수)
 *   6. 기독교한국침례회 (kbch): login_required (총회 로그인 필수)
 *   7. 기독교대한하나님의성회 (agk): login_required (총회 인트라넷 로그인 필수)
 *   8. 대한예수교장로회 백석 (baekseok): login_required (명부 조회 시 세션 로그인 필수)
 *   9. 대한예수교장로회 합신 (hapshin): public_complete_directory_unavailable (전수 공개 명부 미확인)
 *   10. 대한예수교장로회 대신 (daeshin): public_complete_directory_unavailable (전수 공개 명부 미확인)
 *   11. 예수교대한성결교회 (yehc): public_complete_directory_unavailable (전수 공개 명부 미확인)
 *   12. 대한기독교나사렛성결회 (nazarene): public_complete_directory_unavailable (전수 공개 명부 미확인)
 *   13. 기독교대한복음교회 (bokum): public_complete_directory_unavailable (전수 공개 명부 미확인)
 *
 * [수집 범위 및 파이프라인 안내]
 * - 본 스크립트는 공식 디렉터리 수집(official-directory collection) 전용입니다.
 * - 후속 기존 조사/검증(discovery/validation) 및 새 소스 범위 통합(source-scope integration)은 별도 단계로 수행됩니다.
 *
 * [진행 알림 및 개인정보 보호]
 * - 교단별 100개 레코드 처리마다 정확히 진행률을 출력하며 교단 시작/완료/차단/오류 알림 제공.
 * - 모든 사용자 표시 메시지는 [HH:MM KST · G]로 시작.
 * - 개인정보(전화번호·팩스·이메일·개인 식별정보)는 새로운 출력에서 완전히 배제.
 */

import { readFile, writeFile, rename, mkdir } from "node:fs/promises";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import {
  parseRecordsFromHtml as parseTonghapRecordsFromHtml,
  buildDirectoryUrl as buildTonghapDirectoryUrl,
  DEFAULT_REGIONS as TONGHAP_REGIONS,
} from "./discover-pck-tonghap.mjs";

const DEFAULT_DELAY_MS = 600;
const REQUEST_TIMEOUT_MS = 20_000;
const MAX_ATTEMPTS = 3;
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";
const ACTOR_TAG = "G";

// ---------------------------------------------------------------------------
// 13개 교단 매니페스트 (결정적 순서)
// ---------------------------------------------------------------------------

export const DENOMINATION_MANIFEST = [
  // 1. 공식 공개 명부 확인 및 수집 가능 교단 (4곳)
  {
    id: "tonghap",
    name: "대한예수교장로회 통합",
    status: "available",
    officialSite: "https://www.pck.or.kr",
    officialDirectoryUrl: "https://www.pck.or.kr/address.php",
    provenance: "대한예수교장로회(통합) 총회 공식 전국 교회 주소록 검색 (flag=churchAddress, sch=<region>, page=<n>)",
    strategy: "pck_tonghap_search",
  },
  {
    id: "kmc",
    name: "기독교대한감리회",
    status: "available",
    officialSite: "https://kmc.or.kr",
    officialDirectoryUrl: "https://his.kmc.or.kr/address/church",
    provenance: "기독교대한감리회 본부 HIS 공식 전국 교회 주소록 (search_ac=1..13, page=<n>)",
    strategy: "kmc_his_listing",
  },
  {
    id: "salvation",
    name: "구세군대한본영",
    status: "available",
    officialSite: "https://www.salvationarmy.or.kr",
    officialDirectoryUrl: "https://api.thesalvationarmy.or.kr/api/user/organization",
    provenance: "구세군대한본영 공식 조직 API (categoryId=16 / 영문(교회))",
    strategy: "salvation_army_api",
  },
  {
    id: "anglican",
    name: "대한성공회",
    status: "available",
    officialSite: "https://anglicankr.church",
    officialDirectoryUrl: "https://anglicankr.church",
    provenance: "대한성공회 공식 전국 교회 주소록 및 3개 교구(서울·대전·부산) 디렉터리 링크 발견 및 파싱",
    strategy: "anglican_discovery",
  },

  // 2. 공식 명부 열람에 로그인이 필수인 교단 (4곳) — 우회 없이 차단 기록
  {
    id: "kehc",
    name: "기독교대한성결교회",
    status: "blocked",
    officialSite: "https://www.kehc.org",
    officialDirectoryUrl: "https://www.kehc.org",
    blockerReason: "login_required",
    blockerNote: "공식 명부 열람에 교단 전산망 로그인이 필요함 (로그인 우회 절대 금지)",
    provenance: "기독교대한성결교회 총회 공식 웹사이트",
  },
  {
    id: "kbch",
    name: "기독교한국침례회",
    status: "blocked",
    officialSite: "http://kbc.or.kr",
    officialDirectoryUrl: "http://kbc.or.kr",
    blockerReason: "login_required",
    blockerNote: "공식 명부 열람에 교단 총회 로그인이 필요함 (로그인 우회 절대 금지)",
    provenance: "기독교한국침례회 총회 공식 웹사이트",
  },
  {
    id: "agk",
    name: "기독교대한하나님의성회",
    status: "blocked",
    officialSite: "https://agk.or.kr",
    officialDirectoryUrl: "https://agk.or.kr",
    blockerReason: "login_required",
    blockerNote: "공식 명부 열람에 총회 인트라넷 로그인이 필요함 (로그인 우회 절대 금지)",
    provenance: "기독교대한하나님의성회 총회 공식 웹사이트",
  },
  {
    id: "baekseok",
    name: "대한예수교장로회 백석",
    status: "blocked",
    officialSite: "https://pgak.net",
    officialDirectoryUrl: "https://pgak.net/contacts",
    blockerReason: "login_required",
    blockerNote: "https://pgak.net/contacts 는 로그인 세션이 있어야 명부를 조회할 수 있음 (로그인 우회 절대 금지)",
    provenance: "대한예수교장로회 백석 총회 공식 웹사이트",
  },

  // 3. 전수 공개 명부가 확인되지 않은 교단 (5곳) — 우회 없이 차단 기록
  {
    id: "hapshin",
    name: "대한예수교장로회 합신",
    status: "blocked",
    officialSite: "http://www.hapshin.org",
    officialDirectoryUrl: "http://www.hapshin.org",
    blockerReason: "public_complete_directory_unavailable",
    blockerNote: "http://www.hapshin.org 에서 전 교회를 망라하는 공개 명부(전수 검색/다운로드 가능)를 확인하지 못함",
    provenance: "대한예수교장로회 합신 총회 공식 웹사이트",
  },
  {
    id: "daeshin",
    name: "대한예수교장로회 대신",
    status: "blocked",
    officialSite: "http://www.ds1961.com",
    officialDirectoryUrl: "http://www.ds1961.com",
    blockerReason: "public_complete_directory_unavailable",
    blockerNote: "http://www.ds1961.com 에서 전 교회를 망라하는 공개 명부(전수 검색/다운로드 가능)를 확인하지 못함",
    provenance: "대한예수교장로회 대신 총회 공식 웹사이트",
  },
  {
    id: "yehc",
    name: "예수교대한성결교회",
    status: "blocked",
    officialSite: "http://sungkyul.org",
    officialDirectoryUrl: "http://sungkyul.org",
    blockerReason: "public_complete_directory_unavailable",
    blockerNote: "공식 웹사이트에서 전 교회를 망라하는 공개 명부를 확인하지 못함",
    provenance: "예수교대한성결교회 총회 공식 웹사이트",
  },
  {
    id: "nazarene",
    name: "대한기독교나사렛성결회",
    status: "blocked",
    officialSite: "http://nazarene.or.kr",
    officialDirectoryUrl: "http://nazarene.or.kr",
    blockerReason: "public_complete_directory_unavailable",
    blockerNote: "공식 웹사이트에서 전 교회를 망라하는 공개 명부를 확인하지 못함",
    provenance: "대한기독교나사렛성결회 총회 공식 웹사이트",
  },
  {
    id: "bokum",
    name: "기독교대한복음교회",
    status: "blocked",
    officialSite: "http://gospelchurch.or.kr",
    officialDirectoryUrl: "http://gospelchurch.or.kr",
    blockerReason: "public_complete_directory_unavailable",
    blockerNote: "공식 웹사이트에서 전 교회를 망라하는 공개 명부를 확인하지 못함",
    provenance: "기독교대한복음교회 총회 공식 웹사이트",
  },
];

export const MANIFEST_BY_ID = Object.fromEntries(
  DENOMINATION_MANIFEST.map((item) => [item.id, item])
);

export const DEFAULT_MANIFEST_ORDER = DENOMINATION_MANIFEST.map((item) => item.id);

// ---------------------------------------------------------------------------
// 공통 포맷팅 및 상태 알림 유틸
// ---------------------------------------------------------------------------

export function nowKstLabel(actorTag = ACTOR_TAG) {
  const kst = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  const hh = String(kst.getHours()).padStart(2, "0");
  const mm = String(kst.getMinutes()).padStart(2, "0");
  return `[${hh}:${mm} KST · ${actorTag}]`;
}

export function clean(value) {
  return value == null ? "" : String(value).normalize("NFKC").replace(/\s+/g, " ").trim();
}

export function compact(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[.,·・"'‘’“”()\[\]{}!?~\-_/\\:;\s]/g, "")
    .trim();
}

export function djb2Hex(text) {
  let hash = 5381;
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) + hash + text.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

export function stableRecordKey(denominationId, name, address, fallback) {
  const basis = `${denominationId}::${clean(name)}::${clean(address) || clean(fallback) || ""}`;
  return `${denominationId}-${djb2Hex(basis)}`;
}

const PLACEHOLDER_URLS = new Set(["", "-", "--", "없음", "x", "n/a", "null", "none"]);

export function normalizeHomepage(value) {
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

export function formatPastor(value) {
  const pastor = clean(value);
  if (!pastor || pastor === "담임목사 확인 필요") return "담임목사 확인 필요";
  if (pastor.endsWith("목사") || pastor.endsWith("신부") || pastor.endsWith("사제") || pastor.endsWith("사관")) {
    return pastor;
  }
  return `${pastor} 목사`;
}

export function normalizeChurchName(rawName) {
  const trimmed = clean(rawName);
  if (!trimmed) return "";
  if (
    trimmed.endsWith("교회") ||
    trimmed.endsWith("성당") ||
    trimmed.endsWith("영문") ||
    trimmed.endsWith("채플") ||
    trimmed.endsWith("원목실")
  ) {
    return trimmed;
  }
  return `${trimmed}교회`;
}

export function regionFromAddress(value) {
  const address = clean(value)
    .replace(/^\(?\d{3}-?\d{0,4}\)?\s*/, "")
    .replace(/^(서울|부산|대구|인천|광주|대전|울산)시(?=[가-힣]+구\s)/, "$1시 ")
    .replace(/^(경기|강원|충북|충남|전북|전남|경북|경남|제주)도(?=[가-힣]+(?:시|군|구)\s)/, "$1도 ");
  const aliases = [
    [/^서울(?:특별시|시)?\s+([^\s]+)/, "서울"],
    [/^부산(?:광역시|시)?\s+([^\s]+)/, "부산"],
    [/^대구(?:광역시|시)?\s+([^\s]+)/, "대구"],
    [/^인천(?:광역시|시)?\s+([^\s]+)/, "인천"],
    [/^광주(?:광역시|시)?\s+([^\s]+)/, "광주"],
    [/^대전(?:광역시|시)?\s+([^\s]+)/, "대전"],
    [/^울산(?:광역시|시)?\s+([^\s]+)/, "울산"],
    [/^세종(?:특별자치시|시)?(?:\s+([^\s]+))?/, "세종"],
    [/^경기(?:도)?\s+([^\s]+)/, "경기"],
    [/^강원(?:특별자치도|도)?\s+([^\s]+)/, "강원"],
    [/^(?:충청북도|충북)\s+([^\s]+)/, "충북"],
    [/^(?:충청남도|충남)\s+([^\s]+)/, "충남"],
    [/^(?:전북특별자치도|전라북도|전북)\s+([^\s]+)/, "전북"],
    [/^(?:전라남도|전남)\s+([^\s]+)/, "전남"],
    [/^(?:경상북도|경북)\s+([^\s]+)/, "경북"],
    [/^(?:경상남도|경남)\s+([^\s]+)/, "경남"],
    [/^제주(?:특별자치도)?\s+([^\s]+)/, "제주"],
  ];
  for (const [pattern, province] of aliases) {
    const match = address.match(pattern);
    if (match) {
      if (!match[1]) return province;
      const district = match[1];
      const stripped = district.replace(/[시군구]$/, "");
      const local = stripped.length <= 1 ? district : stripped;
      return `${province} ${local}`;
    }
  }
  return "지역 확인 필요";
}

// ---------------------------------------------------------------------------
// 100개 단위 진행 알림 트래커
// ---------------------------------------------------------------------------

export function createProgressTracker({ actorTag = ACTOR_TAG, logger = console.error } = {}) {
  let totalProcessed = 0;
  let denominationProcessed = 0;

  return {
    onDenominationStart(name, sourceUrl) {
      denominationProcessed = 0;
      logger(`${nowKstLabel(actorTag)} [${name}] 수집 시작: ${sourceUrl}`);
    },
    onRecord(name) {
      totalProcessed += 1;
      denominationProcessed += 1;
      if (denominationProcessed % 100 === 0) {
        logger(
          `${nowKstLabel(actorTag)} [${name}] ${denominationProcessed}건 수집 완료 (해당 교단 ${denominationProcessed}건 / 전체 누적 ${totalProcessed}건)`
        );
      }
    },
    onDenominationComplete(name, count, status = "completed") {
      logger(`${nowKstLabel(actorTag)} [${name}] 처리 완료: status=${status}, count=${count}`);
    },
    onDenominationBlocked(name, reason, note) {
      logger(`${nowKstLabel(actorTag)} [${name}] 차단 확인: status=blocked, reason=${reason}`);
    },
    onDenominationError(name, errorMsg) {
      logger(`${nowKstLabel(actorTag)} [${name}] 처리 실패: status=error, error=${errorMsg}`);
    },
    getTotalProcessed() {
      return totalProcessed;
    },
    getDenominationProcessed() {
      return denominationProcessed;
    },
  };
}

// ---------------------------------------------------------------------------
// 정중한 수집 속도 보장 게이트 및 네트워크 재시도
// ---------------------------------------------------------------------------

export function createRateGate(delayMs = DEFAULT_DELAY_MS) {
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

export async function fetchWithRetry(url, options = {}, rateGate = null, maxAttempts = MAX_ATTEMPTS) {
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    if (rateGate) await rateGate();
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
  throw lastError ?? new Error("네트워크 요청 실패");
}

// ---------------------------------------------------------------------------
// HTML 파싱 헬퍼 (의존성 없는 정규식 기반)
// ---------------------------------------------------------------------------

export function stripHtmlTags(html) {
  return (html || "")
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

export function extractHtmlRows(html) {
  const rows = [];
  const regex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    rows.push(match[0]);
  }
  return rows;
}

export function extractHtmlCells(rowHtml) {
  const cells = [];
  const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
  let match;
  while ((match = cellRegex.exec(rowHtml)) !== null) {
    cells.push(stripHtmlTags(match[1]));
  }
  return cells;
}

export function extractHrefFromHtml(html) {
  const match = (html || "").match(/href\s*=\s*["']([^"']+)["']/i);
  return match ? match[1].trim() : null;
}

// ---------------------------------------------------------------------------
// 표준 레코드 규격화 및 결정적 중복 제거
// ---------------------------------------------------------------------------

export function standardizeRecord({
  denomination,
  denominationId,
  name,
  rawName,
  pastor,
  address,
  region,
  homepage,
  officialSourceUrl,
  presbytery = null,
  sourceFallbackKey = null,
}) {
  const finalName = normalizeChurchName(name || rawName);
  const finalAddress = clean(address) || null;
  const finalRegion = region && region !== "지역 확인 필요" ? region : regionFromAddress(finalAddress);
  const finalPastor = formatPastor(pastor);
  const finalHomepage = normalizeHomepage(homepage);

  return {
    denomination: clean(denomination),
    presbytery: clean(presbytery) || null,
    name: finalName,
    rawName: clean(rawName || name),
    address: finalAddress,
    region: finalRegion,
    pastor: finalPastor,
    homepage: finalHomepage,
    homepageStatus: finalHomepage ? "unverified" : "not-provided",
    officialSourceUrl: clean(officialSourceUrl),
    recordKey: stableRecordKey(denominationId, finalName, finalAddress, sourceFallbackKey),
  };
}

export function dedupeRecords(records) {
  const map = new Map();
  for (const record of records) {
    if (!record?.denomination || !record?.name) continue;
    // 교단별 격리를 보장하기 위해 denomination을 키 앞머리에 유지
    const key = `${compact(record.denomination)}::${compact(record.name)}::${compact(record.address || record.region || "")}`;
    if (!map.has(key)) {
      map.set(key, record);
    } else {
      // 기존에 홈페이지가 없었는데 새 레코드에 유효한 홈페이지가 있으면 보강
      const existing = map.get(key);
      if (!existing.homepage && record.homepage) {
        map.set(key, { ...existing, homepage: record.homepage, homepageStatus: "unverified" });
      }
    }
  }
  return [...map.values()];
}

// ---------------------------------------------------------------------------
// 4개 지원 교단 수집기
// ---------------------------------------------------------------------------

/** 1. 대한예수교장로회 통합 수집 (기존 discover-pck-tonghap.mjs 로직 재사용) */
export async function collectTonghap({ rateGate, maxPages = 200, progressTracker = null }) {
  const manifest = MANIFEST_BY_ID.tonghap;
  if (progressTracker) progressTracker.onDenominationStart(manifest.name, manifest.officialDirectoryUrl);

  const allRecords = [];
  const seenSignatures = new Set();

  for (const region of TONGHAP_REGIONS) {
    let previousSignature = null;
    for (let page = 1; page <= maxPages; page += 1) {
      const url = buildTonghapDirectoryUrl(region, page);
      let response;
      try {
        response = await fetchWithRetry(url, {}, rateGate);
      } catch (error) {
        throw new Error(`통합 ${region} page ${page} 요청 실패: ${error.message}`);
      }

      const html = await response.text();
      const rawRecords = parseTonghapRecordsFromHtml(html, region, url);
      if (rawRecords.length === 0) break;

      const sig = rawRecords.map((r) => `${r.rawName}|${r.address}`).join("\n");
      if (sig === previousSignature || seenSignatures.has(sig)) break;
      seenSignatures.add(sig);
      previousSignature = sig;

      for (const r of rawRecords) {
        const standard = standardizeRecord({
          denomination: manifest.name,
          denominationId: manifest.id,
          name: r.name,
          rawName: r.rawName,
          pastor: r.pastor,
          address: r.address,
          region: r.region,
          homepage: r.homepage,
          officialSourceUrl: url,
          presbytery: r.presbytery,
        });
        allRecords.push(standard);
        if (progressTracker) progressTracker.onRecord(manifest.name);
      }

      if (rawRecords.length < 5) break;
    }
  }

  const deduped = dedupeRecords(allRecords);
  if (progressTracker) progressTracker.onDenominationComplete(manifest.name, deduped.length);

  return {
    id: manifest.id,
    name: manifest.name,
    status: "completed",
    stage: "completed",
    officialSourceUrl: manifest.officialDirectoryUrl,
    provenance: manifest.provenance,
    recordCount: deduped.length,
    records: deduped,
  };
}

/** 2. 기독교대한감리회 수집 (HIS 공식 명부: search_ac=1..13, page=1..n) */
export function parseKmcChurchHtml(html, sourceUrl) {
  const records = [];
  const rows = extractHtmlRows(html);

  for (const row of rows) {
    // 1. 구조적 <th> 헤더 행 제외
    if (/<th[^>]*>/i.test(row)) continue;
    if (/check_all/i.test(row)) continue;

    const cells = extractHtmlCells(row);
    if (cells.length < 3) continue;

    // 2. 정확한 컬럼 라벨 기반 헤더 행 제외 (부분 문자열 매칭 대신 정확한 라벨 비교)
    const isHeaderRow = cells.some((c) => {
      const label = clean(c);
      return (
        label === "연회/지방" ||
        label === "연회" ||
        label === "지방" ||
        label === "교회명" ||
        label === "교회" ||
        label === "교회 (소속목회자)" ||
        label === "교회(소속목회자)" ||
        label === "소속목회자" ||
        label === "담임" ||
        label === "담임자" ||
        label === "담임목사" ||
        label === "주소" ||
        label === "전화" ||
        label === "전화번호" ||
        label === "홈페이지" ||
        label === "설립일" ||
        label === "비고"
      );
    });
    if (isHeaderRow) continue;

    let conference = "";
    let rawChurch = "";
    let pastor = "";
    let address = "";
    let homepage = null;

    const href = extractHrefFromHtml(row);

    if (cells.length >= 7) {
      // 공식 10열 레이아웃: [체크박스, 연회, 지방, 교회(소속목회자), 담임, 전화, 주소, 홈페이지, 설립일, 비고]
      const conf = clean(cells[1]);
      const dist = clean(cells[2]);
      const confPart = conf ? (conf.endsWith("연회") ? conf : `${conf}연회`) : "";
      const distPart = dist ? (dist.endsWith("지방") || dist.endsWith("지방회") ? dist : `${dist}지방`) : "";
      conference = [confPart, distPart].filter(Boolean).join(" ");

      rawChurch = cells[3];
      pastor = cells[4];
      address = cells[6];

      if (cells.length >= 8 && cells[7]) {
        const hpCell = clean(cells[7]);
        if (hpCell && !PLACEHOLDER_URLS.has(hpCell.toLowerCase())) {
          homepage = hpCell;
        }
      }
      if (!homepage && href && /^https?:\/\//i.test(href)) {
        homepage = href;
      }
    } else if (cells.length === 5 || cells.length === 6) {
      // 이전 5~6열 압축 레이아웃: [연회/지방, 교회명, 담임자, 주소, 전화번호, (홈페이지)]
      conference = cells[0];
      rawChurch = cells[1];
      pastor = cells[2];
      address = cells[3];
      if (cells.length >= 6 && cells[5] && !PLACEHOLDER_URLS.has(clean(cells[5]).toLowerCase())) {
        homepage = clean(cells[5]);
      }
      if (!homepage && href && /^https?:\/\//i.test(href)) {
        homepage = href;
      }
    } else if (cells.length === 4) {
      // 4열 변형: [교회명, 담임자, 주소, 연회/지방]
      rawChurch = cells[0];
      pastor = cells[1];
      address = cells[2];
      conference = cells[3];
      if (href && /^https?:\/\//i.test(href)) {
        homepage = href;
      }
    } else if (cells.length === 3) {
      // 3열 변형: [교회명, 담임자, 주소]
      rawChurch = cells[0];
      pastor = cells[1];
      address = cells[2];
      if (href && /^https?:\/\//i.test(href)) {
        homepage = href;
      }
    }

    // 소속 교역자 수 등 꼬리 숫자 괄호 제거: "중앙 (13)" -> "중앙"
    const cleanName = clean(rawChurch).replace(/\s*\(\s*\d+\s*\)\s*$/, "").trim();

    // 소속없음, 빈 이름, 헤더 잔여 및 집계/비교회 행 제외
    if (!cleanName) continue;
    if (
      cleanName === "소속없음" ||
      cleanName === "소속 없음" ||
      cleanName.startsWith("소속없음") ||
      cleanName.includes("소속없음")
    ) {
      continue;
    }
    if (
      cleanName === "합계" ||
      cleanName === "총계" ||
      cleanName === "소계" ||
      cleanName === "교회" ||
      cleanName === "교회명" ||
      cleanName === "미파송" ||
      cleanName === "휴직" ||
      cleanName === "은퇴"
    ) {
      continue;
    }

    const normalizedName = normalizeChurchName(cleanName);
    if (!normalizedName) continue;

    records.push(
      standardizeRecord({
        denomination: "기독교대한감리회",
        denominationId: "kmc",
        name: normalizedName,
        rawName: cleanName,
        pastor: clean(pastor),
        address: clean(address) || null,
        region: regionFromAddress(address),
        homepage,
        presbytery: clean(conference) || null,
        officialSourceUrl: sourceUrl,
      })
    );
  }

  // 테이블이 아닌 카드/목록형 구조 처리 (폴백)
  if (records.length === 0) {
    const itemRegex = /<li[^>]*class=["'][^"']*church[^"']*["'][^>]*>([\s\S]*?)<\/li>/gi;
    let m;
    while ((m = itemRegex.exec(html)) !== null) {
      const block = m[1];
      const text = stripHtmlTags(block);
      const nameMatch = text.match(/교회명\s*[:：]\s*([^\n\r]+)/) || text.match(/^([가-힣A-Za-z0-9\s]+교회)/);
      if (!nameMatch) continue;
      const pastorMatch = text.match(/담임(?:자|목사)?\s*[:：]\s*([^\n\r]+)/);
      const addrMatch = text.match(/주소\s*[:：]\s*([^\n\r]+)/);
      const hrefMatch = extractHrefFromHtml(block);

      const cleanName = clean(nameMatch[1]).replace(/\s*\(\s*\d+\s*\)\s*$/, "").trim();
      if (
        !cleanName ||
        cleanName === "소속없음" ||
        cleanName === "소속 없음" ||
        cleanName.startsWith("소속없음") ||
        cleanName.includes("소속없음") ||
        cleanName === "합계" ||
        cleanName === "총계"
      ) {
        continue;
      }

      const normalizedName = normalizeChurchName(cleanName);
      if (!normalizedName) continue;

      records.push(
        standardizeRecord({
          denomination: "기독교대한감리회",
          denominationId: "kmc",
          name: normalizedName,
          rawName: cleanName,
          pastor: pastorMatch ? clean(pastorMatch[1]) : "",
          address: addrMatch ? clean(addrMatch[1]) : null,
          region: addrMatch ? regionFromAddress(addrMatch[1]) : "지역 확인 필요",
          homepage: hrefMatch && /^https?:\/\//i.test(hrefMatch) ? hrefMatch : null,
          presbytery: null,
          officialSourceUrl: sourceUrl,
        })
      );
    }
  }

  return records;
}

export async function collectKmc({ rateGate, maxPages = 150, progressTracker = null }) {
  const manifest = MANIFEST_BY_ID.kmc;
  if (progressTracker) progressTracker.onDenominationStart(manifest.name, manifest.officialDirectoryUrl);

  const allRecords = [];
  const BASE_URL = "https://his.kmc.or.kr/address/church";
  const ANNUAL_CONFERENCES = Array.from({ length: 13 }, (_, i) => i + 1); // search_ac 1..13

  for (const ac of ANNUAL_CONFERENCES) {
    let previousSig = null;
    for (let page = 1; page <= maxPages; page += 1) {
      const url = `${BASE_URL}?search_ac=${ac}&page=${page}`;
      let response;
      try {
        response = await fetchWithRetry(url, {}, rateGate);
      } catch (error) {
        throw new Error(`감리회 ac=${ac} page=${page} 요청 실패: ${error.message}`);
      }

      const html = await response.text();
      const rawRows = parseKmcChurchHtml(html, url);
      if (rawRows.length === 0) break;

      const sig = rawRows.map((r) => `${r.name}|${r.address}|${r.pastor}`).join("\n");
      if (sig === previousSig) break;
      previousSig = sig;

      for (const raw of rawRows) {
        const standard = standardizeRecord(raw);
        allRecords.push(standard);
        if (progressTracker) progressTracker.onRecord(manifest.name);
      }

      if (rawRows.length < 5) break;
    }
  }

  const deduped = dedupeRecords(allRecords);
  if (progressTracker) progressTracker.onDenominationComplete(manifest.name, deduped.length);

  return {
    id: manifest.id,
    name: manifest.name,
    status: "completed",
    stage: "completed",
    officialSourceUrl: manifest.officialDirectoryUrl,
    provenance: manifest.provenance,
    recordCount: deduped.length,
    records: deduped,
  };
}

/** 3. 구세군대한본영 수집 (공식 조직 JSON API: categoryId===16 / categoryName==="영문(교회)") */
export function parseSalvationArmyJson(payload, sourceUrl) {
  let list = [];
  if (Array.isArray(payload)) {
    list = payload;
  } else if (Array.isArray(payload?.data)) {
    list = payload.data;
  } else if (Array.isArray(payload?.list)) {
    list = payload.list;
  } else if (Array.isArray(payload?.organizations)) {
    list = payload.organizations;
  }

  const records = [];
  for (const item of list) {
    const categoryId = Number(item.categoryId ?? item.category_id ?? item.cat_id ?? 0);
    const categoryName = clean(item.categoryName ?? item.category_name ?? item.cat_name ?? "");

    // categoryId===16 또는 categoryName==="영문(교회)" 필터
    const isChurchCategory =
      categoryId === 16 ||
      categoryName === "영문(교회)" ||
      categoryName === "영문" ||
      categoryName.includes("교회") ||
      categoryName.includes("영문");

    if (!isChurchCategory && categoryId !== 0) continue;

    const name = clean(item.name || item.org_name || item.orgName || item.title);
    if (!name) continue;

    const pastor = clean(item.leader || item.pastor || item.officer || item.officerName || item.minister || item.manager);
    const address = clean(item.address || item.addr || item.roadAddress || item.location);
    const homepage = normalizeHomepage(item.homepage || item.homepageUrl || item.website || item.url);

    records.push(
      standardizeRecord({
        denomination: "구세군대한본영",
        denominationId: "salvation",
        name,
        rawName: name,
        pastor: pastor
          ? /(?:^|\s)(?:사관|목사)$/.test(pastor)
            ? pastor
            : `${pastor} 사관`
          : "담임목사 확인 필요",
        address,
        region: regionFromAddress(address),
        homepage,
        officialSourceUrl: sourceUrl,
        sourceFallbackKey: String(item.id || item.orgId || item.code || ""),
      })
    );
  }

  return records;
}

export async function collectSalvation({ rateGate, progressTracker = null }) {
  const manifest = MANIFEST_BY_ID.salvation;
  if (progressTracker) progressTracker.onDenominationStart(manifest.name, manifest.officialDirectoryUrl);

  const API_URL = "https://api.thesalvationarmy.or.kr/api/user/organization";
  let response;
  try {
    response = await fetchWithRetry(API_URL, { headers: { Accept: "application/json" } }, rateGate);
  } catch (error) {
    throw new Error(`구세군 공식 API 요청 실패: ${error.message}`);
  }

  const payload = await response.json();
  const records = parseSalvationArmyJson(payload, API_URL);

  for (let i = 0; i < records.length; i += 1) {
    if (progressTracker) progressTracker.onRecord(manifest.name);
  }

  const deduped = dedupeRecords(records);
  if (progressTracker) progressTracker.onDenominationComplete(manifest.name, deduped.length);

  return {
    id: manifest.id,
    name: manifest.name,
    status: "completed",
    stage: "completed",
    officialSourceUrl: manifest.officialDirectoryUrl,
    provenance: manifest.provenance,
    recordCount: deduped.length,
    records: deduped,
  };
}

/** 4. 대한성공회 수집 (공식 디렉터리 링크 발견 및 3개 교구 명부 파싱) */
export function discoverAnglicanLinks(html, baseUrl) {
  const discovered = new Set();
  const linkRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = linkRegex.exec(html)) !== null) {
    const href = match[1].trim();
    const text = stripHtmlTags(match[2]);
    const isTargetAnchor =
      text.includes("전국 교회 주소록") ||
      text.includes("교구 기관 단체") ||
      text.includes("교회 주소록") ||
      text.includes("교구") ||
      text.includes("성당");

    if (isTargetAnchor) {
      try {
        const resolved = new URL(href, baseUrl);
        if (resolved.hostname === new URL(baseUrl).hostname) {
          discovered.add(resolved.toString());
        }
      } catch {}
    }
  }

  return [...discovered];
}

export function parseAnglicanChurchHtml(html, sourceUrl) {
  const records = [];
  const rows = extractHtmlRows(html);

  for (const row of rows) {
    if (/<th[^>]*>/i.test(row)) continue;

    const cells = extractHtmlCells(row);
    if (cells.length < 2) continue;

    const isHeaderRow = cells.some((c) => {
      const label = clean(c);
      return (
        label === "성당명" ||
        label === "교회명" ||
        label === "성당" ||
        label === "교회" ||
        label === "관할사제" ||
        label === "사제" ||
        label === "주소" ||
        label === "전화" ||
        label === "연락처"
      );
    });
    if (isHeaderRow) continue;

    let name = "";
    let pastor = "";
    let address = "";
    const href = extractHrefFromHtml(row);
    const homepage = href && /^https?:\/\//i.test(href) ? href : null;

    if (cells.length >= 3) {
      name = cells[0];
      pastor = cells[1];
      address = cells[2];
    } else if (cells.length === 2) {
      name = cells[0];
      address = cells[1];
    }

    if (!clean(name)) continue;

    records.push(
      standardizeRecord({
        denomination: "대한성공회",
        denominationId: "anglican",
        name: clean(name),
        rawName: clean(name),
        pastor: pastor ? (pastor.endsWith("사제") || pastor.endsWith("신부") ? pastor : `${pastor} 신부`) : "담임목사 확인 필요",
        address: clean(address) || null,
        region: regionFromAddress(address),
        homepage,
        officialSourceUrl: sourceUrl,
      })
    );
  }

  return records;
}

export async function collectAnglican({ rateGate, progressTracker = null }) {
  const manifest = MANIFEST_BY_ID.anglican;
  if (progressTracker) progressTracker.onDenominationStart(manifest.name, manifest.officialDirectoryUrl);

  const ROOT_URL = "https://anglicankr.church";
  let rootHtml = "";
  try {
    const response = await fetchWithRetry(ROOT_URL, { headers: { Accept: "text/html,*/*" } }, rateGate);
    rootHtml = await response.text();
  } catch (error) {
    if (progressTracker) {
      progressTracker.onDenominationBlocked(
        manifest.name,
        "directory_listing_unverified",
        `공식 루트 연결 실패: ${error.message}`
      );
    }
    return {
      id: manifest.id,
      name: manifest.name,
      status: "blocked",
      stage: "blocked",
      officialSourceUrl: ROOT_URL,
      blockerReason: "directory_listing_unverified",
      blockerNote: `대한성공회 공식 루트(${ROOT_URL}) 요청에 실패했습니다: ${error.message}`,
      recordCount: 0,
      records: [],
    };
  }

  const discoveredLinks = discoverAnglicanLinks(rootHtml, ROOT_URL);
  const candidateUrls = discoveredLinks.length > 0 ? discoveredLinks : [ROOT_URL];
  const allRecords = [];

  for (const url of candidateUrls) {
    try {
      const res = await fetchWithRetry(url, {}, rateGate);
      const html = await res.text();
      const pageRecords = parseAnglicanChurchHtml(html, url);
      for (const r of pageRecords) {
        allRecords.push(r);
        if (progressTracker) progressTracker.onRecord(manifest.name);
      }
    } catch {}
  }

  const deduped = dedupeRecords(allRecords);

  // 런타임에 명부 파싱 검증이 실패하면 절대 가짜 데이터를 생성하지 않고 blocked 처리
  if (deduped.length === 0) {
    if (progressTracker) {
      progressTracker.onDenominationBlocked(
        manifest.name,
        "directory_listing_unverified",
        "공식 사이트에서 구조화된 전국 교회 주소록 목록을 확인하지 못했습니다."
      );
    }
    return {
      id: manifest.id,
      name: manifest.name,
      status: "blocked",
      stage: "blocked",
      officialSourceUrl: ROOT_URL,
      blockerReason: "directory_listing_unverified",
      blockerNote:
        "대한성공회 공식 사이트(anglicankr.church)에서 전국 교회 주소록 구조화 명부를 확인하지 못했습니다 (우회/가상 레코드 생성 금지).",
      recordCount: 0,
      records: [],
    };
  }

  if (progressTracker) progressTracker.onDenominationComplete(manifest.name, deduped.length);

  return {
    id: manifest.id,
    name: manifest.name,
    status: "completed",
    stage: "completed",
    officialSourceUrl: manifest.officialDirectoryUrl,
    provenance: manifest.provenance,
    recordCount: deduped.length,
    records: deduped,
  };
}

// ---------------------------------------------------------------------------
// 차단 교단 처리기 (9곳)
// ---------------------------------------------------------------------------

export function processBlockedDenomination(manifest, progressTracker = null) {
  if (progressTracker) {
    progressTracker.onDenominationBlocked(manifest.name, manifest.blockerReason, manifest.blockerNote);
  }
  return {
    id: manifest.id,
    name: manifest.name,
    status: "blocked",
    stage: "blocked",
    officialSourceUrl: manifest.officialDirectoryUrl,
    blockerReason: manifest.blockerReason,
    blockerNote: manifest.blockerNote,
    provenance: manifest.provenance,
    recordCount: 0,
    records: [],
  };
}

// ---------------------------------------------------------------------------
// 체크포인트 및 원자적 파일 I/O
// ---------------------------------------------------------------------------

export async function atomicWriteJson(filePath, data) {
  const dir = path.dirname(filePath);
  await mkdir(dir, { recursive: true });
  const tmpPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(tmpPath, JSON.stringify(data, null, 2), "utf8");
  await rename(tmpPath, filePath);
}

export async function loadCheckpoint(checkpointPath) {
  try {
    const raw = await readFile(checkpointPath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function isDenominationCompleteInCheckpoint(checkpoint, id) {
  const state = checkpoint?.denominations?.[id];
  return Boolean(state && (state.stage === "completed" || state.stage === "blocked"));
}

// ---------------------------------------------------------------------------
// CLI 인자 파싱 및 메인 오케스트레이터
// ---------------------------------------------------------------------------

export function printHelp() {
  console.log(`batch-register-remaining-denominations.mjs

공식 공개 전국 명부가 확인된 잔여 교단을 결정적 순서로 수집·정규화하고,
13개 전체 교단의 공식 명부 상태(available/completed/blocked/error)를 머신러닝/자동화 파이프라인용
상태 보고서로 생성하는 공식 명부 수집 전용 프로그램입니다.

※ 안내: 본 프로그램은 공식 디렉터리 수집(official-directory collection) 전용으로 동작합니다.
  후속 기존 조사/검증(discovery/validation) 및 새 소스 범위 통합(source-scope integration)은 별도 단계로 수행됩니다.

사용법:
  node scripts/batch-register-remaining-denominations.mjs [옵션]

옵션:
  --output <path>        결과 JSON 파일 경로 (기본: out/batch-remaining-denominations.json)
  --checkpoint <path>    체크포인트 파일 경로 (기본: <output>.checkpoint.json)
  --report <path>        머신러닝용 상태 보고서 JSON 파일 경로 (기본: <output>.report.json)
  --resume               체크포인트를 확인해 이미 완료/차단된 교단은 건너뛰고 이어서 실행
  --only <ids>           특정 교단 식별자만 처리 (예: --only tonghap,kmc)
  --delay-ms <n>         요청 간 최소 지연(ms) (기본: ${DEFAULT_DELAY_MS})
  --max-pages <n>        지역/연회당 최대 페이지 수 (테스트/제한 실행용)
  --help, -h             도움말 출력 후 종료
`);
}

export function parseArgs(argv) {
  const args = {
    output: "out/batch-remaining-denominations.json",
    checkpoint: null,
    report: null,
    resume: false,
    only: null,
    delayMs: DEFAULT_DELAY_MS,
    maxPages: 200,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    switch (token) {
      case "--output":
        args.output = argv[++i];
        break;
      case "--checkpoint":
        args.checkpoint = argv[++i];
        break;
      case "--report":
        args.report = argv[++i];
        break;
      case "--resume":
        args.resume = true;
        break;
      case "--only":
        args.only = argv[++i];
        break;
      case "--delay-ms": {
        const n = Number.parseInt(argv[++i], 10);
        if (Number.isFinite(n) && n >= 0) args.delayMs = n;
        break;
      }
      case "--max-pages": {
        const n = Number.parseInt(argv[++i], 10);
        if (Number.isFinite(n) && n > 0) args.maxPages = n;
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

  if (!args.checkpoint && args.output) {
    args.checkpoint = `${args.output}.checkpoint.json`;
  }
  if (!args.report && args.output) {
    args.report = `${args.output}.report.json`;
  }

  return args;
}

export async function runBatchProgram(args) {
  const progressTracker = createProgressTracker({ actorTag: ACTOR_TAG });
  const rateGate = createRateGate(args.delayMs);

  const targetIds = args.only
    ? args.only
        .split(",")
        .map((s) => s.trim())
        .filter((id) => Boolean(MANIFEST_BY_ID[id]))
    : DEFAULT_MANIFEST_ORDER;

  let checkpoint = args.resume ? await loadCheckpoint(args.checkpoint) : null;
  if (!checkpoint) {
    checkpoint = {
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      updatedAtKst: nowKstLabel(ACTOR_TAG),
      denominations: {},
    };
  }

  const denominationResults = [];

  for (const id of targetIds) {
    const manifest = MANIFEST_BY_ID[id];
    if (!manifest) continue;

    // 1. 체크포인트 재개 검사
    if (args.resume && isDenominationCompleteInCheckpoint(checkpoint, id)) {
      const savedState = checkpoint.denominations[id];
      let loadedRecords = [];
      if (savedState.recordsFile) {
        try {
          const raw = await readFile(savedState.recordsFile, "utf8");
          const parsed = JSON.parse(raw);
          loadedRecords = parsed.records || [];
        } catch {}
      }

      denominationResults.push({
        ...manifest,
        status: savedState.status,
        stage: savedState.stage,
        recordCount: savedState.recordCount ?? loadedRecords.length,
        records: loadedRecords,
        resumedFromCheckpoint: true,
      });

      console.error(
        `${nowKstLabel(ACTOR_TAG)} [${manifest.name}] 체크포인트에서 재개 (status=${savedState.status}, count=${savedState.recordCount})`
      );
      continue;
    }

    // 2. 차단 교단 처리
    if (manifest.status === "blocked") {
      const blockedResult = processBlockedDenomination(manifest, progressTracker);
      denominationResults.push(blockedResult);

      checkpoint.denominations[id] = {
        id,
        name: manifest.name,
        stage: "blocked",
        status: "blocked",
        recordCount: 0,
        reason: manifest.blockerReason,
        note: manifest.blockerNote,
        completedAt: new Date().toISOString(),
      };
      await atomicWriteJson(args.checkpoint, checkpoint);
      continue;
    }

    // 3. 지원 교단 수집
    try {
      let result;
      switch (id) {
        case "tonghap":
          result = await collectTonghap({ rateGate, maxPages: args.maxPages, progressTracker });
          break;
        case "kmc":
          result = await collectKmc({ rateGate, maxPages: args.maxPages, progressTracker });
          break;
        case "salvation":
          result = await collectSalvation({ rateGate, progressTracker });
          break;
        case "anglican":
          result = await collectAnglican({ rateGate, progressTracker });
          break;
        default:
          throw new Error(`알 수 없는 수집 대상 ID: ${id}`);
      }

      denominationResults.push(result);

      // 교단별 개별 파일 저장
      const outDir = path.dirname(args.output);
      const denomOutPath = path.join(outDir, `${path.basename(args.output, ".json")}-${id}.json`);
      await atomicWriteJson(denomOutPath, {
        metadata: {
          denominationId: id,
          denominationName: manifest.name,
          generatedAt: new Date().toISOString(),
          recordCount: result.records.length,
        },
        records: result.records,
      });

      checkpoint.denominations[id] = {
        id,
        name: manifest.name,
        stage: result.stage || "completed",
        status: result.status || "completed",
        recordCount: result.records.length,
        recordsFile: denomOutPath,
        completedAt: new Date().toISOString(),
      };
      await atomicWriteJson(args.checkpoint, checkpoint);
    } catch (error) {
      progressTracker.onDenominationError(manifest.name, error.message);
      const errorResult = {
        id,
        name: manifest.name,
        status: "error",
        stage: "error",
        officialSourceUrl: manifest.officialDirectoryUrl,
        provenance: manifest.provenance,
        error: error.message,
        recordCount: 0,
        records: [],
      };
      denominationResults.push(errorResult);

      checkpoint.denominations[id] = {
        id,
        name: manifest.name,
        stage: "error",
        status: "error",
        recordCount: 0,
        error: error.message,
        failedAt: new Date().toISOString(),
      };
      await atomicWriteJson(args.checkpoint, checkpoint);
    }
  }

  // 전체 통합 및 중복 제거
  const allRecords = denominationResults.flatMap((r) => r.records || []);
  const finalRecords = dedupeRecords(allRecords);

  // 13개 전체 교단 상태 보고서 생성
  const statusReport = {
    reportVersion: "1.0",
    generatedAt: new Date().toISOString(),
    generatedAtKst: nowKstLabel(ACTOR_TAG),
    totalDenominations: DENOMINATION_MANIFEST.length,
    summary: {
      requestedCount: targetIds.length,
      availableCount: denominationResults.filter((r) => r.status === "available" || r.status === "completed").length,
      completedCount: denominationResults.filter((r) => r.status === "completed").length,
      blockedCount: denominationResults.filter((r) => r.status === "blocked").length,
      errorCount: denominationResults.filter((r) => r.status === "error").length,
      totalRawRecords: allRecords.length,
      totalDedupedRecords: finalRecords.length,
    },
    denominations: DENOMINATION_MANIFEST.map((manifest) => {
      const runResult = denominationResults.find((r) => r.id === manifest.id);
      return {
        id: manifest.id,
        name: manifest.name,
        status: runResult ? runResult.status : manifest.status,
        stage: runResult ? runResult.stage || runResult.status : "pending",
        recordCount: runResult ? runResult.recordCount || 0 : 0,
        officialSourceUrl: manifest.officialDirectoryUrl,
        blockerReason: runResult?.blockerReason || manifest.blockerReason || null,
        blockerNote: runResult?.blockerNote || manifest.blockerNote || null,
        provenance: manifest.provenance,
      };
    }),
  };

  // 출력물 저장
  const consolidatedOutput = {
    metadata: statusReport.summary,
    report: statusReport,
    records: finalRecords,
  };

  await atomicWriteJson(args.output, consolidatedOutput);
  await atomicWriteJson(args.report, statusReport);

  console.error(
    `${nowKstLabel(ACTOR_TAG)} [전체 수집 완료] 처리 교단 ${denominationResults.length}곳 (완료 ${statusReport.summary.completedCount}, 차단 ${statusReport.summary.blockedCount}, 오류 ${statusReport.summary.errorCount}), 공식 수집 레코드 ${finalRecords.length}건 저장 완료: ${args.output} (후속 조사/검증 및 소스 범위 통합은 별도 단계)`
  );

  return { statusReport, consolidatedOutput };
}

// ---------------------------------------------------------------------------
// 실행 진입점
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }
  await runBatchProgram(args);
}

const isDirectExecution =
  Boolean(process.argv[1]) &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isDirectExecution) {
  main().catch((error) => {
    console.error(`${nowKstLabel(ACTOR_TAG)} [실패] ${error.message}`);
    process.exitCode = 1;
  });
}
