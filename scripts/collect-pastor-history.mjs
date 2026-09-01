#!/usr/bin/env node

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  USER_AGENT,
  evaluateOfficialSource,
  finalizeSubject,
  parseRobots,
  sha256,
  validateNoSensitiveData,
  validateSourceUrl,
} from "./pastor-history-core.mjs";

const DEFAULT_MANIFEST = "data/pastor-history/sample-sources.json";
const DEFAULT_OUTPUT = "out/pastor-history/collected.json";
const DEFAULT_CACHE = "out/pastor-history/cache.json";
const DEFAULT_ADMIN_CONTACTS_OUTPUT = "out/pastor-history/admin-contact-candidates.json";
const MAX_BODY_BYTES = 1_000_000;
const TIMEOUT_MS = 15_000;
const CACHE_VERSION = 4;

function parseArgs(argv) {
  const value = (name, fallback) => { const index = argv.indexOf(name); return index >= 0 ? argv[index + 1] : fallback; };
  return {
    manifest: value("--manifest", DEFAULT_MANIFEST),
    output: value("--output", DEFAULT_OUTPUT),
    cache: value("--cache", DEFAULT_CACHE),
    roster: value("--roster", null),
    adminContactsOutput: value("--admin-contacts-output", DEFAULT_ADMIN_CONTACTS_OUTPUT),
  };
}

async function readJson(file, fallback) {
  try { return JSON.parse(await readFile(file, "utf8")); } catch (error) {
    if (error?.code === "ENOENT") return fallback;
    throw error;
  }
}

async function atomicJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temp, file);
}

function publicHistoryCacheResult(result) {
  const cached = { ...result };
  delete cached.adminContactCandidates;
  return cached;
}

async function limitedText(response, maximum = MAX_BODY_BYTES) {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maximum) throw new Error("source_too_large");
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maximum) {
      await reader.cancel();
      throw new Error("source_too_large");
    }
    chunks.push(value);
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(body);
}

function manifestSite(manifest, url) {
  return (manifest.sites ?? []).find((site) => site.host.toLowerCase() === url.hostname.toLowerCase());
}

function validateSitePolicy(site, url, sourceType, now) {
  if (!site || site.collectionAllowed !== true) throw new Error("site_policy_not_approved");
  if (!Array.isArray(site.sourceTypes) || !site.sourceTypes.includes(sourceType)) throw new Error("source_type_not_approved_for_site");
  if (!Array.isArray(site.allowedPathPrefixes) || !site.allowedPathPrefixes.some((prefix) => url.pathname.startsWith(prefix))) throw new Error("path_not_approved_by_site_policy");
  const reviewedAt = Date.parse(site.policyReviewedAt);
  if (!Number.isFinite(reviewedAt) || now - reviewedAt > 366 * 24 * 60 * 60 * 1000) throw new Error("site_policy_review_stale");
  let policyUrl;
  try { policyUrl = new URL(site.policyUrl); } catch { throw new Error("invalid_site_policy_url"); }
  if (!new Set(["http:", "https:"]).has(policyUrl.protocol) || policyUrl.hostname.toLowerCase() !== site.host.toLowerCase()) throw new Error("invalid_site_policy_url");
}

function validateSelectionScope(manifest, roster) {
  if (manifest.policy?.pilotOnly === true) {
    if (manifest.subjects.length > 10) throw new Error("pilot_subject_limit_exceeded");
    return { mode: "official_sample_pilot", selectionPolicyId: null };
  }
  if (!roster || roster.metadata?.dryRun !== true || roster.metadata?.published !== false) throw new Error("approved_church_roster_required");
  if (!manifest.policy?.selectionPolicyId || manifest.policy.selectionPolicyId !== roster.metadata.selectionPolicyId) throw new Error("selection_policy_mismatch");
  const candidates = new Map((roster.candidates ?? []).map((candidate) => [candidate.subjectId, candidate]));
  for (const subject of manifest.subjects) {
    const candidate = candidates.get(subject.id);
    if (!candidate || candidate.reviewStatus !== "needs_source_curation" || candidate.publicationEligible !== false) throw new Error(`subject_not_in_approved_church_roster:${subject.id}`);
    if (candidate.churchId != null && subject.churchId !== candidate.churchId) throw new Error(`roster_church_id_mismatch:${subject.id}`);
    if (JSON.stringify(candidate.identity) !== JSON.stringify(subject.identity)) throw new Error(`roster_identity_mismatch:${subject.id}`);
    if (!subject.role || subject.role.category !== candidate.roleCategory || !candidate.eligibleRoleTitles?.includes(subject.role.title)) throw new Error(`roster_role_mismatch:${subject.id}`);
    if (["current", "former"].includes(candidate.roleStatusClaim) && subject.role.status !== candidate.roleStatusClaim) throw new Error(`roster_role_status_mismatch:${subject.id}`);
  }
  return { mode: "approved_church_roster", selectionPolicyId: roster.metadata.selectionPolicyId };
}

export async function collectPastorHistory(manifest, {
  fetchImpl = fetch,
  now = () => new Date(),
  sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  cache = { version: CACHE_VERSION, sources: {} },
  roster = null,
  logger = console.error,
} = {}) {
  if (manifest.version !== 1 || !Array.isArray(manifest.subjects) || !Array.isArray(manifest.sites)) throw new Error("invalid_manifest");
  const selectionScope = validateSelectionScope(manifest, roster);
  const requestState = new Map();
  const robotsByOrigin = new Map();
  const defaultDelay = Math.max(1_500, Number(manifest.policy?.minimumDelayMs ?? 2_000));
  const currentTime = now();
  const currentMs = currentTime.getTime();
  if (cache.version !== CACHE_VERSION) cache = { version: CACHE_VERSION, sources: {} };

  async function pacedFetch(url, delayMs, options = {}) {
    const previous = requestState.get(url.origin) ?? 0;
    const wait = Math.max(0, previous + delayMs - Date.now());
    if (wait) await sleep(wait);
    requestState.set(url.origin, Date.now());
    const response = await fetchImpl(url, {
      ...options,
      method: "GET",
      credentials: "omit",
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { accept: "text/html,application/xhtml+xml,text/plain;q=0.8", "user-agent": USER_AGENT, ...(options.headers ?? {}) },
    });
    return response;
  }

  async function robotsFor(url, site) {
    if (robotsByOrigin.has(url.origin)) return robotsByOrigin.get(url.origin);
    let parsed;
    try {
      const robotsUrl = new URL("/robots.txt", url.origin);
      const response = await pacedFetch(robotsUrl, Math.max(defaultDelay, Number(site.minimumDelayMs ?? 0)));
      if (response.status >= 500 || response.status === 429) throw new Error(`robots_http_${response.status}`);
      if (response.status >= 300 && response.status < 400) throw new Error(`robots_redirect_${response.status}`);
      const body = response.ok ? await limitedText(response, 256_000) : "";
      parsed = parseRobots(body, USER_AGENT);
    } catch (error) {
      throw new Error(`robots_unavailable:${error.message}`);
    }
    robotsByOrigin.set(url.origin, parsed);
    return parsed;
  }

  async function fetchSource(source) {
    let url = validateSourceUrl(source.url, source.type);
    let site = manifestSite(manifest, url);
    validateSitePolicy(site, url, source.type, currentMs);
    const robots = await robotsFor(url, site);
    if (!robots.isAllowed(url)) throw new Error("robots_disallowed");
    let delay = Math.max(defaultDelay, Number(site.minimumDelayMs ?? 0), robots.crawlDelayMs);
    let response;
    for (let redirect = 0; redirect <= 3; redirect += 1) {
      response = await pacedFetch(url, delay);
      if (![301, 302, 303, 307, 308].includes(response.status)) break;
      if (redirect === 3) throw new Error("too_many_redirects");
      const location = response.headers.get("location");
      if (!location) throw new Error("redirect_without_location");
      await response.body?.cancel();
      url = validateSourceUrl(new URL(location, url).toString(), source.type);
      site = manifestSite(manifest, url);
      validateSitePolicy(site, url, source.type, currentMs);
      const redirectedRobots = await robotsFor(url, site);
      if (!redirectedRobots.isAllowed(url)) throw new Error("robots_disallowed_after_redirect");
      delay = Math.max(defaultDelay, Number(site.minimumDelayMs ?? 0), redirectedRobots.crawlDelayMs);
    }
    if (!response.ok) throw new Error(`source_http_${response.status}`);
    const contentType = response.headers.get("content-type") ?? "";
    if (!/(?:text\/html|application\/xhtml\+xml|text\/plain)/i.test(contentType)) throw new Error("unsupported_content_type");
    return { html: await limitedText(response), finalUrl: url.toString(), status: response.status };
  }

  const subjects = [];
  const adminContactMap = new Map();
  for (const subject of manifest.subjects) {
    const sourceResults = [];
    const orderedSources = [...(subject.sources ?? [])].sort((a, b) => Number(a.type === "official_youtube") - Number(b.type === "official_youtube"));
    for (const source of orderedSources) {
      let validatedUrl;
      let sitePolicy;
      try {
        validatedUrl = validateSourceUrl(source.url, source.type);
        sitePolicy = manifestSite(manifest, validatedUrl);
        validateSitePolicy(sitePolicy, validatedUrl, source.type, currentMs);
      } catch (error) {
        sourceResults.push({ sourceUrl: source.url, identityMatched: false, events: [], holds: [{ subjectId: subject.id, sourceUrl: source.url, reason: error.message }] });
        continue;
      }
      if (source.type === "official_youtube") {
        const proof = sourceResults.find((result) => result.sourceUrl === source.ownershipEvidenceUrl && result.identityMatched);
        const wanted = `${validatedUrl.origin}${validatedUrl.pathname.replace(/\/$/, "")}`;
        const linked = proof?.officialChannelUrls?.some((item) => {
          const candidate = new URL(item);
          return `${candidate.origin}${candidate.pathname.replace(/\/$/, "")}` === wanted;
        });
        if (!linked) {
          sourceResults.push({ sourceUrl: source.url, identityMatched: false, events: [], holds: [{ subjectId: subject.id, sourceUrl: source.url, reason: "official_youtube_ownership_unverified" }] });
          continue;
        }
      }
      const cacheKey = sha256(JSON.stringify({ cacheVersion: CACHE_VERSION, policy: manifest.policy, sitePolicy, identity: subject.identity, source }));
      const cached = cache.sources?.[cacheKey];
      const recrawlDays = Math.max(7, Number(source.recrawlDays ?? manifest.policy?.defaultRecrawlDays ?? 30));
      const hasAdminContactCandidates = Array.isArray(source.contactCandidates) && source.contactCandidates.length > 0;
      if (!hasAdminContactCandidates && cached && currentMs - Date.parse(cached.checkedAt) < recrawlDays * 24 * 60 * 60 * 1000) {
        sourceResults.push(cached.result);
        logger(`[cache] ${subject.id} ${source.url}`);
        continue;
      }
      try {
        const fetched = await fetchSource(source);
        const checkedAt = currentTime.toISOString();
        const result = evaluateOfficialSource({ subject, source, html: fetched.html, checkedAt });
        sourceResults.push(result);
        cache.sources ??= {};
        cache.sources[cacheKey] = {
          checkedAt,
          contentSha256: sha256(fetched.html),
          finalUrl: fetched.finalUrl,
          result: publicHistoryCacheResult(result),
        };
        logger(`[checked] ${subject.id} ${source.url}`);
      } catch (error) {
        sourceResults.push({ sourceUrl: source.url, identityMatched: false, events: [], holds: [{ subjectId: subject.id, sourceUrl: source.url, reason: error.message }] });
        logger(`[hold] ${subject.id} ${source.url}: ${error.message}`);
      }
    }
    const finalized = finalizeSubject(subject, sourceResults);
    subjects.push(finalized);
    if (finalized.identityStatus === "verified") {
      for (const contact of sourceResults.flatMap((result) => result.adminContactCandidates ?? [])) adminContactMap.set(contact.contactId, contact);
    }
  }
  const adminContactCandidates = [...adminContactMap.values()].sort((a, b) => a.contactId.localeCompare(b.contactId));
  const configuredSourceUrls = [...new Set(manifest.subjects.flatMap((subject) => (subject.sources ?? []).map((source) => source.url)))];
  const httpSourceCount = configuredSourceUrls.filter((url) => {
    try { return new URL(url).protocol === "http:"; } catch { return false; }
  }).length;
  const result = {
    version: 1,
    metadata: {
      generatedAt: currentTime.toISOString(),
      dryRun: true,
      published: false,
      policy: "official-public-sources-only",
      selectionMode: selectionScope.mode,
      selectionPolicyId: selectionScope.selectionPolicyId,
      subjects: subjects.length,
      verifiedSubjects: subjects.filter((subject) => subject.identityStatus === "verified").length,
      pendingEvents: subjects.reduce((sum, subject) => sum + subject.events.length, 0),
      heldFindings: subjects.reduce((sum, subject) => sum + subject.holds.length, 0),
      separatedAdminContactCandidates: adminContactCandidates.length,
      httpSourceCount,
      transportReview: {
        status: httpSourceCount ? "required" : "passed",
        rule: "public_read_only_no_forms_or_credentials"
      },
      privacyScan: {
        status: "passed",
        sourceTextStored: false,
        factSummariesScanned: subjects.reduce((sum, subject) => sum + subject.events.length, 0),
        sensitiveFindings: 0,
        copiedContactFields: 0,
        separatedAdminContactCandidates: adminContactCandidates.length,
        publicContactFields: 0
      },
    },
    subjects,
  };
  const adminContactArtifact = {
    version: 1,
    metadata: {
      generatedAt: currentTime.toISOString(),
      dryRun: true,
      published: false,
      encrypted: false,
      databaseWrites: 0,
      visibility: "admin_only",
      scope: "official_role",
      revealPolicy: "masked_audited",
      requiresTeamLeadApproval: true,
      candidates: adminContactCandidates.length,
      sourceTextStored: false,
    },
    candidates: adminContactCandidates,
  };
  validateNoSensitiveData(result);
  return { result, cache, adminContactArtifact };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const manifest = await readJson(args.manifest, null);
  if (!manifest) throw new Error(`manifest_not_found:${args.manifest}`);
  const cache = await readJson(args.cache, { version: CACHE_VERSION, sources: {} });
  const roster = args.roster ? await readJson(args.roster, null) : null;
  const collected = await collectPastorHistory(manifest, { cache, roster });
  await atomicJson(args.output, collected.result);
  await atomicJson(args.adminContactsOutput, collected.adminContactArtifact);
  await atomicJson(args.cache, collected.cache);
  console.log(JSON.stringify(collected.result.metadata));
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
