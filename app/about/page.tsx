import type { Metadata } from "next";
import InfoShell from "../info-shell";

export const metadata: Metadata = { title:"운영 안내 | airChurch", description:"airChurch의 자동 수집, 교회 확인, 목회자 제보와 최소 관리 원칙", alternates:{canonical:"/about"} };

export default function AboutPage() {
  return <InfoShell kicker="HOW AIRCHURCH WORKS" title="자료는 자동으로, 결정은 최소한으로" intro="airChurch는 직접 목회하거나 교회를 대신하지 않습니다. 공개된 자료를 모으고 정리해 말씀을 찾는 사람과 지역교회를 잇는 크리스천 포털입니다.">
    <section><h2>airChurch가 하는 일</h2><div className="principle-grid"><div><b>01</b><h3>공개 자료 수집</h3><p>교단·노회·교회가 로그인 없이 공개한 홈페이지와 공식 YouTube 자료를 자동으로 찾고 정리합니다.</p></div><div><b>02</b><h3>보기 쉽게 연결</h3><p>설교·찬양·교회 정보·교계소식을 한곳에서 찾고 원래 교회와 원문으로 이동할 수 있게 합니다.</p></div><div><b>03</b><h3>최소한의 관리</h3><p>문제가 제보된 교회는 보류하고, 익명 글과 나눔 신청은 공개 또는 비공개만 판단합니다.</p></div></div></section>
    <section><h2>교회 확인 흐름</h2><ol><li>공개된 교회명·지역·담임목사·교단·공식 채널을 서로 대조합니다.</li><li>기준에 맞는 교회와 최근 설교·예배 영상을 자동으로 정리합니다.</li><li>초빙된 목회 검토 참여자는 잘못된 정보나 문제가 의심되는 교회를 운영자에게 알립니다.</li><li>운영자는 공개 유지·정보 수정·보류·삭제만 결정합니다.</li></ol><p className="info-note">airChurch는 교단의 공식 치리기관이나 신학 재판기관이 아닙니다. 확인되지 않은 비방으로 교회를 판단하지 않으며, 공개 근거와 목회자 제보를 함께 살핍니다.</p></section>
    <section><h2>하지 않는 일</h2><ul><li>온라인 예배·성례·교적·헌금·개인 심방을 운영하지 않습니다.</li><li>상담기관이나 긴급구호기관의 역할을 대신하지 않습니다.</li><li>로그인·비공개 공간·개인의 민감정보를 수집해 교회를 평가하지 않습니다.</li><li>목회자와 교회를 인기 순위로 줄 세우지 않습니다.</li></ul></section>
    <section><h2>역할 구분</h2><dl><div><dt>자동 시스템</dt><dd>공개 자료 수집, 형식 분류, 최신 콘텐츠 정리</dd></div><div><dt>목회 검토 참여자</dt><dd>잘못된 정보와 문제가 의심되는 교회 제보</dd></div><div><dt>운영자</dt><dd>교회 공개·보류, 익명 글과 나눔 신청의 공개 여부 결정</dd></div><div><dt>지역교회</dt><dd>예배, 교제, 성례, 상담과 실제 목회적 돌봄</dd></div></dl></section>
  </InfoShell>;
}
