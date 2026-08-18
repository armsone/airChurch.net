import { database, ensureSermonTables } from "../_shared";

export async function GET() {
  const db=database();
  await ensureSermonTables(db);
  const result=await db.prepare("SELECT id,name,pastor,region,denomination,youtube_channel_id AS youtubeChannelId FROM churches WHERE review_status='approved' ORDER BY priority_weight DESC,name LIMIT 300").all();
  return Response.json({items:result.results},{headers:{"cache-control":"public, max-age=300, s-maxage=300, stale-while-revalidate=1800"}});
}
