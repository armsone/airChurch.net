"use client";

import { useState } from "react";

type AdminListSearchProps = {
  targetId: string;
  total: number;
  label: string;
  placeholder: string;
  initialLimit?: number;
};

export default function AdminListSearch({ targetId, total, label, placeholder, initialLimit }: AdminListSearchProps) {
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(initialLimit ? Math.min(initialLimit,total) : total);

  function filterList(value: string) {
    setQuery(value);
    const needle = value.trim().toLocaleLowerCase("ko-KR");
    const list = document.getElementById(targetId);
    let matches = 0;

    list?.querySelectorAll<HTMLElement>("[data-admin-search]").forEach((item) => {
      const searchableText = item.dataset.adminSearch?.toLocaleLowerCase("ko-KR") ?? "";
      const isVisible = needle ? searchableText.includes(needle) : initialLimit ? item.dataset.adminPreview === "true" : true;
      item.hidden = !isVisible;
      if (isVisible) matches += 1;
    });

    setVisibleCount(list ? matches : total);
  }

  return <div className="admin-list-search" role="search">
    <label>
      <span className="sr-only">{label}</span>
      <input
        type="search"
        value={query}
        onChange={(event) => filterList(event.target.value)}
        placeholder={placeholder}
        aria-controls={targetId}
      />
    </label>
    <span className="admin-search-count" aria-live="polite">{visibleCount}/{total}</span>
  </div>;
}
