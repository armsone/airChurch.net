import HomeReloadLink from "./home-reload-link";
import FooterVisitorCounts from "./footer-visitor-counts";

const linkGroups = [
  { title: "에어처치 안내", links: [["운영 안내", "/about"], ["에어처치 만들기", "/making"], ["문의", "/contact"]] },
  { title: "참여와 운영", links: [["에어처치 이벤트", "/our-events"], ["목회자 업무", "/pastor"], ["관리자", "/admin"]] },
  { title: "이용 원칙", links: [["공동체 안전", "/community-guidelines"], ["개인정보처리방침", "/privacy"], ["이용약관", "/terms"], ["저작권 원칙", "/copyright"]] },
] as const;

export default function SiteFooter() {
  return <footer id="page-bottom" className="site-footer">
    <div className="site-footer-main">
      <div className="site-footer-identity">
        <HomeReloadLink className="brand" ariaLabel="에어처치 첫 화면"><span className="brand-mark" aria-hidden="true" /><span>airchurch</span></HomeReloadLink>
        <p>공개 자료를 정리해<br />사람과 교회를 잇는 크리스천 포털</p>
        <a className="site-footer-pastor" href="/pastors/2">협동목사 김민석 <span aria-hidden="true">↗</span></a>
      </div>
      <div className="site-footer-groups">
        {linkGroups.map(group => <nav key={group.title} aria-label={group.title}>
          <h2>{group.title}</h2>
          <ul>{group.links.map(([label, href]) => <li key={href}><a href={href}>{label}</a></li>)}</ul>
        </nav>)}
      </div>
    </div>
    <div className="site-footer-bottom">
      <p>airchurch.net · goodshare.net · linechurch.net</p>
      <FooterVisitorCounts />
    </div>
  </footer>;
}
