#!/usr/bin/env node
import { mkdir, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { CATALOG } from "../airchurch-denomination-catalog.mjs";

const arg = (name, fallback = null) => { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : fallback; };
const baseUrl = arg("--base-url", "https://airchurch.net").replace(/\/$/, "");
const outputPath = arg("--output", "data/worship-schedules/all-registered-churches.json");
const delayMs = Math.max(100, Number(arg("--delay-ms", "500")));
const regions = ["서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종", "경기", "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주", "해외", "기타", "전국", "지역 확인 필요"];
const regionSplits = {
  "서울": ["종로", "중", "용산", "성동", "광진", "동대문", "중랑", "성북", "강북", "도봉", "노원", "은평", "서대문", "마포", "양천", "강서", "구로", "금천", "영등포", "동작", "관악", "서초", "강남", "송파", "강동"].map((name) => `서울 ${name}`),
  "경기": ["수원", "성남", "의정부", "안양", "부천", "광명", "평택", "동두천", "안산", "고양", "과천", "구리", "남양주", "오산", "시흥", "군포", "의왕", "하남", "용인", "파주", "이천", "안성", "김포", "화성", "광주", "양주", "포천", "여주", "연천", "가평", "양평"].map((name) => `경기 ${name}`),
};
const additionalDenominations = [
  "대한예수교장로회",
  "기독교대한하나님의성회 광화문총회",
  "독립교회",
  "한국독립교회선교단체연합회",
];
const denominations = [...new Set([...CATALOG.map((item) => item.name), ...additionalDenominations])];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function getJson(params) {
  const url = new URL("/api/churches", baseUrl);
  for (const [key, value] of Object.entries(params)) if (value !== undefined) url.searchParams.set(key, String(value));
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const response = await fetch(url, { headers: { Accept: "application/json", "User-Agent": "AirChurchRegistryExporter/1.0 (+https://airchurch.net/contact)" } });
    if (response.ok) {
      const value = await response.json();
      await sleep(delayMs);
      return value;
    }
    if (attempt === 4 || response.status < 500) throw new Error(`${url} 응답 실패: HTTP ${response.status}`);
    await sleep(delayMs * attempt * 2);
  }
  throw new Error(`${url} 응답을 받지 못했습니다.`);
}

async function atomicJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporaryPath, path);
}

const expectedTotal = Number((await getJson({ countOnly: 1 })).total || 0);
const denominationCounts = [];
const churchesById = new Map();

for (const denomination of denominations) {
  const total = Number((await getJson({ denomination, countOnly: 1 })).total || 0);
  denominationCounts.push({ denomination, total });
  if (!total) continue;
  if (total <= 200) {
    const result = await getJson({ denomination });
    for (const church of result.items || []) churchesById.set(church.id, church);
    continue;
  }
  const denominationIds = new Set();
  for (const region of regions) {
    const regionalTotal = Number((await getJson({ denomination, region, countOnly: 1 })).total || 0);
    if (!regionalTotal) continue;
    if (regionalTotal <= 200) {
      const result = await getJson({ denomination, region });
      if ((result.items || []).length !== regionalTotal) throw new Error(`${denomination}/${region} 개수 불일치: ${result.items?.length || 0}/${regionalTotal}`);
      for (const church of result.items || []) { denominationIds.add(church.id); churchesById.set(church.id, church); }
      continue;
    }
    const subdivisions = regionSplits[region];
    if (!subdivisions) throw new Error(`${denomination}/${region} 결과 ${regionalTotal}건이 API 한도 200건을 넘고 하위 지역 목록이 없습니다.`);
    let regionalCovered = 0;
    for (const subdivision of subdivisions) {
      const subdivisionTotal = Number((await getJson({ denomination, region: subdivision, countOnly: 1 })).total || 0);
      if (!subdivisionTotal) continue;
      if (subdivisionTotal > 200) throw new Error(`${denomination}/${subdivision} 결과 ${subdivisionTotal}건이 API 한도 200건을 넘습니다.`);
      const result = await getJson({ denomination, region: subdivision });
      if ((result.items || []).length !== subdivisionTotal) throw new Error(`${denomination}/${subdivision} 개수 불일치: ${result.items?.length || 0}/${subdivisionTotal}`);
      regionalCovered += subdivisionTotal;
      for (const church of result.items || []) { denominationIds.add(church.id); churchesById.set(church.id, church); }
    }
    if (regionalCovered < regionalTotal) throw new Error(`${denomination}/${region} 하위 지역 분할 누락: ${regionalCovered}/${regionalTotal}`);
  }
  if (denominationIds.size !== total) throw new Error(`${denomination} 지역 분할 누락: ${denominationIds.size}/${total}`);
}

const knownDenominationTotal = denominationCounts.reduce((sum, item) => sum + item.total, 0);
if (knownDenominationTotal !== expectedTotal) {
  throw new Error(`교단 목록 누락 가능성: 알려진 교단 합계 ${knownDenominationTotal}, 전체 ${expectedTotal}`);
}
if (churchesById.size !== expectedTotal) throw new Error(`등록 교회 내보내기 누락: ${churchesById.size}/${expectedTotal}`);

const churches = [...churchesById.values()].sort((a, b) => a.id - b.id).map((church) => ({
  church_id: church.id,
  church_name: church.name,
  pastor: church.pastor || null,
  region: church.region || null,
  denomination: church.denomination || null,
  homepage_url: church.homepageUrl || null,
  profile_source_url: church.homepageUrl || null,
  source_urls: church.homepageUrl ? [church.homepageUrl] : [],
}));
const withHomepage = churches.filter((church) => church.homepage_url).length;
const output = {
  metadata: {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    source: `${baseUrl}/api/churches`,
    approved_only: true,
    expected_total: expectedTotal,
    exported_total: churches.length,
    with_homepage: withHomepage,
    without_homepage: churches.length - withHomepage,
    completeness_verified: true,
    denomination_counts: denominationCounts.filter((item) => item.total),
  },
  churches,
};
await atomicJson(outputPath, output);
console.log(JSON.stringify({ expected: expectedTotal, exported: churches.length, with_homepage: withHomepage, without_homepage: churches.length - withHomepage, output: outputPath }));
