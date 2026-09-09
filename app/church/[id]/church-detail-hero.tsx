"use client";

import { ReactNode, useEffect, useState } from "react";
import type { LogoColor, LogoPalette } from "../../logo-palettes";
import { denominationMark } from "../../directory-cards";

type Rgb = LogoColor;

type LiturgicalSeason = {
  key: "advent" | "christmas" | "epiphany" | "lent" | "easter" | "pentecost" | "ordinary";
  name: string;
  christmasDays?: number;
};

const DAY = 24 * 60 * 60 * 1000;

function utcDate(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month, day));
}

function easterSunday(year: number) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  return utcDate(year, Math.floor((h + l - 7 * m + 114) / 31) - 1, (h + l - 7 * m + 114) % 31 + 1);
}

function koreaToday() {
  const [year, month, day] = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(new Date())
    .reduce<Record<string, string>>((parts, part) => ({ ...parts, [part.type]: part.value }), {});
  return utcDate(Number(year), Number(month) - 1, Number(day));
}

function currentSeason(today = koreaToday()): LiturgicalSeason {
  const year = today.getUTCFullYear();
  const christmas = utcDate(year, 11, 25);
  const firstAdventCandidate = utcDate(year, 10, 27);
  const advent = new Date(firstAdventCandidate.getTime() + ((7 - firstAdventCandidate.getUTCDay()) % 7) * DAY);
  const easter = easterSunday(year);
  const lent = new Date(easter.getTime() - 46 * DAY);
  const pentecost = new Date(easter.getTime() + 49 * DAY);
  const epiphany = utcDate(year, 0, 6);

  if (today.getUTCMonth() === 0 && today <= epiphany) return { key: "christmas", name: "성탄절" };
  if (today >= advent && today < christmas) return { key: "advent", name: "대림절", christmasDays: Math.round((christmas.getTime() - today.getTime()) / DAY) };
  if (today >= christmas) return { key: "christmas", name: "성탄절" };
  if (today >= lent && today < easter) return { key: "lent", name: "사순절" };
  if (today >= easter && today < pentecost) return { key: "easter", name: "부활절기" };
  if (today.getTime() === pentecost.getTime()) return { key: "pentecost", name: "성령강림절" };
  if (today > epiphany && today < lent) return { key: "epiphany", name: "주현절" };
  return { key: "ordinary", name: "일반절기" };
}

function previewSeason(key: string | null) {
  if (key === "advent") return currentSeason(utcDate(2026, 10, 29));
  if (key === "christmas") return currentSeason(utcDate(2026, 11, 25));
  return null;
}

function useCurrentSeason() {
  const [preview, setPreview] = useState<LiturgicalSeason | null>(null);
  useEffect(() => setPreview(previewSeason(new URLSearchParams(window.location.search).get("seasonPreview"))), []);
  return preview ?? currentSeason();
}

function cssRgb([red, green, blue]: Rgb, alpha?: number) {
  return alpha === undefined ? `rgb(${red} ${green} ${blue})` : `rgb(${red} ${green} ${blue} / ${alpha})`;
}

function shade([red, green, blue]: Rgb, amount: number): Rgb {
  return [red, green, blue].map((value) => Math.round(value + (amount < 0 ? value : 255 - value) * amount)) as Rgb;
}

function extractPalette(image: HTMLImageElement): LogoPalette | null {
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 32;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  context.drawImage(image, 0, 0, 32, 32);
  const pixels = context.getImageData(0, 0, 32, 32).data;
  const buckets = new Map<string, { color: Rgb; weight: number }>();
  for (let index = 0; index < pixels.length; index += 4) {
    const alpha = pixels[index + 3] / 255;
    const red = pixels[index];
    const green = pixels[index + 1];
    const blue = pixels[index + 2];
    const max = Math.max(red, green, blue);
    const min = Math.min(red, green, blue);
    const saturation = max === 0 ? 0 : (max - min) / max;
    if (alpha < 0.5 || (max > 248 && min > 238) || max < 28 || saturation < 0.12) continue;
    const color = [Math.round(red / 32) * 32, Math.round(green / 32) * 32, Math.round(blue / 32) * 32] as Rgb;
    const key = color.join(",");
    const weight = alpha * saturation * (0.45 + max / 255);
    const bucket = buckets.get(key);
    if (bucket) bucket.weight += weight;
    else buckets.set(key, { color, weight });
  }
  const colors = [...buckets.values()]
    .sort((a, b) => b.weight - a.weight)
    .map(({ color }) => color)
    .filter((color, index, all) => all.slice(0, index).every((previous) => Math.hypot(color[0] - previous[0], color[1] - previous[1], color[2] - previous[2]) > 55))
    .slice(0, 3);
  if (!colors.length) return null;
  while (colors.length < 3) colors.push(colors[colors.length - 1]);
  return { primary: colors[0], secondary: colors[1], accent: colors[2] };
}

function paletteStyle(palette: LogoPalette): React.CSSProperties {
  return {
    "--lake-swatch-primary": cssRgb(palette.primary),
    "--lake-swatch-secondary": cssRgb(palette.secondary),
    "--lake-swatch-accent": cssRgb(palette.accent),
    "--lake-primary": cssRgb(palette.primary, 0.46),
    "--lake-secondary": cssRgb(palette.secondary, 0.48),
    "--lake-accent": cssRgb(palette.accent, 0.44),
    "--lake-highlight": cssRgb(shade(palette.primary, 0.34), 0.31),
  } as React.CSSProperties;
}

function SeasonLabel({ season }: { season: LiturgicalSeason }) {
  return <div className="liturgical-season" aria-label={season.christmasDays === undefined ? `현재 ${season.name}` : `현재 ${season.name}, 성탄절까지 ${season.christmasDays}일`}><span>{season.name}</span>{season.christmasDays !== undefined && <strong>성탄절까지 D-{season.christmasDays}</strong>}</div>;
}

export default function ChurchDetailHero({ image, publicId, name, pastor, region, denomination, primaryPerson, children }: { image: string | null; publicId: number; name: string; pastor: string; region: string; denomination: string; primaryPerson: { public_id: number } | undefined; children: ReactNode }) {
  const activePalette = useLogoPalette(image, denominationMark(denomination)?.src ?? null);
  const season = useCurrentSeason();
  return <section className={`church-detail-hero season-${season.key}${activePalette ? " has-logo-palette" : ""}`} style={activePalette ? paletteStyle(activePalette) : undefined} id="primary-content" tabIndex={-1}><SeasonLabel season={season}/><div className="church-detail-identity">{image ? <img src={image} alt="" width={96} height={96} loading="eager" decoding="async" referrerPolicy="no-referrer" /> : <span aria-hidden="true">교회</span>}<div><small>확인된 공식 정보</small><h1>{name}</h1><p><a className="church-pastor-profile-link" href={primaryPerson ? `/pastors/${primaryPerson.public_id}` : `/church/${publicId}`}>{pastor} 목회 기록 보기 →</a> · {region} · {denomination}</p></div></div><div className="church-detail-actions">{children}</div></section>;
}

function useLogoPalette(image: string | null, fallbackImage: string | null) {
  const [palette, setPalette] = useState<LogoPalette | null>(null);
  useEffect(() => {
    let cancelled = false;
    setPalette(null);
    const sources = [...new Set([image, fallbackImage].filter((value): value is string => Boolean(value)))];
    async function extract() {
      for (const source of sources) {
        if (cancelled) return;
        try {
          const logo = new Image();
          logo.src = source.startsWith("/") && !source.startsWith("//") ? source : `/api/logo-image?url=${encodeURIComponent(source)}`;
          await logo.decode();
          const extracted = extractPalette(logo);
          if (extracted) { if (!cancelled) setPalette(extracted); return; }
        } catch { /* If the logo cannot load, extract from the actual denomination logo. */ }
      }
    }
    void extract();
    return () => { cancelled = true; };
  }, [image, fallbackImage]);
  return palette;
}

export function LogoPaletteSection({ image, fallbackImage = null, className, children }: { image: string | null; fallbackImage?: string | null; className: string; children: ReactNode }) {
  const activePalette = useLogoPalette(image, fallbackImage);
  const season = useCurrentSeason();
  return <section className={`${className} season-${season.key}${activePalette ? " has-logo-palette" : ""}`} style={activePalette ? paletteStyle(activePalette) : undefined}><SeasonLabel season={season}/>{children}</section>;
}
