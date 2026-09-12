import { createHash } from "node:crypto";

const attribute = (tag, name) => tag.match(new RegExp(`(?:\\s|<)${name}\\s*=\\s*["']([^"']*)["']`, "i"))?.[1] ?? "";
const hidden = tag => /\shidden(?:\s|=|>)/i.test(tag) || attribute(tag, "aria-hidden").toLowerCase() === "true" || /(?:^|\s)(?:hide|hidden|d-none)(?:\s|$)/i.test(attribute(tag, "class")) || /(?:display\s*:\s*none|visibility\s*:\s*hidden)/i.test(attribute(tag, "style"));
const clean = value => String(value ?? "").replace(/<[^>]*>/g, " ").replace(/&nbsp;|&#160;/gi, " ").replace(/&#(x[0-9a-f]+|\d+);/gi, (_, number) => { const point = number[0].toLowerCase() === "x" ? parseInt(number.slice(1), 16) : Number(number); return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : " "; }).replace(/&amp;/gi, "&").replace(/\s+/g, " ").trim();

function contentTables(html) {
  const body = String(html).replace(/<!--[\s\S]*?-->/g, "").replace(/<(script|style|head|nav|header|footer)\b[^>]*>[\s\S]*?<\/\1>/gi, "");
  const stack = [], tables = [];
  for (const token of body.matchAll(/<\/?(?:div|article|section|main)\b[^>]*>|<table\b[^>]*>[\s\S]*?<\/table>/gi)) {
    const tag = token[0], parent = stack.at(-1);
    if (/^<\//.test(tag)) { stack.pop(); continue; }
    if (/^<table/i.test(tag)) {
      if (parent?.article && parent.content && !parent.hidden && !hidden(tag.slice(0, tag.indexOf(">") + 1))) tables.push(tag);
      continue;
    }
    const article = /^<article\b/i.test(tag) ? attribute(tag, "id") === "ctt" && /(?:^|\s)ctt_time(?:\s|$)/.test(attribute(tag, "class")) : Boolean(parent?.article);
    stack.push({ article, content: article && (Boolean(parent?.content) || attribute(tag, "id") === "ctt_con"), hidden: Boolean(parent?.hidden) || hidden(tag) });
  }
  return tables;
}

export function extractHakikSchedules({ church, sourceUrl, html, collectedAt = new Date().toISOString(), sourceLastModified = null }) {
  let url; try { url = new URL(sourceUrl); } catch { return null; }
  if (url.hostname.replace(/^www\./, "") !== "hakik.net") return null;
  if (url.origin !== "https://www.hakik.net" || url.username || url.password || url.port || url.pathname !== "/bbs/content.php" || url.search !== "?co_id=time" || url.hash) return [];
  if (Number(church.church_id) !== 624 || church.church_name !== "학익교회" || church.region?.replace(/\s/g, "") !== "인천남" || church.denomination?.replace(/\s/g, "") !== "대한예수교장로회합동") return [];
  const records = [], dayMap = { 주일: "SUN", 일요일: "SUN", 월요일: "MON", 화요일: "TUE", 수요일: "WED", 목요일: "THU", 금요일: "FRI", 토요일: "SAT" };
  for (const table of contentTables(html)) {
    // This source has three physical cells (name spans two columns). A changed
    // merge or hidden subtree requires review instead of inherited cell values.
    if ([...table.matchAll(/<[a-z][^>]*>/gi)].some(match => hidden(match[0]))) continue;
    let section = "";
    for (const row of table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
      const cells = [...row[1].matchAll(/<t[hd]\b([^>]*)>([\s\S]*?)<\/t[hd]>/gi)];
      if (cells.length !== 3 || cells.some((cell, index) => Number(attribute(`<td ${cell[1]}>`, "rowspan") || 1) !== 1 || Number(attribute(`<td ${cell[1]}>`, "colspan") || 1) !== (index === 0 ? 2 : 1))) { section = ""; continue; }
      const [name, timeText, venue] = cells.map(cell => clean(cell[2]));
      if (timeText.replace(/\s/g, "") === "시간" && venue.replace(/\s/g, "") === "장소") {
        section = ["예배명", "주일학교", "모임"].includes(name.replace(/\s/g, "")) ? name : "";
        continue;
      }
      if (!section || !name || !venue) continue;
      for (const line of cells[1][2].split(/<br\b[^>]*>/i).map(clean).filter(Boolean)) {
        const time = line.match(/^(?:(\d+)부\s+)?(?:매주\s+)?(?:(주일|[월화수목금토일]요일|월\s*[~～–-]\s*금요일)\s+)?(오전|오후)\s*(\d{1,2}):([0-5]\d)$/);
        if (!time || Number(time[4]) < 1 || Number(time[4]) > 12) continue;
        // A Sunday service name is explicit; 삼일저녁 alone does not establish
        // a weekday. Never carry the preceding row's Sunday into this row.
        const days = time[2] ? (/^월\s*[~～–-]\s*금요일$/.test(time[2]) ? ["MON", "TUE", "WED", "THU", "FRI"] : [dayMap[time[2]]]) : /^주일/.test(name) ? ["SUN"] : [];
        if (!days.length || days.some(day => !day)) continue;
        const startTime = `${String(Number(time[4]) % 12 + (time[3] === "오후" ? 12 : 0)).padStart(2, "0")}:${time[5]}`;
        const serviceType = time[1] ? `${name} ${time[1]}부` : name;
        const record = { record_id: "", church_id: church.church_id, church_name: church.church_name, service_type: serviceType, day_of_week: days, start_time: startTime, venue_audience: venue, source_text: `ctt_time/ctt_con | ${section} | ${name} | ${line} | ${venue}`.slice(0, 500), source_url: sourceUrl, collected_at: collectedAt, source_last_modified: sourceLastModified, confidence: "medium", review_status: "hold", flags: ["manual_review_required"] };
        record.record_id = createHash("sha256").update([record.church_id, serviceType, days.join(","), startTime, venue].join("|")).digest("hex").slice(0, 24);
        records.push(record);
      }
    }
  }
  return [...new Map(records.map(record => [record.record_id, record])).values()];
}
