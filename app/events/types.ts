export type ChurchEvent = {
  id: string; title: string; startDate: string; endDate: string; startTime: string | null;
  venue: string; region: string; attendance: string; organizer: string; audience: string;
  category: string; sourceUrl: string; registrationUrl: string | null; checkedAt: string;
  status: string; churchPublicId: number | null; sourceName: string;
};
export type EventSource = {
  id: string; name: string; homepage: string; url: string; kind: string;
  lastCheckedAt: string | null; lastSuccessAt: string | null; status: string;
  candidateCount: number; eventCount: number;
};
export type EventsPayload = { items: ChurchEvent[]; sources: EventSource[]; nextCursor: string | null };
export const eventRegions = ["서울", "경기", "인천", "강원", "충북", "충남", "대전", "세종", "전북", "전남", "광주", "경북", "경남", "대구", "울산", "부산", "제주"];
export const eventCategories = ["집회", "세미나·교육", "찬양·공연", "봉사·선교", "수련회", "기타 행사"];
export const eventAudiences = ["어린이", "청소년", "청년", "가정", "목회자", "대상 확인 필요"];
export function koreaDate(now = new Date()) { return new Date(now.getTime() + 9 * 3600000).toISOString().slice(0, 10); }
export function dateLabel(date: string) { return new Date(`${date}T00:00:00+09:00`).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric", weekday: "short" }); }
