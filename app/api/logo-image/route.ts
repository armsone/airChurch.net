import { database } from "../_shared";
import { churchImageUrls } from "../../church-images";
import { denominationImageUrls } from "../../denomination-images";

const registeredImages = new Set([...Object.values(churchImageUrls), ...Object.values(denominationImageUrls)]);
const imageTypes = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml", "image/x-icon", "image/vnd.microsoft.icon"]);

export async function GET(request: Request) {
  const source = new URL(request.url).searchParams.get("url");
  if (!source || source.length > 2000) return new Response(null, { status: 404 });
  // Only relay logos already used by the public directory, never arbitrary URLs.
  if (!registeredImages.has(source)) {
    const registered = await database().prepare("SELECT id FROM churches WHERE channel_image_url=? AND review_status='approved' LIMIT 1").bind(source).first();
    if (!registered) return new Response(null, { status: 404 });
  }
  try {
    const url = new URL(source);
    if (!/^https?:$/.test(url.protocol) || url.username || url.password || url.port || !/^[a-z0-9.-]+$/i.test(url.hostname) || !url.hostname.includes(".") || /(?:^|\.)(?:localhost|local|internal|test|invalid)$/.test(url.hostname) || /^[\d.]+$/.test(url.hostname)) return new Response(null, { status: 404 });
    const upstream = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(10_000), headers: { accept: "image/*", "user-agent": "airChurch-public-directory/1.0 (+https://airchurch.net)" } });
    const contentType = (upstream.headers.get("content-type") ?? "").split(";")[0].toLowerCase();
    if (!upstream.ok || !imageTypes.has(contentType) || Number(upstream.headers.get("content-length")) > 4_000_000 || !upstream.body) throw new Error(`invalid_logo_${upstream.status}_${contentType}`);
    const reader = upstream.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 4_000_000) { await reader.cancel(); throw new Error("logo_too_large"); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    return new Response(bytes, { headers: { "content-type": contentType, "cache-control": "public, max-age=86400, stale-while-revalidate=604800", "x-content-type-options": "nosniff", "content-security-policy": "default-src 'none'; sandbox" } });
  } catch (error) {
    console.warn("Logo image fetch failed", error instanceof Error ? error.message : "unknown_error");
    return new Response(null, { status: 502, headers: { "cache-control": "public, max-age=60" } });
  }
}
