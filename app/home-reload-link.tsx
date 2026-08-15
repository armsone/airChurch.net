"use client";

import { MouseEvent, ReactNode } from "react";

export default function HomeReloadLink({ children, className, ariaLabel }: { children: ReactNode; className?: string; ariaLabel?: string }) {
  function reloadHome(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    event.stopPropagation();
    window.location.assign(`${window.location.origin}/`);
  }

  // A plain anchor plus location.assign intentionally forces a complete document reload.
  // eslint-disable-next-line @next/next/no-html-link-for-pages
  return <a className={className} href="/" aria-label={ariaLabel} onClick={reloadHome}>{children}</a>;
}
