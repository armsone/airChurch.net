"use client";

import { FormEvent, useState } from "react";
import HomeReloadLink from "../home-reload-link";

export default function AdminLogin({context="admin"}:{context?:"admin"|"reviewer"}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const response = await fetch("/api/admin/unlock", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(values) }).catch(() => null);
    if (!response?.ok) {
      const result = await response?.json().catch(() => ({})) as { error?: string } | undefined;
      setError(result?.error || "로그인하지 못했습니다.");
      setBusy(false);
      return;
    }
    const result=await response.json().catch(()=>({})) as {role?:string};
    window.location.replace(result.role === "reviewer" ? "/pastor" : "/admin");
  }

  return <main className="admin-login-shell">
    <section className="admin-login-card">
      <span className="brand-mark" aria-hidden="true" />
      <small>{context==="reviewer"?"목회자 교회 검토":"AIRCHURCH OPERATIONS"}</small>
      <h1>{context==="reviewer"?"목회자 로그인":"운영자 로그인"}</h1>
      <p>{context==="reviewer"?"승인받은 아이디로 로그인해 교회 검토를 시작해 주세요.":"관리자 아이디로 로그인해 주세요."}</p>
      <form onSubmit={login}>
        <label>아이디<input name="username" autoComplete="username" required /></label>
        <label>비밀번호<input name="password" type="password" autoComplete="current-password" required /></label>
        <button disabled={busy} type="submit">{busy ? "확인 중…" : "로그인"}</button>
        {error && <p className="admin-login-error" role="alert">{error}</p>}
      </form>
      <div className="admin-login-links">{context==="reviewer"&&<a className="reviewer-join-link" href="/pastor/join">교회 검토 참여 신청</a>}<HomeReloadLink>← 에어처치로 돌아가기</HomeReloadLink></div>
    </section>
  </main>;
}
