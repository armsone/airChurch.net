import type { ReactNode } from "react";
import HomeReloadLink from "./home-reload-link";
import SkipLink from "./skip-link";

const infoLinks = [
  ["운영 안내", "/about"],
  ["공동체 안전", "/community-guidelines"],
  ["개인정보처리방침", "/privacy"],
  ["저작권 원칙", "/copyright"],
  ["이용약관", "/terms"],
  ["문의", "/contact"],
] as const;

export default function InfoShell({ kicker, title, intro, children }: { kicker: string; title: string; intro: string; children: ReactNode }) {
  return <main className="info-shell"><SkipLink/>
    <header className="info-header">
      <HomeReloadLink className="brand"><span className="brand-mark" aria-hidden="true"/><span>airchurch</span></HomeReloadLink>
      <nav aria-label="안내 메뉴">{infoLinks.map(([label,href])=><a href={href} key={href}>{label}</a>)}</nav>
      <a className="info-home" href="/">사이트로 돌아가기</a>
    </header>
    <section className="info-hero" id="primary-content" tabIndex={-1}><span>{kicker}</span><h1>{title}</h1><p>{intro}</p></section>
    <div className="info-layout">
      <aside aria-label="안내 문서">{infoLinks.map(([label,href])=><a href={href} key={href}>{label}</a>)}</aside>
      <article className="info-content">{children}</article>
    </div>
    <footer className="info-footer"><a href="/">airChurch 홈</a><span>공개 자료를 모으고 정리해 사람과 교회를 잇습니다.</span></footer>
  </main>;
}
