import type { Metadata } from "next";
import ContestBoard from "../contest-board";
import "../contest.css";
const title = "2026 에어처치 찬양대회 | 수상 결과 및 행사 종료 안내";
const description = "수상자 상금 지급을 마치고 찬양대회를 잘 마무리했습니다. 함께해 주신 모든 분께 감사드립니다. 수상작과 참가 영상을 감상하시고, 다음 이벤트도 기대해 주세요.";
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
    images: [{ url: poster, width: 1254, height: 1254, alt: "에어처치 찬양대회 포스터 · 2026년 10월 대회 결과 발표 및 행사 종료" }],
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
