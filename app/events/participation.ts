export type EventParticipation = {
  audienceText?: string;
  cost?: string;
  registrationInstructions?: string;
  preparation?: string;
  registrationDeadline?: string;
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

// Only the explicitly labelled sections of this source have been inspected.
// Missing or ambiguous sections stay absent instead of inheriting old details.
export function extractParticipation(html: string, sourceId: string): EventParticipation | null {
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
