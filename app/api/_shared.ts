import { env } from "cloudflare:workers";
export function database() { if (!env.DB) throw new Error("Database unavailable"); return env.DB as D1Database; }
async function addColumnIfMissing(db:D1Database,columns:{name:string}[],name:string,sql:string) {
  if(columns.some((column)=>column.name===name)) return;
  try { await db.prepare(sql).run(); }
  catch(error) { if(!String(error).toLowerCase().includes("duplicate column")) throw error; }
}
export async function ensureCommunityTables(db: D1Database) {
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS talent_offers (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, region TEXT NOT NULL, description TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', fingerprint TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_talent_offers_status_created ON talent_offers(status, created_at)"),
    db.prepare("CREATE TABLE IF NOT EXISTS community_posts (id INTEGER PRIMARY KEY AUTOINCREMENT, category TEXT NOT NULL, nickname TEXT NOT NULL, content TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', report_count INTEGER NOT NULL DEFAULT 0, fingerprint TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_community_posts_status_created ON community_posts(status, created_at)"),
  ]);
}
export async function ensureSermonTables(db:D1Database) {
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS churches (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, pastor TEXT NOT NULL, region TEXT NOT NULL, denomination TEXT NOT NULL, youtube_channel_id TEXT UNIQUE, review_status TEXT NOT NULL DEFAULT 'pending', hold_reason TEXT, hold_note TEXT, held_at TEXT, priority_weight INTEGER NOT NULL DEFAULT 1, reviewer_status TEXT NOT NULL DEFAULT 'unreviewed', reviewer_note TEXT, reviewed_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE TABLE IF NOT EXISTS sermons (id INTEGER PRIMARY KEY AUTOINCREMENT, church_id INTEGER NOT NULL REFERENCES churches(id), youtube_id TEXT NOT NULL UNIQUE, title TEXT NOT NULL, thumbnail_url TEXT NOT NULL, published_at TEXT NOT NULL, view_count INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_sermons_published_at ON sermons(published_at DESC)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_churches_search ON churches(region, name, pastor)"),
    db.prepare("CREATE TABLE IF NOT EXISTS sync_state (key TEXT PRIMARY KEY, last_synced_at TEXT NOT NULL)"),
  ]);
  const columns = await db.prepare("PRAGMA table_info(sermons)").all<{ name: string }>();
  if (!columns.results.some((column) => column.name === "status")) {
    await db.prepare("ALTER TABLE sermons ADD COLUMN status TEXT NOT NULL DEFAULT 'published'").run();
  }
  const churchColumns = await db.prepare("PRAGMA table_info(churches)").all<{ name: string }>();
  if (!churchColumns.results.some((column) => column.name === "reviewer_status")) await db.prepare("ALTER TABLE churches ADD COLUMN reviewer_status TEXT NOT NULL DEFAULT 'unreviewed'").run();
  if (!churchColumns.results.some((column) => column.name === "reviewer_note")) await db.prepare("ALTER TABLE churches ADD COLUMN reviewer_note TEXT").run();
  if (!churchColumns.results.some((column) => column.name === "reviewed_at")) await db.prepare("ALTER TABLE churches ADD COLUMN reviewed_at TEXT").run();
  if (!churchColumns.results.some((column) => column.name === "channel_image_url")) await db.prepare("ALTER TABLE churches ADD COLUMN channel_image_url TEXT").run();
  if (!churchColumns.results.some((column) => column.name === "homepage_url")) await db.prepare("ALTER TABLE churches ADD COLUMN homepage_url TEXT").run();
  await addColumnIfMissing(db,churchColumns.results,"review_resolution_token","ALTER TABLE churches ADD COLUMN review_resolution_token TEXT");
  await db.prepare("CREATE INDEX IF NOT EXISTS idx_sermons_status_published ON sermons(status, published_at DESC)").run();
}
export async function ensurePraiseTables(db:D1Database) {
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS praise_videos (id INTEGER PRIMARY KEY AUTOINCREMENT, church_id INTEGER NOT NULL REFERENCES churches(id), youtube_id TEXT NOT NULL UNIQUE, title TEXT NOT NULL, thumbnail_url TEXT NOT NULL, published_at TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'published', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_praise_videos_status_published ON praise_videos(status, published_at DESC)"),
  ]);
}
export async function ensureChurchRecommendationTables(db:D1Database) {
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS church_recommendations (id INTEGER PRIMARY KEY AUTOINCREMENT, church_name TEXT NOT NULL, pastor TEXT NOT NULL, region TEXT NOT NULL, denomination TEXT NOT NULL, youtube_url TEXT, reason TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', fingerprint TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, reviewed_at TEXT)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_church_recommendations_status_created ON church_recommendations(status, created_at DESC)"),
  ]);
}
export async function ensureReviewerTables(db:D1Database) {
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS reviewer_accounts (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, contact TEXT NOT NULL, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, password_salt TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', fingerprint TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, reviewed_at TEXT)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_reviewer_accounts_status_created ON reviewer_accounts(status, created_at DESC)"),
    db.prepare("CREATE TABLE IF NOT EXISTS reviewer_church_reviews (id INTEGER PRIMARY KEY AUTOINCREMENT, reviewer_id INTEGER NOT NULL, church_id INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'unreviewed', note TEXT, reviewed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, handled_at TEXT, admin_resolution TEXT, admin_note TEXT, resolved_by TEXT, UNIQUE(reviewer_id,church_id))"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_reviewer_church_reviews_church ON reviewer_church_reviews(church_id, reviewed_at DESC)"),
    db.prepare("CREATE TABLE IF NOT EXISTS church_change_requests (id INTEGER PRIMARY KEY AUTOINCREMENT, reviewer_id INTEGER NOT NULL, church_id INTEGER NOT NULL, request_type TEXT NOT NULL, reason TEXT NOT NULL, proposed_name TEXT, proposed_pastor TEXT, proposed_region TEXT, proposed_denomination TEXT, status TEXT NOT NULL DEFAULT 'pending', admin_note TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, reviewed_at TEXT)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_church_change_requests_status_created ON church_change_requests(status, created_at DESC)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_church_change_requests_reviewer_created ON church_change_requests(reviewer_id, created_at DESC)"),
  ]);
  const reviewColumns=await db.prepare("PRAGMA table_info(reviewer_church_reviews)").all<{name:string}>();
  await addColumnIfMissing(db,reviewColumns.results,"handled_at","ALTER TABLE reviewer_church_reviews ADD COLUMN handled_at TEXT");
  await addColumnIfMissing(db,reviewColumns.results,"admin_resolution","ALTER TABLE reviewer_church_reviews ADD COLUMN admin_resolution TEXT");
  await addColumnIfMissing(db,reviewColumns.results,"admin_note","ALTER TABLE reviewer_church_reviews ADD COLUMN admin_note TEXT");
  await addColumnIfMissing(db,reviewColumns.results,"resolved_by","ALTER TABLE reviewer_church_reviews ADD COLUMN resolved_by TEXT");
}
export async function ensureAnalyticsTables(db:D1Database) {
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS page_views (id INTEGER PRIMARY KEY AUTOINCREMENT, path TEXT NOT NULL, referrer_domain TEXT, visitor_hash TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_page_views_created ON page_views(created_at DESC)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_page_views_visitor_created ON page_views(visitor_hash, created_at DESC)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_page_views_path_created ON page_views(path, created_at DESC)"),
    db.prepare("CREATE TABLE IF NOT EXISTS visitor_activity (visitor_hash TEXT PRIMARY KEY NOT NULL, path TEXT NOT NULL, last_seen TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_visitor_activity_last_seen ON visitor_activity(last_seen DESC)"),
  ]);
}
export async function fingerprint(request: Request) { const ip=request.headers.get("cf-connecting-ip")||"local", agent=request.headers.get("user-agent")||"unknown", day=new Date().toISOString().slice(0,10); const bytes=new TextEncoder().encode(`${ip}|${agent}|${day}`); return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes))).map((b)=>b.toString(16).padStart(2,"0")).join(""); }
export function clean(value:unknown,max:number) { return typeof value === "string" ? value.trim().replace(/<[^>]*>/g,"").slice(0,max) : ""; }
