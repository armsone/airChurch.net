"use client";

import { FormEvent, useState } from "react";

export default function ReviewerSignup() {
  const [busy,setBusy]=useState(false),[message,setMessage]=useState(""),[done,setDone]=useState(false);
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();setBusy(true);setMessage("");
    const response=await fetch("/api/reviewer-signup",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(Object.fromEntries(new FormData(event.currentTarget)))}).catch(()=>null);
    const result=await response?.json().catch(()=>({})) as {error?:string}|undefined;
    if(!response?.ok){setMessage(result?.error||"가입 신청을 접수하지 못했습니다.");setBusy(false);return;}
    setDone(true);setMessage("가입 신청을 접수했습니다. 관리자 승인 후 로그인할 수 있습니다.");
  }
  return <main className="admin-login-shell"><section className="admin-login-card reviewer-signup-card"><span className="brand-mark" aria-hidden="true"/><small>CHURCH REVIEWER</small><h1>목회자 검토자 가입</h1><p>성함과 연락처는 관리자 확인에만 사용합니다. 가입 신청 후 관리자가 승인해야 교회 목록 검토 작업이 가능합니다.</p>{done?<p className="reviewer-signup-success" role="status">{message}</p>:<form onSubmit={submit}><label>성함<input name="name" minLength={2} maxLength={80} autoComplete="name" required/></label><label>연락처<input name="contact" minLength={5} maxLength={120} autoComplete="tel" placeholder="전화번호 또는 이메일" required/></label><label>아이디<input name="username" minLength={4} maxLength={40} pattern="[A-Za-z0-9._-]+" autoComplete="username" required/></label><label>비밀번호<input name="password" type="password" autoComplete="new-password" required/></label><button disabled={busy} type="submit">{busy?"접수 중…":"가입 신청"}</button>{message&&<p className="admin-login-error" role="alert">{message}</p>}</form>}<div className="admin-login-links single"><a href="/review">← 로그인 화면으로 돌아가기</a></div></section></main>;
}
