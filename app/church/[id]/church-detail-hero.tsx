"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import type { LogoColor, LogoPalette } from "../../logo-palettes";
import { churchLogoPalettes, denominationLogoPalettes } from "../../logo-palettes";

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
    "--church-hero-start": cssRgb(shade(palette.primary, -0.56)),
    "--church-hero-end": cssRgb(shade(palette.primary, -0.32)),
    "--church-hero-glow": cssRgb(palette.secondary, 0.3),
    "--church-hero-accent": cssRgb(palette.accent, 0.24),
  } as React.CSSProperties;
}

export default function ChurchDetailHero({ image, publicId, name, pastor, region, denomination, primaryPerson, palette, children }: { image: string | null; publicId: number; name: string; pastor: string; region: string; denomination: string; primaryPerson: { public_id: number } | undefined; palette?: LogoPalette; children: ReactNode }) {
  const imageRef = useRef<HTMLImageElement>(null);
  const [activePalette, setActivePalette] = useState<LogoPalette | null>(palette ?? churchLogoPalettes[name] ?? denominationLogoPalettes[denomination] ?? null);
  useEffect(() => {
    const imageElement = imageRef.current;
    if (!imageElement) return;
    const updateColor = () => {
      try {
        const extracted = extractPalette(imageElement);
        if (extracted) setActivePalette(extracted);
      } catch { /* CORS가 허용되지 않으면 사전 팔레트를 유지합니다. */ }
    };
    if (imageElement.complete) updateColor();
    else imageElement.addEventListener("load", updateColor);
    return () => imageElement.removeEventListener("load", updateColor);
  }, [image]);
  return <section className={`church-detail-hero${activePalette ? " has-logo-palette" : ""}`} style={activePalette ? paletteStyle(activePalette) : undefined} id="primary-content" tabIndex={-1}><div className="church-detail-identity">{image ? <img ref={imageRef} src={image} alt="" width={96} height={96} loading="eager" decoding="async" referrerPolicy="no-referrer" /> : <span aria-hidden="true">교회</span>}<div><small>확인된 공식 정보</small><h1>{name}</h1><p><a className="church-pastor-profile-link" href={primaryPerson ? `/pastors/${primaryPerson.public_id}` : `/church/${publicId}`}>{pastor} 목회 기록 보기 →</a> · {region} · {denomination}</p></div></div><div className="church-detail-actions">{children}</div></section>;
}

export function LogoPaletteSection({ image, className, palette, children }: { image: string | null; className: string; palette?: LogoPalette; children: ReactNode }) {
  const imageRef = useRef<HTMLImageElement>(null);
  const fallbackPalette = image?.includes("kwangsung") ? churchLogoPalettes["거룩한빛광성교회"] : image?.includes("gocheok") ? denominationLogoPalettes["대한예수교장로회 통합"] : image?.includes("prok") ? denominationLogoPalettes["한국기독교장로회"] : image?.includes("kmc") ? denominationLogoPalettes["기독교대한감리회"] : image?.includes("koreabaptist") ? denominationLogoPalettes["기독교한국침례회"] : null;
  const [activePalette, setActivePalette] = useState<LogoPalette | null>(palette ?? fallbackPalette);
  useEffect(() => {
    const imageElement = imageRef.current;
    if (!imageElement) return;
    const updateColor = () => {
      try {
        const extracted = extractPalette(imageElement);
        if (extracted) setActivePalette(extracted);
      } catch { /* CORS가 허용되지 않으면 사전 팔레트를 유지합니다. */ }
    };
    if (imageElement.complete) updateColor();
    else imageElement.addEventListener("load", updateColor);
    return () => imageElement.removeEventListener("load", updateColor);
  }, [image]);
  return <section className={`${className}${activePalette ? " has-logo-palette" : ""}`} style={activePalette ? paletteStyle(activePalette) : undefined}>{image && <img ref={imageRef} className="logo-palette-source" src={image} alt="" crossOrigin="anonymous" referrerPolicy="no-referrer" />}{children}</section>;
}
