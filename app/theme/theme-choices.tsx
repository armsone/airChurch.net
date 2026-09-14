"use client";

import { useState, type CSSProperties } from "react";
import type { SiteThemeId } from "../site-theme";

type Theme = {
  id: SiteThemeId;
  name: string;
  description: string;
  colors: readonly string[];
  palette: { green: string; greenText: string; coral: string; paper: string; text: string };
};

export default function ThemeChoices({ themes, selected, canManage, settingsAvailable }: { themes: readonly Theme[]; selected: SiteThemeId | null; canManage: boolean; settingsAvailable: boolean }) {
  const [active, setActive] = useState<SiteThemeId | null>(selected);
  const [pending, setPending] = useState<SiteThemeId | null>(null);
  const [message, setMessage] = useState("");

  async function chooseTheme(theme: SiteThemeId) {
    setPending(theme);
    setMessage("");
    try {
      const response = await fetch("/api/site-theme", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ theme }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "테마를 저장하지 못했습니다.");
      setActive(theme);
      setMessage(`${themes.find((item) => item.id === theme)?.name} 테마를 적용했습니다.`);
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "테마를 저장하지 못했습니다.");
    } finally {
      setPending(null);
    }
  }

  return <>
    <div className="theme-options" aria-label="에어처치 색상 테마">
      {themes.map((theme) => <article className={`theme-option${active === theme.id ? " is-active" : ""}`} key={theme.id}>
        <div className="theme-option-head"><div><span className="theme-option-kicker">{theme.id === "everyday" ? "ALL YEAR" : theme.id.toUpperCase()}</span><h2>{theme.name}</h2></div>{active === theme.id && <span className="theme-active-badge">현재 적용</span>}</div>
        <p className="theme-description">{theme.description}</p>
        <div className="theme-mini-preview" style={{ "--theme-green": theme.palette.green, "--theme-green-text": theme.palette.greenText, "--theme-coral": theme.palette.coral, "--theme-paper": theme.palette.paper, "--theme-text": theme.palette.text } as CSSProperties}>
          <div className="theme-mini-header"><b>에어처치</b><span>말씀　 교회　 메뉴</span></div>
          <div className="theme-mini-body"><span>말씀과 교회를 한곳에서</span><strong>사람과 교회를 잇는<br />크리스천 포털</strong><i>오늘의 말씀</i></div>
        </div>
        <div className="theme-swatches" aria-label={`${theme.name} 색상표`}>{theme.colors.map((color) => <span key={color} style={{ backgroundColor: color }} title={color}><span className="sr-only">{color}</span></span>)}</div>
        <div className="theme-option-foot"><span>{theme.colors.join(" · ")}</span>{canManage && <button type="button" aria-pressed={active === theme.id} onClick={() => chooseTheme(theme.id)} disabled={pending !== null || active === theme.id || !settingsAvailable}>{pending === theme.id ? "저장 중…" : active === theme.id ? "현재 적용" : "이 테마 선택"}</button>}</div>
      </article>)}
    </div>
    {!settingsAvailable && <p className="theme-unavailable" role="status">테마 설정 상태를 확인하지 못했습니다. 화면은 기본 색상으로 보이지만, 저장된 테마가 무엇인지는 확인할 수 없습니다.</p>}
    <p className="theme-status" role="status" aria-live="polite">{message}</p>
  </>;
}
