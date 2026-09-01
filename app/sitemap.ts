import type { MetadataRoute } from "next";
import { database, ensureMinistryProfileTables, ensureSermonTables } from "./api/_shared";

type ChurchSitemapRow = { id: number; created_at: string };
type MinisterSitemapRow = { id:number; church_id:number; updated_at:string };

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const db = database();
  await Promise.all([ensureSermonTables(db),ensureMinistryProfileTables(db)]);
  const [churches,ministers] = await Promise.all([
    db.prepare("SELECT id,created_at FROM churches WHERE review_status='approved' ORDER BY id").all<ChurchSitemapRow>(),
    db.prepare("SELECT m.id,m.church_id,m.updated_at FROM church_ministry_profiles m JOIN churches c ON c.id=m.church_id WHERE m.review_status='approved' AND c.review_status='approved' ORDER BY m.id").all<MinisterSitemapRow>(),
  ]);
  const staticPages: MetadataRoute.Sitemap = [
    { url: "https://airchurch.net", changeFrequency: "hourly", priority: 1 },
    { url: "https://airchurch.net/pastors", changeFrequency: "daily", priority: 0.75 },
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
    ...churches.results.map((church) => ({
      url: `https://airchurch.net/pastors/${church.id}`,
      lastModified: new Date(`${church.created_at.replace(" ", "T")}Z`),
      changeFrequency: "weekly" as const,
      priority: 0.55,
    })),
    ...ministers.results.map((minister)=>({
      url:`https://airchurch.net/pastors/${minister.church_id}?minister=${minister.id}`,
      lastModified:new Date(`${minister.updated_at.replace(" ","T")}Z`),
      changeFrequency:"weekly" as const,
      priority:0.5,
    })),
  ];
}
