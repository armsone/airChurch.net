export const CONTEST = {
  id: "praise-2026-10",
  title: "에이처치 찬양대회",
  startsAt: "2026-09-30T15:00:00.000Z",
  submissionEndsAt: "2026-10-15T15:00:00.000Z",
  votingEndsAt: "2026-10-18T15:00:00.000Z",
  resultsAt: "2026-10-18T15:00:00.000Z",
  prizes: [500000, 300000, 100000, 50000, 50000],
  minimumEntries: 6,
  consentVersion: "2026-10-v2-links",
} as const;
export type ContestEntry = { id: number; performer: string; title: string; youtubeId: string; channelName: string; createdAt: string; likes: number; rank: number | null; prize: number; reuploadUrl?: string | null };
export function contestPhase(now = Date.now()) {
  if (now < Date.parse(CONTEST.startsAt)) return "upcoming";
  if (now < Date.parse(CONTEST.submissionEndsAt)) return "open";
  if (now < Date.parse(CONTEST.votingEndsAt)) return "voting";
  return "finished";
}
export function youtubeIdFromUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
    const host = url.hostname.toLowerCase();
    let id: string | null = null;
    if (host === "youtu.be") id = url.pathname.split("/")[1];
    if (["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com"].includes(host)) {
      id = url.pathname === "/watch" ? url.searchParams.get("v") : /^\/(shorts|embed|live)\//.test(url.pathname) ? url.pathname.split("/")[2] : null;
    }
    return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
  } catch { return null; }
}
