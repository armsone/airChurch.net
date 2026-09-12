import { database, ensureAnalyticsTables } from "../../_shared";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = database();
    await ensureAnalyticsTables(db);
    const counts = await db.prepare(`SELECT
      (SELECT COUNT(*) FROM visitor_activity WHERE last_seen >= datetime('now','-5 minutes')) AS now,
      (SELECT COUNT(*) FROM visitor_activity WHERE last_seen >= datetime('now','+9 hours','start of day','-9 hours')) AS today,
      (SELECT COUNT(*) FROM page_views WHERE created_at >= datetime('now','+9 hours','start of day','-9 hours')) AS views
    `).first<{ now: number; today: number; views: number }>();
    if (!counts) throw new Error("Visit counts unavailable");
    return Response.json(counts, { headers: { "cache-control": "public, max-age=30, s-maxage=30" } });
  } catch {
    return Response.json({ error: "방문 통계를 불러오지 못했습니다." }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
