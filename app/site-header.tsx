"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import HomeReloadLink from "./home-reload-link";
import SavedNavLink from "./saved-nav-link";

const menuItems = [["말씀", "/#sermons"], ["찬양", "/#praises"], ["찬양대회", "/praise-contest"], ["교회", "/#church-directory"], ["목회자", "/#pastor-directory"], ["행사", "/#events"], ["교계소식", "/#church-news"], ["선한 영향력", "/#community"], ["소개", "/#vision"]] as const;

export default function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const header = useRef<HTMLElement>(null), button = useRef<HTMLButtonElement>(null), panel = useRef<HTMLDivElement>(null);
  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    if (pathname !== "/") return;
    let stop = () => {};
    const followEventAnchor = () => {
      stop();
      if (window.location.hash !== "#events") return;
      const target = document.getElementById("events");
      const content = document.getElementById("site-content");
      if (!target || !content) return;
      // Keep the destination aligned while the preceding DB-backed sections load.
      const align = () => target.scrollIntoView({ block: "start", behavior: "instant" });
      const observer = new ResizeObserver(align);
      const userEvents = ["wheel", "touchstart", "pointerdown", "keydown"] as const;
      const timer = window.setTimeout(() => stop(), 20000);
      stop = () => {
        observer.disconnect();
        window.clearTimeout(timer);
        userEvents.forEach(event => window.removeEventListener(event, stop));
      };
      observer.observe(content);
      userEvents.forEach(event => window.addEventListener(event, stop, { passive: true, once: true }));
      align();
    };
    followEventAnchor();
    window.addEventListener("hashchange", followEventAnchor);
    return () => { stop(); window.removeEventListener("hashchange", followEventAnchor); };
  }, [pathname]);
  useEffect(() => {
    if (!open) return;
    panel.current?.querySelector<HTMLAnchorElement>("a")?.focus();
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); button.current?.focus(); } };
    const closeOutside = (event: PointerEvent) => { if (!header.current?.contains(event.target as Node)) setOpen(false); };
    const desktop = window.matchMedia("(min-width: 1101px)");
    const closeOnDesktop = () => { if (desktop.matches) setOpen(false); };
    window.addEventListener("keydown", closeOnEscape);
    document.addEventListener("pointerdown", closeOutside);
    desktop.addEventListener("change", closeOnDesktop);
    return () => { window.removeEventListener("keydown", closeOnEscape); document.removeEventListener("pointerdown", closeOutside); desktop.removeEventListener("change", closeOnDesktop); };
  }, [open]);
  const hrefFor = (href: string) => pathname === "/" && href.startsWith("/#") ? href.slice(1) : href;
  const navigation = menuItems.map(([label, href]) => <a key={href} href={hrefFor(href)} onClick={() => setOpen(false)}>{label}</a>);
  return <header className="site-header shared-site-header" ref={header}>
    <HomeReloadLink className="brand" ariaLabel="에어처치 첫 화면 새로 불러오기"><span className="brand-mark" aria-hidden="true"/><span>airchurch</span></HomeReloadLink>
    <nav className="shared-primary-nav" aria-label="주요 메뉴">{navigation}</nav>
    <nav className="header-admin-links" aria-label="운영 메뉴"><SavedNavLink/><a href="/about">운영 안내</a><a href="/contact">문의</a></nav>
    <button ref={button} className="mobile-menu-button" type="button" aria-expanded={open} aria-controls="mobile-site-menu" onClick={() => setOpen(value => !value)}><span aria-hidden="true">{open ? "×" : "☰"}</span>{open ? "닫기" : "메뉴"}</button>
    <div ref={panel} id="mobile-site-menu" className={`mobile-menu-panel${open ? " is-open" : ""}`} hidden={!open}>
      {navigation}<div className="mobile-menu-admin" onClick={() => setOpen(false)}><SavedNavLink/><a href="/about">운영 안내</a><a href="/contact">문의</a></div>
    </div>
  </header>;
}
