import { createHash } from "node:crypto";
import { isIP } from "node:net";

export const USER_AGENT = "airChurchPublicHistoryBot/0.1 (+https://airchurch.net/contact)";
export const SOURCE_TYPES = new Set([
  "official_church",
  "official_denomination",
  "official_presbytery",
  "official_seminary",
  "official_youtube",
]);
export const ROLE_CATEGORIES = new Set(["current_primary", "associate", "education", "cooperating", "emeritus", "retired"]);
export const ROLE_STATUSES = new Set(["current", "former", "unverified"]);
export const OFFICIAL_CONTACT_TYPES = new Set(["email", "phone", "account"]);

const DENIED_HOSTS = [
  /(^|\.)facebook\.com$/i,
  /(^|\.)instagram\.com$/i,
  /(^|\.)threads\.net$/i,
  /(^|\.)x\.com$/i,
  /(^|\.)twitter\.com$/i,
  /(^|\.)tiktok\.com$/i,
  /(^|\.)linkedin\.com$/i,
  /(^|\.)band\.us$/i,
  /(^|\.)kakao\.com$/i,
  /(^|\.)blog\.naver\.com$/i,
  /(^|\.)cafe\.naver\.com$/i,
];
const YOUTUBE_HOSTS = /(^|\.)(youtube\.com|youtu\.be)$/i;
const DENIED_PATH = /\/(?:login|log-in|signin|sign-in|member|members|mypage|my-page|admin)(?:\/|$)/i;
const PRIVATE_HOST = /^(?:localhost|0\.0\.0\.0|127(?:\.\d{1,3}){3}|10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|169\.254(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2}|\[?::1\]?)$/i;
const SENSITIVE_TEXT = /(?:전화|연락처|휴대폰|핸드폰|이메일|e-mail|@|배우자|부인|아내|남편|자녀|아들|딸|가족|생년월일|주민등록|계좌|건강|질병|병력|장애|주소)/i;
const CONTACT_VALUE_TEXT = /(?:\+82|0\d{1,2})[- )]?\d{3,4}[- ]?\d{4}|\d{2,6}-\d{2,6}-\d{3,8}/;
const FORBIDDEN_KEYS = /^(?:phone|tel|telephone|mobile|email|contact|address|streetAddress|postalCode|family|spouse|children|birthDate|health|medical|residentId)$/i;

export function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

export function compact(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase("ko-KR")
    .replace(/\s+/g, "")
    .replace(/[^0-9a-z가-힣]/g, "");
}

function decodeEntities(value) {
  const named = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
  return value.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (_, token) => {
    if (token[0] !== "#") return named[token.toLowerCase()] ?? " ";
    const point = token[1].toLowerCase() === "x" ? Number.parseInt(token.slice(2), 16) : Number.parseInt(token.slice(1), 10);
    return Number.isFinite(point) ? String.fromCodePoint(point) : " ";
  });
}

export function visibleText(html) {
  return decodeEntities(String(html ?? "")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(?:script|style|noscript|template)\b[^>]*>[\s\S]*?<\/(?:script|style|noscript|template)>/gi, " ")
    .replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

export function officialYouTubeChannelUrls(html, baseUrl) {
  const urls = new Set();
  const expression = /(?:href|content)\s*=\s*["']([^"']*(?:youtube\.com\/)(?:@[^"'/?#&]+|channel\/UC[\w-]{20,})[^"']*)["']/gi;
  let match;
  while ((match = expression.exec(String(html ?? ""))) !== null) {
    try {
      const url = new URL(decodeEntities(match[1]), baseUrl);
      const validated = validateSourceUrl(url.toString(), "official_youtube");
      validated.search = "";
      validated.pathname = validated.pathname.replace(/\/$/, "");
      urls.add(validated.toString());
    } catch {
      // Ignore non-channel and malformed links; only validated official-channel URLs survive.
    }
  }
  return [...urls].sort();
}

export function validateSourceUrl(rawUrl, sourceType) {
  if (!SOURCE_TYPES.has(sourceType)) throw new Error(`unsupported_source_type:${sourceType}`);
  let url;
  try { url = new URL(rawUrl); } catch { throw new Error("invalid_source_url"); }
  if (!new Set(["http:", "https:"]).has(url.protocol)) throw new Error("http_or_https_required");
  if (url.username || url.password) throw new Error("source_credentials_forbidden");
  if (isIP(url.hostname.replace(/^\[|\]$/g, "")) || PRIVATE_HOST.test(url.hostname) || url.hostname.endsWith(".local")) throw new Error("private_host_forbidden");
  if (DENIED_HOSTS.some((pattern) => pattern.test(url.hostname))) throw new Error("personal_social_source_forbidden");
  if (DENIED_PATH.test(url.pathname)) throw new Error("login_or_private_path_forbidden");
  const isYouTube = YOUTUBE_HOSTS.test(url.hostname);
  if (isYouTube !== (sourceType === "official_youtube")) throw new Error("source_type_host_mismatch");
  if (isYouTube && !/^\/(?:@[^/]+|channel\/UC[\w-]{20,})(?:\/|$)/.test(url.pathname)) throw new Error("youtube_channel_url_required");
  if (isYouTube) {
    const channelPath = url.pathname.match(/^\/(?:@[^/]+|channel\/UC[\w-]{20,})/)?.[0];
    url.hostname = "www.youtube.com";
    url.protocol = "https:";
    url.pathname = channelPath;
    url.search = "";
  }
  url.hash = "";
  return url;
}

export function transportReview(rawUrl) {
  const protocol = new URL(rawUrl).protocol;
  const unencrypted = protocol === "http:";
  return {
    transportSecurity: unencrypted ? "unencrypted" : "encrypted",
    transportWarning: unencrypted ? "unencrypted_transport" : null,
    transportReview: unencrypted ? "required" : "passed",
  };
}

function robotsPattern(path) {
  const endAnchored = path.endsWith("$");
  const body = (endAnchored ? path.slice(0, -1) : path)
    .split("*")
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${body}${endAnchored ? "$" : ""}`);
}

export function parseRobots(text, userAgent = USER_AGENT) {
  const groups = [];
  let group = null;
  let hasRules = false;
  for (const rawLine of String(text ?? "").split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    const separator = line.indexOf(":");
    if (separator < 0) continue;
    const field = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (field === "user-agent") {
      if (!group || hasRules) {
        group = { agents: [], rules: [], crawlDelayMs: 0 };
        groups.push(group);
        hasRules = false;
      }
      group.agents.push(value.toLowerCase());
      continue;
    }
    if (!group) continue;
    if (field === "allow" || field === "disallow") {
      hasRules = true;
      if (value) group.rules.push({ type: field, path: value });
    } else if (field === "crawl-delay") {
      const seconds = Number(value);
      if (Number.isFinite(seconds) && seconds >= 0) group.crawlDelayMs = Math.ceil(seconds * 1000);
    }
  }
  const agent = userAgent.toLowerCase();
  const specific = groups.filter((candidate) => candidate.agents.some((item) => item !== "*" && agent.includes(item)));
  const matched = specific.length ? specific : groups.filter((candidate) => candidate.agents.includes("*"));
  const rules = matched.flatMap((candidate) => candidate.rules);
  const crawlDelayMs = Math.max(0, ...matched.map((candidate) => candidate.crawlDelayMs));
  return {
    crawlDelayMs,
    isAllowed(target) {
      const url = target instanceof URL ? target : new URL(target);
      const requestPath = `${url.pathname}${url.search}`;
      const matches = rules
        .filter((rule) => robotsPattern(rule.path).test(requestPath))
        .sort((a, b) => b.path.replace(/[*$]/g, "").length - a.path.replace(/[*$]/g, "").length || (a.type === "allow" ? -1 : 1));
      return !matches.length || matches[0].type === "allow";
    },
  };
}

export function validateNoSensitiveData(value, location = "root") {
  if (Array.isArray(value)) {
    value.forEach((item, index) => validateNoSensitiveData(item, `${location}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, item] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.test(key)) throw new Error(`forbidden_field:${location}.${key}`);
    const text=String(item??"");
    const sensitiveSummary=key==="factSummary"&&(SENSITIVE_TEXT.test(text)||CONTACT_VALUE_TEXT.test(text));
    const contactInIdentity=["role","organization"].includes(key)&&CONTACT_VALUE_TEXT.test(text);
    if (sensitiveSummary||contactInIdentity) {
      throw new Error(`sensitive_text:${location}.${key}`);
    }
    validateNoSensitiveData(item, `${location}.${key}`);
  }
}

function hasAllEvidence(pageText, values) {
  const haystack = compact(pageText);
  return Array.isArray(values) && values.length > 0 && values.every((value) => haystack.includes(compact(value)));
}

function officialContactValue(type, value) {
  const candidate = String(value ?? "").normalize("NFKC").trim();
  if (type === "email" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate)) return candidate;
  if (type === "phone" && /^\+?[0-9()\-\s]{8,24}$/.test(candidate)) return candidate;
  if (type === "account" && /^[0-9\-\s]{8,32}$/.test(candidate)) return candidate;
  throw new Error("invalid_official_contact_value");
}

function evaluateOfficialContacts(subject, source, text, checkedAt, transport) {
  const contacts = [];
  const holds = [];
  for (const [index, candidate] of (source.contactCandidates ?? []).entries()) {
    const churchId = Number(subject.churchId);
    if (!Number.isInteger(churchId) || churchId < 1 || !OFFICIAL_CONTACT_TYPES.has(candidate.type) || candidate.scope !== "official_role") throw new Error("invalid_official_contact_candidate");
    if (!hasAllEvidence(text, candidate.evidenceAll)) {
      holds.push({ subjectId: subject.id, sourceUrl: source.url, reason: "official_contact_evidence_missing", contactIndex: index });
      continue;
    }
    const value = officialContactValue(candidate.type, candidate.value);
    const key = [churchId, candidate.type, candidate.scope, value, source.url].map(compact).join("|");
    contacts.push({
      contactId: sha256(key).slice(0, 24),
      churchId,
      type: candidate.type,
      value,
      scope: "official_role",
      officialRole: String(candidate.officialRole ?? subject.role.title).trim(),
      sourceUrl: source.url,
      checkedAt,
      reviewStatus: "pending",
      visibility: "admin_only",
      revealPolicy: "masked_audited",
      publicationEligible: false,
      confidence: "high",
      ...transport,
    });
  }
  return { contacts, holds };
}

function isoDateOrNull(value, field) {
  if (value == null || value === "") return null;
  if (!/^\d{4}(?:-\d{2}(?:-\d{2})?)?$/.test(value)) throw new Error(`invalid_${field}`);
  const [year, month, day] = value.split("-").map(Number);
  if (month != null && (month < 1 || month > 12)) throw new Error(`invalid_${field}`);
  if (day != null) {
    const parsed = new Date(Date.UTC(year, month - 1, day));
    if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) throw new Error(`invalid_${field}`);
  }
  return value;
}

export function evaluateOfficialSource({ subject, source, html, checkedAt }) {
  if (!subject.role || !ROLE_CATEGORIES.has(subject.role.category) || !subject.role.title || !ROLE_STATUSES.has(subject.role.status)) throw new Error("invalid_subject_role");
  const text = visibleText(html);
  const transport = transportReview(source.url);
  const officialChannelUrls = source.type === "official_youtube" ? [] : officialYouTubeChannelUrls(html, source.url);
  const axes = ["pastor", "church", "denomination", "region", "role"];
  const identityMatches = Object.fromEntries(axes.map((axis) => [axis, hasAllEvidence(text, source.identityEvidence?.[axis])]));
  const missingAxes = axes.filter((axis) => !identityMatches[axis]);
  if (missingAxes.length) {
    return {
      sourceUrl: source.url,
      identityMatched: false,
      identityMatches,
      officialChannelUrls,
      ...transport,
      events: [],
      holds: [{ subjectId: subject.id, sourceUrl: source.url, reason: "identity_evidence_missing", details: missingAxes }],
    };
  }
  const events = [];
  const holds = [];
  const adminContacts = evaluateOfficialContacts(subject, source, text, checkedAt, transport);
  holds.push(...adminContacts.holds);
  for (const [index, assertion] of (source.assertions ?? []).entries()) {
    if (!hasAllEvidence(text, assertion.evidenceAll)) {
      holds.push({ subjectId: subject.id, sourceUrl: source.url, reason: "assertion_evidence_missing", assertionIndex: index });
      continue;
    }
    const startDate = isoDateOrNull(assertion.startDate, "start_date");
    const endDate = isoDateOrNull(assertion.endDate, "end_date");
    if (startDate && endDate && startDate > endDate) throw new Error("event_date_range_invalid");
    const event = {
      subjectId: subject.id,
      churchId: subject.churchId ?? null,
      pastorName: subject.identity.pastorName,
      churchName: subject.identity.churchName,
      denomination: subject.identity.denomination,
      region: subject.identity.region,
      eventType: assertion.eventType,
      role: assertion.role,
      roleCategory: assertion.roleCategory ?? subject.role.category,
      roleStatus: assertion.roleStatus ?? subject.role.status,
      organization: assertion.organization,
      startDate,
      endDate,
      factSummary: String(assertion.factSummary ?? "").trim(),
      sourceUrl: source.url,
      sourceUrls: [source.url],
      checkedAt,
      confidence: "high",
      reviewStatus: "pending",
      isPrimaryRole: assertion.isPrimaryRole === true,
      ...transport,
    };
    if (!event.factSummary || event.factSummary.length > 160 || /[\r\n]/.test(event.factSummary)) throw new Error("invalid_fact_summary");
    if (text.includes(event.factSummary)) throw new Error("fact_summary_must_be_paraphrased");
    if (!event.eventType || !event.role || !event.organization) throw new Error("incomplete_event");
    if (!ROLE_CATEGORIES.has(event.roleCategory) || !ROLE_STATUSES.has(event.roleStatus)) throw new Error("invalid_event_role");
    validateNoSensitiveData(event, `subjects.${subject.id}.assertions[${index}]`);
    events.push(event);
  }
  return { sourceUrl: source.url, identityMatched: true, identityMatches, officialChannelUrls, ...transport, events, adminContactCandidates: adminContacts.contacts, holds };
}

function eventKey(event) {
  return [event.subjectId, event.eventType, event.roleCategory, event.roleStatus, event.role, event.organization, event.startDate ?? "", event.endDate ?? ""].map(compact).join("|");
}

export function finalizeSubject(subject, sourceResults) {
  const verifiedSources = new Set(sourceResults.filter((result) => result.identityMatched).map((result) => result.sourceUrl));
  const minimum = Math.max(2, Number(subject.minimumIdentitySources ?? 2));
  const inheritedHolds = sourceResults.flatMap((result) => result.holds ?? []).map((hold) => ({ ...hold, confidence: "low", reviewStatus: "hold" }));
  if (verifiedSources.size < minimum) {
    return {
      subjectId: subject.id,
      churchId: subject.churchId ?? null,
      identity: subject.identity,
      role: subject.role,
      identityStatus: "hold",
      verifiedSourceCount: verifiedSources.size,
      events: [],
      holds: [...inheritedHolds, { subjectId: subject.id, reason: "insufficient_cross_verification", details: { required: minimum, found: verifiedSources.size }, confidence: "low", reviewStatus: "hold" }],
    };
  }
  const merged = new Map();
  for (const event of sourceResults.flatMap((result) => result.events ?? [])) {
    const key = eventKey(event);
    const existing = merged.get(key);
    if (!existing) {
      const eventId = sha256(key).slice(0, 24);
      merged.set(key, { ...event, eventId });
    } else {
      existing.sourceUrls = [...new Set([...existing.sourceUrls, ...event.sourceUrls])].sort();
      existing.sourceUrl = existing.sourceUrls[0];
      if (event.checkedAt > existing.checkedAt) existing.checkedAt = event.checkedAt;
    }
  }
  const events = [...merged.values()];
  const primaryCurrent = events.filter((event) => event.isPrimaryRole && event.roleCategory === "current_primary" && event.roleStatus === "current" && !event.endDate);
  const organizations = new Set(primaryCurrent.map((event) => compact(event.organization)));
  if (organizations.size > 1) {
    return {
      subjectId: subject.id,
      churchId: subject.churchId ?? null,
      identity: subject.identity,
      role: subject.role,
      identityStatus: "hold",
      verifiedSourceCount: verifiedSources.size,
      events: [],
      holds: [...inheritedHolds, { subjectId: subject.id, reason: "conflicting_current_primary_roles", confidence: "low", reviewStatus: "hold" }],
    };
  }
  return {
    subjectId: subject.id,
    churchId: subject.churchId ?? null,
    identity: subject.identity,
    role: subject.role,
    identityStatus: "verified",
    verifiedSourceCount: verifiedSources.size,
    events: events.sort((a, b) => String(b.startDate ?? "").localeCompare(String(a.startDate ?? "")) || a.eventId.localeCompare(b.eventId)),
    holds: inheritedHolds,
  };
}

export function canonicalImportRecords(collected) {
  const records = (collected.subjects ?? [])
    .filter((subject) => subject.identityStatus === "verified")
    .flatMap((subject) => subject.events ?? [])
    .filter((event) => event.reviewStatus === "pending" && event.confidence === "high")
    .map((event) => Object.fromEntries(Object.entries(event).filter(([key]) => key !== "isPrimaryRole")))
    .sort((a, b) => a.eventId.localeCompare(b.eventId));
  validateNoSensitiveData(records, "importRecords");
  return records;
}

export function importArtifactDigest(records) {
  return sha256(JSON.stringify(records));
}
