"use client";

import { FormEvent, useState } from "react";
import HomeReloadLink from "../home-reload-link";

export default function AdminLogin() {
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
    window.location.replace("/admin");
  }

  return <main className="admin-login-shell">
    <section className="admin-login-card">
      <span className="brand-mark" aria-hidden="true" />
      <small>AIRCHURCH ADMIN</small>
      <h1>관리자 로그인</h1>
      <p>교회 검토와 노출 비중을 관리하려면 로그인해 주세요.</p>
      <form onSubmit={login}>
        <label>아이디<input name="username" autoComplete="username" required /></label>
        <label>비밀번호<input name="password" type="password" autoComplete="current-password" required /></label>
        <button disabled={busy} type="submit">{busy ? "확인 중…" : "로그인"}</button>
        {error && <p className="admin-login-error" role="alert">{error}</p>}
      </form>
      <HomeReloadLink>← 사이트로 돌아가기</HomeReloadLink>
    </section>
  </main>;
}
