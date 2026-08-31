import type { Metadata } from "next";
import InfoShell from "../info-shell";

export const metadata: Metadata = { title:"이용약관 | airChurch", description:"airChurch 이용 조건과 책임 범위 안내" };

export default function TermsPage() {
  return <InfoShell kicker="TERMS" title="자료를 정직하게 연결하기 위한 약속" intro="airChurch를 이용하면 아래 기준에 동의한 것으로 봅니다. 시행일: 2026년 8월 31일">
    <section><h2>서비스 성격</h2><p>airChurch는 여러 교회와 언론이 공개한 자료를 수집·정리하고 원문으로 연결하는 포털입니다. 특정 교회의 공식 홈페이지, 교단 기관, 상담기관 또는 온라인 교회가 아닙니다.</p></section>
    <section><h2>콘텐츠와 권리</h2><p>설교·찬양·뉴스 등 외부 콘텐츠의 권리는 각 제작자와 원문 제공자에게 있습니다. airChurch는 제목·짧은 소개·미리보기와 원문 링크를 제공하며, 권리자의 정당한 수정·비공개 요청을 확인한 뒤 반영합니다.</p></section>
    <section><h2>사용자가 올리는 내용</h2><p>사용자는 자신이 작성할 권한이 있는 내용만 제출해야 합니다. 개인정보, 허위 비방, 불법정보와 타인의 권리를 침해하는 내용은 공개하지 않거나 삭제할 수 있습니다.</p></section>
    <section><h2>교회 정보의 보류</h2><p>공개 정보가 일치하지 않거나 목회 검토 참여자의 구체적인 문제 제보가 있으면 확인하는 동안 교회와 관련 콘텐츠를 보류할 수 있습니다. 보류는 신학적 유죄 판정이나 법적 판단을 뜻하지 않습니다.</p></section>
    <section><h2>서비스 변경</h2><p>공개 자료 제공 상태와 운영 여건에 따라 일부 콘텐츠가 늦게 갱신되거나 일시적으로 제공되지 않을 수 있습니다. 중요한 기준 변경은 이 안내 문서에 반영합니다.</p></section>
  </InfoShell>;
}
