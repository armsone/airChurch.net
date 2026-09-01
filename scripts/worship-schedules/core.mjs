import { createHash } from "node:crypto";

export const DAYS = Object.freeze({
  "월": "MON", "화": "TUE", "수": "WED", "목": "THU", "금": "FRI", "토": "SAT", "주일": "SUN", "일": "SUN",
});

export function decodeHtml(value) {
  return String(value || "")
    .replace(/&nbsp;|&#160;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/&quot;|&#34;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
}

export function visibleLines(html) {
  const marked = String(html || "")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n").replace(/<\/(?:p|div|li|tr|td|th|h[1-6])\s*>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  return decodeHtml(marked).split(/\n+/).map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean);
}

export function normalizeTime(period, hourText, minuteText = "0") {
  let hour = Number(hourText), minute = Number(minuteText || 0);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  if (/오후|저녁|밤/.test(period) && hour < 12) hour += 12;
  if (/오전/.test(period) && hour === 12) hour = 0;
  if (/낮/.test(period) && hour < 11) hour += 12;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function parseDays(text) {
  const value = String(text || "");
  if (/월\s*[~-]\s*토/.test(value)) return ["MON", "TUE", "WED", "THU", "FRI", "SAT"];
  if (/월\s*[~-]\s*금/.test(value)) return ["MON", "TUE", "WED", "THU", "FRI"];
  const result = [];
  for (const match of value.matchAll(/(주일|월|화|수|목|금|토|일)(?:요일)?/g)) {
    const day = DAYS[match[1]];
    if (day && !result.includes(day)) result.push(day);
  }
  return result;
}

function cleanLabel(value) {
  return String(value || "").replace(/\b(?:class|style|href)\s*=\s*["'][^"']*["']/gi, " ")
    .replace(/^[|·•\-*<>\s]+|[|·•\-*<>\s]+$/g, "").replace(/\s+/g, " ").trim().slice(0, 100);
}

function serviceFromContext(lines, index, section) {
  const nearby = lines.slice(Math.max(0, index - 3), index).reverse();
  const explicit = nearby.find((line) => /(?:예배|기도회|미사|집회)/.test(line) && !/\d{1,2}\s*(?:시|:)/.test(line) && line.length <= 80);
  const part = nearby.find((line) => /^\d+부(?:\s*예배)?$/.test(cleanLabel(line)));
  let label = cleanLabel(part && section && !section.includes(part) ? `${section} ${cleanLabel(part)}` : explicit || section || "예배");
  const concise = label.match(/^(.{1,50}?(?:예배|기도회|미사|집회)(?:\s*\d+부|\d+부)?)/)?.[1];
  if (concise) label = cleanLabel(concise);
  return label;
}

function venueFromLine(line, matchedText) {
  const rest = cleanLabel(line.replace(matchedText, "").replace(/^(?:매주\s*)?(?:(?:월|화|수|목|금|토|일)\s*[~-]\s*(?:월|화|수|목|금|토|일)|주일|월|화|수|목|금|토|일)(?:요일)?\s*/g, ""));
  return cleanLabel(rest.replace(/^[,，/\s]+/, "")) || null;
}

function venueFromContext(lines, index, matchedText) {
  const inline = venueFromLine(lines[index], matchedText);
  if (inline && !/^(?:주일|월|화|수|목|금|토|일)(?:요일)?$/.test(inline)) return inline;
  const next = cleanLabel(lines[index + 1] || "");
  return next && next.length <= 120 && !/(?:예배|기도회|미사|집회|\d{1,2}\s*(?:시|:))/.test(next) ? next : null;
}

function freshnessFlags(sourceLastModified, collectedAt) {
  if (!sourceLastModified) return ["freshness_unknown"];
  const age = Date.parse(collectedAt) - Date.parse(sourceLastModified);
  return Number.isFinite(age) && age > 366 * 24 * 60 * 60 * 1000 ? ["possibly_stale"] : [];
}

export function recordId(record) {
  const key = [record.church_id, record.service_type, record.day_of_week.join(","), record.start_time, record.venue_audience || ""].join("|");
  return createHash("sha256").update(key).digest("hex").slice(0, 24);
}

export function extractScheduleCandidates({ church, sourceUrl, html, collectedAt = new Date().toISOString(), sourceLastModified = null }) {
  const lines = visibleLines(html);
  const records = [];
  let section = "";
  const timePattern = /(오전|오후|저녁|밤|낮)?\s*(\d{1,2})\s*(?:시|:)(?:\s*(\d{1,2})\s*분?)?/g;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (/(?:예배|기도회|미사|집회)$/.test(line) && line.length <= 50) section = cleanLabel(line);
    for (const match of line.matchAll(timePattern)) {
      const context = lines.slice(Math.max(0, index - 3), index + 2).join(" ");
      if (!/(예배|기도회|미사|집회)/.test(context)) continue;
      const startTime = normalizeTime(match[1] || "", match[2], match[3] || "0");
      if (!startTime) continue;
      // 요일은 같은 행 또는 현재 예배 제목에서만 확정한다. 인접한 다른
      // 예배의 요일이 섞이면 자동 공개로 이어질 수 있으므로 넓은 context를 쓰지 않는다.
      const dayOfWeek = parseDays(line).length ? parseDays(line) : parseDays(section);
      const serviceType = serviceFromContext(lines, index, section);
      const sourceText = cleanLabel(lines.slice(Math.max(0, index - 2), Math.min(lines.length, index + 2)).join(" | "));
      const flags = [...freshnessFlags(sourceLastModified, collectedAt)];
      if (!dayOfWeek.length) flags.push("ambiguous_day");
      if (!/(?:예배|기도회|미사|집회)/.test(serviceType) || /^(?:예배|예배영상)$/.test(serviceType) || /video\s*예배영상/i.test(serviceType)) flags.push("ambiguous_service");
      const record = {
        record_id: "", church_id: church.church_id, church_name: church.church_name,
        service_type: serviceType, day_of_week: dayOfWeek, start_time: startTime,
        venue_audience: venueFromContext(lines, index, match[0]), source_text: sourceText.slice(0, 500), source_url: sourceUrl,
        collected_at: collectedAt, source_last_modified: sourceLastModified, confidence: dayOfWeek.length ? "medium" : "low",
        review_status: flags.some((flag) => flag.startsWith("ambiguous_")) ? "hold" : "pending", flags,
      };
      record.record_id = recordId(record);
      records.push(record);
    }
  }
  return deduplicate(records);
}

function metaContent(html, names) {
  for (const tag of String(html || "").match(/<meta\b[^>]*>/gi) || []) {
    const key = tag.match(/(?:name|property)=["']([^"']+)["']/i)?.[1]?.toLowerCase();
    const content = tag.match(/content=["']([^"']+)["']/i)?.[1];
    if (content && names.includes(key)) return cleanLabel(decodeHtml(content));
  }
  return null;
}

function afterHeading(lines, pattern, maxLength = 240) {
  const index = lines.findIndex((line) => pattern.test(line) && line.length <= 50);
  if (index < 0) return null;
  const value = lines.slice(index + 1, index + 4).find((line) => line.length >= 4 && line.length <= maxLength && !pattern.test(line));
  return value ? cleanLabel(value) : null;
}

function jsonLdOrganizations(html) {
  const found = [];
  for (const match of String(html || "").matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const root = JSON.parse(decodeHtml(match[1]));
      const visit = (value) => {
        if (Array.isArray(value)) return value.forEach(visit);
        if (!value || typeof value !== "object") return;
        const types = Array.isArray(value["@type"]) ? value["@type"] : [value["@type"]];
        if (types.some((type) => ["Church", "Organization", "Place"].includes(type))) found.push(value);
        for (const child of Object.values(value)) if (child && typeof child === "object") visit(child);
      };
      visit(root);
    } catch { continue; }
  }
  return found;
}

function addressText(value) {
  if (!value) return null;
  if (typeof value === "string") return cleanLabel(value);
  if (typeof value !== "object") return null;
  return cleanLabel([value.postalCode, value.addressRegion, value.addressLocality, value.streetAddress].filter(Boolean).join(" ")) || null;
}

export function extractChurchProfileCandidate({ church, sourceUrl, html, collectedAt = new Date().toISOString(), sourceLastModified = null }) {
  const lines = visibleLines(html), organizations = jsonLdOrganizations(html), organization = organizations[0] || {};
  const description = cleanLabel(organization.description || metaContent(html, ["description", "og:description"]) || "") || null;
  const slogan = afterHeading(lines, /^(?:교회\s*)?(?:표어|슬로건|캐치프레이즈)$/) || cleanLabel(organization.slogan || "") || null;
  const vision = afterHeading(lines, /^(?:교회\s*)?(?:비전|목회비전|핵심가치|목표)$/) || null;
  const addressLine = lines.find((line) => /(?:서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)(?:특별시|광역시|특별자치시|특별자치도|도)?\s+.{2,}(?:로|길|동)\s*\d*/.test(line) && line.length <= 150);
  const address = addressText(organization.address) || cleanLabel(addressLine || "") || null;
  if (![slogan, vision, description, address].some(Boolean)) return null;
  const fields = [slogan && `표어: ${slogan}`, vision && `비전: ${vision}`, description && `소개: ${description}`, address && `주소: ${address}`].filter(Boolean);
  const flags = freshnessFlags(sourceLastModified, collectedAt);
  return {
    profile_id: `church-profile-${church.church_id}`, church_id: church.church_id, church_name: church.church_name,
    slogan, vision, summary: description, address, source_url: sourceUrl, source_text: fields.join(" | ").slice(0, 1000),
    collected_at: collectedAt, source_last_modified: sourceLastModified, confidence: organizations.length ? "high" : "medium",
    review_status: "pending", flags,
  };
}

export function deduplicate(records) {
  const byKey = new Map();
  for (const record of records) {
    const key = recordId(record);
    const previous = byKey.get(key);
    if (!previous || String(record.collected_at) > String(previous.collected_at)) byKey.set(key, { ...record, record_id: key });
  }
  return [...byKey.values()];
}

export function parseRobots(text, userAgent = "AirChurchWorshipCollector") {
  const groups = [];
  let agents = [], rules = [];
  const flush = () => { if (agents.length) groups.push({ agents, rules }); agents = []; rules = []; };
  for (const raw of String(text || "").split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    if (!line) continue;
    const match = line.match(/^([^:]+):\s*(.*)$/);
    if (!match) continue;
    const key = match[1].trim().toLowerCase(), value = match[2].trim();
    if (key === "user-agent") { if (rules.length) flush(); agents.push(value.toLowerCase()); }
    else if ((key === "allow" || key === "disallow") && agents.length) rules.push({ type: key, path: value });
  }
  flush();
  const needle = userAgent.toLowerCase();
  const specific = groups.filter((group) => group.agents.some((agent) => agent !== "*" && needle.includes(agent)));
  return (specific.length ? specific : groups.filter((group) => group.agents.includes("*"))).flatMap((group) => group.rules);
}

export function robotsAllows(url, robotsText, userAgent) {
  const target = new URL(url), path = `${target.pathname}${target.search}`;
  const matching = parseRobots(robotsText, userAgent).filter((rule) => rule.path && path.startsWith(rule.path));
  matching.sort((a, b) => b.path.length - a.path.length || (a.type === "allow" ? -1 : 1));
  return !matching.length || matching[0].type === "allow";
}

export function validateBundle(bundle, reviews = {}) {
  const errors = [], candidates = [], held = [];
  const required = ["record_id", "church_id", "church_name", "service_type", "day_of_week", "start_time", "source_text", "source_url", "collected_at", "confidence", "review_status"];
  const seen = new Set();
  for (const original of bundle?.candidates || []) {
    const record = { ...original };
    for (const field of required) if (record[field] === undefined || record[field] === null || record[field] === "") errors.push({ record_id: record.record_id || null, code: "missing_field", field });
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(record.start_time || "")) errors.push({ record_id: record.record_id || null, code: "invalid_time" });
    if (!Array.isArray(record.day_of_week) || record.day_of_week.some((day) => !Object.values(DAYS).includes(day))) errors.push({ record_id: record.record_id || null, code: "invalid_day" });
    if (seen.has(record.record_id)) errors.push({ record_id: record.record_id, code: "duplicate_record_id" });
    seen.add(record.record_id);
    const review = reviews[record.record_id];
    if (review?.decision === "approve" && record.review_status === "pending") {
      record.review_status = "approved"; record.reviewed_at = review.reviewed_at; record.reviewer_note = review.note || null;
      candidates.push(record);
    } else {
      if (review?.decision === "reject") record.flags = [...new Set([...(record.flags || []), "review_rejected"])];
      record.review_status = "hold"; held.push(record);
    }
  }
  return { approved: errors.length ? [] : candidates, held, errors };
}

export function validateProfiles(bundle, reviews = {}) {
  const approved = [], held = [], errors = [];
  const required = ["profile_id", "church_id", "church_name", "source_url", "source_text", "collected_at", "confidence", "review_status"];
  for (const original of bundle?.profiles || []) {
    const profile = { ...original };
    for (const field of required) if (profile[field] === undefined || profile[field] === null || profile[field] === "") errors.push({ profile_id: profile.profile_id || null, code: "missing_profile_field", field });
    if (![profile.slogan, profile.vision, profile.summary, profile.address].some(Boolean)) errors.push({ profile_id: profile.profile_id, code: "empty_profile" });
    const review = reviews[profile.profile_id];
    if (review?.decision === "approve" && profile.review_status === "pending") {
      profile.review_status = "approved"; profile.reviewed_at = review.reviewed_at; profile.reviewer_note = review.note || null; approved.push(profile);
    } else {
      if (review?.decision === "reject") profile.flags = [...new Set([...(profile.flags || []), "review_rejected"])];
      profile.review_status = "hold"; held.push(profile);
    }
  }
  return { approved: errors.length ? [] : approved, held, errors };
}
