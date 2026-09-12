"use client";

import { useEffect, useState } from "react";

type Counts = { now: number; today: number; views: number };
const formatCount = (value: number | undefined) => value === undefined ? "--" : String(value).padStart(2, "0");

export default function FooterVisitorCounts() {
  const [counts, setCounts] = useState<Counts | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let pending = false;
    const refresh = async () => {
      if (document.visibilityState !== "visible" || pending) return;
      pending = true;
      try {
        const response = await fetch("/api/analytics/summary", { signal: controller.signal });
        if (!response.ok) throw new Error("Visit counts unavailable");
        const value = await response.json() as Counts;
        if (![value.now, value.today, value.views].every(n => Number.isSafeInteger(n) && n >= 0)) throw new Error("Invalid visit counts");
        if (!controller.signal.aborted) setCounts(value);
      } catch {
        if (!controller.signal.aborted) setCounts(null);
      } finally {
        pending = false;
      }
    };
    void refresh();
    const interval = window.setInterval(refresh, 60_000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      controller.abort();
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  return <span className="footer-visitor-counts" aria-label="방문 통계">
    <span title="최근 5분 이내 활동한 방문자">Now({formatCount(counts?.now)})</span>{", "}
    <span title="오늘 방문자 · 한국 시간 기준">Today({formatCount(counts?.today)})</span>{", "}
    <span title="최근 90일 조회수 · 같은 방문자의 같은 페이지는 30분마다 1회 집계">Views({formatCount(counts?.views)})</span>
  </span>;
}
