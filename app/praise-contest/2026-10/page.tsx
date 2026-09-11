import type { Metadata } from "next";
import SiteFooter from "../../site-footer";
import ContestBoard from "../contest-board";
import "../contest.css";
export const metadata:Metadata={title:"2026년 10월 찬양대회 | 에이처치",description:"에이처치 2026년 10월 찬양대회 참가작과 공식 결과를 만나는 공간입니다.",alternates:{canonical:"/praise-contest/2026-10"}};
// Permanent October edition. Retain its board and praise-2026-10 data when introducing another edition.
export default function OctoberContestPage(){return <main className="contest-shell"><a className="contest-back" href="/our-events">← 에이처치 행사 모아보기</a><ContestBoard/><SiteFooter/></main>;}
