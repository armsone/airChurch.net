import { database, ensureSermonTables } from "../_shared";
export async function GET() {
  const db=database(); await ensureSermonTables(db);
  const result=await db.prepare("SELECT s.youtube_id AS youtubeId, s.title, s.thumbnail_url AS thumbnailUrl, s.published_at AS publishedAt, c.name AS church, c.pastor, c.region, c.denomination FROM sermons s JOIN churches c ON c.id=s.church_id WHERE c.review_status='approved' ORDER BY s.published_at DESC LIMIT 30").all();
  return Response.json({items:result.results},{headers:{"cache-control":"public, max-age=300"}});
}
