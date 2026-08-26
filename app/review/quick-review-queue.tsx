"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export type QuickReviewChurch = {
  id: number;
  name: string;
  pastor: string;
  region: string;
  denomination: string;
  youtube_channel_id: string | null;
  homepage_url: string | null;
};

export type QuickReviewQueueProps = {
  todo: QuickReviewChurch[];
  total: number;
};

const concernReasons = [
  "교회 정보 다름",
  "목회자 정보 다름",
  "교단 확인 필요",
  "공식 채널 아님",
  "최근 활동 없음",
  "기타",
] as const;

async function saveReview(id: number, status: "confirmed" | "concern", note: string) {
  const response = await fetch("/api/admin/manage", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ kind: "church-review", id, status, note }),
  });
  const result = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) throw new Error(result.error || "검토 결과를 저장하지 못했습니다.");
}

export function QuickReviewQueue({ todo, total }: QuickReviewQueueProps) {
  const router = useRouter();
  const [queue, setQueue] = useState(todo);
  const [remaining, setRemaining] = useState(total);
  const [activeIndex, setActiveIndex] = useState(0);
  const [showConcern, setShowConcern] = useState(false);
  const [reason, setReason] = useState<(typeof concernReasons)[number] | "">("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [listQuery, setListQuery] = useState("");

  const current = queue[activeIndex];
  const hasReference = Boolean(current?.homepage_url || current?.youtube_channel_id);
  const upcoming = useMemo(() => {
    if (queue.length < 2) return [];
    return Array.from({ length: queue.length - 1 }, (_, offset) => queue[(activeIndex + offset + 1) % queue.length]).slice(0, 3);
  }, [activeIndex, queue]);
  const visibleQueue = useMemo(() => {
    const query=listQuery.trim().toLocaleLowerCase("ko-KR");
    if(!query) return queue;
    return queue.filter((church)=>`${church.name} ${church.pastor} ${church.region} ${church.denomination}`.toLocaleLowerCase("ko-KR").includes(query));
  },[listQuery,queue]);

  function resetConcern() {
    setShowConcern(false);
    setReason("");
    setNote("");
  }

  function movePast(id: number) {
    const next = queue.filter((church) => church.id !== id);
    setQueue(next);
    setRemaining((count) => Math.max(0, count - 1));
    setActiveIndex(next.length && activeIndex < next.length ? activeIndex : 0);
    resetConcern();
  }

  async function confirmCurrent() {
    if (!current || busy) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await saveReview(current.id, "confirmed", "");
      setSuccess(`${current.name}을(를) 문제 없음으로 저장했습니다.`);
      movePast(current.id);
      if(queue.length===1) window.setTimeout(()=>router.refresh(),300);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function submitConcern() {
    if (!current || busy) return;
    if (!reason) {
      setError("관리자가 빠르게 확인할 수 있도록 사유를 선택해 주세요.");
      return;
    }
    if (reason === "기타" && note.trim().length < 3) {
      setError("기타 사유를 3자 이상 적어 주세요.");
      return;
    }
    setBusy(true);
    setError("");
    setSuccess("");
    const reviewNote = note.trim() ? `${reason}\n${note.trim()}` : reason;
    try {
      await saveReview(current.id, "concern", reviewNote);
      setSuccess(`${current.name}의 관리자 확인 요청을 저장했습니다.`);
      movePast(current.id);
      if(queue.length===1) window.setTimeout(()=>router.refresh(),300);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function skipCurrent() {
    if (!current || busy) return;
    if(queue.length<2) {
      setError("");
      setSuccess(`${current.name}은(는) 저장하지 않았습니다. 시간이 될 때 다시 확인해 주세요.`);
      return;
    }
    setActiveIndex((index) => (index + 1) % queue.length);
    resetConcern();
    setError("");
    setSuccess(`${current.name}은(는) 건너뛰고 다음 교회를 보여드립니다.`);
  }

  function selectChurch(id:number) {
    const index=queue.findIndex((church)=>church.id===id);
    if(index<0) return;
    setActiveIndex(index);
    resetConcern();
    setError("");
    setSuccess(`${queue[index].name}을(를) 먼저 확인합니다.`);
    window.requestAnimationFrame(()=>document.getElementById("quick-review-title")?.scrollIntoView({behavior:"smooth",block:"start"}));
  }

  if (!current && remaining > 0) {
    return <section className="quick-review-queue is-loading" aria-live="polite"><p className="quick-review-kicker">다음 검토 준비</p><h2>다음 교회를 불러오고 있습니다</h2><p>잠시만 기다려 주세요.</p></section>;
  }

  if (!current) {
    return <section className="quick-review-queue is-complete" aria-labelledby="quick-review-title">
      <p className="quick-review-kicker">오늘의 빠른 검토</p>
      <h2 id="quick-review-title">검토할 교회가 없습니다</h2>
      <p>모든 교회 확인을 마쳤습니다. 보내신 의견은 아래에서 다시 볼 수 있습니다.</p>
      {success && <p className="admin-success" aria-live="polite">{success}</p>}
    </section>;
  }

  return <section className="quick-review-queue" aria-labelledby="quick-review-title">
    <header className="quick-review-header">
      <div><p className="quick-review-kicker">지금 확인할 교회</p><h2 id="quick-review-title">한 곳만 빠르게 확인해 주세요</h2></div>
      <strong aria-label={`검토할 교회 ${remaining}곳 남음`}>{remaining}곳 남음</strong>
    </header>

    <article className="quick-review-card" aria-busy={busy}>
      <div className="quick-review-church">
        <span>{current.region}</span>
        <h3>{current.name}</h3>
        <p>{current.pastor} · {current.denomination}</p>
        <div className="quick-review-sources">{current.homepage_url&&<a href={current.homepage_url} target="_blank" rel="noreferrer">공식 홈페이지 확인 ↗</a>}{current.youtube_channel_id && <a href={`https://www.youtube.com/channel/${current.youtube_channel_id}`} target="_blank" rel="noreferrer">공식 YouTube 확인 ↗</a>}</div>
        {!hasReference&&<p className="quick-review-source-warning">확인 자료가 없습니다. `관리자 확인 필요`로 알려 주세요.</p>}
      </div>

      <div className="quick-review-actions">
        <button type="button" disabled={busy||!hasReference} onClick={() => void confirmCurrent()} style={{ minHeight: 44 }}>문제 없음</button>
        <button type="button" className="concern" disabled={busy} aria-expanded={showConcern} aria-controls="quick-review-concern" onClick={() => { setShowConcern(true); setError(""); }} style={{ minHeight: 44 }}>관리자 확인 필요</button>
        <button type="button" className="skip" disabled={busy} onClick={skipCurrent} style={{ minHeight: 44 }}>나중에 하기</button>
      </div>

      {showConcern && <div className="quick-review-concern" id="quick-review-concern">
        <fieldset>
          <legend>확인이 필요한 이유</legend>
          <div className="quick-review-reasons">
            {concernReasons.map((item) => <button type="button" key={item} aria-pressed={reason === item} className={reason === item ? "is-selected" : ""} disabled={busy} onClick={() => { setReason(item); setError(""); }} style={{ minHeight: 44 }}>{item}</button>)}
          </div>
        </fieldset>
        <label htmlFor="quick-review-note">관리자에게 전할 내용 {reason !== "기타" && <small>· 선택</small>}</label>
        <textarea id="quick-review-note" value={note} maxLength={500} rows={3} disabled={busy} onChange={(event) => setNote(event.target.value)} placeholder="확인한 내용이나 다시 살펴볼 부분을 적어 주세요." />
        <div className="quick-review-concern-actions">
          <button type="button" disabled={busy} onClick={() => void submitConcern()} style={{ minHeight: 44 }}>{busy ? "저장 중…" : "관리자에게 보내기"}</button>
          <button type="button" disabled={busy} onClick={resetConcern} style={{ minHeight: 44 }}>취소</button>
        </div>
      </div>}
    </article>

    <div className="quick-review-message" aria-live="polite" aria-atomic="true">
      {success && <p className="admin-success">{success}</p>}
      {error && <p className="admin-error" role="alert">{error}</p>}
    </div>

    {upcoming.length > 0 && <aside className="quick-review-upcoming" aria-label="다음 검토 교회">
      <h3>다음 교회</h3>
      <ol>{upcoming.map((church) => <li key={church.id}><strong>{church.name}</strong><span>{church.pastor} · {church.region}</span></li>)}</ol>
    </aside>}

    <details className="quick-review-all">
      <summary><span><strong>전체 대기 목록</strong><small>목록에서 원하는 교회를 먼저 선택할 수 있습니다.</small></span><b>{queue.length}곳 보기</b></summary>
      <div className="quick-review-all-body">
        <label htmlFor="quick-review-list-search">대기 교회 검색</label>
        <input id="quick-review-list-search" type="search" value={listQuery} onChange={(event)=>setListQuery(event.target.value)} placeholder="교회명, 목사님, 지역, 교단 검색" />
        <p className="quick-review-list-count">{listQuery.trim()?`검색 결과 ${visibleQueue.length}곳`:`현재 대기 중인 ${queue.length}곳`}{remaining>queue.length?` · 전체 ${remaining}곳 중 표시` : ""}</p>
        <ul>{visibleQueue.map((church)=><li key={church.id}><button type="button" aria-current={church.id===current.id?"true":undefined} onClick={()=>selectChurch(church.id)}><span><strong>{church.name}</strong><small>{church.pastor} · {church.denomination}</small></span><em>{church.region}</em></button></li>)}</ul>
        {!visibleQueue.length&&<p className="admin-empty">검색 조건에 맞는 대기 교회가 없습니다.</p>}
      </div>
    </details>
  </section>;
}

export default QuickReviewQueue;
