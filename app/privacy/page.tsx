import type { Metadata } from "next";
import InfoShell from "../info-shell";

export const metadata: Metadata = { title:"개인정보처리방침 | airChurch", description:"airChurch가 처리하는 정보와 이용 목적 안내" };

export default function PrivacyPage() {
  return <InfoShell kicker="PRIVACY" title="필요한 정보만, 공개 자료는 공개 범위에서만" intro="airChurch는 교회 공개 자료를 정리하며, 서비스 운영과 남용 방지에 필요한 최소한의 정보만 처리합니다. 시행일: 2026년 8월 31일">
    <section><h2>처리하는 정보</h2><ul><li><strong>방문 기록:</strong> 임의로 만든 브라우저 식별값의 해시, 방문 경로, 외부 유입 도메인, 마지막 활동 시각</li><li><strong>익명 광장:</strong> 별칭, 분류, 글 내용, 반복 접수 방지를 위한 일 단위 접속 환경 해시</li><li><strong>달란트·교회 추천:</strong> 사용자가 입력한 제목·지역·설명 또는 교회 정보와 추천 이유</li><li><strong>목회 검토 참여:</strong> 성명, 연락처, 아이디, 안전하게 변환한 비밀번호 정보</li><li><strong>운영 문의:</strong> 분류, 이름, 답변받을 연락처, 문의 내용</li></ul></section>
    <section><h2>이용 목적</h2><p>교회와 콘텐츠를 정리해 보여주고, 접수된 글과 요청의 공개 여부를 판단하며, 반복 제출과 자동화된 남용을 막고, 방문 흐름을 익명 통계로 확인하는 데 사용합니다.</p></section>
    <section><h2>브라우저에만 저장되는 정보</h2><p>‘오늘의 5분’ 진행 상태와 찜한 말씀·찬양·교회는 로그인 없이 현재 브라우저의 로컬 저장소에만 보관합니다. airChurch 서버로 전송하지 않으며, 브라우저의 사이트 데이터 삭제 기능으로 언제든 지울 수 있습니다.</p></section>
    <section><h2>외부 콘텐츠</h2><p>YouTube 영상, 교회 홈페이지와 뉴스 원문을 열면 해당 서비스의 개인정보 처리방침이 적용됩니다. airChurch는 외부 사이트의 로그인 정보나 비공개 영역을 수집하지 않습니다.</p></section>
    <section><h2>보관과 삭제</h2><p>정보는 접수 내용 검토, 공개 유지, 남용 방지 등 필요한 기간에만 보관합니다. 목적이 끝났거나 삭제 요청이 확인되면 관련 기록을 삭제하며, 법령상 보관 의무가 있는 경우에는 그 기간 동안 분리해 보관합니다.</p></section>
    <section><h2>문의와 권리 요청</h2><p>본인 정보의 열람·정정·삭제를 원하면 <a href="/contact">운영 문의</a>에서 요청해 주세요. 본인 확인에 필요한 최소 정보만 추가로 요청할 수 있습니다.</p></section>
  </InfoShell>;
}
