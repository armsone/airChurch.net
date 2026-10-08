import type { database } from "./_shared";

type PopularityRow = { id: number };
type PastorPopularityRow = { pastorId: number };

const rankWeight = (rank: number) => rank <= 10 ? 3 : rank <= 40 ? 2 : 1;

/** Refreshes media collection priority from the last seven days of anonymous visits. */
export async function refreshPopularityWeights(db: ReturnType<typeof database>) {
  // Public media reads can start three collection scopes in multiple isolates.
  // Share the existing five-minute refresh interval in D1, not just in memory.
  const now=new Date().toISOString();
  const claim=await db.prepare("INSERT INTO sync_state(key,last_synced_at) VALUES('popularity-weights-v1',?) ON CONFLICT(key) DO UPDATE SET last_synced_at=excluded.last_synced_at WHERE sync_state.last_synced_at<?").bind(now,new Date(Date.now()-5*60000).toISOString()).run();
  if(Number(claim.meta.changes)!==1)return {churchCount:0,pastorCount:0,skipped:"fresh"};
  try{
  const [churches, pastors] = await Promise.all([
    db.prepare(`
      SELECT c.id
      FROM page_views v
      JOIN churches c ON v.path = '/church/' || COALESCE(c.public_id, 1000000 + c.id)
      WHERE v.created_at >= datetime('now', '-7 days')
        AND c.review_status = 'approved'
      GROUP BY c.id, c.name
      ORDER BY COUNT(DISTINCT v.visitor_hash) DESC, COUNT(*) DESC, c.name
      LIMIT 40
    `).all<PopularityRow>(),
    db.prepare(`
      SELECT p.id AS pastorId
      FROM page_views v
      JOIN pastor_people p ON v.path = '/pastors/' || COALESCE(p.public_id, 1000000 + p.id)
      WHERE v.created_at >= datetime('now', '-7 days')
        AND p.review_status = 'approved'
      GROUP BY p.id, p.name
      ORDER BY COUNT(DISTINCT v.visitor_hash) DESC, COUNT(*) DESC, p.name
      LIMIT 40
    `).all<PastorPopularityRow>(),
  ]);

  const statements = [
    db.prepare("UPDATE churches SET priority_weight=1 WHERE priority_weight<4 AND priority_weight<>1"),
    ...churches.results.map((row, index) => db.prepare("UPDATE churches SET priority_weight=MAX(priority_weight,?) WHERE id=? AND review_status='approved' AND priority_weight<?").bind(rankWeight(index + 1), row.id,rankWeight(index + 1))),
    ...pastors.results.map((row, index) => db.prepare(`
      UPDATE churches
      SET priority_weight=MAX(priority_weight,?)
      WHERE id IN (
        SELECT church_id
        FROM pastor_church_roles
        WHERE pastor_id=? AND review_status='approved' AND church_id IS NOT NULL
      ) AND review_status='approved' AND priority_weight<?
    `).bind(rankWeight(index + 1), row.pastorId,rankWeight(index + 1))),
  ];
  const writes=await db.batch(statements);
  console.info("popularity_weights_refreshed",{churchCount:churches.results.length,pastorCount:pastors.results.length,rowsWritten:writes.reduce((total,result)=>total+Number(result.meta.rows_written||0),0),queryDurationMs:Number(churches.meta.duration||0)+Number(pastors.meta.duration||0)+writes.reduce((total,result)=>total+Number(result.meta.duration||0),0)});
  return { churchCount: churches.results.length, pastorCount: pastors.results.length };
  }catch(error){
    // Failed calculations must be eligible again; never clear a newer claim.
    await db.prepare("DELETE FROM sync_state WHERE key='popularity-weights-v1' AND last_synced_at=?").bind(now).run().catch(()=>undefined);
    throw error;
  }
}
