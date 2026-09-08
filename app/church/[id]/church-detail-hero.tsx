"use client";

import { ReactNode, useEffect, useState } from "react";
import type { LogoColor, LogoPalette } from "../../logo-palettes";
import { denominationMark } from "../../directory-cards";

type Rgb = LogoColor;

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
    "--lake-primary": cssRgb(palette.primary, 0.78),
    "--lake-secondary": cssRgb(palette.secondary, 0.80),
    "--lake-accent": cssRgb(palette.accent, 0.75),
    "--lake-highlight": cssRgb(shade(palette.primary, 0.34), 0.51),
  } as React.CSSProperties;
}

export default function ChurchDetailHero({ image, publicId, name, pastor, region, denomination, primaryPerson, children }: { image: string | null; publicId: number; name: string; pastor: string; region: string; denomination: string; primaryPerson: { public_id: number } | undefined; children: ReactNode }) {
  const activePalette = useLogoPalette(image, denominationMark(denomination)?.src ?? null);
  return <section className={`church-detail-hero${activePalette ? " has-logo-palette" : ""}`} style={activePalette ? paletteStyle(activePalette) : undefined} id="primary-content" tabIndex={-1}><div className="church-detail-identity">{image ? <img src={image} alt="" width={96} height={96} loading="eager" decoding="async" referrerPolicy="no-referrer" /> : <span aria-hidden="true">교회</span>}<div><small>확인된 공식 정보</small><h1>{name}</h1><p><a className="church-pastor-profile-link" href={primaryPerson ? `/pastors/${primaryPerson.public_id}` : `/church/${publicId}`}>{pastor} 목회 기록 보기 →</a> · {region} · {denomination}</p></div></div><div className="church-detail-actions">{children}</div></section>;
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
  return <section className={`${className}${activePalette ? " has-logo-palette" : ""}`} style={activePalette ? paletteStyle(activePalette) : undefined}>{children}</section>;
}
