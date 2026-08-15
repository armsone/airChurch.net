"use client";

import { FormEvent, useState } from "react";

async function updateAdmin(body: Record<string, unknown>) {
  const response = await fetch("/api/admin/manage", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const result = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) throw new Error(result.error || "처리하지 못했습니다.");
  window.location.reload();
}

export function ChurchControls(props: { id: number; name: string; pastor: string; region: string; denomination: string; status: string }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try { await updateAdmin({ kind: "church", id: props.id, ...values }); } catch (reason) { setError((reason as Error).message); setBusy(false); }
  }
  async function toggle() {
    const removing = props.status === "approved";
    if (removing && !window.confirm("이 교회를 공개 목록에서 내릴까요? 관련 설교도 함께 숨겨집니다.")) return;
    setBusy(true); setError("");
    try { await updateAdmin({ kind: "church", id: props.id, status: removing ? "removed" : "approved" }); } catch (reason) { setError((reason as Error).message); setBusy(false); }
  }
  return <form className="admin-edit-form" onSubmit={save}>
    <div className="admin-edit-fields"><input name="name" defaultValue={props.name} aria-label="교회명" required /><input name="pastor" defaultValue={props.pastor} aria-label="목사님" required /><input name="region" defaultValue={props.region} aria-label="지역" required /><input name="denomination" defaultValue={props.denomination} aria-label="교단" required /></div>
    <div className="admin-action-row"><button disabled={busy} type="submit">정보 저장</button><button disabled={busy} className={props.status === "approved" ? "danger" : "restore"} type="button" onClick={() => void toggle()}>{props.status === "approved" ? "목록에서 내리기" : "다시 공개"}</button></div>{error && <p className="admin-error">{error}</p>}
  </form>;
}

export function SermonControls({ id, status }: { id: number; status: string }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function toggle() {
    const hiding = status === "published";
    if (hiding && !window.confirm("이 영상을 사이트에서 즉시 내릴까요?")) return;
    setBusy(true); setError("");
    try { await updateAdmin({ kind: "sermon", id, status: hiding ? "hidden" : "published" }); } catch (reason) { setError((reason as Error).message); setBusy(false); }
  }
  return <div className="admin-inline-control"><button disabled={busy} className={status === "published" ? "danger" : "restore"} onClick={() => void toggle()}>{status === "published" ? "즉시 내리기" : "다시 공개"}</button>{error && <span className="admin-error">{error}</span>}</div>;
}

export function ReviewControls({ kind, id, status }: { kind: "post" | "talent"; id: number; status: string }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function setStatus(next: string) {
    if (next === "rejected" && !window.confirm("공개하지 않고 반려할까요?")) return;
    setBusy(true); setError("");
    try { await updateAdmin({ kind, id, status: next }); } catch (reason) { setError((reason as Error).message); setBusy(false); }
  }
  return <div className="admin-action-row"><button disabled={busy || status === "approved"} className="restore" onClick={() => void setStatus("approved")}>공개 승인</button><button disabled={busy || status === "rejected"} className="danger" onClick={() => void setStatus("rejected")}>비공개</button>{status !== "pending" && <button disabled={busy} onClick={() => void setStatus("pending")}>재검토</button>}{error && <span className="admin-error">{error}</span>}</div>;
}
