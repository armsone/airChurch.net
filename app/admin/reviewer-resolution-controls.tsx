"use client";

import { FormEvent, useState } from "react";

type Resolution = "kept_public" | "held" | "needs_follow_up" | "deleted";
type ExpandedAction = "held" | "needs_follow_up" | null;

type ReviewerResolutionControlsProps = {
  churchId: number;
  churchStatus: string;
  opinions: { id: number; reviewedAt: string }[];
  existingNote?: string | null;
  existingHoldReason?: string | null;
  existingHoldNote?: string | null;
};

const holdReasons = [
  ["rights_request", "저작권·개인정보·권리자 요청"],
  ["youtube_unavailable", "공식 YouTube 확인 불가"],
  ["inactive", "최근 180일 업로드 없음"],
  ["info_unverified", "교회 정보 재확인 필요"],
  ["review_needed", "운영상 재검토"],
  ["other", "기타"],
] as const;

export default function ReviewerResolutionControls({
  churchId,
  churchStatus,
  opinions,
  existingNote,
  existingHoldReason,
  existingHoldNote,
}: ReviewerResolutionControlsProps) {
  const isHeld = churchStatus === "removed";
  const [expandedAction, setExpandedAction] = useState<ExpandedAction>(null);
  const [holdReason, setHoldReason] = useState(existingHoldReason || "review_needed");
  const [adminNote, setAdminNote] = useState(existingNote ?? existingHoldNote ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const panelId = `reviewer-resolution-${churchId}`;

  async function submitResolution(resolution: Resolution) {
    if (!opinions.length) {
      setError("처리할 목사님 의견을 찾지 못했습니다. 화면을 새로 고쳐 주세요.");
      return;
    }
    if ((resolution === "held" || resolution === "needs_follow_up") && adminNote.trim().length < 3) {
      setError(resolution === "held" ? "보류 근거를 3자 이상 적어 주세요." : "추가로 확인할 내용을 3자 이상 적어 주세요.");
      return;
    }
    if (resolution === "held" && !holdReason) {
      setError("보류 사유를 선택해 주세요.");
      return;
    }

    const confirmation = resolution === "kept_public"
      ? isHeld
        ? "이 교회를 다시 공개하고, 표시된 목사님 의견을 모두 처리 완료할까요? 숨겨진 설교는 자동으로 공개되지 않습니다."
        : "이 교회의 공개 상태를 유지하고, 표시된 목사님 의견을 모두 처리 완료할까요?"
      : resolution === "held"
        ? isHeld
          ? "이 교회의 보류 상태를 유지하고, 표시된 목사님 의견을 모두 처리 완료할까요?"
          : "이 교회를 보류하고, 표시된 목사님 의견을 모두 처리 완료할까요? 관련 설교도 함께 숨겨집니다."
        : resolution === "deleted"
          ? "이 교회를 삭제 처리할까요? 표시된 목사님 의견도 함께 처리 완료되며, 관련 설교와 찬양 영상이 모두 숨겨집니다. 이 작업은 되돌릴 수 없습니다."
          : "표시된 목사님 의견을 추가 확인이 필요한 상태로 남길까요? 검토 대기 목록에서 계속 확인할 수 있습니다.";
    if (!window.confirm(confirmation)) return;

    setBusy(true);
    setError("");
    setStatusMessage("저장하고 있습니다.");
    try {
      const response = await fetch("/api/admin/manage", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "church-review-resolution",
          id: churchId,
          opinions,
          resolution,
          ...(resolution === "held" ? { holdReason } : {}),
          ...((resolution === "held" || resolution === "needs_follow_up") ? { adminNote: adminNote.trim() } : {}),
        }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(result.error || "처리 결과를 저장하지 못했습니다.");
      setStatusMessage("저장했습니다. 화면을 새로 고칩니다.");
      window.location.reload();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "처리 결과를 저장하지 못했습니다.");
      setStatusMessage("");
      setBusy(false);
    }
  }

  function openAction(action: Exclude<ExpandedAction, null>) {
    setError("");
    setStatusMessage("");
    setExpandedAction((current) => current === action ? null : action);
  }

  function submitExpanded(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (expandedAction) void submitResolution(expandedAction);
  }

  return <div className="reviewer-resolution-controls">
    <div className="admin-action-row reviewer-resolution-actions">
      <button
        className="restore"
        disabled={busy}
        onClick={() => void submitResolution("kept_public")}
        style={{ minHeight: 44 }}
        type="button"
      >공개</button>
      <button
        aria-controls={panelId}
        aria-expanded={expandedAction === "held"}
        className="danger"
        disabled={busy}
        onClick={() => openAction("held")}
        style={{ minHeight: 44 }}
        type="button"
      >보류</button>
      <button
        aria-controls={panelId}
        aria-expanded={expandedAction === "needs_follow_up"}
        disabled={busy}
        onClick={() => openAction("needs_follow_up")}
        style={{ minHeight: 44 }}
        type="button"
      >재검토</button>
      <button
        className="danger"
        disabled={busy}
        onClick={() => void submitResolution("deleted")}
        style={{ minHeight: 44 }}
        type="button"
      >삭제</button>
    </div>

    {expandedAction && <form className="reviewer-resolution-form" id={panelId} onSubmit={submitExpanded}>
      {expandedAction === "held" && <label className="admin-note-field">
        <span>보류 사유</span>
        <select value={holdReason} onChange={(event) => setHoldReason(event.target.value)} disabled={busy} required>
          {holdReasons.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>}
      <label className="admin-note-field">
        <span>{expandedAction === "held" ? "보류 근거" : "추가로 확인할 내용"} <small>· 필수</small></span>
        <textarea
          disabled={busy}
          maxLength={500}
          onChange={(event) => setAdminNote(event.target.value)}
          placeholder={expandedAction === "held" ? "확인한 근거와 다시 검토할 내용을 적어 주세요." : "누가 무엇을 더 확인해야 하는지 적어 주세요."}
          required
          rows={3}
          value={adminNote}
        />
      </label>
      <div className="admin-action-row">
        <button className={expandedAction === "held" ? "danger" : "restore"} disabled={busy} style={{ minHeight: 44 }} type="submit">
          {expandedAction === "held" ? "보류로 저장" : "재검토로 저장"}
        </button>
        <button disabled={busy} onClick={() => setExpandedAction(null)} style={{ minHeight: 44 }} type="button">취소</button>
      </div>
    </form>}

    <div aria-live="polite" aria-atomic="true">
      {statusMessage && <p className="admin-held-at">{statusMessage}</p>}
      {error && <p className="admin-error" role="alert">{error}</p>}
    </div>
  </div>;
}
