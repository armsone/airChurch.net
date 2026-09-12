import { createHash } from "node:crypto";

const tags = /<\/?[a-z][a-z0-9]*\b(?:"[^"]*"|'[^']*'|[^'">])*>/gi;
const attribute = (tag, name) => tag.match(new RegExp(`\\s${name}\\s*=\\s*["']([^"']*)["']`, "i"))?.[1] ?? "";
const hasClass = (tag, name) => attribute(tag, "class").split(/\s+/).includes(name);
const hidden = tag => /\shidden(?:\s|=|>)/i.test(tag) || attribute(tag, "aria-hidden").toLowerCase() === "true" || /(?:^|\s)(?:hidden|hide|d-none)(?:\s|$)/i.test(attribute(tag, "class")) || /display\s*:\s*none|visibility\s*:\s*hidden/i.test(attribute(tag, "style"));
const clean = html => html.replace(tags, " ").replace(/&nbsp;|&#160;/gi, " ").replace(/&amp;/gi, "&").replace(/&#(x[0-9a-f]+|\d+);/gi, (_, value) => { const point = value[0].toLowerCase() === "x" ? parseInt(value.slice(1), 16) : Number(value); return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : " "; }).replace(/\s+/g, " ").trim();

function officialTables(html) {
  // Tooltip attributes contain literal <br> strings. Consume quoted attributes
  // intact and discard entire anchors so descriptions/videos cannot become names.
  const body = String(html).replace(/<!--[\s\S]*?-->/g, "").replace(/<(head|script|style|nav|header|footer|video)\b[^>]*>[\s\S]*?<\/\1>/gi, "").replace(/<a\b(?:"[^"]*"|'[^']*'|[^'">])*?>[\s\S]*?<\/a>/gi, "");
  const stack = [], tables = [];
  for (const match of body.matchAll(tags)) {
    const tag = match[0], name = tag.match(/^<\/?([a-z0-9]+)/i)?.[1].toLowerCase();
    if (!["div", "section", "main", "article"].includes(name)) continue;
    if (/^<\//.test(tag)) {
      const frame = stack.pop();
      if (!frame || frame.name !== name) return [];
      if (frame.kind && frame.table && !frame.hidden) {
        const content = body.slice(frame.start, match.index);
        if ([...content.matchAll(tags)].some(token => hidden(token[0]))) continue;
        if (frame.kind === "head") frame.table.heads.push(content);
        else frame.table.rows.push(content);
      }
      continue;
    }
    const parent = stack.at(-1), inSection = name === "section" ? hasClass(tag, "time-table-wrap") : Boolean(parent?.inSection);
    const isHidden = Boolean(parent?.hidden) || hidden(tag);
    let table = parent?.table;
    if (name === "section") table = undefined;
    if (inSection && hasClass(tag, "tbl")) { table = { heads: [], rows: [] }; if (!isHidden) tables.push(table); }
    stack.push({ name, inSection, hidden: isHidden, table, kind: inSection && table ? (hasClass(tag, "head") ? "head" : hasClass(tag, "tr") ? "row" : null) : null, start: match.index + tag.length });
  }
  return tables;
}

function columns(html) {
  const cells = new Map();
  for (const match of html.matchAll(/<span\b([^>]*)>([\s\S]*?)<\/span>/gi)) {
    const key = attribute(`<span ${match[1]}>`, "class");
    if (!/^cl0[1-4]$/.test(key)) continue;
    if (cells.has(key)) return null;
    cells.set(key, clean(match[2]));
  }
  return cells;
}

export function extractOnnuriSchedules({ church, sourceUrl, html, collectedAt = new Date().toISOString(), sourceLastModified = null }) {
  let url; try { url = new URL(sourceUrl); } catch { return null; }
  if (url.hostname.replace(/^www\./, "") !== "onnuri.org") return null;
  if (sourceUrl !== "https://www.onnuri.org/about-onnuri/service-times/seobinggo-campus/" || Number(church.church_id) !== 1 || church.church_name !== "온누리교회" || church.region?.replace(/\s/g, "") !== "서울용산" || church.denomination?.replace(/\s/g, "") !== "대한예수교장로회통합") return [];
  const records = [], dayMap = { 일: "SUN", 월: "MON", 화: "TUE", 수: "WED", 목: "THU", 금: "FRI", 토: "SAT" };
  for (const table of officialTables(html)) {
    if (table.heads.length !== 1) continue;
    const head = columns(table.heads[0]);
    if (head?.get("cl01") !== "예배") continue;
    const basic = head.get("cl02") === "시간" && head.get("cl03") === "장소";
    const audience = head.get("cl02") === "대상" && head.get("cl03") === "시간" && head.get("cl04") === "장소";
    if (!basic && !audience) continue;
    for (const row of table.rows) {
      const cells = columns(row), name = cells?.get("cl01"), timeText = cells?.get(basic ? "cl02" : "cl03"), venue = cells?.get(basic ? "cl03" : "cl04");
      if (!name || !timeText || !venue) continue;
      const time = timeText.match(/^(주일(?:\s+주일)?|[월화수목금토일](?:요일)?|월\s*[~～–-]\s*금)\s+([01]?\d|2[0-3]):([0-5]\d)$/);
      if (!time) continue;
      const days = /^월\s*[~～–-]\s*금$/.test(time[1]) ? ["MON", "TUE", "WED", "THU", "FRI"] : [time[1].startsWith("주일") ? "SUN" : dayMap[time[1][0]]];
      const startTime = `${time[2].padStart(2, "0")}:${time[3]}`;
      const record = { record_id: "", church_id: church.church_id, church_name: church.church_name, service_type: name, day_of_week: days, start_time: startTime, venue_audience: venue, source_text: `서빙고 예배 안내 | ${[...cells.values()].join(" | ")}`.slice(0, 500), source_url: sourceUrl, collected_at: collectedAt, source_last_modified: sourceLastModified, confidence: "medium", review_status: "hold", flags: ["manual_review_required"] };
      record.record_id = createHash("sha256").update([record.church_id, name, days.join(","), startTime, venue].join("|")).digest("hex").slice(0, 24);
      records.push(record);
    }
  }
  return [...new Map(records.map(record => [record.record_id, record])).values()];
}
