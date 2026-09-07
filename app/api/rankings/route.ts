import { database, ensureAnalyticsTables, ensurePastorPeopleTables } from "../_shared";

export const dynamic = "force-dynamic";

type RankingRow = {
  id: number;
  publicId: number;
  name: string;
  pastor?: string | null;
  churchName?: string | null;
  uniqueVisitors: number;
  views: number;
  sermonCount?: number;
  source?: "visit" | "sermon";
};

function normalizeRows(rows: RankingRow[]) {
  return rows.map((row) => ({
    ...row,
    id: Number(row.id),
    publicId: Number(row.publicId),
    uniqueVisitors: Number(row.uniqueVisitors),
    views: Number(row.views),
    sermonCount: Number(row.sermonCount || 0),
  }));
}

export async function GET() {
  const db = database();
  await Promise.all([ensureAnalyticsTables(db), ensurePastorPeopleTables(db)]);

  const [churches, pastors] = await Promise.all([
    db.prepare(`
      SELECT
        c.id,
        COALESCE(c.public_id, 1000000 + c.id) AS publicId,
        c.name,
        c.pastor,
        COUNT(DISTINCT v.visitor_hash) AS uniqueVisitors,
        COUNT(*) AS views,
        (SELECT COUNT(*) FROM sermons s WHERE s.church_id = c.id AND s.status = 'published') AS sermonCount
      FROM page_views v
      JOIN churches c ON v.path = '/church/' || COALESCE(c.public_id, 1000000 + c.id)
      WHERE v.created_at >= datetime('now', '-7 days')
        AND c.review_status = 'approved'
      GROUP BY c.id, c.public_id, c.name, c.pastor
      ORDER BY COUNT(DISTINCT v.visitor_hash) DESC, COUNT(*) DESC, c.name
      LIMIT 5
    `).all<RankingRow>(),
    db.prepare(`
      SELECT
        p.id,
        COALESCE(p.public_id, 1000000 + p.id) AS publicId,
        p.name,
        r.church_name AS churchName,
        COUNT(DISTINCT v.visitor_hash) AS uniqueVisitors,
        COUNT(*) AS views
      FROM page_views v
      JOIN pastor_people p ON v.path = '/pastors/' || COALESCE(p.public_id, 1000000 + p.id)
      LEFT JOIN pastor_church_roles r ON r.id = (
        SELECT rr.id
        FROM pastor_church_roles rr
        WHERE rr.pastor_id = p.id
          AND rr.review_status = 'approved'
        ORDER BY CASE rr.role_status WHEN 'current' THEN 0 ELSE 1 END, rr.id DESC
        LIMIT 1
      )
      WHERE v.created_at >= datetime('now', '-7 days')
        AND p.review_status = 'approved'
      GROUP BY p.id, p.public_id, p.name, r.church_name
      ORDER BY COUNT(DISTINCT v.visitor_hash) DESC, COUNT(*) DESC, p.name
      LIMIT 5
    `).all<RankingRow>(),
  ]);

  const churchRows = normalizeRows(churches.results).map((row) => ({ ...row, source: "visit" as const }));
  const missingChurchCount = Math.max(0, 5 - churchRows.length);
  if (missingChurchCount > 0) {
    const excludedIds = churchRows.map((row) => row.id);
    const excludedClause = excludedIds.length ? `AND c.id NOT IN (${excludedIds.map(() => "?").join(",")})` : "";
    const fallbackChurches = await db.prepare(`
      SELECT
        c.id,
        COALESCE(c.public_id, 1000000 + c.id) AS publicId,
        c.name,
        c.pastor,
        0 AS uniqueVisitors,
        0 AS views,
        COUNT(s.id) AS sermonCount
      FROM churches c
      LEFT JOIN sermons s ON s.church_id = c.id AND s.status = 'published'
      WHERE c.review_status = 'approved'
        ${excludedClause}
      GROUP BY c.id, c.public_id, c.name, c.pastor
      ORDER BY COUNT(s.id) DESC, RANDOM()
      LIMIT ${missingChurchCount}
    `).bind(...excludedIds).all<RankingRow>();
    churchRows.push(...normalizeRows(fallbackChurches.results).map((row) => ({ ...row, source: "sermon" as const })));
  }

  return Response.json(
    {
      churches: churchRows,
      pastors: normalizeRows(pastors.results),
      windowDays: 7,
    },
    { headers: { "cache-control": "public, max-age=300, stale-while-revalidate=900" } },
  );
}
