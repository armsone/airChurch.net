#!/usr/bin/env node

/**
 * 스마트처치의 공개 교회 명부를 후보 원천으로만 사용한다.
 * 화면에 공개된 교회명·주소·교단·담임목사·공식 홈페이지·YouTube 링크만
 * 남기며, 원본 API에 포함될 수 있는 계정/후원 정보는 출력하지 않는다.
 */

import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIRECTORY_URL = "https://www.smartchurch.net/homepages";
const API_URL = "https://api.smartchurch.net/api/v1/homepages?homepageStatuses=ACTIVE&page=0&pageSize=500&sort=createdAt,DESC";
const USER_AGENT = "Mozilla/5.0 (compatible; AirChurchCandidateVerifier/1.0; +https://airchurch.net)";
const TIMEOUT_MS = 12_000;
const CONCURRENCY = 8;
const RECENT_DAYS = 180;
const SERMON_WORDS = ["설교", "예배", "말씀", "주일", "수요", "새벽", "기도회", "worship", "sermon"];

const DENOMINATIONS = {
  "PCK-H": "대한예수교장로회 합동",
  "PCK-T": "대한예수교장로회 통합",
  "PCK-B": "대한예수교장로회 백석",
  "PCK-K": "대한예수교장로회 고신",
  "PCK-HS": "대한예수교장로회 합신",
  "PCK-HJS": "대한예수교장로회 합동중앙",
  PROK: "한국기독교장로회",
  KMC: "기독교대한감리회",
  KBC: "기독교한국침례회",
  KES: "기독교대한성결교회",
  JES: "예수교대한성결교회",
  "AG-KR": "기독교대한하나님의성회",
  KAICAM: "한국독립교회선교단체협의회",
  LCK: "대한기독교나사렛성결회",
  PCKD: "대한예수교장로회 대신",
  KNC: "대한성공회",
  WAIC: "웨이크",
  "CMA-US": "기독교선교연맹",
};

function args(argv) {
  const value = (flag, fallback) => {
    const index = argv.indexOf(flag);
    return index >= 0 ? argv[index + 1] : fallback;
  };
  return {
    output: value("--output", "out/smartchurch/candidates.json"),
    verifiedOutput: value("--verified-output", "out/smartchurch/verified-direct.json"),
    reviewOutput: value("--review-output", "out/smartchurch/review.json"),
    searchOutput: value("--search-output", "out/smartchurch/search-input.json"),
  };
}

function decode(value) {
  return String(value || "")
    .replaceAll("&amp;", "&").replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'").replaceAll("&lt;", "<").replaceAll("&gt;", ">");
}

function cleanText(value) {
  return decode(value).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeName(value) {
  return cleanText(value).normalize("NFKC").toLowerCase().replace(/\s+/g, "").replace(/[()·・.,'"_-]/g, "");
}

function regionFromAddress(address) {
  const text = cleanText(address).replace(/^대한민국\s*/, "");
  if (/미국|Canada|캐나다|인도네시아|Indonesia/i.test(text)) return "";
  if (/South Korea/i.test(text) && /Seoul/i.test(text)) return "서울";
  const short = text.match(/^(서울|부산|대구|인천|광주|대전|울산|경기|강원|충북|충남|전북|전남|경북|경남|제주)\s+([^\s]+)/);
  if (short) return `${short[1]} ${short[2].replace(/시$/, "")}`;
  const inferred = [
    [/^부산진구\b/, "부산 부산진구"], [/^전주시\b/, "전북 전주"], [/^수원시\b/, "경기 수원"],
    [/^용인시\b/, "경기 용인"], [/^고양시\b/, "경기 고양"], [/^성남시\b/, "경기 성남"],
    [/^부천시\b/, "경기 부천"], [/^안양시\b/, "경기 안양"], [/^안산시\b/, "경기 안산"],
    [/^화성시\b/, "경기 화성"], [/^평택시\b/, "경기 평택"], [/^의정부시\b/, "경기 의정부"],
  ];
  for (const [regex, region] of inferred) if (regex.test(text)) return region;
  const rules = [
    [/^(서울특별시|서울시)\s+([^\s]+)/, "서울"], [/^(부산광역시|부산시)\s+([^\s]+)/, "부산"],
    [/^(대구광역시|대구시)\s+([^\s]+)/, "대구"], [/^(인천광역시|인천시)\s+([^\s]+)/, "인천"],
    [/^(광주광역시|광주시)\s+([^\s]+)/, "광주"], [/^(대전광역시|대전시)\s+([^\s]+)/, "대전"],
    [/^(울산광역시|울산시)\s+([^\s]+)/, "울산"], [/^세종(?:특별자치시|시)?\s*/, "세종"],
    [/^경기도\s+([^\s]+)/, "경기"], [/^강원(?:특별자치도|도)\s+([^\s]+)/, "강원"],
    [/^충청북도\s+([^\s]+)/, "충북"], [/^충청남도\s+([^\s]+)/, "충남"],
    [/^(?:전북특별자치도|전라북도)\s+([^\s]+)/, "전북"], [/^전라남도\s+([^\s]+)/, "전남"],
    [/^경상북도\s+([^\s]+)/, "경북"], [/^경상남도\s+([^\s]+)/, "경남"],
    [/^제주(?:특별자치도|도)\s+([^\s]+)/, "제주"],
  ];
  for (const [regex, province] of rules) {
    const match = text.match(regex);
    if (!match) continue;
    const locality = (match[2] || match[1] || "").replace(/시$/, "");
    return locality && locality !== province ? `${province} ${locality}` : province;
  }
  return "";
}

function isKoreanAddress(address) {
  if (/미국|Canada|캐나다|인도네시아|Indonesia/i.test(address)) return false;
  return /대한민국|서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충청|충북|충남|전라|전북|전남|경상|경북|경남|제주|South Korea/i.test(address);
}

function pastorFromHtml(html) {
  const patterns = [
    /<p[^>]*>([^<]{2,30})<\/p>\s*<p[^>]*>\s*담임목사\s*<\/p>/i,
    /alt=["']([^"']{2,30})\s+담임목사\s+사진["']/i,
    /\\?"role\\?":\\?"담임목사\\?",\\?"name\\?":\\?"([^"\\]{2,30})/i,
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) return `${cleanText(match[1])} 목사`;
  }
  return "";
}

function youtubeUrlsFromHtml(html, baseUrl) {
  const urls = new Set();
  const regex = /(?:href|link)\\?"?\s*[:=]\s*\\?["'](https?:\\?\/\\?\/(?:www\.)?(?:youtube\.com|youtu\.be)[^"'\\<]*)/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    try {
      const raw = decode(match[1]).replaceAll("\\/", "/");
      const url = new URL(raw, baseUrl);
      url.searchParams.delete("si"); url.searchParams.delete("feature");
      urls.add(url.toString());
    } catch {}
  }
  return [...urls].sort((a, b) => youtubeRank(a) - youtubeRank(b));
}

function youtubeRank(url) {
  if (/\/channel\/UC[\w-]{20,}/.test(url)) return 0;
  if (/\/@[^/?]+/.test(url)) return 1;
  if (/\/(?:c|user)\/[^/?]+/.test(url)) return 2;
  if (/\/(?:watch|live|shorts)\b|youtu\.be\//.test(url)) return 3;
  return 4;
}

async function fetchText(url, accept = "text/html,application/xhtml+xml") {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, { redirect: "follow", signal: controller.signal, headers: { "User-Agent": USER_AGENT, Accept: accept } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return { text: await response.text(), finalUrl: response.url };
  } finally { clearTimeout(timer); }
}

async function channelIdFromUrl(url) {
  const direct = url.match(/\/channel\/(UC[\w-]{20,})/);
  if (direct) return direct[1];
  const { text } = await fetchText(url);
  const patterns = [/"channelId":"(UC[\w-]{20,})"/, /"externalId":"(UC[\w-]{20,})"/, /<meta itemprop="channelId" content="(UC[\w-]{20,})"/];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function feedEntries(xml) {
  return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map((match) => {
    const body = match[1];
    return {
      videoId: body.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1] || "",
      title: cleanText(body.match(/<title>([\s\S]*?)<\/title>/)?.[1] || ""),
      publishedAt: body.match(/<published>([^<]+)<\/published>/)?.[1] || "",
    };
  });
}

async function recentSermons(channelId) {
  const { text } = await fetchText(`https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`, "application/atom+xml,text/xml");
  const cutoff = Date.now() - RECENT_DAYS * 86_400_000;
  return feedEntries(text).filter((entry) => Date.parse(entry.publishedAt) >= cutoff && SERMON_WORDS.some((word) => entry.title.toLowerCase().includes(word)));
}

async function atomicJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.tmp-${process.pid}`;
  await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temp, file);
}

function reason(record) {
  if (!record.name || !record.address || !record.region) return "missing_identity_or_address";
  if (!record.isKorean) return "outside_korea";
  if (!record.denomination) return "denomination_missing";
  if (!record.pastor) return "pastor_missing";
  if (/테스트|sample|ㄱㅁㅈㅂㄱ/i.test(record.name)) return "test_record";
  if (/선교회|연구소|아카데미|센터/.test(record.name) && !/교회/.test(record.name)) return "not_a_local_church";
  return null;
}

async function main() {
  const options = args(process.argv.slice(2));
  const response = await fetch(API_URL, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" } });
  if (!response.ok) throw new Error(`스마트처치 명부 HTTP ${response.status}`);
  const payload = await response.json();
  const safeBase = (payload.data || []).map((item) => {
    const church = item.church || {};
    const denomination = cleanText(church.denominationName || DENOMINATIONS[church.denomination] || "");
    const address = cleanText(church.address || "");
    return {
      recordKey: `smartchurch|${item.uuid || item.id}`,
      name: cleanText(church.name || item.title), address, region: regionFromAddress(address), denomination,
      homepage: `https://${cleanText(item.domain)}/`, directorySourceUrl: DIRECTORY_URL,
      isKorean: isKoreanAddress(address), source: "smartchurch-public-directory",
    };
  });

  const records = new Array(safeBase.length);
  let cursor = 0, completed = 0, nextReport = Math.ceil(safeBase.length / 10);
  async function worker() {
    while (cursor < safeBase.length) {
      const index = cursor++; const base = safeBase[index];
      let record = { ...base, pastor: "", youtubeUrls: [], channelId: null, recentSermons: [], status: "review", decision: "needs_review", holdReason: null };
      try {
        const { text: html, finalUrl } = await fetchText(base.homepage);
        record.homepage = finalUrl; record.pastor = pastorFromHtml(html); record.youtubeUrls = youtubeUrlsFromHtml(html, finalUrl);
        record.holdReason = reason(record);
        if (!record.holdReason && record.youtubeUrls.length) {
          record.channelId = await channelIdFromUrl(record.youtubeUrls[0]);
          if (record.channelId) record.recentSermons = await recentSermons(record.channelId);
          if (!record.channelId) record.holdReason = "youtube_channel_unresolved";
          else if (!record.recentSermons.length) record.holdReason = "no_recent_sermon";
          else { record.status = "verified"; record.decision = "approved"; }
        } else if (!record.holdReason) record.holdReason = "youtube_missing";
      } catch (error) { record.holdReason = `fetch_error:${error?.name === "AbortError" ? "timeout" : error.message}`; }
      records[index] = record; completed++;
      if (completed >= nextReport || completed === safeBase.length) {
        console.error(`PROGRESS|smartchurch|${completed}|${safeBase.length}|${Math.floor(completed / safeBase.length * 100)}% 확인`);
        nextReport += Math.ceil(safeBase.length / 10);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, safeBase.length || 1) }, worker));

  const verified = records.filter((record) => record.status === "verified").map((record) => ({
    ...record, evidenceVideos: record.recentSermons.slice(0, 6).map((video) => ({ videoId: video.videoId, title: video.title, publishedAt: video.publishedAt })),
    sourceEvidence: { directorySourceUrl: record.directorySourceUrl, homepage: record.homepage, officialYoutubeUrl: record.youtubeUrls[0] },
  }));
  const review = records.filter((record) => record.status !== "verified");
  const searchRecords = review.filter((record) =>
    record.name && record.pastor && record.region && record.denomination && record.isKorean &&
    !record.holdReason?.startsWith("fetch_error") &&
    !["test_record", "not_a_local_church", "no_recent_sermon"].includes(record.holdReason)
  ).map((record) => ({
    recordKey: record.recordKey, name: record.name, pastor: record.pastor, region: record.region, address: record.address,
    denomination: record.denomination, homepage: record.homepage, youtubeHandleLead: record.youtubeUrls.find((url) => /\/@/.test(url))?.match(/\/@([^/?]+)/)?.[1] || null,
    youtubeChannelIds: record.channelId ? [record.channelId] : [], evidence: { directorySourceUrl: record.homepage, sourceRegionQuery: record.region },
  }));
  const metadata = { generatedAt: new Date().toISOString(), source: DIRECTORY_URL, total: records.length, verifiedDirect: verified.length, review: review.length, searchTargets: searchRecords.length };
  await atomicJson(options.output, { metadata, records });
  await atomicJson(options.verifiedOutput, { metadata, results: verified });
  await atomicJson(options.reviewOutput, { metadata, results: review });
  await atomicJson(options.searchOutput, { metadata, records: searchRecords });
  console.log(JSON.stringify(metadata));
}

const direct = Boolean(process.argv[1]) && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (direct) main().catch((error) => { console.error(error.message); process.exitCode = 1; });

export { channelIdFromUrl, pastorFromHtml, recentSermons, regionFromAddress, youtubeUrlsFromHtml };
