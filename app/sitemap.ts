import type { MetadataRoute } from "next";
import { database, ensureSermonTables } from "./api/_shared";

type ChurchSitemapRow = { id: number; created_at: string };

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const db = database();
  await ensureSermonTables(db);
  const churches = await db.prepare("SELECT id,created_at FROM churches WHERE review_status='approved' ORDER BY id").all<ChurchSitemapRow>();
  const staticPages: MetadataRoute.Sitemap = [
    { url: "https://airchurch.net", changeFrequency: "hourly", priority: 1 },
    { url: "https://airchurch.net/about", changeFrequency: "monthly", priority: 0.6 },
    { url: "https://airchurch.net/community-guidelines", changeFrequency: "monthly", priority: 0.4 },
    { url: "https://airchurch.net/contact", changeFrequency: "monthly", priority: 0.3 },
    { url: "https://airchurch.net/privacy", changeFrequency: "yearly", priority: 0.2 },
    { url: "https://airchurch.net/terms", changeFrequency: "yearly", priority: 0.2 },
    { url: "https://airchurch.net/copyright", changeFrequency: "yearly", priority: 0.2 },
  ];
  return [
    ...staticPages,
    ...churches.results.map((church) => ({
      url: `https://airchurch.net/church/${church.id}`,
      lastModified: new Date(`${church.created_at.replace(" ", "T")}Z`),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
