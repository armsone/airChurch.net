#!/usr/bin/env node

/**
 * 대한예수교장로회 합동 총회 공식 교회명부를 공개 API에서 전수 수집해
 * AirChurch 조사 파이프라인이 읽는 표준 JSON으로 변환한다.
 */

import { writeFile } from "node:fs/promises";

const SOURCE_PAGE = "https://www.gapck.org/customer-support?cat=church&search=ORG0003";
const SOURCE_API = "https://gapck.org/api/v1/eORG_USER_HOMEPAGE_CHURCH_LIST";
const DENOMINATION = "대한예수교장로회 합동";
const LIMIT = 12000;
const PLACEHOLDER_URLS = new Set(["", "-", "--", "없음", "x"]);

function parseArgs(argv) {
  const outputIndex = argv.indexOf("--output");
  return { output: outputIndex >= 0 ? argv[outputIndex + 1] : null };
}

function clean(value) {
  return value == null ? "" : String(value).normalize("NFKC").replace(/\s+/g, " ").trim();
}

function normalizeHomepage(value) {
  const raw = clean(value);
  if (PLACEHOLDER_URLS.has(raw.toLowerCase())) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}

function formatPastor(value) {
  const pastor = clean(value);
  if (!pastor) return "담임목사 확인 필요";
  return pastor.endsWith("목사") ? pastor : `${pastor} 목사`;
}

function regionFromAddress(value) {
  const address = clean(value)
    .replace(/^\(?\d{3}-\d{3,4}\)?\s*/, "")
    .replace(/^전남광주\s+(광산구|동구|서구|남구|북구)(?=\s)/, "광주 $1")
    .replace(/^전남광주\s+/, "전남 ")
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

async function main() {
  const { output } = parseArgs(process.argv.slice(2));
  if (!output) throw new Error("--output <path>가 필요합니다.");

  const url = new URL(SOURCE_API);
  url.searchParams.set("skip", "0");
  url.searchParams.set("limit", String(LIMIT));
  url.searchParams.set("sort", "1");
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`합동 공식 API 응답 실패: HTTP ${response.status}`);
  const payload = await response.json();
  if (!Array.isArray(payload.list) || payload.list.length !== payload.count) {
    throw new Error(`합동 공식 API 전수성 불일치: count=${payload.count}, list=${payload.list?.length}`);
  }

  const records = payload.list.filter((row) => clean(row.org_nm)).map((row) => {
    const address = clean(row.adrs);
    const homepage = normalizeHomepage(row.homepage_url);
    return {
      denomination: DENOMINATION,
      presbytery: clean(row.nh_nm) || null,
      name: clean(row.org_nm),
      rawName: clean(row.org_nm),
      postalCode: null,
      address: address || null,
      region: regionFromAddress(address),
      pastor: formatPastor(row.pastor),
      phone: clean(row.tel_no) || null,
      homepage,
      homepageStatus: homepage ? "unverified" : "not-provided",
      youtubeChannelIds: [],
      youtubeHandleLead: homepage && /(youtube\.com|youtu\.be)/i.test(homepage) ? homepage : null,
      evidence: { directorySourceUrl: SOURCE_PAGE, sourceApiUrl: url.toString(), sourceRegionQuery: null },
    };
  });

  const result = {
    metadata: {
      source: SOURCE_PAGE,
      sourceApi: url.toString(),
      generatedAt: new Date().toISOString(),
      rawRecordCount: payload.count,
      recordCount: records.length,
      homepageCount: records.filter((r) => r.homepage).length,
      youtubeHomepageCount: records.filter((r) => r.youtubeHandleLead).length,
    },
    records,
  };
  await writeFile(output, JSON.stringify(result, null, 2), "utf8");
  console.log(JSON.stringify(result.metadata));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
