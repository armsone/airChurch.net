import type { Metadata } from "next";
import SiteFooter from "../site-footer";
import { CONTEST,contestPhase } from "../praise-contest/config";
import "../praise-contest/contest.css";
export const dynamic="force-dynamic";
export const metadata:Metadata={title:"에이처치 행사 | 함께한 무대와 기록",description:"에이처치가 마련한 행사와 지난 무대의 참가작·결과를 다시 만나보세요.",alternates:{canonical:"/our-events"}};
export default function OurEvents(){const phase=contestPhase();const upcoming=phase==="upcoming",past=phase==="finished";return <main className="contest-shell"><section id="primary-content" className="contest-header"><div><p className="contest-kicker">에이처치가 함께 만드는 자리</p><h1>함께한 무대,<br/>이어지는 이야기.</h1><p className="contest-intro">다가오는 행사를 만나고, 지난 무대의 찬양과 기록을 다시 찾아보세요.</p></div></section><section className="our-event-list"><h2>{upcoming?"다가오는 행사":past?"지난 행사":"진행 중인 행사"}</h2><a className="our-event-card" href="/praise-contest/2026-10"><span className="our-event-date">2026.10</span><div><small>{upcoming?"참가 준비":past?"행사 기록":"진행 중"}</small><h3>에이처치 찬양대회</h3><p>접수 10월 1~15일 · 응원 18일까지 · 결과 19일</p><p>총상금 {CONTEST.prizes.reduce((a,b)=>a+b,0)/10000}만 원 · 후원 (주)한통</p><strong>{past?"참가작과 진행 결과 보기":"대회 안내와 참가작 보기"} ↗</strong></div></a>{!past&&<p className="contest-order-note">행사가 끝난 뒤에도 같은 날짜의 페이지에서 참가작과 진행 결과를 다시 볼 수 있습니다.</p>}</section><SiteFooter/></main>;}
