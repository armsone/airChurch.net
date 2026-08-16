"use client";

import { FormEvent, useState } from "react";

async function updateAdmin(body: Record<string, unknown>) {
  const response = await fetch("/api/admin/manage", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const result = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) throw new Error(result.error || "처리하지 못했습니다.");
  window.location.reload();
}

const holdReasons = [
  ["youtube_unavailable", "공식 YouTube 확인 불가"],
  ["inactive", "최근 180일 업로드 없음"],
  ["info_unverified", "교회 정보 재확인 필요"],
  ["review_needed", "운영상 재검토"],
  ["other", "기타"],
] as const;

export function ChurchControls(props: { id: number; name: string; pastor: string; region: string; denomination: string; status: string; holdReason: string | null; holdNote: string | null; heldAt: string | null; priorityWeight: number }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [holdReason, setHoldReason] = useState(props.holdReason || "");
  const [holdNote, setHoldNote] = useState(props.holdNote || "");
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try { await updateAdmin({ kind: "church", id: props.id, ...values }); } catch (reason) { setError((reason as Error).message); setBusy(false); }
  }
  async function changeStatus(next: "approved" | "removed" | "deleted") {
    if (next === "removed" && (!holdReason || holdNote.trim().length < 3)) {
      setError("보류 사유를 선택하고 3자 이상의 관리자 메모를 입력해 주세요.");
      return;
    }
    const message = next === "removed"
      ? "이 교회를 보류 목록으로 옮길까요? 관련 설교도 함께 숨겨집니다."
      : next === "deleted"
        ? "보류 목록에서 이 교회를 삭제할까요? 삭제 후에는 관리자 화면에 표시되지 않습니다."
        : "이 교회를 다시 공개할까요? 숨겨진 설교는 자동 공개되지 않습니다.";
    if (!window.confirm(message)) return;
    setBusy(true); setError("");
    try { await updateAdmin({ kind: "church", id: props.id, status: next, holdReason, holdNote }); } catch (reason) { setError((reason as Error).message); setBusy(false); }
  }
  return <details className="admin-church-details"><summary>정보 · 노출 · 보류 관리</summary><form className="admin-edit-form" onSubmit={save}>
    <div className="admin-edit-fields"><input name="name" defaultValue={props.name} aria-label="교회명" required /><input name="pastor" defaultValue={props.pastor} aria-label="목사님" required /><input name="region" defaultValue={props.region} aria-label="지역" required /><input name="denomination" defaultValue={props.denomination} aria-label="교단" required /></div>
    <div className="admin-preference-fields">
      <label><span>노출 비중</span><select name="priorityWeight" defaultValue={String(props.priorityWeight)}><option value="1">기본 · 균등 노출</option><option value="2">높음 · 최대 2배</option><option value="3">매우 높음 · 최대 3배</option></select></label>
      <label><span>보류 사유</span><select name="holdReason" value={holdReason} onChange={(event) => setHoldReason(event.target.value)}><option value="">선택해 주세요</option>{holdReasons.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
    </div>
    <label className="admin-note-field"><span>관리자 메모 {props.status === "approved" && <small>· 보류 시 필수</small>}</span><textarea name="holdNote" value={holdNote} onChange={(event) => setHoldNote(event.target.value)} maxLength={500} rows={3} placeholder="확인한 근거와 다시 검토할 내용을 남겨 주세요." /></label>
    {props.status === "removed" && props.heldAt && <p className="admin-held-at">최근 보류: {new Date(`${props.heldAt}Z`).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}</p>}
    <div className="admin-action-row"><button disabled={busy} type="submit">정보 저장</button>{props.status === "approved" ? <button disabled={busy} className="danger" type="button" onClick={() => void changeStatus("removed")}>보류로 이동</button> : <><button disabled={busy} className="restore" type="button" onClick={() => void changeStatus("approved")}>공개로 복원</button><button disabled={busy} className="danger" type="button" onClick={() => void changeStatus("deleted")}>삭제</button></>}</div>{error && <p className="admin-error">{error}</p>}
  </form></details>;
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

export function ReviewControls({ kind, id, status }: { kind: "post" | "talent" | "recommendation"; id: number; status: string }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function setStatus(next: string) {
    if (next === "rejected" && !window.confirm("공개하지 않고 반려할까요?")) return;
    setBusy(true); setError("");
    try { await updateAdmin({ kind, id, status: next }); } catch (reason) { setError((reason as Error).message); setBusy(false); }
  }
  return <div className="admin-action-row"><button disabled={busy || status === "approved"} className="restore" onClick={() => void setStatus("approved")}>{kind === "recommendation" ? "교회 등록 승인" : "공개 승인"}</button><button disabled={busy || status === "rejected"} className="danger" onClick={() => void setStatus("rejected")}>{kind === "recommendation" ? "등록하지 않음" : "비공개"}</button>{status !== "pending" && <button disabled={busy} onClick={() => void setStatus("pending")}>재검토</button>}{error && <span className="admin-error">{error}</span>}</div>;
}

export function ChurchReviewControls({id,status,note,reviewedAt}:{id:number;status:string;note:string|null;reviewedAt:string|null}) {
  const [busy,setBusy]=useState(false),[error,setError]=useState("");
  async function save(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();setBusy(true);setError("");
    const values=Object.fromEntries(new FormData(event.currentTarget));
    try { await updateAdmin({kind:"church-review",id,...values}); } catch(reason) { setError((reason as Error).message);setBusy(false); }
  }
  return <form className="church-review-control" onSubmit={save}><label>검토 결과<select name="status" defaultValue={status}><option value="unreviewed">아직 검토하지 않음</option><option value="confirmed">정보 확인 완료</option><option value="concern">관리자 재검토 필요</option></select></label><label>검토 메모<textarea name="note" defaultValue={note??""} maxLength={500} rows={3} placeholder="확인한 내용이나 재검토 이유를 적어 주세요." /></label><div><button disabled={busy} type="submit">검토 결과 저장</button>{reviewedAt&&<small>최근 검토 {new Date(`${reviewedAt}Z`).toLocaleString("ko-KR",{timeZone:"Asia/Seoul"})}</small>}</div>{error&&<p className="admin-error">{error}</p>}</form>;
}
