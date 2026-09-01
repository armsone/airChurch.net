#!/usr/bin/env node

import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sha256, transportReview, validateNoSensitiveData, validateSourceUrl } from "./pastor-history-core.mjs";

const DEFAULT_POLICY = "data/pastor-history/selection-policy.json";
const DEFAULT_OUTPUT = "out/pastor-history/roster.json";
const MAX_INPUT_BYTES = 20_000_000;
const MAX_RECORDS = 50_000;
const ROLE_CATEGORIES = {
  current_primary: ["담임목사", "위임목사", "대표목사"],
  associate: ["부목사"],
  education: ["교육목사"],
  cooperating: ["협동목사"],
  emeritus: ["원로목사"],
  retired: ["은퇴목사"],
};
const ROLE_BY_TITLE = new Map(Object.entries(ROLE_CATEGORIES).flatMap(([category, titles]) => titles.map((title) => [title, category])));
const UNSUPPORTED_ROLE = /(?:기관)\s*목사|선교사|전도사|강도사|장로|사모/u;
const MULTIPLE_PEOPLE = /(?:[,/&·ㆍ]|\s외(?:\s*\d+명)?$|\s및\s)/u;
const GENERIC_NAME = /^(?:(?:교육|협동|원로|은퇴|담임|위임|대표|부)\s*)?목사(?:님)?$|^(?:미상|없음|공석|청빙중)$/u;

function parseArgs(argv) {
  const value = (name, fallback = null) => { const index = argv.indexOf(name); return index >= 0 ? argv[index + 1] : fallback; };
  return { input: value("--input"), output: value("--output", DEFAULT_OUTPUT), policy: value("--policy", DEFAULT_POLICY) };
}

function clean(value, maximum) {
  return String(value ?? "").normalize("NFKC").replace(/\s+/g, " ").trim().slice(0, maximum);
}

function recordValue(record, ...keys) {
  for (const key of keys) if (record?.[key] != null) return record[key];
  return null;
}

function normalizeRoleTitle(value) {
  const title = clean(value, 40).replace(/\s+/g, "").replace(/님$/u, "");
  return ROLE_BY_TITLE.has(title) ? title : null;
}

function parsePastorLabel(value, explicitRole = null, requireExplicitRole = false) {
  const label = clean(value, 100);
  if (!label || GENERIC_NAME.test(label)) return { error: "pastor_name_missing" };
  if (MULTIPLE_PEOPLE.test(label)) return { error: "multiple_pastors_require_manual_split" };
  if (UNSUPPORTED_ROLE.test(label) || explicitRole && !normalizeRoleTitle(explicitRole)) return { error: "role_not_in_supported_pastor_categories" };
  let roleTitleClaim = normalizeRoleTitle(explicitRole);
  let name = label;
  if (!roleTitleClaim) {
    const prefix = label.match(/^((?:교육|협동|원로|은퇴|담임|위임|대표|부)\s*목사)(?:님)?\s+(.+)$/u);
    const suffix = label.match(/^(.+?)\s+((?:교육|협동|원로|은퇴|담임|위임|대표|부)\s*목사)(?:님)?$/u);
    if (prefix) { roleTitleClaim = normalizeRoleTitle(prefix[1]); name = prefix[2]; }
    else if (suffix) { name = suffix[1]; roleTitleClaim = normalizeRoleTitle(suffix[2]); }
    else name = label.replace(/\s*목사(?:님)?$/u, "");
  }
  if (requireExplicitRole && !roleTitleClaim) return { error: "role_required_for_additional_pastor" };
  name = clean(name, 60);
  if (name.length < 2 || GENERIC_NAME.test(name) || !/[\p{L}]/u.test(name)) return { error: "pastor_name_invalid" };
  const roleCategory = roleTitleClaim ? ROLE_BY_TITLE.get(roleTitleClaim) : "current_primary";
  return { name, roleTitleClaim, roleCategory, eligibleRoleTitles: roleTitleClaim ? [roleTitleClaim] : [...ROLE_CATEGORIES.current_primary] };
}

function roleEntries(record) {
  const additional = Array.isArray(record.pastors) ? record.pastors : [];
  const additionalPrimaryNames = new Set(additional.flatMap((item) => {
    if (!item || typeof item !== "object" || ROLE_BY_TITLE.get(normalizeRoleTitle(item.role)) !== "current_primary") return [];
    const parsed = parsePastorLabel(item.name ?? item.pastorName, item.role, true);
    return parsed.error ? [] : [parsed.name];
  }));
  const entries = [];
  const primary = recordValue(record, "pastor", "pastorName", "pastor_name");
  const parsedPrimary = primary ? parsePastorLabel(primary) : null;
  if (primary && (!parsedPrimary || parsedPrimary.error || !additionalPrimaryNames.has(parsedPrimary.name))) entries.push({ name: primary, role: null, status: "current", origin: "church_primary_field" });
  for (const item of additional) {
    if (typeof item === "string") entries.push({ name: item, role: null, status: null, origin: "official_role_list" });
    else if (item && typeof item === "object") entries.push({ name: item.name ?? item.pastorName, role: item.role ?? item.roleTitle, status: item.status ?? item.roleStatus, startDate: item.startDate, endDate: item.endDate, origin: "official_role_list" });
  }
  return entries;
}

function dateClaim(value) {
  const date = clean(value, 10);
  if (!date) return null;
  if (!/^\d{4}(?:-\d{2}(?:-\d{2})?)?$/.test(date)) return "invalid";
  const [year, month, day] = date.split("-").map(Number);
  if (month != null && (month < 1 || month > 12)) return "invalid";
  if (day != null) {
    const parsed = new Date(Date.UTC(year, month - 1, day));
    if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) return "invalid";
  }
  return date;
}

function inputRecords(input) {
  if (Array.isArray(input)) return { records: input, approvedOnly: false };
  const records = Array.isArray(input?.items) ? input.items : Array.isArray(input?.records) ? input.records : null;
  if (!records) throw new Error("church_records_array_required");
  return { records, approvedOnly: input.metadata?.approvedOnly === true };
}

function approvedRecord(record, approvedOnly) {
  const status = clean(recordValue(record, "reviewStatus", "review_status", "status"), 30).toLowerCase();
  return status ? status === "approved" : approvedOnly;
}

function hold(record, reason, details = null) {
  const churchName = clean(recordValue(record, "name", "churchName", "church_name"), 100) || "이름 없음";
  const result = { churchName, reason, confidence: "low", reviewStatus: "hold", publicationEligible: false };
  return details ? { ...result, details } : result;
}

export function buildPastorRoster(input, policy, generatedAt = new Date().toISOString()) {
  const requiredAxes = new Set(policy?.requiredIdentityAxes ?? []);
  const policyRolesValid = Object.entries(ROLE_CATEGORIES).every(([category, titles]) =>
    Array.isArray(policy?.roleCategories?.[category]) &&
    policy.roleCategories[category].length === titles.length &&
    titles.every((title) => policy.roleCategories[category].includes(title))
  );
  if (
    policy?.version !== 1 ||
    policy?.phase !== "all_official_church_pastors" ||
    policy?.publicationDefault !== false ||
    policy?.allowsPublicHttpRead !== true ||
    policy?.visibilityPriorityPolicy !== "equal_across_role_categories" ||
    !policyRolesValid ||
    requiredAxes.size !== 5 ||
    !["pastor", "church", "denomination", "region", "role"].every((axis) => requiredAxes.has(axis)) ||
    !Array.isArray(policy.allowedRegionPrefixes) ||
    policy.allowedRegionPrefixes.length < 1
  ) throw new Error("invalid_selection_policy");
  const { records, approvedOnly } = inputRecords(input);
  if (records.length > MAX_RECORDS) throw new Error("too_many_church_records");
  const candidateMap = new Map();
  const roleDiscoveryMap = new Map();
  const holds = [];

  for (const record of records) {
    if (!record || typeof record !== "object" || Array.isArray(record)) { holds.push(hold({}, "invalid_church_record")); continue; }
    if (!approvedRecord(record, approvedOnly)) { holds.push(hold(record, "church_not_approved")); continue; }
    const churchName = clean(recordValue(record, "name", "churchName", "church_name"), 100);
    const denomination = clean(recordValue(record, "denomination"), 120);
    const region = clean(recordValue(record, "region"), 80);
    if (!churchName || !denomination || !region) {
      const missing = [["church", churchName], ["denomination", denomination], ["region", region]].filter(([, value]) => !value).map(([axis]) => axis);
      holds.push(hold(record, "identity_axis_missing", missing));
      continue;
    }
    if (!policy.allowedRegionPrefixes.some((prefix) => region.startsWith(prefix))) {
      holds.push(hold(record, "outside_korea_region_scope"));
      continue;
    }
    const rawHomepage = clean(recordValue(record, "homepageUrl", "homepage_url", "homepage"), 500);
    let homepageUrl;
    try { homepageUrl = validateSourceUrl(rawHomepage, "official_church").toString(); } catch (error) {
      holds.push(hold(record, "official_public_homepage_required", error.message));
      continue;
    }
    const homepageTransport = transportReview(homepageUrl);
    const rawChannelId = clean(recordValue(record, "youtubeChannelId", "youtube_channel_id", "channelId"), 80);
    const youtubeChannelCandidateUrl = /^UC[\w-]{20,}$/.test(rawChannelId) ? `https://www.youtube.com/channel/${rawChannelId}` : null;
    const churchId = Number(recordValue(record, "id", "churchId", "church_id"));
    const churchKey = [churchName, denomination, region].map((item) => item.normalize("NFKC").toLowerCase().replace(/[^0-9a-z가-힣]/g, "")).join("|");
    if (!roleDiscoveryMap.has(churchKey)) roleDiscoveryMap.set(churchKey, {
      discoveryId: `roles-${sha256(churchKey).slice(0, 20)}`,
      churchId: Number.isInteger(churchId) && churchId > 0 ? churchId : null,
      church: { churchName, denomination, region },
      officialHomepageUrl: homepageUrl,
      ...homepageTransport,
      roleCategoriesToDiscover: ["associate", "education", "cooperating", "emeritus", "retired"],
      reviewStatus: "needs_official_role_discovery",
      confidence: "unverified",
      publicationEligible: false,
      searchPriorityWeight: 1,
      publicationPriorityWeight: 1,
      fairnessPolicy: "equal_across_role_categories",
      nextAction: "공식 교역자·섬기는 사람들·연혁 페이지에서 각 목사 이름·직책·current/former 상태를 별도 행으로 확인한다.",
    });
    const entries = roleEntries(record);
    if (!entries.length) { holds.push(hold(record, "pastor_name_missing")); continue; }
    for (const entry of entries) {
      const parsedPastor = parsePastorLabel(entry.name, entry.role, entry.origin === "official_role_list");
      if (parsedPastor.error) { holds.push(hold(record, parsedPastor.error, { role: clean(entry.role, 40) || null })); continue; }
      const startDateClaim = dateClaim(entry.startDate), endDateClaim = dateClaim(entry.endDate);
      if (startDateClaim === "invalid" || endDateClaim === "invalid" || startDateClaim && endDateClaim && startDateClaim > endDateClaim) {
        holds.push(hold(record, "role_date_claim_invalid", { pastorName: parsedPastor.name, role: parsedPastor.roleTitleClaim }));
        continue;
      }
      const rawRoleStatus = clean(entry.status, 20).toLowerCase();
      if (rawRoleStatus && !["current", "former"].includes(rawRoleStatus)) {
        holds.push(hold(record, "role_status_claim_invalid", { pastorName: parsedPastor.name, role: parsedPastor.roleTitleClaim }));
        continue;
      }
      const roleStatusClaim = rawRoleStatus || "unverified";
      const identity = { pastorName: parsedPastor.name, churchName, denomination, region };
      const dedupeKey = [identity.pastorName, identity.churchName, identity.denomination, identity.region, parsedPastor.roleCategory, parsedPastor.roleTitleClaim ?? "unconfirmed", roleStatusClaim, startDateClaim ?? "", endDateClaim ?? ""].map((item) => item.normalize("NFKC").toLowerCase().replace(/[^0-9a-z가-힣]/g, "")).join("|");
      if (candidateMap.has(dedupeKey)) continue;
      candidateMap.set(dedupeKey, {
        subjectId: `pastor-${sha256(dedupeKey).slice(0, 20)}`,
        churchId: Number.isInteger(churchId) && churchId > 0 ? churchId : null,
        identity,
        organization: churchName,
        selectionBasis: "approved_airchurch_church",
        selectionPhase: policy.phase,
        roleCategory: parsedPastor.roleCategory,
        roleTitleClaim: parsedPastor.roleTitleClaim,
        eligibleRoleTitles: parsedPastor.eligibleRoleTitles,
        roleStatusClaim,
        startDateClaim,
        endDateClaim,
        officialHomepageUrl: homepageUrl,
        ...homepageTransport,
        youtubeChannelCandidateUrl,
        requiredOfficialIdentitySources: Math.max(2, Number(policy.minimumOfficialIdentitySources ?? 2)),
        reviewStatus: "needs_source_curation",
        confidence: "unverified",
        publicationEligible: false,
        searchPriorityWeight: 1,
        publicationPriorityWeight: 1,
        fairnessPolicy: "equal_across_role_categories",
        nextAction: "공식 페이지 두 곳에서 이름·교회·교단·지역·직책과 current/former 상태를 각각 확인한다.",
      });
    }
  }

  const candidates = [...candidateMap.values()].sort((a, b) => a.identity.denomination.localeCompare(b.identity.denomination, "ko") || a.identity.churchName.localeCompare(b.identity.churchName, "ko") || a.identity.pastorName.localeCompare(b.identity.pastorName, "ko") || a.roleCategory.localeCompare(b.roleCategory));
  const roleDiscoveryQueue = [...roleDiscoveryMap.values()].sort((a, b) => a.church.denomination.localeCompare(b.church.denomination, "ko") || a.church.churchName.localeCompare(b.church.churchName, "ko"));
  const result = {
    version: 1,
    metadata: {
      generatedAt,
      dryRun: true,
      published: false,
      selectionPolicyId: policy.policyId,
      selectionPolicySha256: sha256(JSON.stringify(policy)),
      inputRecords: records.length,
      candidates: candidates.length,
      roleDiscoveryQueue: roleDiscoveryQueue.length,
      held: holds.length,
      scope: "approved_church_all_official_pastors",
      fairnessPolicy: "equal_across_role_categories",
      httpSourceCount: candidates.filter((candidate) => candidate.transportSecurity === "unencrypted").length,
      transportReview: {
        status: candidates.some((candidate) => candidate.transportSecurity === "unencrypted") ? "required" : "passed",
        rule: "public_read_only_no_forms_or_credentials"
      },
      privacyScan: {
        status: "passed",
        sourceTextStored: false,
        factSummariesScanned: 0,
        sensitiveFindings: 0,
        copiedContactFields: 0,
        adminOnlyContactCandidates: 0,
        publicContactFields: 0
      },
    },
    candidates,
    roleDiscoveryQueue,
    holds,
  };
  validateNoSensitiveData(result);
  return result;
}

async function readLimitedJson(file) {
  const info = await stat(file);
  if (info.size > MAX_INPUT_BYTES) throw new Error("church_export_too_large");
  return JSON.parse(await readFile(file, "utf8"));
}

async function atomicJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporary, file);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.input) throw new Error("--input approved-church-export.json is required");
  const [input, policy] = await Promise.all([readLimitedJson(args.input), readLimitedJson(args.policy)]);
  const roster = buildPastorRoster(input, policy);
  await atomicJson(args.output, roster);
  console.log(JSON.stringify(roster.metadata));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
