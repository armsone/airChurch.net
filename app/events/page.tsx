import type { Metadata } from "next";
import HomeReloadLink from "../home-reload-link";
import SiteFooter from "../site-footer";
import SkipLink from "../skip-link";
import EventsBrowser from "./events-browser";
export const metadata: Metadata = { title: "기독교 행사 일정 | airChurch", description: "공식 출처에서 모은 집회, 세미나, 찬양, 봉사 일정을 날짜와 지역으로 찾아보세요.", alternates: { canonical: "/events" } };
export const dynamic = "force-static";
export default function EventsPage() {
  return <main className="church-detail-shell"><SkipLink/><header className="church-detail-header"><HomeReloadLink className="brand"><span className="brand-mark" aria-hidden="true"/><span>airchurch</span></HomeReloadLink><a href="/#events">이번 주 행사 →</a></header><section id="primary-content" className="events-page" tabIndex={-1}><div className="section-heading"><div><span className="section-kicker">함께하는 신앙</span><h1>기독교 행사 일정</h1><p>참여 전 공식 안내에서 변경 사항과 신청 조건을 확인해 주세요.</p></div></div><EventsBrowser/></section><SiteFooter/></main>;
}
