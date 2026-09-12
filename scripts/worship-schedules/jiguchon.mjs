import { createHash } from "node:crypto";

const clean = value => String(value || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/gi, " ").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&amp;/gi, "&").replace(/\s+/g, " ").trim();

// Return null for other sources. Never send this multi-chapel site through the
// flat-line parser, including a namesake church using the wrong homepage.
export function extractJiguchonSchedules({church, sourceUrl, html, collectedAt, sourceLastModified}) {
  let url;
  try { url = new URL(sourceUrl); } catch { return null; }
  if (url.hostname.replace(/^www\./, "") !== "jiguchon.or.kr") return null;
  if (!/^https?:$/.test(url.protocol) || url.username || url.password || url.port) return [];
  if (Number(church.church_id) !== 95 || church.church_name !== "지구촌교회" || church.region?.replace(/\s/g, "") !== "경기성남" || church.denomination?.replace(/\s/g, "") !== "기독교한국침례회") return [];
  if (url.searchParams.getAll("gr").length !== 1 || url.searchParams.getAll("page").length !== 1 || url.pathname !== "/contents.php" || url.searchParams.get("gr") !== "2" || url.searchParams.get("page") !== "9") return [];
  const body = String(html).replace(/<!--[\s\S]*?-->/g, "").replace(/<(script|style|nav|header|footer)\b[^>]*>[\s\S]*?<\/\1>/gi, "");
  let chapel = "", section = "";
  const records = [];
  for (const token of body.matchAll(/<h([56])\b[^>]*>([\s\S]*?)<\/h\1>|<table\b[^>]*>[\s\S]*?<\/table>/gi)) {
    if (token[1] === "5") { chapel = clean(token[2]).replace(/\s/g, ""); section = ""; continue; }
    if (token[1] === "6") { section = clean(token[2]); continue; }
    if (!["수지채플", "분당채플", "경기대채플", "선교센터", "필그림하우스", "구리지구촌채플"].includes(chapel)) continue;
    const table = token[0], caption = clean(table.match(/<caption[^>]*>([\s\S]*?)<\/caption>/i)?.[1]);
    const headings = [...(table.match(/<thead[^>]*>([\s\S]*?)<\/thead>/i)?.[1] || "").matchAll(/<th\b([^>]*)>([\s\S]*?)<\/th>/gi)].flatMap(m => Array(Number(m[1].match(/colspan=["'](\d+)["']/i)?.[1] || 1)).fill(clean(m[2])));
    const timeColumn = headings.indexOf("시간"), venueColumn = headings.indexOf("장소");
    if (timeColumn < 1 || venueColumn < 0 || headings[0] !== "예배명") continue;
    const spans = [];
    for (const row of (table.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i)?.[1] || "").matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
      const cells = []; let column = 0;
      for (let i = 0; i < spans.length; i++) if (spans[i]?.left > 0) { cells[i] = spans[i].value; spans[i].left--; }
      for (const cell of row[1].matchAll(/<td\b([^>]*)>([\s\S]*?)<\/td>/gi)) {
        while (cells[column] !== undefined) column++;
        const value = clean(cell[2]), count = Number(cell[1].match(/colspan=["'](\d+)["']/i)?.[1] || 1), rows = Number(cell[1].match(/rowspan=["'](\d+)["']/i)?.[1] || 1);
        for (let i = 0; i < count; i++) { cells[column] = value; spans[column] = {value, left: rows - 1}; column++; }
      }
      if (cells.length !== headings.length || !cells[0] || !cells[venueColumn]) continue;
      const clock = cells[timeColumn], explicitDay = clock.match(/(?:매주\s*)?\((주일|[월화수목금토일])\)/)?.[1];
      const days = /\(월\)\s*[~～-]\s*\(금\)/.test(clock) ? ["MON","TUE","WED","THU","FRI"] : explicitDay ? [{주일:"SUN",일:"SUN",월:"MON",화:"TUE",수:"WED",목:"THU",금:"FRI",토:"SAT"}[explicitDay]] : /주일예배/.test(section) ? ["SUN"] : /수요예배/.test(section) ? ["WED"] : /금요예배/.test(section) ? ["FRI"] : [];
      const label = /^\d+부$/.test(cells[0]) ? `주일예배 ${cells[0]}` : /미취학|어린이|청소년/.test(caption) ? `${caption.replace(/.*채플\s*/, "").replace(/\s*예배 시간 안내$/, "")} ${cells[0]} 예배` : cells[0];
      for (const time of clock.matchAll(/\b([01]\d|2[0-3]):([0-5]\d)\b/g)) {
        const record = {record_id:"",church_id:church.church_id,church_name:church.church_name,service_type:label,day_of_week:days,start_time:`${time[1]}:${time[2]}`,venue_audience:`${chapel} · ${cells[venueColumn]}`,source_text:`${chapel} | ${section} | ${caption} | ${cells.join(" | ")}`.slice(0,500),source_url:sourceUrl,collected_at:collectedAt,source_last_modified:sourceLastModified,confidence:days.length?"medium":"low",review_status:"hold",flags:["manual_review_required",...(!days.length?["ambiguous_day"]:[])]};
        record.record_id = createHash("sha256").update([record.church_id,label,days.join(","),record.start_time,record.venue_audience].join("|")).digest("hex").slice(0,24);
        records.push(record);
      }
    }
  }
  return [...new Map(records.map(record => [record.record_id,record])).values()];
}
