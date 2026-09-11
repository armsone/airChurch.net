import type { Metadata } from "next";
import SiteFooter from "../site-footer";
import EventsBrowser from "./events-browser";
export const metadata: Metadata = { title: "교계행사 | airChurch", description: "공식 출처에서 모은 집회, 세미나, 찬양, 봉사 일정을 날짜와 지역으로 찾아보세요.", alternates: { canonical: "/events" } };
export const dynamic = "force-static";
export default function EventsPage() {
  return <main className="church-detail-shell events-shell"><section id="primary-content" className="events-page" tabIndex={-1}><div className="section-heading"><div><span className="section-kicker">함께하는 신앙</span><h1>교계행사</h1><p>집회부터 공연·배움까지, 날짜순으로 만나보세요.</p></div></div><p><a href="/our-events">에어처치 이벤트와 지난 기록 보기 →</a></p><EventsBrowser/></section><SiteFooter/></main>;
}
