import HomeReloadLink from "./home-reload-link";

export default function SiteFooter() {
  return <footer id="page-bottom">
    <HomeReloadLink className="brand footer-brand"><span className="brand-mark" aria-hidden="true" /><span>airchurch</span></HomeReloadLink>
    <p>airchurch.net · goodshare.net · linechurch.net<br />공개 자료를 정리해 사람과 교회를 잇는 크리스천 포털</p>
    <div className="footer-meta"><div className="footer-links"><a href="/our-events">에이처치 행사</a><a href="/about">운영 안내</a><a href="/tech">테크</a><a href="/history">히스토리</a><a href="/community-guidelines">공동체 안전</a><a href="/privacy">개인정보처리방침</a><a href="/copyright">저작권 원칙</a><a href="/terms">이용약관</a><a href="/contact">문의</a><a href="/admin">관리자</a><a href="/pastor">목회자</a></div><a className="footer-pastor-link" href="/pastors/2">협동목사 김민석 <span>(바로가기)</span></a></div>
  </footer>;
}
