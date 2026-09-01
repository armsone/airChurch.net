#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { decodeHtml, extractChurchProfileCandidate, extractScheduleCandidates, robotsAllows, visibleLines } from "./core.mjs";

const USER_AGENT = "AirChurchWorshipCollector/1.0 (+https://airchurch.net/contact)";
const MAX_BYTES = 2 * 1024 * 1024;
const arg = (name, fallback = null) => { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : fallback; };
const inputPath = arg("--input", "data/worship-schedules/all-registered-churches.json");
const outputPath = arg("--output", "data/worship-schedules/all-output.json");
const checkpointPath = arg("--checkpoint", "data/worship-schedules/all-checkpoint.json");
const contactsOutputPath = arg("--contacts-output", "data/worship-schedules/all-contact-candidates.review.json");
const concurrency = Math.max(1, Math.min(8, Number(arg("--concurrency", "4"))));
const delayMs = Math.max(1000, Number(arg("--delay-ms", "3000")));
const timeoutMs = Math.max(3000, Number(arg("--timeout-ms", "15000")));
const maxChurches = Number(arg("--max-churches", "0"));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const robotsCache = new Map(), originGates = new Map(), termsCache = new Map();

async function atomicJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporaryPath, path);
}

function safePublicUrl(value, base) {
  try {
    const url = new URL(value, base);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    const host = url.hostname.toLowerCase();
    if (host === "localhost" || host.endsWith(".local") || /^(?:127\.|10\.|192\.168\.|169\.254\.)/.test(host)) return null;
    url.hash = "";
    return url;
  } catch { return null; }
}

async function gated(origin, task) {
  const previous = originGates.get(origin) || Promise.resolve();
  const current = previous.catch(() => {}).then(async () => {
    const previousAt = originGates.get(`${origin}:at`) || 0;
    const wait = delayMs - (Date.now() - previousAt);
    if (wait > 0) await sleep(wait);
    originGates.set(`${origin}:at`, Date.now());
    return task();
  });
  originGates.set(origin, current);
  return current;
}

async function rawFetch(url, accept, redirect = "manual") {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await gated(url.origin, () => fetch(url, { redirect, signal: controller.signal, headers: { Accept: accept, "User-Agent": USER_AGENT } }));
    const contentLength = Number(response.headers.get("content-length") || 0);
    if (contentLength > MAX_BYTES) return { response, text: "", code: "response_too_large" };
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > MAX_BYTES) return { response, text: "", code: "response_too_large" };
    return { response, text: new TextDecoder().decode(bytes), code: null };
  } finally { clearTimeout(timer); }
}

async function robotsFor(origin, fetchLog) {
  if (!robotsCache.has(origin)) robotsCache.set(origin, (async () => {
    const url = new URL("/robots.txt", origin);
    try {
      const result = await rawFetch(url, "text/plain");
      fetchLog.push({ url: url.toString(), status: result.response.status, purpose: "robots" });
      if (result.response.status === 404) return { allowed: true, text: "", status: 404 };
      if (!result.response.ok || result.code) return { allowed: false, text: "", status: result.response.status, code: result.code || "robots_unavailable" };
      return { allowed: true, text: result.text, status: result.response.status };
    } catch (error) {
      return { allowed: false, text: "", status: null, code: error?.name === "AbortError" ? "robots_timeout" : "robots_unavailable", message: String(error?.message || error) };
    }
  })());
  return robotsCache.get(origin);
}

async function allowedFetch(requested, purpose, fetchLog) {
  let url = safePublicUrl(requested);
  if (!url) return { error: { code: "invalid_or_private_url", source_url: requested, purpose } };
  for (let redirect = 0; redirect <= 5; redirect += 1) {
    const robots = await robotsFor(url.origin, fetchLog);
    if (!robots.allowed) return { error: { code: robots.code || "robots_unavailable", source_url: url.toString(), purpose, status: robots.status, message: robots.message } };
    if (!robotsAllows(url, robots.text, USER_AGENT)) return { error: { code: "robots_disallowed", source_url: url.toString(), purpose } };
    try {
      const result = await rawFetch(url, "text/html,application/xhtml+xml");
      fetchLog.push({ url: url.toString(), status: result.response.status, purpose });
      if ([301, 302, 303, 307, 308].includes(result.response.status)) {
        const next = safePublicUrl(result.response.headers.get("location"), url);
        if (!next) return { error: { code: "unsafe_redirect", source_url: url.toString(), purpose } };
        url = next;
        continue;
      }
      const contentType = result.response.headers.get("content-type") || "";
      if (!result.response.ok || !/text\/html|application\/xhtml\+xml/i.test(contentType) || result.code) {
        return { error: { code: result.code || "unusable_response", source_url: url.toString(), purpose, status: result.response.status, content_type: contentType } };
      }
      return { ...result, url };
    } catch (error) {
      return { error: { code: error?.name === "AbortError" ? "timeout" : "fetch_error", source_url: url.toString(), purpose, message: String(error?.message || error) } };
    }
  }
  return { error: { code: "too_many_redirects", source_url: url.toString(), purpose } };
}

function anchors(html, base) {
  const found = [];
  for (const match of String(html || "").matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const url = safePublicUrl(decodeHtml(match[1]), base), text = decodeHtml(match[2].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
    if (url) found.push({ url, text });
  }
  return found;
}

function discoverLink(html, base, pattern) {
  const origin = new URL(base).origin;
  return anchors(html, base).find((item) => item.url.origin === origin && pattern.test(`${item.text} ${item.url.pathname}`) && !/(?:login|signin|로그인)/i.test(`${item.text} ${item.url.pathname}`))?.url || null;
}

const EMAIL_PATTERN = /[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/gi;
const MOBILE_PATTERN = /01[016789][-)\s]?\d{3,4}[-\s]?\d{4}/g;
const ACCOUNT_PATTERN = /(?:헌금\s*)?계좌(?:번호)?\s*[:：]?\s*(?:[가-힣A-Za-z]+\s*)?\d[\d-]{7,}/gi;
const CONTACT_PHONE_PATTERN = /(?:02|0[3-6][1-5]|01[016789])[-)\s]?\d{3,4}[-\s]?\d{4}/g;
const RESIDENTIAL_PATTERN = /(?:담임목사\s*)?(?:사택|자택|거주지)/i;
function privacySignals(profile) {
  const value = [profile.source_text, profile.summary, profile.address, profile.phone].filter(Boolean).join(" | ");
  return {
    email: new RegExp(EMAIL_PATTERN.source, "i").test(value),
    mobile_phone: new RegExp(MOBILE_PATTERN.source).test(value),
    account_number: new RegExp(ACCOUNT_PATTERN.source, "i").test(value),
    residential_address: RESIDENTIAL_PATTERN.test(value),
  };
}
function sanitizeText(value) {
  if (!value) return null;
  const sanitized = String(value).replace(EMAIL_PATTERN, "[이메일 제거]").replace(ACCOUNT_PATTERN, "[계좌정보 제거]").replace(CONTACT_PHONE_PATTERN, "[연락처 제거]").replace(/\s+/g, " ").trim();
  return sanitized || null;
}
function sanitizeRecord(original) {
  const signals = privacySignals(original);
  const { phone: _phone, ...safeOriginal } = original;
  const record = { ...safeOriginal, source_text: sanitizeText(original.source_text), summary: sanitizeText(original.summary), address: signals.email || signals.account_number || signals.residential_address ? null : sanitizeText(original.address) };
  if (Object.values(signals).some(Boolean)) record.flags = [...new Set([...(original.flags || []), "privacy_redacted"])];
  return { record, signals };
}

function extractOfficialContacts({ church, sourceUrl, html, collectedAt }) {
  const contacts = [], seen = new Set();
  const hostname = new URL(sourceUrl).hostname.toLowerCase();
  if (/(?:^|\.)(?:youtube\.com|youtu\.be|facebook\.com|instagram\.com|x\.com|twitter\.com|tiktok\.com)$/.test(hostname)) return contacts;
  const add = (type, value, scope, line) => {
    if (type === "email") {
      const domain = value.split("@")[1]?.toLowerCase();
      if (["def.org", "ghi.org", "jkl.org", "email.com", "example.com"].includes(domain) || domain === "korea.kr" && !hostname.endsWith("korea.kr")) return;
    }
    const key = `${type}:${value.toLowerCase()}`; if (seen.has(key)) return; seen.add(key);
    contacts.push({ contact_id: createHash("sha256").update(`${church.church_id}|${key}`).digest("hex").slice(0, 24), church_id: church.church_id, church_name: church.church_name, contact_type: type, contact_value: value, scope, source_url: sourceUrl, source_text: sanitizeText(line)?.slice(0, 500), collected_at: collectedAt, review_status: "pending", visibility: "admin_only", reveal_policy: "masked_audited", flags: sourceUrl.startsWith("http://") ? ["unencrypted_transport"] : [] });
  };
  for (const line of visibleLines(html)) {
    const organizational = /(?:교회|사무|행정|문의|대표|연락처|오시는\s*길|contact|office|e-?mail|메일)/i.test(line);
    const personal = /(?:개인|후원|담임목사\s*(?:개인)?|카카오톡|인스타|페이스북)/i.test(line);
    if (!organizational || personal) continue;
    for (const match of line.matchAll(new RegExp(EMAIL_PATTERN.source, "gi"))) {
      add("email", match[0].toLowerCase(), "organization", line);
    }
    for (const match of line.matchAll(new RegExp(CONTACT_PHONE_PATTERN.source, "g"))) {
      const value = match[0].replace(/\s+/g, "-"), mobile = /^01/.test(value);
      if (mobile && !/(?:사무|행정|문의|대표번호|교회\s*연락처)/.test(line)) continue;
      const officialRole = /(?:교역자|전도사|목사|간사|담당)/.test(line);
      add("phone", value, officialRole ? "official_role" : "organization", line);
    }
    for (const match of line.matchAll(new RegExp(ACCOUNT_PATTERN.source, "gi"))) {
      const number = match[0].match(/\d[\d-]{7,}/)?.[0];
      if (number && /(?:헌금|계좌)/.test(line)) add("account", number, "organization", line);
    }
  }
  return contacts;
}
function secureResult(result, security) {
  const candidates = [], profiles = [], held = [];
  const transportReviewed = (record) => {
    if (!String(record.source_url || "").startsWith("http://")) return record;
    security.http_source_count += 1;
    security.transport_review.warning_count += 1;
    return { ...record, transport_review: "unencrypted_public_read_only", flags: [...new Set([...(record.flags || []).filter((flag) => flag !== "https_required"), "unencrypted_transport"])] };
  };
  const privacyHold = (record, signals, kind) => {
    if (kind === "profile") security.privacy_profiles_held += 1;
    else security.privacy_schedule_candidates_held += 1;
    const detected = Object.keys(signals).filter((key) => signals[key]);
    for (const key of detected) security.detected[key] += 1;
    const profile = { ...record, code: "privacy_review_required", review_status: "hold", privacy_signals: detected.length ? detected : record.privacy_signals || ["previously_redacted"], flags: [...new Set([...(record.flags || []), "privacy_review_required"])] };
    held.push(profile);
  };
  for (const original of result.held || []) {
    const sanitized = sanitizeRecord(original), record = sanitized.record;
    if (original.code === "https_required") {
      const { code: _code, ...restored } = record;
      const cleaned = { ...restored, review_status: "pending", flags: [...new Set([...(restored.flags || []).filter((flag) => flag !== "https_required")])] };
      if (cleaned.profile_id && (cleaned.flags.includes("privacy_redacted") || Object.values(sanitized.signals).some(Boolean))) privacyHold(cleaned, sanitized.signals, "profile");
      else if (cleaned.profile_id) profiles.push(transportReviewed(cleaned));
      else { if (cleaned.flags.includes("privacy_redacted")) security.privacy_redactions += 1; candidates.push(transportReviewed(cleaned)); }
      continue;
    }
    held.push(record);
    if (record.code === "privacy_review_required") {
      security.privacy_profiles_held += record.profile_id ? 1 : 0;
      security.privacy_schedule_candidates_held += record.record_id ? 1 : 0;
      for (const key of record.privacy_signals || []) if (security.detected[key] !== undefined) security.detected[key] += 1;
    }
  }
  for (const original of result.candidates || []) {
    const { record, signals } = sanitizeRecord(original);
    if (signals.residential_address) privacyHold(record, signals, "schedule");
    else {
      if (signals.email || signals.mobile_phone || signals.account_number || record.flags?.includes("privacy_redacted")) security.privacy_redactions += 1;
      for (const [key, detected] of Object.entries(signals)) if (detected) security.detected[key] += 1;
      candidates.push(transportReviewed(record));
    }
  }
  for (const original of result.profiles || []) {
    const sanitized = sanitizeRecord(original);
    const signals = sanitized.signals;
    if (signals.residential_address) {
      const profile = { ...sanitized.record, review_status: "hold", privacy_signals: Object.keys(signals).filter((key) => signals[key]), flags: [...new Set([...(sanitized.record.flags || []), "privacy_review_required"])] };
      profile.source_text = [profile.slogan && `표어: ${profile.slogan}`, profile.vision && `비전: ${profile.vision}`, profile.summary && `소개: ${profile.summary}`, profile.address && `주소: ${profile.address}`].filter(Boolean).join(" | ").slice(0, 1000);
      privacyHold(profile, signals, "profile");
    } else {
      if (signals.email || signals.mobile_phone || signals.account_number) security.privacy_redactions += 1;
      for (const [key, detected] of Object.entries(signals)) if (detected) security.detected[key] += 1;
      const profile = sanitized.record;
      if ([profile.slogan, profile.vision, profile.summary, profile.address].some(Boolean)) profiles.push(transportReviewed(profile));
      else held.push({ ...profile, code: "empty_after_contact_redaction", review_status: "hold", flags: [...new Set([...(profile.flags || []), "contact_values_removed"])] });
    }
  }
  const noHomepage = result.status === "no_homepage" || held.some((record) => record.code === "missing_homepage");
  return { ...result, candidates, profiles, held, status: noHomepage ? "no_homepage" : candidates.length || profiles.length ? "collected" : "held" };
}

async function termsDecision(homepage, html, fetchLog) {
  const origin = new URL(homepage).origin;
  if (termsCache.has(origin)) return termsCache.get(origin);
  const promise = (async () => {
    const link = discoverLink(html, homepage, /(?:이용약관|서비스약관|terms(?:[-_/ ]of[-_/ ]use)?)/i);
    if (!link) return { status: "not_found", source_url: null };
    const result = await allowedFetch(link, "terms", fetchLog);
    if (result.error) return { status: "unavailable", source_url: link.toString(), error: result.error };
    const normalized = result.text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    const prohibited = /(?:크롤링|스크래핑|자동\s*수집|로봇|robot|crawler|scrap(?:e|ing)|bot).{0,100}(?:금지|제한|허용하지|prohibit|forbid|not\s+permit)/i.test(normalized)
      || /(?:금지|제한|허용하지|prohibit|forbid|not\s+permit).{0,100}(?:크롤링|스크래핑|자동\s*수집|로봇|robot|crawler|scrap(?:e|ing)|bot)/i.test(normalized);
    return { status: prohibited ? "prohibited" : "no_prohibition_found", source_url: result.url.toString() };
  })();
  termsCache.set(origin, promise);
  return promise;
}

async function processChurch(church) {
  const fetchLog = [], held = [], errors = [], candidates = [], profiles = [], contacts = [];
  if (!church.homepage_url) return { church_id: church.church_id, church_name: church.church_name, status: "no_homepage", candidates, profiles, held: [{ church_id: church.church_id, church_name: church.church_name, purpose: "all", code: "missing_homepage" }], errors, fetch_log: fetchLog };
  const homepage = await allowedFetch(church.homepage_url, "homepage", fetchLog);
  if (homepage.error) return { church_id: church.church_id, church_name: church.church_name, status: "held", candidates, profiles, held: [{ church_id: church.church_id, church_name: church.church_name, ...homepage.error }], errors, fetch_log: fetchLog };
  const terms = await termsDecision(homepage.url, homepage.text, fetchLog);
  if (terms.status === "prohibited") return { church_id: church.church_id, church_name: church.church_name, status: "held", policy_evidence: terms, candidates, profiles, held: [{ church_id: church.church_id, church_name: church.church_name, source_url: homepage.url.toString(), purpose: "all", code: "terms_prohibit_automated_collection" }], errors, fetch_log: fetchLog };

  const collectedAt = new Date().toISOString(), lastModified = homepage.response.headers.get("last-modified");
  contacts.push(...extractOfficialContacts({ church, sourceUrl: homepage.url.toString(), html: homepage.text, collectedAt }));
  const policyFlag = terms.status === "not_found" ? "terms_link_not_found" : terms.status === "unavailable" ? "terms_unavailable" : null;
  const profile = extractChurchProfileCandidate({ church, sourceUrl: homepage.url.toString(), html: homepage.text, collectedAt, sourceLastModified: lastModified });
  if (profile) { if (policyFlag) profile.flags = [...new Set([...(profile.flags || []), policyFlag])]; profiles.push(profile); }
  else held.push({ church_id: church.church_id, church_name: church.church_name, source_url: homepage.url.toString(), purpose: "profile", code: "no_profile_candidate" });

  const scheduleLink = discoverLink(homepage.text, homepage.url, /(?:예배\s*(?:시간|안내)|미사\s*(?:시간|안내)|worship|service[-_ ]?times?)/i);
  const schedulePages = [{ ...homepage, purpose: "homepage" }];
  if (scheduleLink && scheduleLink.toString() !== homepage.url.toString()) {
    const schedule = await allowedFetch(scheduleLink, "schedule", fetchLog);
    if (schedule.error) held.push({ church_id: church.church_id, church_name: church.church_name, ...schedule.error });
    else { schedulePages.push(schedule); contacts.push(...extractOfficialContacts({ church, sourceUrl: schedule.url.toString(), html: schedule.text, collectedAt: new Date().toISOString() })); }
  }
  const seen = new Set();
  for (const page of schedulePages) {
    const extracted = extractScheduleCandidates({ church, sourceUrl: page.url.toString(), html: page.text, collectedAt: new Date().toISOString(), sourceLastModified: page.response.headers.get("last-modified") });
    for (const record of extracted) {
      if (policyFlag) record.flags = [...new Set([...(record.flags || []), policyFlag])];
      if (seen.has(record.record_id)) continue;
      seen.add(record.record_id);
      (record.review_status === "hold" ? held : candidates).push(record);
    }
  }
  if (!seen.size) held.push({ church_id: church.church_id, church_name: church.church_name, source_url: scheduleLink?.toString() || homepage.url.toString(), purpose: "schedule", code: "no_schedule_candidates" });
  return { church_id: church.church_id, church_name: church.church_name, status: candidates.length || profiles.length ? "collected" : "held", policy_evidence: terms, candidates, profiles, contacts, held, errors, fetch_log: fetchLog };
}

const input = JSON.parse(await readFile(inputPath, "utf8"));
let checkpoint = { metadata: {}, results: [] };
try { checkpoint = JSON.parse(await readFile(checkpointPath, "utf8")); } catch {}
const resultById = new Map((checkpoint.results || []).map((result) => [result.church_id, result]));
const allChurches = input.churches || [];
const pending = allChurches.filter((church) => !resultById.has(church.church_id)).slice(0, maxChurches > 0 ? maxChurches : undefined);
let cursor = 0, completedSinceSave = 0;
let saveChain = Promise.resolve();
async function saveCheckpoint() {
  const snapshot = [...resultById.values()].sort((a, b) => a.church_id - b.church_id);
  saveChain = saveChain.then(() => atomicJson(checkpointPath, { metadata: { updated_at: new Date().toISOString(), input: inputPath }, results: snapshot }));
  await saveChain;
}
async function worker() {
  while (cursor < pending.length) {
    const church = pending[cursor++];
    const result = await processChurch(church);
    resultById.set(church.church_id, result);
    completedSinceSave += 1;
    if (completedSinceSave >= 10) {
      completedSinceSave = 0;
      await saveCheckpoint();
      console.log(JSON.stringify({ completed: resultById.size, total: allChurches.length, church_id: church.church_id }));
    }
  }
}
await Promise.all(Array.from({ length: concurrency }, worker));
const rawResults = [...resultById.values()].sort((a, b) => a.church_id - b.church_id);
const securityCurrent = checkpoint.metadata?.security_version === 5 && pending.length === 0;
const security = securityCurrent
  ? checkpoint.metadata.privacy_scan
  : { http_source_count: 0, privacy_profiles_held: 0, privacy_schedule_candidates_held: 0, privacy_redactions: 0, detected: { email: 0, mobile_phone: 0, account_number: 0, residential_address: 0 }, transport_review: { policy: "public_read_only_allowed_with_warning", warning_count: 0, login_or_form_submission_allowed: false } };
const results = securityCurrent ? rawResults : rawResults.map((result) => secureResult(result, security));
await atomicJson(checkpointPath, { metadata: { updated_at: new Date().toISOString(), input: inputPath, security_applied: true, security_version: 5, privacy_scan: security }, results });
const output = {
  metadata: { schema_version: 3, generated_at: new Date().toISOString(), input: inputPath, registered_total: allChurches.length, attempted_total: results.length, complete: results.length === allChurches.length, request_delay_per_origin_ms: delayMs, concurrency, automatic_publication: false, transport_policy: security.transport_review.policy, privacy_scan: security },
  candidates: results.flatMap((result) => result.candidates || []), profiles: results.flatMap((result) => result.profiles || []), held: results.flatMap((result) => result.held || []), errors: results.flatMap((result) => result.errors || []), fetch_log: results.flatMap((result) => result.fetch_log || []), church_results: results.map(({ candidates, profiles, contacts, held, errors, fetch_log, ...result }) => ({ ...result, candidate_count: candidates?.length || 0, profile_count: profiles?.length || 0, contact_candidate_count: contacts?.length || 0, held_count: held?.length || 0, error_count: errors?.length || 0, fetch_count: fetch_log?.length || 0 })),
};
await atomicJson(outputPath, output);
const contactsById = new Map(results.flatMap((result) => result.contacts || []).map((contact) => [contact.contact_id, contact]));
const contacts = [...contactsById.values()].map((contact) => ({ candidateId: contact.contact_id, churchId: contact.church_id, churchName: contact.church_name, type: contact.contact_type, value: contact.contact_value, scope: contact.scope, sourceUrl: contact.source_url, collectedAt: contact.collected_at, reviewStatus: contact.review_status, visibility: contact.visibility, revealPolicy: contact.reveal_policy, flags: contact.flags || [] })).filter((contact) => {
  if (contact.type !== "email") return true;
  const domain = contact.value.split("@")[1]?.toLowerCase(), hostname = new URL(contact.sourceUrl).hostname.toLowerCase();
  return !["def.org", "ghi.org", "jkl.org", "email.com", "example.com"].includes(domain) && (domain !== "korea.kr" || hostname.endsWith("korea.kr"));
}).sort((a, b) => a.churchId - b.churchId || a.type.localeCompare(b.type));
await atomicJson(contactsOutputPath, { metadata: { schema_version: 1, generated_at: new Date().toISOString(), visibility: "admin_only", automatic_publication: false, public_api_exposure: false, requires_human_review: true }, contacts });
console.log(JSON.stringify({ registered: allChurches.length, attempted: results.length, complete: output.metadata.complete, candidates: output.candidates.length, profiles: output.profiles.length, contact_candidates: contacts.length, held: output.held.length, errors: output.errors.length, output: outputPath, contacts_output: contactsOutputPath }));
