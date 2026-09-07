import { database, ensureAnalyticsTables, ensureMediaCollectionTables } from "../_shared";
import { refreshPopularityWeights } from "../_popularity";
import { POST as syncSermons } from "../sermons/sync/route";

export async function POST() {
  const db = database();
  await Promise.all([ensureAnalyticsTables(db), ensureMediaCollectionTables(db)]);
  const weights = await refreshPopularityWeights(db);
  await db.batch([
    db.prepare("UPDATE sync_state SET last_synced_at='2000-01-01 00:00:00' WHERE key IN ('youtube-v9-database:lease','youtube-v11-photo-pastors:lease')"),
  ]);
  const runs = [];
  for (const scope of ["database", "photo_pastors"] as const) {
    for (const start of [0, 20]) {
      const response = await syncSermons(new Request(`https://airchurch.internal/api/sermons/sync?scope=${scope}&start=${start}&limit=20`, { method: "POST" }));
      runs.push({ scope, start, result: await response.json() });
    }
  }
  return Response.json({ ok: true, weights, runs });
}
