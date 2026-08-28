#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const DENOMINATIONS = {
  anglican: "대한성공회",
  nazarene: "대한기독교나사렛성결회",
  yehc: "예수교대한성결교회",
  bokum: "기독교대한복음교회",
};

const DISTRICTS = [1, 2, 3, 4, 5, 6];
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/128 Safari/537.36";

function parseArgs(argv) {
  const args = { only: Object.keys(DENOMINATIONS), output: "out/public-remaining-denominations.json" };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--only") args.only = argv[++i].split(",").map((v) => v.trim()).filter(Boolean);
    else if (argv[i] === "--output") args.output = argv[++i];
  }
  args.only = args.only.filter((id) => DENOMINATIONS[id]);
  if (!args.only.length) throw new Error("지원 교단을 선택하세요: nazarene,yehc,bokum");
  return args;
}

function decodeHtml(value = "") {
  return value
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/\s+/g, " ")
    .trim();
}

function stripHtml(value = "") {
  return decodeHtml(String(value || "").replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, " "));
}

function regionFromText(value = "") {
  const text = value.replace(/^\(\d{5}\)\s*/, "");
  const aliases = [
    [/(서울|서울시|서울특별시)/, "서울"],
    [/(부산|부산시|부산광역시)/, "부산"],
    [/(대구|대구시|대구광역시)/, "대구"],
    [/(인천|인천시|인천광역시)/, "인천"],
    [/(광주|광주시|광주광역시)/, "광주"],
    [/(대전|대전시|대전광역시)/, "대전"],
    [/(울산|울산시|울산광역시)/, "울산"],
    [/(세종|세종시|세종특별자치시)/, "세종"],
    [/(경기도|경기)/, "경기"],
    [/(강원특별자치도|강원도|강원)/, "강원"],
    [/(충청북도|충북)/, "충북"],
    [/(충청남도|충남)/, "충남"],
    [/(전북특별자치도|전라북도|전북)/, "전북"],
    [/(전라남도|전남)/, "전남"],
    [/(경상북도|경북)/, "경북"],
    [/(경상남도|경남)/, "경남"],
    [/(제주특별자치도|제주도|제주)/, "제주"],
  ];
  for (const [pattern, region] of aliases) if (pattern.test(text)) return region;
  return "지역 확인 필요";
}

function standardize({ denomination, name, pastor, address, region, homepage, officialSourceUrl, presbytery }) {
  const cleanHomepage = /^https?:\/\//i.test(homepage || "") ? homepage.trim() : null;
  return {
    denomination,
    presbytery: presbytery || null,
    name: stripHtml(name),
    rawName: stripHtml(name),
    address: stripHtml(address) || null,
    region: region || regionFromText(`${address || ""}`),
    pastor: stripHtml(pastor) || "담임목사 확인 필요",
    homepage: cleanHomepage,
    homepageStatus: cleanHomepage ? "official-directory" : "not-provided",
    officialSourceUrl,
    evidence: { directorySourceUrl: officialSourceUrl },
  };
}

async function fetchText(url, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { "user-agent": USER_AGENT, "accept-language": "ko-KR,ko;q=0.9" } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.text();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
    }
  }
  throw lastError;
}

async function mapLimit(items, limit, fn) {
  const result = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      result[index] = await fn(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length || 1) }, worker));
  return result;
}

function parseNazareneCard(html, sourceUrl) {
  const name = html.match(/card-title[^>]*title="([^"]+)"/i)?.[1];
  if (!name) return null;
  const district = html.match(/<p[^>]*title="([^"]*지방회)"/i)?.[1] || null;
  const pastor = html.match(/title="담임목사\s*([^"]+)"/i)?.[1];
  const address = html.match(/addr text-muted"\s+title="([^"]*)"/i)?.[1];
  return standardize({
    denomination: DENOMINATIONS.nazarene,
    name,
    pastor: pastor ? `${pastor} 목사` : null,
    address,
    presbytery: district,
    officialSourceUrl: sourceUrl,
  });
}

async function collectNazarene() {
  const churches = new Map();
  for (const district of DISTRICTS) {
    const url = `https://na.or.kr/om/district/list.php?dn=${district}`;
    const html = await fetchText(url);
    for (const match of html.matchAll(/<a href="https:\/\/na\.or\.kr\/om\/church\/view\.php\?cid=(\d+)">([^<]+)<\/a>/g)) {
      churches.set(match[1], { id: match[1], name: decodeHtml(match[2]), district });
    }
  }
  const entries = [...churches.values()];
  const records = await mapLimit(entries, 5, async (entry, index) => {
    const url = new URL("https://na.or.kr/om/church/list.php");
    url.searchParams.set("dist", String(entry.district));
    url.searchParams.set("sfield", "basic,addr,people");
    url.searchParams.set("stx_inc", entry.name);
    const html = await fetchText(url);
    const record = parseNazareneCard(html, url.toString());
    if ((index + 1) % 100 === 0) console.error(`나사렛 ${index + 1}/${entries.length}`);
    return record;
  });
  return records.filter(Boolean);
}

function cellsFromRow(row) {
  return [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((match) => stripHtml(match[1]));
}

async function collectYehc() {
  const sourceUrl = "https://sungkyul.org/branch/site.php";
  const html = await fetchText(sourceUrl);
  const records = [];
  for (const match of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const row = match[1];
    const cells = cellsFromRow(row);
    const href = row.match(/class="btn-common04"\s+href="([^"]+)"/i)?.[1]?.trim();
    if (cells.length < 2 || !href || !cells[0] || cells[0] === "교회명") continue;
    const description = cells[1];
    const pastor = description.match(/([가-힣]{2,4})\s*목사(?:님)?/i)?.[1];
    records.push(standardize({
      denomination: DENOMINATIONS.yehc,
      name: cells[0],
      pastor: pastor ? `${pastor} 목사` : null,
      address: description,
      region: regionFromText(description),
      homepage: href,
      officialSourceUrl: sourceUrl,
    }));
  }
  return records;
}

async function collectBokum() {
  const officialSourceUrl = "http://www.pkec.org/main/sub.html?pageCode=12";
  return [
    ["서울복음교회", "서울", "http://seoulgospel.co.kr"],
    ["군산복음교회", "전북", "http://www.kunsanch.org"],
    ["갈릴리교회", "지역 확인 필요", "http://igalilee.org"],
    ["군산방주교회", "전북", "http://www.bangju.or.kr/"],
  ].map(([name, region, homepage]) => standardize({
    denomination: DENOMINATIONS.bokum,
    name,
    region,
    homepage,
    officialSourceUrl,
  }));
}

async function collectAnglican() {
  const officialSourceUrl = "https://anglicankr.church/대한성공회-주소록/";
  const html = await fetchText(officialSourceUrl);
  const records = [];
  for (const match of html.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)) {
    const row = match[1];
    const name = stripHtml(row.split(/<br\s*\/?>/i)[0]);
    if (!/(교회|성당|기도소)/.test(name) || !/\(\d{5,6}\)/.test(row)) continue;
    const address = stripHtml(row.match(/\(\d{5,6}\)\s*([\s\S]*?)(?:<br\s*\/?>)/i)?.[1]);
    const pastorMatch = stripHtml(row).match(/(?:관할|주임|담당|관리|촉탁)\s*(?:사제|주교)?\s*:?\s*([가-힣]{2,4})\s*(신부|주교)/);
    const webMatch = row.match(/web:[\s\S]*?<a[^>]+href=["'](https?:\/\/[^"']+)["']/i);
    records.push(standardize({
      denomination: DENOMINATIONS.anglican,
      name,
      pastor: pastorMatch ? `${pastorMatch[1]} ${pastorMatch[2]}` : null,
      address,
      homepage: webMatch?.[1] || null,
      officialSourceUrl,
    }));
  }
  return records;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const records = [];
  for (const id of args.only) {
    if (id === "anglican") records.push(...await collectAnglican());
    if (id === "nazarene") records.push(...await collectNazarene());
    if (id === "yehc") records.push(...await collectYehc());
    if (id === "bokum") records.push(...await collectBokum());
  }
  const deduped = [...new Map(records.filter((r) => r.name).map((r) => [`${r.denomination}|${r.name}|${r.region}`, r])).values()];
  await mkdir(path.dirname(path.resolve(args.output)), { recursive: true });
  await writeFile(args.output, `${JSON.stringify({ metadata: { generatedAt: new Date().toISOString(), source: "official-public" }, records: deduped }, null, 2)}\n`);
  console.log(JSON.stringify({ collected: deduped.length, byDenomination: Object.fromEntries(Object.values(DENOMINATIONS).map((name) => [name, deduped.filter((r) => r.denomination === name).length])) }));
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
