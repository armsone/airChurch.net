import HomeReloadLink from "./home-reload-link";
import FooterVisitorCounts from "./footer-visitor-counts";
import { siteIdentities, type SiteIdentity } from "./site-identity";

const footerLinks = [
  ["관리자", "/admin"], ["목회자", "/pastor"], ["제작기록", "/making"], ["운영안내", "/about"],
  ["개인정보처리방침", "/privacy"], ["이용약관", "/terms"], ["문의", "/contact"],
] as const;

export default function SiteFooter({ identity }: { identity: SiteIdentity }) {
  return <footer id="page-bottom" className="site-footer">
    <div className="site-footer-main">
      <div className="site-footer-identity">
        <HomeReloadLink className="brand" ariaLabel={`${identity.name} 첫 화면`}><img className="brand-mark" src="/favicon.svg" width={30} height={30} alt="" aria-hidden="true" /><span>{identity.wordmark}</span></HomeReloadLink>
        <p>{identity.description}</p>
      </div>
      <div className="site-footer-groups">
        <nav aria-label="사이트 안내">
          <ul>{footerLinks.map(([label, href]) => <li key={href}><a href={href}>{label}</a></li>)}</ul>
        </nav>
      </div>
    </div>
    <div className="site-footer-bottom">
      <p className="site-domain-links">{Object.values(siteIdentities).map((site, index) => <span key={site.domain}>{index > 0 && <span aria-hidden="true"> · </span>}<a href={`https://${site.domain}/`} aria-label={`${site.name} (${site.domain})`} aria-current={site.domain === identity.domain ? "true" : undefined}>{site.wordmark}</a></span>)}</p>
      <a className="site-footer-pastor" href="/pastors/2">협동목사 김민석 <span aria-hidden="true">↗</span></a>
      <FooterVisitorCounts />
    </div>
  </footer>;
}
