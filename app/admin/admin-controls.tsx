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

export function denominationMark(denomination:string) {
  if (denomination === "대한예수교장로회 통합") return { src:"/denominations/pck-tonghap.png", alt:"대한예수교장로회 통합 교단 심볼" };
  if (denomination === "대한예수교장로회 합동") return { src:"/denominations/pck-hapdong.svg", alt:"대한예수교장로회 합동 교단 심볼" };
  if (denomination === "기독교대한감리회") return { src:"/denominations/kmc.ico", alt:"기독교대한감리회 교단 심볼" };
  if (denomination === "대한예수교장로회 고신") return { src:"/denominations/pck-kosin.jpg", alt:"대한예수교장로회 고신 교단 심볼" };
  if (denomination === "기독교한국침례회") return { src:"/denominations/kbch.png", alt:"기독교한국침례회 공식 로고" };
  if (denomination === "기독교대한성결교회") return { src:"/denominations/kehc.png", alt:"기독교대한성결교회 교단 심볼" };
  if (denomination === "대한예수교장로회 합신") return { src:"/denominations/pck-hapshin.png", alt:"대한예수교장로회 합신 공식 로고" };
  if (denomination === "대한예수교장로회 백석") return { src:"/denominations/pck-baekseok.png", alt:"대한예수교장로회 백석 교단 심볼" };
  if (denomination === "기독교대한하나님의성회") return { src:"/denominations/agk.png", alt:"기독교대한하나님의성회 공식 로고" };
  if (denomination === "기독교대한하나님의성회 광화문총회") return { src:"/denominations/agk-gwanghwamun.png", alt:"기독교대한하나님의성회 광화문총회 공식 로고" };
  if (denomination === "한국기독교장로회") return { src:"/denominations/prok.png", alt:"한국기독교장로회 교단 심볼" };
  if (denomination === "한국독립교회선교단체연합회") return { src:"/denominations/kaicam.png", alt:"한국독립교회선교단체연합회 공식 로고" };
  return null;
}

export type AdminChurchItem = {
  id: number;
  name: string;
  pastor: string;
  region: string;
  denomination: string;
  review_status?: string;
  status?: string;
  hold_reason?: string | null;
  holdReason?: string | null;
  hold_note?: string | null;
  holdNote?: string | null;
  held_at?: string | null;
  heldAt?: string | null;
  priority_weight?: number;
  priorityWeight?: number;
  homepage_url?: string | null;
  homepageUrl?: string | null;
  youtube_channel_id?: string | null;
  youtubeChannelId?: string | null;
  channel_image_url?: string | null;
  channelImageUrl?: string | null;
};

export function AdminChurchCard({ church, preview, isHeld = false, selected = false, onToggleSelected }: { church: AdminChurchItem; preview: boolean; isHeld?: boolean; selected?: boolean; onToggleSelected?: (id: number, checked: boolean) => void }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const status = church.review_status ?? church.status ?? (isHeld ? "removed" : "approved");
  const holdReasonValue = church.hold_reason ?? church.holdReason ?? null;
  const holdNoteValue = church.hold_note ?? church.holdNote ?? "";
  const heldAtValue = church.held_at ?? church.heldAt ?? null;
  const priorityWeightValue = church.priority_weight ?? church.priorityWeight ?? 1;

  const [holdReason, setHoldReason] = useState(holdReasonValue || "review_needed");
  const [holdNote, setHoldNote] = useState(holdNoteValue || "");
  const detailsRef = useRef<HTMLDetailsElement>(null);

  const homepageUrl = church.homepage_url ?? church.homepageUrl ?? null;
  const youtubeChannelId = church.youtube_channel_id ?? church.youtubeChannelId ?? null;
  const channelImageUrl = church.channel_image_url ?? church.channelImageUrl ?? null;

  const churchPrimaryUrl = homepageUrl || (youtubeChannelId ? `https://www.youtube.com/channel/${youtubeChannelId}` : null);
  const churchPrimaryLabel = `${church.name} ${homepageUrl ? "공식 홈페이지" : "공식 YouTube"} 열기`;
  const mark = denominationMark(church.denomination);
  const holdReasonText = holdReasons.find(([value]) => value === (holdReasonValue || holdReason))?.[1] ?? (holdReasonValue ? "기타" : "사유 미기록");

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try { await updateAdmin({ kind: "church", id: church.id, ...values }); } catch (reason) { setError((reason as Error).message); setBusy(false); }
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
    try {
      await updateAdmin({ kind: "church", id: church.id, status: next, holdReason, holdNote }, next !== "deleted");
      if (next === "deleted") {
        const article = detailsRef.current?.closest<HTMLElement>("[data-admin-search]"), targetId = article?.parentElement?.id;
        article?.remove();
        if (targetId) window.dispatchEvent(new CustomEvent("admin-church-removed", { detail: { targetId } }));
      }
    } catch (reason) { setError((reason as Error).message); setBusy(false); }
  }

  function handleCardClick(event: React.MouseEvent<HTMLElement>) {
    const target = event.target as HTMLElement;
    if (target.closest("a, button, input, select, textarea, label, form")) return;
    if (detailsRef.current) detailsRef.current.open = !detailsRef.current.open;
  }

  const publicCardContent = (
    <>
      <div className="church-directory-top">
        <div className="admin-church-region-select">
          {onToggleSelected && <label className="admin-card-select"><input type="checkbox" checked={selected} onChange={(event) => onToggleSelected(church.id, event.target.checked)} aria-label={`${church.name} 선택`} /></label>}
          <span>{church.region}</span>
        </div>
        {mark && <img className="church-denomination-mark" src={mark.src} alt={mark.alt} loading="lazy" decoding="async" referrerPolicy="no-referrer" />}
      </div>
      <h3>{churchPrimaryUrl ? <a className="church-primary-link" href={churchPrimaryUrl} target="_blank" rel="noreferrer" aria-label={churchPrimaryLabel}>{church.name}</a> : church.name}</h3>
      <div className="church-directory-meta">
        <div className="church-directory-meta-copy">
          <p>{churchPrimaryUrl ? <a className="church-primary-link" href={churchPrimaryUrl} target="_blank" rel="noreferrer" aria-label={churchPrimaryLabel}>{church.pastor}</a> : church.pastor}</p>
          <small>{church.denomination}</small>
        </div>
        <div className="church-directory-links">
          {homepageUrl && <a className="homepage-link" href={homepageUrl} target="_blank" rel="noreferrer" title={`${church.name} 공식 홈페이지`} aria-label={`${church.name} 공식 홈페이지 열기`}><span className="homepage-visual" aria-hidden="true"><span>⛪</span>{channelImageUrl && <img src={channelImageUrl} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={(event) => { event.currentTarget.hidden = true; }} />}</span></a>}
          {youtubeChannelId && <a className="youtube-link" href={`https://www.youtube.com/channel/${youtubeChannelId}`} target="_blank" rel="noreferrer" title={`${church.name} 공식 YouTube`} aria-label={`${church.name} 공식 YouTube 열기`}><span className="directory-icon youtube-icon" aria-hidden="true" /></a>}
        </div>
      </div>
    </>
  );

  const editForm = (
    <details ref={detailsRef} className="admin-church-details">
      <summary className="sr-only">교회 정보 및 공개 상태 관리</summary>
      <form className="admin-edit-form" onSubmit={save}>
        <div className="admin-edit-fields">
          <input name="name" defaultValue={church.name} aria-label="교회명" required />
          <input name="pastor" defaultValue={church.pastor} aria-label="목사님" required />
          <input name="region" defaultValue={church.region} aria-label="지역" required />
          <input name="denomination" defaultValue={church.denomination} aria-label="교단" required />
        </div>
        <div className="admin-preference-fields">
          <label>
            <span>노출 비중</span>
            <select name="priorityWeight" defaultValue={String(priorityWeightValue)}>
              <option value="1">기본 · 균등 노출</option>
              <option value="2">높음 · 최대 2배</option>
              <option value="3">매우 높음 · 최대 3배</option>
              <option value="4">핀업 · 항상 최상단</option>
            </select>
          </label>
          <label>
            <span>보류 사유</span>
            <select name="holdReason" value={holdReason} onChange={(event) => setHoldReason(event.target.value)}>
              <option value="">선택해 주세요</option>
              {holdReasons.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
            </select>
          </label>
        </div>
        <label className="admin-note-field">
          <span>관리자 메모 {status === "approved" && <small>· 보류 시 필수</small>}</span>
          <textarea name="holdNote" value={holdNote} onChange={(event) => setHoldNote(event.target.value)} maxLength={500} rows={3} placeholder="확인한 근거와 다시 검토할 내용을 남겨 주세요." />
        </label>
        {status === "removed" && heldAtValue && <p className="admin-held-at">최근 보류: {new Date(`${heldAtValue}Z`).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}</p>}
        <div className="admin-action-row">
          <button disabled={busy} type="submit">정보 저장</button>
          {status === "approved" ? (
            <>
              <button disabled={busy} className="danger" type="button" onClick={() => void changeStatus("removed")}>보류로 이동</button>
              <button disabled={busy} className="danger" type="button" onClick={() => void changeStatus("deleted")}>삭제</button>
            </>
          ) : (
            <>
              <button disabled={busy} className="restore" type="button" onClick={() => void changeStatus("approved")}>공개로 복원</button>
              <button disabled={busy} className="danger" type="button" onClick={() => void changeStatus("deleted")}>삭제</button>
            </>
          )}
        </div>
        {error && <p className="admin-error">{error}</p>}
      </form>
    </details>
  );

  if (isHeld) {
    return (
      <article className="managed-church-card admin-directory-card is-held-card" key={church.id} data-admin-id={church.id} data-admin-selected={selected ? "true" : "false"} data-admin-search={`${church.name} ${church.pastor} ${church.region} ${church.denomination} ${holdReasonValue ?? ""} ${holdNoteValue ?? ""}`} data-admin-preview={preview ? "true" : "false"} hidden={!preview}>
        <div className="admin-held-card-body">
          <div className="admin-held-card-public" onClick={handleCardClick}>
            {publicCardContent}
          </div>
          <div className="admin-directory-hold-panel">
            <div className="admin-directory-hold-reason">
              <b>{holdReasonText}</b>
              <span>{holdNoteValue || "관리자 메모가 없습니다."}</span>
            </div>
            <div className="admin-directory-hold-actions">
              <button disabled={busy} type="button" onClick={() => void changeStatus("approved")}>노출</button>
              <button type="button" onClick={() => { if (detailsRef.current) detailsRef.current.open = true; }}>수정</button>
              <button disabled={busy} className="danger" type="button" onClick={() => void changeStatus("deleted")}>삭제</button>
            </div>
          </div>
        </div>
        {editForm}
      </article>
    );
  }

  return (
    <article className="managed-church-card admin-directory-card" key={church.id} data-admin-id={church.id} data-admin-selected={selected ? "true" : "false"} data-admin-search={`${church.name} ${church.pastor} ${church.region} ${church.denomination} ${holdReasonValue ?? ""} ${holdNoteValue ?? ""}`} data-admin-preview={preview ? "true" : "false"} hidden={!preview} onClick={handleCardClick}>
      {publicCardContent}
      {editForm}
    </article>
  );
}

export function AdminChurchList({ churches, previewIds, variant }: { churches: AdminChurchItem[]; previewIds: number[]; variant: "public" | "held" }) {
  const [selected, setSelected] = useState<Set<number>>(() => new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const preview = new Set(previewIds);

  function toggleSelected(id: number, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(id); else next.delete(id);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(churches.map((church) => church.id)));
  }

  async function runBatch(status: "approved" | "removed" | "deleted") {
    const ids = [...selected];
    if (!ids.length) return;
    const message = status === "removed"
      ? `선택한 ${ids.length}곳을 보류할까요? 관련 말씀과 찬양도 함께 숨겨집니다.`
      : status === "deleted"
        ? `선택한 ${ids.length}곳을 삭제할까요? 관련 말씀과 찬양도 즉시 숨겨집니다.`
        : `선택한 ${ids.length}곳을 노출할까요? 숨겨진 설교는 자동 공개되지 않습니다.`;
    if (!window.confirm(message)) return;
    setBusy(true); setError("");
    try {
      let updatedCount = 0, failedCount = 0;
      for (let offset = 0; offset < ids.length; offset += 500) {
        const response = await fetch("/api/admin/manage", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ kind: "church-batch", ids: ids.slice(offset, offset + 500), status }),
        });
        const result = await response.json().catch(() => ({})) as { error?: string; updated?: number[]; failed?: number[] };
        if (!response.ok) throw new Error(result.error || "처리하지 못했습니다.");
        updatedCount += result.updated?.length ?? 0;
        failedCount += result.failed?.length ?? 0;
      }
      const action = status === "removed" ? "보류" : status === "deleted" ? "삭제" : "노출";
      window.alert(failedCount
        ? `${updatedCount}곳을 ${action}했고, ${failedCount}곳은 이미 상태가 바뀌어 제외했습니다.`
        : `${updatedCount}곳을 ${action}했습니다.`);
      window.location.reload();
    } catch (reason) {
      setError((reason as Error).message);
      setBusy(false);
    }
  }

  return <>
    {selected.size > 0 && <div className="admin-batch-bar" role="toolbar" aria-label="선택한 교회 일괄 처리">
      <strong>{selected.size}곳 선택</strong>
      {variant === "held"
        ? <button disabled={busy} className="restore" type="button" onClick={() => void runBatch("approved")}>노출</button>
        : <button disabled={busy} type="button" onClick={() => void runBatch("removed")}>보류</button>}
      <button disabled={busy} className="danger" type="button" onClick={() => void runBatch("deleted")}>삭제</button>
      <button disabled={busy} type="button" onClick={selectAll}>전체 선택</button>
      <button disabled={busy} type="button" onClick={() => setSelected(new Set())}>선택 해제</button>
      {error && <span className="admin-error" role="alert">{error}</span>}
    </div>}
    {churches.map((church) => <AdminChurchCard key={church.id} church={church} preview={preview.has(church.id)} isHeld={variant === "held"} selected={selected.has(church.id)} onToggleSelected={toggleSelected} />)}
  </>;
}

export function ChurchControls(props: { id: number; name: string; pastor: string; region: string; denomination: string; status: string; holdReason: string | null; holdNote: string | null; heldAt: string | null; priorityWeight: number; iconOnly?:boolean; markTrigger?:{src:string|null;alt:string}; cardTrigger?:ReactNode; overlayTrigger?:boolean; heldQuickActions?:boolean }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [holdReason, setHoldReason] = useState(props.holdReason || "review_needed");
  const [holdNote, setHoldNote] = useState(props.holdNote || "");
  const detailsRef=useRef<HTMLDetailsElement>(null);
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
  return <details ref={detailsRef} className={`admin-church-details${props.iconOnly||props.markTrigger?" is-icon-editor":""}${props.markTrigger?" is-mark-editor":""}`}><summary aria-label="교회 정보 및 공개 상태 관리">{props.markTrigger?(props.markTrigger.src?<img src={props.markTrigger.src} alt={props.markTrigger.alt}/>:<span className="church-admin-mark-fallback" aria-hidden="true">✝</span>):props.iconOnly?<span aria-hidden="true">✎</span>:<><span className="admin-church-details-open">정보 관리</span><span className="admin-church-details-close" aria-label="관리 화면 닫기">관리 닫기</span><b aria-hidden="true">⌄</b></>}</summary><form className="admin-edit-form" onSubmit={save}>
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
