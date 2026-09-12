import type { Metadata } from "next";
import ContestBoard from "../contest-board";
import "../contest.css";
const title = "2026 에어처치 찬양대회 | 총상금 100만 원";
const description = "곡의 종류·형식, 개인·밴드·팀 여부에 관계없이 창작곡·기성곡 모두 참여할 수 있습니다. 10월 1~15일 유튜브 영상 접수 · 여러분의 좋아요로 수상작이 결정됩니다.";
const poster = "https://airchurch.net/images/praise-contest-2026-open-format.png";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/praise-contest/2026-10-01" },
  openGraph: {
    title,
    description,
    url: "https://airchurch.net/praise-contest/2026-10-01",
    siteName: "에어처치",
    type: "website",
    locale: "ko_KR",
    images: [{ url: poster, width: 1254, height: 1254, alt: "에어처치 찬양대회 포스터 · 2026년 10월 1~15일 참가 접수" }],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: [poster],
  },
};
// Permanent start-date URL for this edition. Preserve its storage ID when adding events.
export default function OctoberContestPage(){return <><main className="contest-shell"><a className="contest-back" href="/our-events">← 이벤트 모아보기</a><ContestBoard/></main></>;}
