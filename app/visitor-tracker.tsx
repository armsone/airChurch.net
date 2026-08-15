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

    const pageKey = `airchurch_viewed:${location.pathname}`;
    if (sessionStorage.getItem(pageKey)) return;
    sessionStorage.setItem(pageKey, "1");

    void fetch("/api/analytics/track", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        path: location.pathname,
        referrer: document.referrer,
        visitorId,
      }),
      keepalive: true,
    }).catch(() => null);
  }, []);

  return null;
}
