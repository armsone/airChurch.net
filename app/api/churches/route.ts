import { database, ensureSermonTables } from "../_shared";

export async function GET() {
  const db = database();
  await ensureSermonTables(db);
  const rows = await db.prepare("SELECT id,name,pastor,region,denomination FROM churches WHERE review_status='approved' ORDER BY region,name LIMIT 300").all<{ id: number; name: string; pastor: string; region: string; denomination: string }>();
  return Response.json({ items: rows.results }, { headers: { "cache-control": "public, max-age=300" } });
}
