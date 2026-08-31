import type { Metadata } from "next";
import InfoShell from "../info-shell";
import ContactForm from "./contact-form";

export const metadata: Metadata = { title:"운영 문의 | airChurch", description:"교회 정보 수정, 저작권·비공개, 개인정보와 운영 문의 접수", alternates:{canonical:"/contact"} };

export default function ContactPage() {
  return <InfoShell kicker="CONTACT" title="잘못된 정보는 고치고, 권리자의 요청은 먼저 살핍니다" intro="교회 정보 수정, 저작권·비공개, 개인정보 요청처럼 운영 판단이 필요한 내용만 접수합니다. 일반 상담과 기도 응답은 제공하지 않습니다.">
    <section><h2>빠르게 확인할 수 있도록</h2><ul><li>문제가 있는 페이지 또는 교회명을 적어 주세요.</li><li>권리자 요청은 공식 홈페이지나 교회 연락처처럼 확인 가능한 근거를 함께 적어 주세요.</li><li>비밀번호, 주민등록번호, 진료정보와 같은 민감정보는 보내지 마세요.</li></ul></section>
    <section><h2>문의 접수</h2><ContactForm/></section>
  </InfoShell>;
}
