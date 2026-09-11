import logos from "../../data/news-source-logos.json";

const publisherLogos: Record<string, { path: string }> = logos;
export function newsLogoUrl(source: string, fallback = "") {
  return publisherLogos[source]?.path || fallback;
}
