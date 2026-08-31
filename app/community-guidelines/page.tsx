import type { Metadata } from "next";
import InfoShell from "../info-shell";

export const metadata: Metadata = { title:"공동체 안전 원칙 | airChurch", description:"airChurch 익명 광장과 공개 콘텐츠의 최소 관리 기준" };

export default function CommunityGuidelinesPage() {
  return <InfoShell kicker="COMMUNITY SAFETY" title="자유롭게 나누되, 공개 기준은 분명하게" intro="익명 글은 먼저 접수되고 운영자가 공개 또는 비공개만 판단합니다. airChurch는 논쟁을 지휘하거나 모든 글에 답변하지 않습니다.">
    <section><h2>공개할 수 있는 글</h2><ul><li>신앙과 삶에 대한 솔직한 생각</li><li>말씀을 읽고 받은 은혜와 질문</li><li>개인을 특정하지 않는 교회 생활 이야기</li><li>개인정보를 포함하지 않은 기도 부탁</li></ul></section>
    <section><h2>공개하지 않는 글</h2><ul><li>특정 교회·목회자·개인을 향한 확인되지 않은 비방과 폭로</li><li>개인 연락처, 주소, 계좌, 진료·상담 내용 등 민감정보</li><li>혐오·협박·성적 표현·선동·반복 광고</li><li>아동·청소년을 식별할 수 있는 사진이나 구체적 정보</li><li>불법행위나 즉각적인 위험을 조장하는 내용</li></ul></section>
    <section><h2>운영자가 하는 판단</h2><p>운영자는 글의 신학적 정답을 판정하지 않습니다. 공개 기준에 맞는지만 살펴보고 <strong>공개·비공개·삭제</strong> 중 하나를 결정합니다. 별도의 답변이나 상담을 약속하지 않습니다.</p></section>
    <section className="crisis-box"><h2>긴급한 도움이 필요할 때</h2><p>airChurch 광장은 상담기관이나 신고기관이 아닙니다. 생명이나 안전이 위험하면 112·119, 자살예방상담전화 109에 바로 연락해 주세요. 아동·청소년의 안전이 걱정되면 보호자 또는 관계기관에 즉시 알려주세요.</p></section>
  </InfoShell>;
}
