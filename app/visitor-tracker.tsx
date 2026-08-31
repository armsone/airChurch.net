"use client";

import { useEffect } from "react";

const VISITOR_KEY = "airchurch_visitor_id";
const VISITOR_ID_MAX_AGE=30*24*60*60*1000;

export default function VisitorTracker() {
  useEffect(() => {
    if (location.pathname.startsWith("/admin")) return;
    if (navigator.doNotTrack === "1") return;

    let visitorId: string | null = null;
    try {
      const saved=JSON.parse(localStorage.getItem(VISITOR_KEY)||"null") as {id?:unknown;createdAt?:unknown}|null;
      if(saved&&typeof saved.id==="string"&&typeof saved.createdAt==="number"&&Date.now()-saved.createdAt<VISITOR_ID_MAX_AGE)visitorId=saved.id;
    } catch { /* 이전 형식이나 손상된 값은 새 임시 식별자로 교체합니다. */ }
    if (!visitorId) {
      visitorId = crypto.randomUUID();
      try { localStorage.setItem(VISITOR_KEY, JSON.stringify({id:visitorId,createdAt:Date.now()})); } catch { /* 방문 기록 전송 자체는 계속할 수 있습니다. */ }
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
