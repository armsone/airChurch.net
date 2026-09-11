"use client";

import { useState } from "react";
import { newsLogoUrl } from "./news-logo";

export default function NewsMark({ source, markUrl }: { source: string; markUrl?: string }) {
  const src = newsLogoUrl(source, markUrl);
  const [failedSrc, setFailedSrc] = useState<string>();
  return <span className="church-news-mark">
    {src && failedSrc !== src
      ? <img src={src} alt="" loading="lazy" onError={() => setFailedSrc(src)} />
      : <span className="news-mark-fallback">{source}</span>}
  </span>;
}
