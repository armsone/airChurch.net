// Automatic collection/import only. These labels require review, not a global
// public-name blacklist or deletion of an existing person with the same name.
const NAVIGATION_LABELS = new Set(["신청하기", "안내", "연혁", "지구촌"]);
export function needsPersonEvidence(name) {
  return NAVIGATION_LABELS.has(String(name ?? "").normalize("NFKC").replace(/\s+/g, ""));
}

export function mismatchedChurchSource(church, sourceUrl) {
  let host;
  try { host = new URL(sourceUrl).hostname.replace(/^www\./, ""); } catch { return false; }
  // Confirmed cross-church source contamination, not an inference from a name.
  return host === "jiguchon.or.kr" && (
    church.directoryChurchId === "church-8600beba3a2b822132a9"
    || Number(church.existingChurchId) === 564
    || (church.churchName === "지구촌교회" && church.region === "경남 창원" && church.denomination === "대한예수교장로회 통합")
  );
}

export function clergyContentHtml(html) {
  return html
    .replace(/<(head|nav|header|footer)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "\u0000")
    .replace(/<a\b[^>]*>[\s\S]*?<\/a\s*>/gi, (anchor) => {
      const label = anchor.replace(/<[^>]+>/g, "").replace(/\s+/g, "");
      return /^(?:신청하기|안내|연혁|교회소개|원로목사|담임목사|오시는길|로그인|회원가입)$/.test(label) ? "\u0000" : anchor;
    })
    // A roster card may put its name and role in separate divs or paragraphs.
    // Separate records/menu entries, but preserve those within-card layouts.
    .replace(/<\/(?:li|tr|section|article)\s*>/gi, "$&\u0000");
}
