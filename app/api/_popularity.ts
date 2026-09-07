import type { database } from "./_shared";

type PopularityRow = { id: number };
type PastorPopularityRow = { pastorId: number };

const rankWeight = (rank: number) => rank <= 10 ? 3 : rank <= 40 ? 2 : 1;

/** Refreshes media collection priority from the last seven days of anonymous visits. */
export async function refreshPopularityWeights(db: ReturnType<typeof database>) {
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
    db.prepare("UPDATE churches SET priority_weight=1 WHERE priority_weight<4"),
    ...churches.results.map((row, index) => db.prepare("UPDATE churches SET priority_weight=MAX(priority_weight,?) WHERE id=? AND review_status='approved'").bind(rankWeight(index + 1), row.id)),
    ...pastors.results.map((row, index) => db.prepare(`
      UPDATE churches
      SET priority_weight=MAX(priority_weight,?)
      WHERE id IN (
        SELECT church_id
        FROM pastor_church_roles
        WHERE pastor_id=? AND review_status='approved' AND church_id IS NOT NULL
      ) AND review_status='approved'
    `).bind(rankWeight(index + 1), row.pastorId)),
  ];
  await db.batch(statements);
  return { churchCount: churches.results.length, pastorCount: pastors.results.length };
}
