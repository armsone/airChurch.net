export type EventParticipation = {
  audienceText?: string;
  cost?: string;
  registrationInstructions?: string;
  preparation?: string;
  registrationDeadline?: string;
  registrationClosesOn?: string;
};

function text(html: string) {
  return html.replace(/<[^>]*>/g, " ")
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (_, value: string) => {
      const point = value[0].toLowerCase() === "x" ? parseInt(value.slice(1), 16) : Number(value);
      return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : " ";
    })
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ").trim();
}

function section(html: string, title: string) {
  const headings = [...html.matchAll(/<h3\b[^>]*>([\s\S]*?)<\/h3>/gi)];
  const matches = headings.filter(heading => text(heading[1]) === title);
  if (matches.length !== 1) return "";
  const heading = matches[0], index = headings.indexOf(heading);
  return html.slice(heading.index! + heading[0].length, headings[index + 1]?.index ?? html.length);
}

function single(values: string[]) {
  const unique = [...new Set(values.filter(Boolean))];
  return unique.length === 1 && unique[0].length <= 2000 ? unique[0] : undefined;
}

function verifiedFamilySource(sourceId: string, sourceUrl: string) {
  try {
    const url = new URL(sourceUrl);
    if (url.username || url.password || url.port || url.hash) return null;
    if (sourceId === "duranno-college" && url.origin === "https://biblecollege.duranno.com" && url.pathname === "/biblecollege/view/seminar_detail.asp" && [...url.searchParams.keys()].every(key => key === "smrnum") && url.searchParams.getAll("smrnum").length === 1 && url.searchParams.get("smrnum") === "4197") return "duranno-college";
    if (sourceId === "jiguchon" && url.origin === "https://www.jiguchon.or.kr" && url.pathname === "/bbs/board.php" && [...url.searchParams.keys()].every(key => key === "bo_table" || key === "wr_id") && url.searchParams.getAll("bo_table").length === 1 && url.searchParams.get("bo_table") === "G02" && url.searchParams.getAll("wr_id").length === 1 && url.searchParams.get("wr_id") === "1170") return "jiguchon";
  } catch { /* Unknown or changed source boundaries remain unclassified. */ }
  return null;
}

export function verifiedParticipationAudience(sourceId: string, sourceUrl: string, participation: EventParticipation | null): "가정" | null {
  if (!verifiedFamilySource(sourceId, sourceUrl)) return null;
  const audience = participation?.audienceText?.trim();
  return audience && /부부|커플/.test(audience) && !/제외|불가|아닌|아니라/.test(audience) ? "가정" : null;
}

// Only the explicitly labelled sections of this source have been inspected.
// Missing or ambiguous sections stay absent instead of inheriting old details.
export function extractParticipation(html: string, sourceId: string, sourceUrl?: string): EventParticipation | null {
  if (sourceId === "duranno-college") {
    try {
      const url = new URL(sourceUrl || "");
      if (url.origin !== "https://biblecollege.duranno.com" || url.username || url.password || url.port || url.pathname !== "/biblecollege/view/seminar_detail.asp" || url.hash || [...url.searchParams.keys()].some(key => key !== "smrnum") || url.searchParams.getAll("smrnum").length !== 1 || url.searchParams.get("smrnum") !== "4197") return null;
    } catch { return null; }
    const body = html.replace(/<!--[\s\S]*?-->/g, "").replace(/<(head|script|style|nav|header|footer)\b[^>]*>[\s\S]*?<\/\1>/gi, "");
    const result: EventParticipation = {};
    const audience = single([...body.matchAll(/<span\b[^>]*class=["']people-info["'][^>]*>([\s\S]*?)<\/span>/gi)].map(match => text(match[1])));
    if (audience) result.audienceText = audience;
    const guidance = section(body, "수강안내");
    // This notice uses literal <<<...>>> around its payment terms. Protect
    // those characters only here before the shared tag-to-text conversion.
    const instructions = text(guidance.replace(/<<<([\s\S]*?)>>>/g, (_, value: string) => `&lt;&lt;&lt;${value}&gt;&gt;&gt;`));
    const price = single([...body.matchAll(/<p\b[^>]*class=["']price["'][^>]*>([\s\S]*?)<\/p>/gi)].map(match => text(match[1])).filter(value => /^₩[\d,]+$/.test(value)));
    const couple = single([...instructions.matchAll(/커플\s+([\d,]+)\s*만원/g)].map(match => match[1]));
    if (price && couple) {
      const amount = Number(price.slice(1).replace(/,/g, "")), coupleAmount = Number(couple.replace(/,/g, "")) * 10000;
      if (Number.isSafeInteger(amount) && amount > 0 && amount === coupleAmount) result.cost = `커플 ${amount.toLocaleString("ko-KR")}원`;
    }
    const registration = single([...instructions.matchAll(/(?:^|\s)02\.\s*홈페이지\s*등록[_\s]*([\s\S]*?)(?=\s04\.)/g)].map(match => match[1].replace(/<<<|>>>/g, "").trim()));
    if (registration) result.registrationInstructions = registration;
    const deadline = single([...body.matchAll(/<p\b[^>]*class=["']wait-table["'][^>]*>([\s\S]*?)<\/p>/gi)].map(match => text(match[1]).replace(/^사전신청\s*[:：]\s*/, "")).filter(value => /선착순\s*마감/.test(value)));
    if (deadline) result.registrationDeadline = deadline;
    return Object.keys(result).length ? result : null;
  }
  if (sourceId === "jiguchon") {
    try {
      const url = new URL(sourceUrl || "");
      if (url.origin !== "https://www.jiguchon.or.kr" || url.username || url.password || url.pathname !== "/bbs/board.php" || url.searchParams.getAll("bo_table").length !== 1 || url.searchParams.get("bo_table") !== "G02" || url.searchParams.getAll("wr_id").length !== 1 || !["1167", "1170", "1171"].includes(url.searchParams.get("wr_id") || "")) return null;
    } catch { return null; }
    const result: EventParticipation = {};
    // These three notices were checked against their official G02 posts.
    // Other notices have conflicting periods and must not inherit this rule.
    const notice = html.match(/<div\b[^>]*class=["']notice_information["'][^>]*>([\s\S]*?)<section\b[^>]*id=["']bo_v_atc["']/i)?.[1] || "";
    const periods = [...notice.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map(match => text(match[1])).filter(value => /^신청기간\s/.test(value));
    if (periods.length === 1) {
      const period = periods[0].replace(/^신청기간\s*/, ""), dates = period.match(/^(\d{4})\.\s*(\d{2})\.\s*(\d{2})\s*-\s*(\d{4})\.\s*(\d{2})\.\s*(\d{2})$/);
      if (dates) {
        const from = `${dates[1]}-${dates[2]}-${dates[3]}`, to = `${dates[4]}-${dates[5]}-${dates[6]}`;
        const valid = (value: string) => { const date = new Date(`${value}T00:00:00Z`); return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value; };
        if (valid(from) && valid(to) && from <= to) { result.registrationDeadline = period; result.registrationClosesOn = to; }
      }
    }
    const content = html.match(/<div\b[^>]*id=["']bo_v_con["'][^>]*>([\s\S]*?)<!--\s*}\s*본문 내용 끝\s*-->/i)?.[1] || "";
    const rows = content.replace(/<br\b[^>]*>|<\/(?:p|div)>/gi, "\n").split("\n").map(text).filter(Boolean);
    const cost = single(rows.filter(value => /^등\s*록\s*비\s*[:：]\s*\S/.test(value)).map(value => value.replace(/^등\s*록\s*비\s*[:：]\s*/, "")));
    if (cost) result.cost = cost;
    const audience = single(rows.filter(value => /^등록조건\s*[:：]\s*\S/.test(value)).map(value => value.replace(/^등록조건\s*[:：]\s*/, "")));
    if (audience) result.audienceText = audience;
    else if (!rows.some(value => /^등록조건\s*[:：]/.test(value)) && verifiedFamilySource(sourceId, sourceUrl || "") === "jiguchon") {
      const invitation = single(rows.filter(value => /^성서적 비전으로\s+가정을\s+세우기\s+원하는\s+.*부부.*관심과\s+참여/.test(value)));
      if (invitation) result.audienceText = invitation;
    }
    return Object.keys(result).length ? result : null;
  }
  if (sourceId !== "sorrygom") return null;
  const body = html.replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(head|script|style|nav|header|footer)\b[^>]*>[\s\S]*?<\/\1>/gi, "");
  const target = section(body, "대상"), schedule = section(body, "장소 및 일시"), preparation = section(body, "신청 및 준비");
  const result: EventParticipation = {};
  const audiences = [...target.matchAll(/<h4\b[^>]*>([\s\S]*?)<\/h4>/gi)].map(match => text(match[1])).filter(Boolean);
  if (audiences.length && audiences.length <= 20 && audiences.every(value => value.length <= 100)) result.audienceText = [...new Set(audiences)].join(" · ");

  const costs = [...schedule.matchAll(/<span\b[^>]*>([\s\S]*?)<\/span>/gi)]
    .map(match => text(match[1])).filter(value => /^참가비\s*[:：]\s*\S/.test(value))
    .map(value => value.replace(/^참가비\s*[:：]\s*/, ""));
  const cost = single(costs);
  if (cost) result.cost = cost;

  const list = preparation.match(/<ul\b[^>]*>([\s\S]*?)<\/ul>/i)?.[1] ?? "";
  const items = [...list.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)].map(match => text(match[1]));
  const instructions = single(items.filter(value => /^신청\s*[:：]\s*\S/.test(value)).map(value => value.replace(/^신청\s*[:：]\s*/, "")));
  if (instructions) result.registrationInstructions = instructions;
  const deadlinePattern = /^(?:신청\s*마감|접수\s*마감|신청\s*기한)\s*[:：]\s*/;
  const deadline = single(items.filter(value => deadlinePattern.test(value)).map(value => value.replace(deadlinePattern, "")));
  if (deadline) result.registrationDeadline = deadline;
  const starts = items.map((value, index) => /^준비\s*[:：]\s*\S/.test(value) ? index : -1).filter(index => index >= 0);
  if (starts.length === 1) {
    const notes = items.slice(starts[0]).filter(value => !/^신청\s*[:：]/.test(value) && !deadlinePattern.test(value));
    const value = notes.join("\n").replace(/^준비\s*[:：]\s*/, "");
    if (value && value.length <= 2000) result.preparation = value;
  }
  return Object.keys(result).length ? result : null;
}
