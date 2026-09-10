"use client";

import { useEffect, useRef, useState } from "react";

const storageKey = "airchurch-theme";
const themes = [
  { id: "default", label: "기본", description: "신뢰감 있는 기본 보기" },
  { id: "calm", label: "편안한 보기", description: "눈부심을 낮춘 부드러운 보기" },
  { id: "contrast", label: "높은 대비", description: "글자와 버튼을 더 또렷하게" },
] as const;

type ThemeId = (typeof themes)[number]["id"];

function applyTheme(theme: ThemeId) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme === "contrast" ? "light" : "normal";
}

export default function ThemeSettings() {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeId>("default");
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey);
    const selected = themes.some(item => item.id === saved) ? saved as ThemeId : "default";
    setTheme(selected);
    applyTheme(selected);
  }, []);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    const closeOutside = (event: PointerEvent) => !panel.current?.contains(event.target as Node) && setOpen(false);
    window.addEventListener("keydown", closeOnEscape);
    document.addEventListener("pointerdown", closeOutside);
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      document.removeEventListener("pointerdown", closeOutside);
    };
  }, [open]);

  const selectTheme = (nextTheme: ThemeId) => {
    setTheme(nextTheme);
    applyTheme(nextTheme);
    window.localStorage.setItem(storageKey, nextTheme);
    setOpen(false);
  };

  return <div className="theme-settings" ref={panel}>
    <button className="theme-settings-trigger" type="button" aria-expanded={open} aria-controls="theme-settings-panel" onClick={() => setOpen(value => !value)}>
      <span aria-hidden="true">◐</span> 보기 설정
    </button>
    {open && <div id="theme-settings-panel" className="theme-settings-panel" role="dialog" aria-label="보기 설정">
      <strong>보기 설정</strong>
      <p>내 기기에서 다음 방문에도 유지됩니다.</p>
      <div role="radiogroup" aria-label="색상 테마">
        {themes.map(item => <button key={item.id} type="button" role="radio" aria-checked={theme === item.id} className={theme === item.id ? "is-selected" : ""} onClick={() => selectTheme(item.id)}>
          <span><b>{item.label}</b><small>{item.description}</small></span><i aria-hidden="true">{theme === item.id ? "✓" : ""}</i>
        </button>)}
      </div>
    </div>}
  </div>;
}
