"use client";

import { FormEvent, useState } from "react";

export default function ContactForm() {
  const [busy,setBusy]=useState(false),[message,setMessage]=useState(""),[done,setDone]=useState(false);
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();setBusy(true);setMessage("");
    const form=event.currentTarget,body=Object.fromEntries(new FormData(form));
    const response=await fetch("/api/contact",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)}).catch(()=>null);
    const result=await response?.json().catch(()=>({})) as {error?:string}|undefined;
    if(!response?.ok){setMessage(result?.error||"문의를 보내지 못했습니다. 잠시 후 다시 시도해 주세요.");setBusy(false);return;}
    form.reset();setDone(true);setMessage("문의가 접수되었습니다. 운영자가 확인한 뒤 필요한 경우 입력한 연락처로 답변드립니다.");setBusy(false);
  }
  return <form className="contact-form" onSubmit={submit}>
    <label>문의 종류<select name="category" defaultValue="정보 수정 요청" required><option>정보 수정 요청</option><option>저작권·비공개 요청</option><option>개인정보 요청</option><option>운영 문의</option></select></label>
    <div><label>이름 또는 교회명<input name="name" minLength={2} maxLength={80} required/></label><label>답변받을 연락처<input name="contact" minLength={5} maxLength={160} placeholder="전화번호 또는 이메일" required/></label></div>
    <label>확인할 내용<textarea name="message" minLength={20} maxLength={1500} rows={7} placeholder="대상 페이지와 수정·비공개가 필요한 이유를 구체적으로 적어 주세요." required/></label>
    <input className="honeypot" name="company" tabIndex={-1} autoComplete="off"/>
    <label className="agreement"><input type="checkbox" required/> 문의 처리에 필요한 이름·연락처·내용 수집에 동의합니다.</label>
    <button type="submit" disabled={busy}>{busy?"보내는 중…":"운영 문의 보내기"}</button>
    {message&&<p className={done?"form-success":"form-error"} role={done?"status":"alert"}>{message}</p>}
  </form>;
}
