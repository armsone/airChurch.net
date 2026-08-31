"use client";

import { useEffect } from "react";

const VISITOR_KEY = "airchurch_visitor_id";

export default function VisitorTracker() {
  useEffect(() => {
    if (location.pathname.startsWith("/admin")) return;
    if (navigator.doNotTrack === "1") return;

    let visitorId: string | null = null;
    try { visitorId = localStorage.getItem(VISITOR_KEY); } catch { /* 저장 차단 환경은 일회성 식별자를 씁니다. */ }
    if (!visitorId) {
      visitorId = crypto.randomUUID();
      try { localStorage.setItem(VISITOR_KEY, visitorId); } catch { /* 방문 기록 전송 자체는 계속할 수 있습니다. */ }
    }

    let lastReportedAt=0;
    const reportActivity = () => {
      if (document.visibilityState !== "visible") return;
      if(Date.now()-lastReportedAt<300_000)return;
      lastReportedAt=Date.now();
      void fetch("/api/analytics/track", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ path: location.pathname, referrer: document.referrer, visitorId }),
        keepalive: true,
      }).catch(() => null);
    };
    const initialReport = window.setTimeout(reportActivity, 1_500);
    const interval = window.setInterval(reportActivity, 300_000);
    document.addEventListener("visibilitychange", reportActivity);
    return () => {
      window.clearTimeout(initialReport);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", reportActivity);
    };
  }, []);

  return null;
}
