"use client";

import { FormEvent, useRef, useState, type ReactNode } from "react";

async function updateAdmin(body: Record<string, unknown>, reload=true) {
  const response = await fetch("/api/admin/manage", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const result = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) throw new Error(result.error || "처리하지 못했습니다.");
  if(reload)window.location.reload();
}

const holdReasons = [
  ["pastor_request", "목사님 요청"],
  ["youtube_unavailable", "공식 YouTube 확인 불가"],
  ["inactive", "최근 180일 업로드 없음"],
  ["info_unverified", "교회 정보 재확인 필요"],
  ["review_needed", "운영상 재검토"],
  ["other", "기타"],
] as const;

export function ChurchControls(props: { id: number; name: string; pastor: string; region: string; denomination: string; status: string; holdReason: string | null; holdNote: string | null; heldAt: string | null; priorityWeight: number; iconOnly?:boolean; markTrigger?:{src:string|null;alt:string}; cardTrigger?:ReactNode; heldQuickActions?:boolean }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [holdReason, setHoldReason] = useState(props.holdReason || "review_needed");
  const [holdNote, setHoldNote] = useState(props.holdNote || "");
  const detailsRef=useRef<HTMLDetailsElement>(null);
  const holdReasonText=holdReasons.find(([value])=>value===props.holdReason)?.[1]??"사유 미기록";
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
      ? "이 교회를 보류 목록으로 옮길까요? 관련 말씀과 찬양도 함께 숨겨집니다."
      : next === "deleted"
        ? "이 교회를 삭제 처리할까요? 관련 말씀과 찬양도 즉시 숨겨집니다."
        : "이 교회를 다시 공개할까요? 숨겨진 설교는 자동 공개되지 않습니다.";
    if (!window.confirm(message)) return;
    setBusy(true); setError("");
    try { await updateAdmin({ kind: "church", id: props.id, status: next, holdReason, holdNote },next!=="deleted");if(next==="deleted"){const article=detailsRef.current?.closest<HTMLElement>("[data-admin-search]"),targetId=article?.parentElement?.id;article?.remove();if(targetId)window.dispatchEvent(new CustomEvent("admin-church-removed",{detail:{targetId}}));} } catch (reason) { setError((reason as Error).message); setBusy(false); }
  }
  return <details ref={detailsRef} className={`admin-church-details${props.iconOnly||props.markTrigger?" is-icon-editor":""}${props.markTrigger?" is-mark-editor":""}${props.cardTrigger?" is-card-editor":""}`}><summary aria-label="교회 정보 및 공개 상태 관리">{props.cardTrigger?<>{props.cardTrigger}{props.heldQuickActions&&<span className="admin-directory-hold-panel"><span className="admin-directory-hold-reason"><b>{holdReasonText}</b><span>{props.holdNote||"관리자 메모가 없습니다."}</span></span><span className="admin-directory-hold-actions"><button disabled={busy} type="button" onClick={(event)=>{event.preventDefault();event.stopPropagation();void changeStatus("approved");}}>노출</button><button type="button" onClick={(event)=>{event.preventDefault();event.stopPropagation();if(detailsRef.current)detailsRef.current.open=true;}}>수정</button><button disabled={busy} className="danger" type="button" onClick={(event)=>{event.preventDefault();event.stopPropagation();void changeStatus("deleted");}}>삭제</button></span></span>}</>:props.markTrigger?(props.markTrigger.src?<img src={props.markTrigger.src} alt={props.markTrigger.alt}/>:<span className="church-admin-mark-fallback" aria-hidden="true">✝</span>):props.iconOnly?<span aria-hidden="true">✎</span>:<><span className="admin-church-details-open">정보 관리</span><span className="admin-church-details-close" aria-label="관리 화면 닫기">관리 닫기</span><b aria-hidden="true">⌄</b></>}</summary><form className="admin-edit-form" onSubmit={save}>
    <div className="admin-edit-fields"><input name="name" defaultValue={props.name} aria-label="교회명" required /><input name="pastor" defaultValue={props.pastor} aria-label="목사님" required /><input name="region" defaultValue={props.region} aria-label="지역" required /><input name="denomination" defaultValue={props.denomination} aria-label="교단" required /></div>
    <div className="admin-preference-fields">
      <label><span>노출 비중</span><select name="priorityWeight" defaultValue={String(props.priorityWeight)}><option value="1">기본 · 균등 노출</option><option value="2">높음 · 최대 2배</option><option value="3">매우 높음 · 최대 3배</option><option value="4">핀업 · 항상 최상단</option></select></label>
      <label><span>보류 사유</span><select name="holdReason" value={holdReason} onChange={(event) => setHoldReason(event.target.value)}><option value="">선택해 주세요</option>{holdReasons.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
    </div>
    <label className="admin-note-field"><span>관리자 메모 {props.status === "approved" && <small>· 보류 시 필수</small>}</span><textarea name="holdNote" value={holdNote} onChange={(event) => setHoldNote(event.target.value)} maxLength={500} rows={3} placeholder="확인한 근거와 다시 검토할 내용을 남겨 주세요." /></label>
    {props.status === "removed" && props.heldAt && <p className="admin-held-at">최근 보류: {new Date(`${props.heldAt}Z`).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}</p>}
    <div className="admin-action-row"><button disabled={busy} type="submit">정보 저장</button>{props.status === "approved" ? <><button disabled={busy} className="danger" type="button" onClick={() => void changeStatus("removed")}>보류로 이동</button><button disabled={busy} className="danger" type="button" onClick={() => void changeStatus("deleted")}>삭제</button></> : <><button disabled={busy} className="restore" type="button" onClick={() => void changeStatus("approved")}>공개로 복원</button><button disabled={busy} className="danger" type="button" onClick={() => void changeStatus("deleted")}>삭제</button></>}</div>{error && <p className="admin-error">{error}</p>}
  </form></details>;
}

export function ChurchInfoEditControls(props:{id:number;name:string;pastor:string;region:string;denomination:string;iconOnly?:boolean}) {
  const [busy,setBusy]=useState(false),[error,setError]=useState("");
  async function save(event:FormEvent<HTMLFormElement>){event.preventDefault();setBusy(true);setError("");const values=Object.fromEntries(new FormData(event.currentTarget));try{await updateAdmin({kind:"church-info",id:props.id,...values});}catch(reason){setError((reason as Error).message);setBusy(false);}}
  return <details className={`admin-church-details admin-church-info-edit${props.iconOnly?" is-icon-editor":""}`}><summary aria-label="교회 정보 수정">{props.iconOnly?<span aria-hidden="true">✎</span>:"교회 정보 수정"}</summary><form className="admin-edit-form" onSubmit={save}><div className="admin-edit-fields"><input name="name" defaultValue={props.name} aria-label="교회명" required/><input name="pastor" defaultValue={props.pastor} aria-label="담임목사" required/><input name="region" defaultValue={props.region} aria-label="지역" required/><input name="denomination" defaultValue={props.denomination} aria-label="교단" required/></div><div className="admin-action-row"><button disabled={busy} type="submit">수정 내용 저장</button></div>{error&&<p className="admin-error">{error}</p>}</form></details>;
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
  async function setStatus(next: "pending" | "approved" | "rejected" | "deleted") {
    if (next === "rejected" && !window.confirm("공개하지 않고 반려할까요?")) return;
    if (next === "deleted") {
      const label=kind === "recommendation" ? "교회 추천" : kind === "post" ? "익명 글" : "달란트";
      if (!window.confirm(`이 ${label} 기록을 삭제할까요? 삭제 후에는 되돌릴 수 없습니다.`)) return;
    }
    setBusy(true); setError("");
    try { await updateAdmin({ kind, id, status: next }); } catch (reason) { setError((reason as Error).message); setBusy(false); }
  }
  return <div className="admin-action-row"><button disabled={busy || status === "approved"} className="restore" onClick={() => void setStatus("approved")}>{kind === "recommendation" ? "교회 등록 승인" : "공개 승인"}</button><button disabled={busy || status === "rejected"} className="danger" onClick={() => void setStatus("rejected")}>{kind === "recommendation" ? "등록하지 않음" : "비공개"}</button>{status !== "pending" && <button disabled={busy} onClick={() => void setStatus("pending")}>재검토</button>}<button disabled={busy} className="danger" onClick={() => void setStatus("deleted")}>삭제</button>{error && <span className="admin-error">{error}</span>}</div>;
}

export function ReviewerAccountControls({id,status}:{id:number;status:string}) {
  const [busy,setBusy]=useState(false),[error,setError]=useState("");
  async function setStatus(next:"pending"|"approved"|"rejected"|"deleted") {
    if(next==="rejected"&&!window.confirm("이 목회자 가입 신청을 거절할까요?")) return;
    if(next==="deleted"&&!window.confirm("이 목회자 계정과 검토 기록을 모두 삭제할까요? 삭제 후에는 되돌릴 수 없습니다.")) return;
    setBusy(true);setError("");
    try { await updateAdmin({kind:"reviewer-account",id,status:next}); } catch(reason) { setError((reason as Error).message);setBusy(false); }
  }
  return <div className="admin-action-row"><button disabled={busy||status==="approved"} className="restore" onClick={()=>void setStatus("approved")}>검토 권한 승인</button><button disabled={busy||status==="rejected"} className="danger" onClick={()=>void setStatus("rejected")}>가입 거절</button>{status!=="pending"&&<button disabled={busy} onClick={()=>void setStatus("pending")}>재검토</button>}<button disabled={busy} className="danger" onClick={()=>void setStatus("deleted")}>삭제</button>{error&&<span className="admin-error">{error}</span>}</div>;
}

export function ReviewerOpinionControls({id,handled=false}:{id:number;handled?:boolean}) {
  const [busy,setBusy]=useState(false),[error,setError]=useState("");
  async function toggle() {
    setBusy(true);setError("");
    try { await updateAdmin({kind:"church-review-handled",id,handled:!handled}); } catch(reason) { setError((reason as Error).message);setBusy(false); }
  }
  return <div className="admin-action-row opinion-action"><button disabled={busy} className={handled?"":"restore"} onClick={()=>void toggle()}>{handled?"다시 처리하기":"처리 완료"}</button>{error&&<span className="admin-error">{error}</span>}</div>;
}

export function ChurchReviewControls({id,status,note,reviewedAt}:{id:number;status:string;note:string|null;reviewedAt:string|null}) {
  const [busy,setBusy]=useState(false),[error,setError]=useState(""),[selectedStatus,setSelectedStatus]=useState(status);
  async function save(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();setBusy(true);setError("");
    const values=Object.fromEntries(new FormData(event.currentTarget));
    try { await updateAdmin({kind:"church-review",id,...values}); } catch(reason) { setError((reason as Error).message);setBusy(false); }
  }
  const results=[["unreviewed","아직 확인 전"],["confirmed","특이사항 없음"],["concern","검토 의견 있음"]] as const;
  return <form className="church-review-control" onSubmit={save}><fieldset><legend>내 검토 상태</legend><div className="review-result-options">{results.map(([value,label])=><label className={selectedStatus===value?"is-selected":""} key={value}><input type="radio" name="status" value={value} checked={selectedStatus===value} onChange={()=>setSelectedStatus(value)}/><span>{label}</span></label>)}</div></fieldset><label>내가 남긴 내용<textarea name="note" defaultValue={note??""} maxLength={500} rows={3} placeholder="알고 계신 내용이나 의견을 적어 주세요." /></label><div className="review-save-row">{reviewedAt&&<small>마지막 확인 {new Date(`${reviewedAt}Z`).toLocaleString("ko-KR",{timeZone:"Asia/Seoul"})}</small>}<button disabled={busy} type="submit">내 검토 저장</button></div>{error&&<p className="admin-error">{error}</p>}</form>;
}
