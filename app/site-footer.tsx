import HomeReloadLink from "./home-reload-link";
import FooterVisitorCounts from "./footer-visitor-counts";

const footerLinks = [
  ["제작기록", "/making"], ["운영 안내", "/about"],
  ["개인정보처리방침", "/privacy"], ["이용약관", "/terms"], ["문의", "/contact"],
] as const;

export default function SiteFooter() {
  return <footer id="page-bottom" className="site-footer">
    <div className="site-footer-main">
      <div className="site-footer-identity">
        <HomeReloadLink className="brand" ariaLabel="에어처치 첫 화면"><span className="brand-mark" aria-hidden="true" /><span>airchurch</span></HomeReloadLink>
        <p>사람과 교회를 잇는 크리스천 포털</p>
      </div>
      <div className="site-footer-groups">
        <nav aria-label="사이트 안내">
          <ul>{footerLinks.map(([label, href]) => <li key={href}><a href={href}>{label}</a></li>)}</ul>
        </nav>
      </div>
    </div>
    <div className="site-footer-bottom">
      <p>airchurch.net · goodshare.net · linechurch.net</p>
      <a className="site-footer-pastor" href="/pastors/2">협동목사 김민석 <span aria-hidden="true">↗</span></a>
      <FooterVisitorCounts />
      <nav className="site-footer-tools" aria-label="운영자 메뉴"><a href="/pastor">목회자 업무</a><a href="/admin">관리자</a></nav>
    </div>
  </footer>;
}
