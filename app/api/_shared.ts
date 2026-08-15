import { env } from "cloudflare:workers";
export function database() { if (!env.DB) throw new Error("Database unavailable"); return env.DB as D1Database; }
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
    db.prepare("CREATE TABLE IF NOT EXISTS churches (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, pastor TEXT NOT NULL, region TEXT NOT NULL, denomination TEXT NOT NULL, youtube_channel_id TEXT UNIQUE, review_status TEXT NOT NULL DEFAULT 'pending', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE TABLE IF NOT EXISTS sermons (id INTEGER PRIMARY KEY AUTOINCREMENT, church_id INTEGER NOT NULL REFERENCES churches(id), youtube_id TEXT NOT NULL UNIQUE, title TEXT NOT NULL, thumbnail_url TEXT NOT NULL, published_at TEXT NOT NULL, view_count INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_sermons_published_at ON sermons(published_at DESC)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_churches_search ON churches(region, name, pastor)"),
    db.prepare("CREATE TABLE IF NOT EXISTS sync_state (key TEXT PRIMARY KEY, last_synced_at TEXT NOT NULL)"),
  ]);
}
export async function ensureAnalyticsTables(db:D1Database) {
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS page_views (id INTEGER PRIMARY KEY AUTOINCREMENT, path TEXT NOT NULL, referrer_domain TEXT, visitor_hash TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_page_views_created ON page_views(created_at DESC)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_page_views_visitor_created ON page_views(visitor_hash, created_at DESC)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_page_views_path_created ON page_views(path, created_at DESC)"),
  ]);
}
export async function fingerprint(request: Request) { const ip=request.headers.get("cf-connecting-ip")||"local", agent=request.headers.get("user-agent")||"unknown", day=new Date().toISOString().slice(0,10); const bytes=new TextEncoder().encode(`${ip}|${agent}|${day}`); return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes))).map((b)=>b.toString(16).padStart(2,"0")).join(""); }
export function clean(value:unknown,max:number) { return typeof value === "string" ? value.trim().replace(/<[^>]*>/g,"").slice(0,max) : ""; }
