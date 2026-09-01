import type { Metadata } from "next";
import InfoShell from "../info-shell";

export const metadata: Metadata = { title:"저작권 원칙 | airChurch", description:"교회와 창작자의 권리를 지키는 airChurch의 수집·소개·연결 원칙", alternates:{canonical:"/copyright"} };

export default function CopyrightPage() {
  return <InfoShell kicker="COPYRIGHT & SOURCES" title="도움이 되기 위해, 원작자의 권리부터 지킵니다" intro="airChurch는 콘텐츠를 소유한 것처럼 복제하지 않습니다. 공개된 공식 자료를 찾기 쉽게 정리하고 원래 제작자와 원문으로 연결합니다.">
    <section><h2>기본 원칙</h2><ul><li>교회·교단·언론사가 일반에 공개한 자료만 대상으로 합니다.</li><li>뉴스는 제목과 필요한 범위의 짧은 소개만 표시하고 전체 내용은 원문에서 읽게 합니다.</li><li>설교와 찬양은 공식 YouTube 채널의 제공 기능을 사용해 재생하며 원본을 내려받아 다시 배포하지 않습니다.</li><li>교회명, 출처, 공식 채널과 원문 링크를 가능한 한 콘텐츠 가까이에 표시합니다.</li><li>로그인, 유료 구독, 접근 제한이나 DRM을 우회하지 않습니다.</li></ul></section>
    <section><h2>자료별 표시 범위</h2><dl><div><dt>뉴스</dt><dd>제목, 출처, 게시 시각과 내용을 대신하지 않는 짧은 소개만 표시하고 원문으로 연결합니다.</dd></div><div><dt>말씀·찬양·쇼츠</dt><dd>공식 YouTube가 제공하는 제목·썸네일·게시 정보와 원본 링크만 사용합니다.</dd></div><div><dt>교회·목회자 정보</dt><dd>공식 홈페이지·교단 명부·공식 채널에서 공개한 교회 정보, 목회 직분과 사역 이력을 대조합니다. 공식 목회자 단독 프로필 사진은 출처와 함께 표시하며, 가족·친인척·일반 신도 등 직무와 무관한 제3자나 개인 SNS의 사적 사진은 사용하지 않습니다.</dd></div><div><dt>성경 본문</dt><dd>저작권 허락이 확인되지 않은 번역문을 복제하거나 자동 번역해 게시하지 않고, 성경 서비스의 한국어 검색 페이지로 연결합니다.</dd></div></dl></section>
    <section><h2>정정·비노출 요청</h2><p>교회·목회자·촬영자·권리자가 정보나 사진에 구체적인 문제를 제기하면 해당 자료를 먼저 임시 비노출하고, 공식 연락처와 출처·인물 일치·권리 관계를 확인해 복구·교체·삭제합니다. <a href="/contact">운영 문의</a>에서 <strong>저작권·비공개 요청</strong>을 선택해 주세요. 접수와 처리 자료는 개인정보처리방침의 기간에 따라 자동 삭제합니다.</p></section>
    <section><h2>자동 수집의 한계</h2><p>자동 수집 과정에서 제목·출처·채널 연결이 잘못될 수 있습니다. 잘못된 연결은 콘텐츠에 대한 판단이 아니라 기술적인 오류로 보고, 확인되는 즉시 고칩니다. 반복되는 오류가 있으면 해당 출처의 자동 노출을 보류합니다.</p></section>
    <section className="info-note"><h2>콘텐츠 권리</h2><p>외부 설교·찬양·뉴스·이미지의 권리는 각 원 제작자와 제공자에게 있습니다. airChurch 자체 문구·구성·서비스 표식의 권리는 airChurch에 있습니다.</p></section>
  </InfoShell>;
}
