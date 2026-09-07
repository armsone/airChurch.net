import { database, ensureAnalyticsTables, ensureMediaCollectionTables } from "../_shared";
import { refreshPopularityWeights } from "../_popularity";
import { POST as syncSermons } from "../sermons/sync/route";

export async function POST(request: Request) {
  const db = database();
  await Promise.all([ensureAnalyticsTables(db), ensureMediaCollectionTables(db)]);
  const weights = await refreshPopularityWeights(db);
  const url = new URL(request.url);
  const scope = url.searchParams.get("scope") === "photo_pastors" ? "photo_pastors" : "database";
  const start = Math.max(0, Number(url.searchParams.get("start") || 0));
  const lease = scope === "photo_pastors" ? "youtube-v11-photo-pastors:lease" : "youtube-v9-database:lease";
  await db.prepare("UPDATE sync_state SET last_synced_at='2000-01-01 00:00:00' WHERE key=?").bind(lease).run();
  const response = await syncSermons(new Request(`https://airchurch.internal/api/sermons/sync?scope=${scope}&start=${start}&limit=5`, { method: "POST" }));
  return Response.json({ ok: true, weights, scope, start, result: await response.json() });
}
