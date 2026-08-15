import { database, ensurePraiseTables, ensureSermonTables } from "../_shared";

export async function GET() {
  const db = database();
  await Promise.all([ensureSermonTables(db), ensurePraiseTables(db)]);
  const rows = await db.prepare("SELECT p.youtube_id AS youtubeId,p.title,p.thumbnail_url AS thumbnailUrl,p.published_at AS publishedAt,c.name AS church,c.pastor,c.region,c.denomination FROM praise_videos p JOIN churches c ON c.id=p.church_id WHERE c.review_status='approved' AND p.status='published' ORDER BY p.published_at DESC LIMIT 12").all<{ youtubeId: string; title: string; thumbnailUrl: string; publishedAt: string; church: string; pastor: string; region: string; denomination: string }>();
  return Response.json({ items: rows.results }, { headers: { "cache-control": "public, max-age=300" } });
}
