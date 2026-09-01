#!/usr/bin/env node
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { extractChurchProfileCandidate, extractScheduleCandidates, robotsAllows } from "./core.mjs";

const USER_AGENT = "AirChurchWorshipCollector/0.2 (+https://airchurch.net/contact)";
const arg = (name, fallback = null) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : fallback; };
const inputPath = arg("--input"), policyPath = arg("--policy"), outputPath = arg("--output");
const delayMs = Math.max(1000, Number(arg("--delay-ms", "3000"))), timeoutMs = Math.max(3000, Number(arg("--timeout-ms", "15000")));
if (!inputPath || !policyPath || !outputPath) throw new Error("--input, --policy, --output이 필요합니다.");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function fetchText(url, accept = "text/html") {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { redirect: "follow", signal: controller.signal, headers: { "User-Agent": USER_AGENT, Accept: accept } });
    const text = await response.text();
    return { response, text };
  } finally { clearTimeout(timer); }
}
async function atomicJson(path, value) {
  await mkdir(dirname(path), { recursive: true }); const temp = `${path}.tmp`;
  await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, "utf8"); await rename(temp, path);
}

const input = JSON.parse(await readFile(inputPath, "utf8"));
const policy = JSON.parse(await readFile(policyPath, "utf8"));
const policyMaxAgeMs = Math.max(1, Number(policy.review_ttl_days || 180)) * 24 * 60 * 60 * 1000;
const policyByHost = new Map((policy.domains || []).map((item) => [item.host.toLowerCase(), item]));
const candidates = [], profiles = [], held = [], errors = [], fetchLog = [];
const robotsCache = new Map();
let lastRequestAt = 0;

async function allowedPage(church, requestedUrl, purpose) {
  if (!requestedUrl) { errors.push({ church_id: church.church_id, code: `missing_${purpose}_url` }); return null; }
  try {
    const url = new URL(requestedUrl), domainPolicy = policyByHost.get(url.hostname.toLowerCase());
    if (!domainPolicy || domainPolicy.decision !== "allow" || !domainPolicy.reviewed_at) {
      held.push({ church_id: church.church_id, church_name: church.church_name, source_url: requestedUrl, purpose, code: "policy_review_required" }); return null;
    }
    if (!domainPolicy.note || !Number.isFinite(Date.parse(domainPolicy.reviewed_at)) || Date.now() - Date.parse(domainPolicy.reviewed_at) > policyMaxAgeMs) {
      held.push({ church_id: church.church_id, church_name: church.church_name, source_url: requestedUrl, purpose, code: "policy_review_expired" }); return null;
    }
    const exactAllowed = domainPolicy.allowed_urls?.includes(url.toString());
    const prefixAllowed = domainPolicy.allowed_path_prefixes?.some((prefix) => url.pathname.startsWith(prefix));
    if (!exactAllowed && !prefixAllowed) {
      held.push({ church_id: church.church_id, church_name: church.church_name, source_url: requestedUrl, purpose, code: "path_not_allowlisted" }); return null;
    }
    const origin = url.origin;
    if (!robotsCache.has(origin)) {
      const robotsUrl = new URL("/robots.txt", origin).toString();
      const result = await fetchText(robotsUrl, "text/plain");
      robotsCache.set(origin, { status: result.response.status, text: result.response.ok ? result.text : "" });
      fetchLog.push({ url: robotsUrl, status: result.response.status, purpose: "robots" });
      await sleep(delayMs);
    }
    const robots = robotsCache.get(origin);
    if (!(robots.status >= 200 && robots.status < 300) && robots.status !== 404) {
      held.push({ church_id: church.church_id, church_name: church.church_name, source_url: requestedUrl, purpose, code: "robots_unavailable", status: robots.status }); return null;
    }
    if (!robotsAllows(url, robots.text, USER_AGENT)) {
      held.push({ church_id: church.church_id, church_name: church.church_name, source_url: requestedUrl, purpose, code: "robots_disallowed" }); return null;
    }
    const elapsed = Date.now() - lastRequestAt; if (elapsed < delayMs) await sleep(delayMs - elapsed);
    lastRequestAt = Date.now();
    const result = await fetchText(url);
    fetchLog.push({ url: requestedUrl, final_url: result.response.url, status: result.response.status, purpose });
    if (!result.response.ok || !/text\/html|application\/xhtml\+xml/i.test(result.response.headers.get("content-type") || "")) {
      errors.push({ church_id: church.church_id, source_url: requestedUrl, purpose, code: "unusable_response", status: result.response.status }); return null;
    }
    return result;
  } catch (error) {
    errors.push({ church_id: church.church_id, source_url: requestedUrl, purpose, code: error?.name === "AbortError" ? "timeout" : "fetch_error", message: String(error?.message || error) });
    return null;
  }
}

for (const church of input.churches || []) {
  for (const requestedUrl of church.source_urls || [church.homepage_url]) {
    const result = await allowedPage(church, requestedUrl, "schedule");
    if (!result) continue;
    const extracted = extractScheduleCandidates({ church, sourceUrl: result.response.url, html: result.text, collectedAt: new Date().toISOString(), sourceLastModified: result.response.headers.get("last-modified") });
    if (!extracted.length) held.push({ church_id: church.church_id, church_name: church.church_name, source_url: result.response.url, purpose: "schedule", code: "no_schedule_candidates" });
    for (const record of extracted) (record.review_status === "hold" ? held : candidates).push(record);
  }
  const result = await allowedPage(church, church.profile_source_url || church.homepage_url, "profile");
  if (!result) continue;
  const profile = extractChurchProfileCandidate({ church, sourceUrl: result.response.url, html: result.text, collectedAt: new Date().toISOString(), sourceLastModified: result.response.headers.get("last-modified") });
  if (profile) profiles.push(profile);
  else held.push({ church_id: church.church_id, church_name: church.church_name, source_url: result.response.url, purpose: "profile", code: "no_profile_candidate" });
}

const output = { metadata: { schema_version: 2, generated_at: new Date().toISOString(), input: inputPath, policy: policyPath, request_delay_ms: delayMs, automatic_publication: false }, candidates, profiles, held, errors, fetch_log: fetchLog };
await atomicJson(outputPath, output);
console.log(JSON.stringify({ candidates: candidates.length, profiles: profiles.length, held: held.length, errors: errors.length, output: outputPath }));
