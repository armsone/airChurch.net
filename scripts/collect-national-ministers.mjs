#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_INPUT = "out/pastor-history/nationwide-directory.json";
const DEFAULT_DIR = "out/pastor-history/national-collection";
const COLLECTOR_VERSION = 4;
const USER_AGENT = "airChurch-public-directory/1.0 (+https://airchurch.net)";
const ROLE_PATTERN = "초대담임목사|역대담임목사|수석부목사|부담임목사|교육부목사|행정부목사|목양부목사|담임목사|위임목사|대표목사|담당목사|설립목사|창립목사|개척목사|초대목사|부목사|부교역자|교육목사|행정목사|목양목사|선교목사|찬양목사|협동목사|명예목사|공로목사|원로목사|은퇴목사|강도사|전임전도사|교육전도사|전도사|목사";
const ROLE_RE = new RegExp(`(?:(?<![가-힣])(${ROLE_PATTERN})\\s*[:：·|/\\-]?\\s*([가-힣]{2,5})(?![가-힣])|(?<![가-힣])([가-힣]{2,5})\\s*(?:\\([^)]{0,30}\\)\\s*)?(${ROLE_PATTERN})(?![가-힣]))`, "gu");
const LINK_HINT = /교역자|목회자|사역자|섬기는|섬김|교회소개|인사말|목사|약력|소개|연혁|조직|staff|pastor|ministry|servant|history|greeting|about|intro/i;
const BLOCKED_PATH = /(?:login|logout|admin|mypage|signup|register|privacy|contact|donation|offering)/i;
const NAME_DENY = new Set(["교회소개", "예배안내", "섬기는", "사람들", "목회자", "교역자", "부교역자", "전도사", "담임목사", "위임목사", "원로목사", "은퇴목사", "교육목사", "협동목사", "오시는길", "대한예수", "예수교장", "기독교대한", "하나님의", "말씀으로", "복음으로", "사랑으로", "성령으로", "하나님을", "예수님을", "교회학교", "교육부서", "청년부를"]);
const SURNAME = /^(?:김|이|박|최|정|강|조|윤|장|임|한|오|서|신|권|황|안|송|전|홍|유|류|라|나|고|문|양|손|배|백|허|남|심|노|하|곽|성|차|주|우|구|민|진|지|엄|채|원|천|방|공|현|함|변|염|여|추|도|소|석|선|설|마|길|연|위|표|명|기|반|왕|금|옥|육|인|맹|제|모|탁|국|어|은|편|용|봉|태|빈|시|계|피|목|남궁|황보|제갈|선우|독고|사공)/u;
const COMPOUND_SURNAME = /^(?:남궁|황보|제갈|선우|독고|사공)/u;
const NON_PERSON = /^(?:하나|박사|권사|강도사|선교사|여전도사|조사|인사|인사말|공지|공지사항|기도회|위원회|고문위원|이사장|원로|원로장로|현재|성년부|소년부|어린이부|유소년부|장년부|장애인부|주강사|강사로|강사도|안수후|안수하여|인허받고|인허받다|인허식|위임건|위임식|위임식을|위임을|추대를|추대식|추대식을|추대와|추대의|사공집|은퇴|퇴임|소천|별세|청빙|후임|시무|취임|이임|성도|장로|권찰|설교|명예|안식년|인턴|이들)$/u;
const ORGANIZATION_AS_NAME = /(?:성전|교구|기관|선임|국장|부서|선교국)$/u;

function args(argv) {
  const value = (name, fallback) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : fallback; };
  return {
    input: value("--input", DEFAULT_INPUT),
    registered: value("--registered", "data/worship-schedules/all-registered-churches.json"),
    outputDir: value("--output-dir", DEFAULT_DIR),
    concurrency: Math.max(1, Number(value("--concurrency", 16))),
    limit: Math.max(0, Number(value("--limit", 0))),
    offset: Math.max(0, Number(value("--offset", 0))),
    timeoutMs: Math.max(2_000, Number(value("--timeout-ms", 8_000))),
    delayMs: Math.max(750, Number(value("--delay-ms", 900))),
    pagesPerChurch: Math.max(1, Math.min(8, Number(value("--pages-per-church", 3)))),
    sourceHost: clean(value("--source-host", "")).toLowerCase(),
    sourcePage: clean(value("--source-page", "")),
    churchName: clean(value("--church-name", "")),
    retryStatuses: new Set(clean(value("--retry-statuses", "")).split(",").filter(Boolean)),
    retryFailureTypes: new Set(clean(value("--retry-failure-types", "")).split(",").filter(Boolean)),
  };
}

const clean = (value) => String(value ?? "").normalize("NFKC").replace(/\s+/g, " ").trim();
const identityKey = (...values) => values.map((value) => clean(value).toLowerCase().replace(/[^0-9a-z가-힣]/g, "")).join("|");
const digest = (value, length = 20) => createHash("sha256").update(value).digest("hex").slice(0, length);
const nowIso = () => new Date().toISOString();

async function readJson(file, fallback = null) {
  try { return JSON.parse(await readFile(file, "utf8")); }
  catch (error) { if (error?.code === "ENOENT") return fallback; throw error; }
}

async function atomicJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporary, file);
}

function decodeEntities(value) {
  const named = { amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'", nbsp: " " };
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (_, entity) => {
    if (entity[0] === "#") {
      const point = entity[1].toLowerCase() === "x" ? Number.parseInt(entity.slice(2), 16) : Number.parseInt(entity.slice(1), 10);
      return Number.isFinite(point) ? String.fromCodePoint(point) : " ";
    }
    return named[entity.toLowerCase()] ?? " ";
  });
}

function htmlText(html) {
  return clean(decodeEntities(html
    .replace(/<!--\s*([^<>]{0,30}(?:목사|전도사|강도사))\s*-->/g, " $1 ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|svg|noscript|template)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<(?:br|\/p|\/li|\/div|\/tr|\/h[1-6])\s*>/gi, " \n ")
    .replace(/<[^>]+>/g, " ")));
}

function candidateLinks(html, baseUrl) {
  const found = [];
  const re = /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(re)) {
    try {
      const label = htmlText(match[2]);
      const url = new URL(decodeEntities(match[1]), baseUrl);
      const base = new URL(baseUrl);
      if (!new Set(["http:", "https:"]).has(url.protocol) || url.hostname !== base.hostname) continue;
      if (BLOCKED_PATH.test(url.pathname) || !LINK_HINT.test(`${label} ${url.pathname}`)) continue;
      url.hash = "";
      const clue = `${label} ${decodeURIComponent(url.pathname)}`;
      const priority = /교역자|목회자|사역자|섬기는|staff|pastor|minister|servant/i.test(clue) ? 100
        : /원로|은퇴|역대|개척|연혁|history/i.test(clue) ? 80
          : /인사말|약력|소개|greeting|profile|bio/i.test(clue) ? 60 : 20;
      found.push({ url: url.toString(), label, priority });
    } catch {}
  }
  return [...new Map(found.toSorted((left, right) => right.priority - left.priority).map((item) => [item.url, item])).values()];
}

function normalizeRole(title) {
  if (title === "목사") return { roleTitle: "목사", roleCategory: "associate" };
  if (/^(?:수석|교육|행정|목양)부목사$/.test(title)) return { roleTitle: title, roleCategory: title === "교육부목사" ? "education" : "associate" };
  if (/^(?:설립|창립|개척|초대|초대담임)목사$/.test(title)) return { roleTitle: title, roleCategory: "founding" };
  if (/^(?:담임|위임|대표)목사$/.test(title)) return { roleTitle: title, roleCategory: "current_primary" };
  if (/^(?:수석부목사|부담임목사|담당목사|부목사|부교역자|행정목사|목양목사|선교목사|찬양목사)$/.test(title)) return { roleTitle: title, roleCategory: "associate" };
  if (/^(?:교육목사|강도사|전임전도사|교육전도사|전도사)$/.test(title)) return { roleTitle: title, roleCategory: "education" };
  if (title === "협동목사") return { roleTitle: title, roleCategory: "cooperating" };
  if (title === "원로목사") return { roleTitle: title, roleCategory: "emeritus" };
  if (/^(?:은퇴|명예|공로)목사$/.test(title)) return { roleTitle: title, roleCategory: "retired" };
  return { roleTitle: title, roleCategory: "other" };
}

function validName(name) {
  const maximumLength = COMPOUND_SURNAME.test(name) ? 5 : 4;
  return name.length >= 2 && name.length <= maximumLength && SURNAME.test(name) && !NAME_DENY.has(name)
    && !NON_PERSON.test(name) && !ORGANIZATION_AS_NAME.test(name)
    && !/(교회|목사|전도|예배|교육|사역|부서|소개|말씀|하나님|예수님|학교|노회|성경|전도회|심방|전임|전담|인허|위임|추대|안수|주년|사임|사면|부임|유년부|유치부|초등부|중등부|고등부|대학부|청년부|장립집사|현재까지|에서|부)$/u.test(name);
}

function genericPastorRoster(html) {
  if (!/섬기는\s*사람|교역자\s*(?:검색|소개|안내)|목회자\s*(?:소개|안내)|staff|pastor|minister/i.test(html)) return false;
  const cards = html.match(/<img\b[^>]*>[\s\S]{0,1600}?[가-힣]{2,5}\s*목사/gi) ?? [];
  return cards.length >= 3;
}

function extractMinisters(html, church, sourceUrl, checkedAt) {
  const text = htmlText(html);
  const allowGenericPastor = genericPastorRoster(html);
  const people = [];
  for (const match of text.matchAll(ROLE_RE)) {
    const role = clean(match[1] ?? match[4]);
    const name = clean(match[2] ?? match[3]);
    if (role === "목사" && !allowGenericPastor) continue;
    if (!validName(name)) continue;
    const normalized = normalizeRole(role);
    const at = match.index ?? 0;
    const evidence = clean(text.slice(Math.max(0, at - 36), Math.min(text.length, at + match[0].length + 36)));
    const isFormer = /사임|사면|은퇴|퇴임|이임|소천|별세|역대/u.test(evidence)
      || /(?:~|–|—|부터)\s*(?:19|20)\d{2}(?:년)?(?:까지)?/u.test(evidence)
      || /(?:19|20)\d{2}년?\s*(?:까지|사임|은퇴|퇴임|이임)/u.test(evidence);
    const personKey = identityKey(name, church.directoryChurchId);
    people.push({
      discoveryId: `discovery-${digest(identityKey(name, church.directoryChurchId, role, sourceUrl))}`,
      directoryPersonId: `person-${digest(personKey)}`,
      name,
      ...normalized,
      roleStatus: /원로|은퇴/.test(role) || isFormer ? "former" : "current",
      directoryChurchId: church.directoryChurchId,
      churchName: church.name,
      denomination: church.denomination,
      region: church.region,
      presbytery: church.presbytery ?? null,
      sourceUrl,
      checkedAt,
      evidenceTokens: [name, role],
      reviewStatus: "candidate",
      publicationEligible: false,
    });
  }
  return [...new Map(people.map((person) => [person.discoveryId, person])).values()];
}

function failureType(error) {
  const code = error?.cause?.code ?? error?.code ?? "";
  if (code === "ENOTFOUND" || code === "EAI_AGAIN") return "dns_failure";
  if (/CERT|TLS|SSL|EPROTO/.test(code)) return "tls_failure";
  if (code === "UND_ERR_CONNECT_TIMEOUT" || error?.name === "TimeoutError") return "timeout";
  if (/redirect/i.test(error?.message ?? "")) return "redirect_failure";
  return "network_failure";
}

async function fetchPage(url, timeoutMs) {
  let response;
  try {
    response = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
      headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml,text/plain;q=0.8" },
    });
  } catch (error) { throw Object.assign(new Error(failureType(error)), { detail: error?.cause?.code ?? error?.message }); }
  if (!response.ok) throw Object.assign(new Error(`http_${response.status}`), { detail: response.status });
  const type = response.headers.get("content-type") ?? "";
  if (!/(?:text\/html|application\/xhtml\+xml|text\/plain)/i.test(type)) throw new Error("unsupported_content_type");
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > 1_500_000) throw new Error("source_too_large");
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > 1_500_000) throw new Error("source_too_large");
  const headerCharset = type.match(/charset\s*=\s*["']?([^;"'\s]+)/i)?.[1];
  const asciiHead = new TextDecoder("latin1").decode(bytes.subarray(0, Math.min(bytes.length, 8192)));
  const metaCharset = asciiHead.match(/<meta[^>]+charset\s*=\s*["']?([^\s"'/>;]+)/i)?.[1]
    ?? asciiHead.match(/<meta[^>]+content\s*=\s*["'][^"']*charset\s*=\s*([^\s"';>]+)/i)?.[1];
  const declaredCharset = clean(headerCharset ?? metaCharset ?? "utf-8").toLowerCase();
  const charset = /(?:euc[-_]?kr|ks_c_5601|cp949)/i.test(declaredCharset) ? "euc-kr" : "utf-8";
  const body = new TextDecoder(charset).decode(bytes);
  return { html: body, finalUrl: response.url, status: response.status, charset };
}

async function wordpressStaffFragments(html, pageUrl, timeoutMs, delayMs) {
  const ajaxMatch = html.match(/\bwa_ajax\s*=\s*\{[\s\S]{0,800}?["']url["']\s*:\s*["']([^"']+)["']/i);
  if (!ajaxMatch) return "";
  let ajaxUrl;
  try { ajaxUrl = new URL(decodeEntities(ajaxMatch[1].replace(/\\\//g, "/")), pageUrl); }
  catch { return ""; }
  const categories = [];
  for (const match of html.matchAll(/<[^>]+>/g)) {
    if (!/\bstaffs\b/i.test(match[0])) continue;
    const category = match[0].match(/\bid\s*=\s*["']cattabs-(\d+)["']/i)?.[1];
    if (category && !categories.includes(category)) categories.push(category);
  }
  const fragments = [];
  for (const category of categories.slice(0, 12)) {
    try {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      ajaxUrl.search = new URLSearchParams({ action: "load_staffs", cat: category }).toString();
      const page = await fetchPage(ajaxUrl.toString(), timeoutMs);
      fragments.push(page.html);
    } catch {}
  }
  return fragments.join("\n");
}

function robotsAllows(body, url) {
  const pathName = new URL(url).pathname;
  let applies = false;
  const rules = [];
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const separator = line.indexOf(":");
    if (separator < 0) continue;
    const key = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (key === "user-agent") applies = value === "*" || value.toLowerCase().includes("airchurch-public-directory");
    else if (applies && (key === "allow" || key === "disallow") && value) rules.push({ type: key, prefix: value });
  }
  const match = rules.filter((rule) => pathName.startsWith(rule.prefix)).sort((left, right) => right.prefix.length - left.prefix.length)[0];
  return !match || match.type === "allow";
}

async function crawlChurch(church, options) {
  const checkedAt = nowIso();
  const failures = [];
  const pages = [];
  let start;
  try { start = new URL(church.homepageUrl); }
  catch { return { church, checkedAt, status: "failed", failureType: "invalid_url", failures, pages, ministers: [] }; }
  if (!new Set(["http:", "https:"]).has(start.protocol)) return { church, checkedAt, status: "failed", failureType: "invalid_url", failures, pages, ministers: [] };

  const variants = [start];
  const alternate = new URL(start);
  alternate.protocol = start.protocol === "https:" ? "http:" : "https:";
  variants.push(alternate);
  let root = null;
  for (const variant of variants) {
    try { root = await fetchPage(variant.toString(), options.timeoutMs); break; }
    catch (error) { failures.push({ url: variant.toString(), type: error.message, detail: error.detail ?? null }); }
  }
  if (!root) return { church, checkedAt, status: "failed", failureType: failures.at(-1)?.type ?? "network_failure", failures, pages, ministers: [] };

  let robotsStatus = "not_found", robotsBody = "";
  try {
    const robotsUrl = new URL("/robots.txt", root.finalUrl);
    const robots = await fetchPage(robotsUrl.toString(), options.timeoutMs);
    robotsBody = robots.html;
    robotsStatus = robotsAllows(robotsBody, root.finalUrl) ? "allowed" : "disallowed";
  } catch (error) {
    robotsStatus = error.message === "http_404" ? "not_found" : `unavailable:${error.message}`;
  }
  if (robotsStatus === "disallowed") return { church, checkedAt, status: "failed", failureType: "robots_disallowed", robotsStatus, failures, pages, ministers: [] };

  pages.push({ url: root.finalUrl, status: root.status, contentSha256: digest(root.html, 64) });
  const rootDynamic = await wordpressStaffFragments(root.html, root.finalUrl, options.timeoutMs, options.delayMs);
  let ministers = extractMinisters(rootDynamic ? `${root.html}\n${rootDynamic}` : root.html, church, root.finalUrl, checkedAt);
  const links = candidateLinks(root.html, root.finalUrl).filter((item) => item.url !== root.finalUrl).slice(0, options.pagesPerChurch - 1);
  for (const link of links) {
    await new Promise((resolve) => setTimeout(resolve, options.delayMs));
    try {
      if (robotsStatus === "allowed" && !robotsAllows(robotsBody, link.url)) { failures.push({ url: link.url, type: "robots_disallowed", detail: null }); continue; }
      const page = await fetchPage(link.url, options.timeoutMs);
      pages.push({ url: page.finalUrl, status: page.status, contentSha256: digest(page.html, 64) });
      const dynamic = await wordpressStaffFragments(page.html, page.finalUrl, options.timeoutMs, options.delayMs);
      ministers.push(...extractMinisters(dynamic ? `${page.html}\n${dynamic}` : page.html, church, page.finalUrl, checkedAt));
    } catch (error) { failures.push({ url: link.url, type: error.message, detail: error.detail ?? null }); }
  }
  ministers = [...new Map(ministers.map((person) => [person.discoveryId, person])).values()];
  return { church, checkedAt, status: ministers.length ? "people_found" : "no_people_found", failureType: null, robotsStatus, failures, pages, ministers };
}

function summarize(results, baseline, registered, startedAt) {
  const all = results.flatMap((result) => result.ministers ?? []);
  const discovered = [...new Map(all.map((person) => [person.directoryPersonId, person])).values()];
  const additionalRelationships = [...new Map(all.map((person) => [person.discoveryId, person])).values()];
  const additionalPeople = discovered;
  const roleCounts = {};
  const roleStatusCounts = {};
  const statusCounts = {};
  const rolePeople = new Set();
  for (const person of additionalRelationships) {
    const key = identityKey(person.directoryPersonId, person.roleTitle);
    if (rolePeople.has(key)) continue;
    rolePeople.add(key);
    roleCounts[person.roleTitle] = (roleCounts[person.roleTitle] ?? 0) + 1;
    const roleStatus = `${person.roleTitle}:${person.roleStatus}`;
    roleStatusCounts[roleStatus] = (roleStatusCounts[roleStatus] ?? 0) + 1;
    statusCounts[person.roleStatus] = (statusCounts[person.roleStatus] ?? 0) + 1;
  }
  const failureCounts = {};
  const churchFailureCounts = {};
  for (const result of results) {
    if (result.failureType) churchFailureCounts[result.failureType] = (churchFailureCounts[result.failureType] ?? 0) + 1;
    for (const failure of result.failures ?? []) failureCounts[failure.type] = (failureCounts[failure.type] ?? 0) + 1;
  }
  const churchesWithAdditional = new Set(additionalPeople.map((person) => person.directoryChurchId)).size;
  const registeredResultsById = new Map();
  const statusRank = { failed: 0, no_people_found: 1, people_found: 2 };
  for (const result of results) {
    const existingChurchId = Number(result.church?.existingChurchId);
    if (!Number.isInteger(existingChurchId) || existingChurchId < 1) continue;
    const current = registeredResultsById.get(existingChurchId);
    if (!current || (statusRank[result.status] ?? -1) > (statusRank[current.status] ?? -1)) registeredResultsById.set(existingChurchId, result);
  }
  const registeredResults = [...registeredResultsById.values()];
  const registeredRelationships = registeredResults.flatMap((result) => result.ministers ?? []);
  const registeredRoleCounts = {};
  const registeredFailureCounts = {};
  for (const person of registeredRelationships) registeredRoleCounts[person.roleTitle] = (registeredRoleCounts[person.roleTitle] ?? 0) + 1;
  for (const result of registeredResults) if (result.failureType) registeredFailureCounts[result.failureType] = (registeredFailureCounts[result.failureType] ?? 0) + 1;
  const registeredHomepageChurches = (registered.churches ?? []).filter((church) => clean(church.homepage_url)).length;
  const registeredChurches = (registered.churches ?? []).length;
  return {
    generatedAt: nowIso(), startedAt, published: false,
    baselineChurches: baseline.churches.length,
    registeredChurches,
    registeredHomepageChurches,
    registeredMissingHomepageChurches: registeredChurches - registeredHomepageChurches,
    registeredResults: {
      attempted: registeredResults.length,
      reached: registeredResults.filter((result) => result.pages?.length).length,
      peopleFoundChurches: registeredResults.filter((result) => result.status === "people_found").length,
      noPeopleFoundChurches: registeredResults.filter((result) => result.status === "no_people_found").length,
      failedChurches: registeredResults.filter((result) => result.status === "failed").length,
      people: new Set(registeredRelationships.map((person) => person.directoryPersonId)).size,
      relationships: registeredRelationships.length,
      roleCounts: registeredRoleCounts,
      failureCounts: registeredFailureCounts,
      pendingOfficialHomepage: registeredChurches - registeredHomepageChurches,
      pendingOfficialSourceComplement: registeredChurches - registeredResults.filter((result) => result.status === "people_found").length,
    },
    baselineMinisters: baseline.ministers.length,
    homepageChurches: baseline.churches.filter((church) => church.homepageUrl).length,
    churchesAttempted: results.length,
    churchesReached: results.filter((result) => result.pages?.length).length,
    churchesWithAdditional,
    attemptedChurchCoveragePercent: results.length ? Number((churchesWithAdditional / results.length * 100).toFixed(2)) : 0,
    nationalChurchCoveragePercent: baseline.churches.length ? Number((churchesWithAdditional / baseline.churches.length * 100).toFixed(2)) : 0,
    sourcePages: new Set(additionalRelationships.map((person) => person.sourceUrl)).size,
    discoveredCandidates: discovered.length,
    actualNewPeople: additionalPeople.length,
    newMinistryRelationships: additionalRelationships.length,
    cumulativePeople: baseline.ministers.length + additionalPeople.length,
    roleCounts,
    roleStatusCounts,
    statusCounts,
    nameBasedExclusions: 0,
    churchFailureCounts,
    requestFailureCounts: failureCounts,
    protocolFallbackRecoveries: results.filter((result) => result.pages?.length && result.failures?.length).length,
    peopleFoundChurches: results.filter((result) => result.status === "people_found").length,
    noPeopleFoundChurches: results.filter((result) => result.status === "no_people_found").length,
    failedChurches: results.filter((result) => result.status === "failed").length,
  };
}

async function main() {
  const options = args(process.argv.slice(2));
  const checkpointPath = path.join(options.outputDir, "checkpoint.json");
  const candidatesPath = path.join(options.outputDir, "candidates.json");
  const holdsPath = path.join(options.outputDir, "review-holds.json");
  const importPath = path.join(options.outputDir, "import-ready.json");
  const reportPath = path.join(options.outputDir, "report.json");
  const baseline = await readJson(options.input);
  if (!baseline?.churches || !baseline?.ministers) throw new Error("invalid_nationwide_directory");
  const registered = await readJson(options.registered, { churches: [] });
  const churchesByKey = new Map(baseline.churches.map((church) => [identityKey(church.name, church.denomination, church.region), church]));
  for (const record of registered.churches ?? []) {
    const name = clean(record.church_name), denomination = clean(record.denomination), region = clean(record.region);
    if (!name || !denomination || !region) continue;
    const key = identityKey(name, denomination, region);
    const existing = churchesByKey.get(key);
    if (existing) {
      existing.existingChurchId = Number(record.church_id) || existing.existingChurchId || null;
      if (!existing.homepageUrl) existing.homepageUrl = clean(record.homepage_url) || null;
      if (!existing.officialSourceUrl) existing.officialSourceUrl = clean(record.profile_source_url) || clean(record.homepage_url) || null;
      continue;
    }
    const directoryChurchId = `church-${digest(key)}`;
    baseline.churches.push({
      directoryChurchId,
      existingChurchId: Number(record.church_id) || null,
      name,
      denomination,
      region,
      presbytery: null,
      homepageUrl: clean(record.homepage_url) || null,
      officialSourceUrl: clean(record.profile_source_url) || clean(record.homepage_url) || null,
    });
    churchesByKey.set(key, baseline.churches.at(-1));
  }
  const fingerprint = digest(JSON.stringify({ collectorVersion: COLLECTOR_VERSION, churches: baseline.churches.map((c) => [c.directoryChurchId, c.homepageUrl]), ministers: baseline.ministers.map((p) => p.directoryMinisterId) }), 64);
  let checkpoint = await readJson(checkpointPath, { version: 1, inputFingerprint: fingerprint, startedAt: nowIso(), results: {} });
  if (checkpoint.inputFingerprint !== fingerprint) throw new Error("checkpoint_input_changed_use_new_output_dir");
  for (const [churchId, result] of Object.entries(checkpoint.results)) {
    if (options.retryStatuses.has(result.status) || (result.failureType && options.retryFailureTypes.has(result.failureType))) delete checkpoint.results[churchId];
  }
  let churches = baseline.churches.filter((church) => {
    if (!church.homepageUrl) return false;
    if (!options.sourceHost) return true;
    try { return new URL(church.homepageUrl).hostname.toLowerCase() === options.sourceHost; }
    catch { return false; }
  }).slice(options.offset);
  if (options.sourcePage && options.churchName) {
    const selected = baseline.churches.find((church) => identityKey(church.name) === identityKey(options.churchName));
    churches = selected ? [{ ...selected, homepageUrl: options.sourcePage }] : [];
  }
  if (options.limit) churches = churches.slice(0, options.limit);
  churches = churches.filter((church) => !checkpoint.results[church.directoryChurchId]);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(options.concurrency, Math.max(1, churches.length)) }, async () => {
    while (cursor < churches.length) {
      const church = churches[cursor++];
      const result = await crawlChurch(church, options);
      checkpoint.results[church.directoryChurchId] = result;
      if (Object.keys(checkpoint.results).length % 25 === 0) await atomicJson(checkpointPath, checkpoint);
      process.stderr.write(`[${Object.keys(checkpoint.results).length}] ${church.name}: ${result.status} (${result.ministers.length})\n`);
    }
  });
  await Promise.all(workers);
  checkpoint.completedAt = nowIso();
  await atomicJson(checkpointPath, checkpoint);
  const rawResults = Object.values(checkpoint.results);
  const parserRejectedNonPerson = rawResults.reduce((sum, result) => sum + (result.ministers ?? []).filter((person) => !validName(person.name)).length, 0);
  const results = rawResults.map((result) => ({ ...result, ministers: (result.ministers ?? []).filter((person) => validName(person.name)) }));
  const report = summarize(results, baseline, registered, checkpoint.startedAt);
  report.parserRejectedNonPerson = parserRejectedNonPerson;
  const candidates = [...new Map(results.flatMap((result) => result.ministers).map((person) => [person.discoveryId, person])).values()];
  const readyRelationships = candidates.map((person) => ({ ...person, reviewStatus: "source_review_required" }));
  const readyPeople = [...new Map(readyRelationships.map((person) => [person.directoryPersonId, {
    directoryPersonId: person.directoryPersonId,
    name: person.name,
    denomination: person.denomination,
    region: person.region,
    identityStatus: "provisional_official_source",
    reviewStatus: "source_review_required",
  }])).values()];
  report.nameBasedExclusions = 0;
  report.importReadyPeopleAfterHolds = readyPeople.length;
  report.importReadyRelationshipsAfterHolds = readyRelationships.length;
  const candidatePeople = [...new Map(candidates.map((person) => [person.directoryPersonId, {
    directoryPersonId: person.directoryPersonId,
    name: person.name,
    denomination: person.denomination,
    region: person.region,
    identityStatus: "provisional_official_source",
    reviewStatus: "candidate",
  }])).values()];
  await atomicJson(candidatesPath, { metadata: report, people: candidatePeople, ministryRelationships: candidates });
  await atomicJson(holdsPath, { metadata: report, relationshipHolds: [], note: "Every valid person is preserved by directory ID; names affect search only." });
  await atomicJson(importPath, { metadata: report, databaseWrites: 0, people: readyPeople, ministryRelationships: readyRelationships });
  await atomicJson(reportPath, report);
  console.log(JSON.stringify({ ...report, outputDir: options.outputDir }));
}

await main();
