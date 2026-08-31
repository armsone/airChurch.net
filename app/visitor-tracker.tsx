"use client";

import { useEffect } from "react";

const VISITOR_KEY = "airchurch_visitor_id";

export default function VisitorTracker() {
  useEffect(() => {
    if (location.pathname.startsWith("/admin")) return;

    let visitorId = localStorage.getItem(VISITOR_KEY);
    if (!visitorId) {
      visitorId = crypto.randomUUID();
      localStorage.setItem(VISITOR_KEY, visitorId);
    }

    const reportActivity = () => {
      if (document.visibilityState !== "visible") return;
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
