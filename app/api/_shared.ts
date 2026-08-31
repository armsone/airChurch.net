import { env } from "cloudflare:workers";
export function database() { if (!env.DB) throw new Error("Database unavailable"); return env.DB as D1Database; }
async function addColumnIfMissing(db:D1Database,columns:{name:string}[],name:string,sql:string) {
  if(columns.some((column)=>column.name===name)) return;
  try { await db.prepare(sql).run(); }
  catch(error) { if(!String(error).toLowerCase().includes("duplicate column")) throw error; }
}
// These ensure* functions are idempotent DDL only. They are memoized per isolate so that
// hot request paths (homepage sermons/churches/etc.) don't re-run PRAGMA/CREATE TABLE round trips on every request.
function memoizeEnsure(run:(db:D1Database)=>Promise<void>) {
  let pending:Promise<void>|null=null;
  return (db:D1Database)=>{
    if(!pending) pending=run(db).catch((error)=>{pending=null;throw error;});
    return pending;
  };
}
export const ensureCommunityTables = memoizeEnsure(async (db: D1Database) => {
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS maintenance_state (key TEXT PRIMARY KEY,completed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE TABLE IF NOT EXISTS talent_offers (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, region TEXT NOT NULL, description TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', fingerprint TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_talent_offers_status_created ON talent_offers(status, created_at)"),
    db.prepare("DROP INDEX IF EXISTS idx_talent_offers_fingerprint_created"),
    db.prepare("CREATE TABLE IF NOT EXISTS community_posts (id INTEGER PRIMARY KEY AUTOINCREMENT, category TEXT NOT NULL, nickname TEXT NOT NULL, content TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', report_count INTEGER NOT NULL DEFAULT 0, fingerprint TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_community_posts_status_created ON community_posts(status, created_at)"),
    db.prepare("DROP INDEX IF EXISTS idx_community_posts_fingerprint_created"),
    db.prepare("UPDATE talent_offers SET fingerprint='' WHERE fingerprint!='' AND NOT EXISTS (SELECT 1 FROM maintenance_state WHERE key='scrub-talent-fingerprints-v1')"),
    db.prepare("INSERT OR IGNORE INTO maintenance_state (key) VALUES ('scrub-talent-fingerprints-v1')"),
    db.prepare("UPDATE community_posts SET fingerprint='' WHERE fingerprint!='' AND NOT EXISTS (SELECT 1 FROM maintenance_state WHERE key='scrub-post-fingerprints-v1')"),
    db.prepare("INSERT OR IGNORE INTO maintenance_state (key) VALUES ('scrub-post-fingerprints-v1')"),
  ]);
});
export const ensureSermonTables = memoizeEnsure(async (db:D1Database) => {
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS churches (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, pastor TEXT NOT NULL, region TEXT NOT NULL, denomination TEXT NOT NULL, youtube_channel_id TEXT UNIQUE, review_status TEXT NOT NULL DEFAULT 'pending', hold_reason TEXT, hold_note TEXT, held_at TEXT, priority_weight INTEGER NOT NULL DEFAULT 1, reviewer_status TEXT NOT NULL DEFAULT 'unreviewed', reviewer_note TEXT, reviewed_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE TABLE IF NOT EXISTS sermons (id INTEGER PRIMARY KEY AUTOINCREMENT, church_id INTEGER NOT NULL REFERENCES churches(id), youtube_id TEXT NOT NULL UNIQUE, title TEXT NOT NULL, thumbnail_url TEXT NOT NULL, published_at TEXT NOT NULL, view_count INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_sermons_published_at ON sermons(published_at DESC)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_churches_search ON churches(region, name, pastor)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_churches_review_region ON churches(review_status, region)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_churches_review_denomination ON churches(review_status, denomination)"),
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
  await db.prepare("CREATE INDEX IF NOT EXISTS idx_sermons_church_status_published ON sermons(church_id, status, published_at DESC)").run();
});
export const ensurePraiseTables = memoizeEnsure(async (db:D1Database) => {
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS praise_videos (id INTEGER PRIMARY KEY AUTOINCREMENT, church_id INTEGER NOT NULL REFERENCES churches(id), youtube_id TEXT NOT NULL UNIQUE, title TEXT NOT NULL, thumbnail_url TEXT NOT NULL, published_at TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'published', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_praise_videos_status_published ON praise_videos(status, published_at DESC)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_praise_videos_church_status_published ON praise_videos(church_id, status, published_at DESC)"),
  ]);
});
export const ensureShortsTables = memoizeEnsure(async (db:D1Database) => {
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS church_shorts (id INTEGER PRIMARY KEY AUTOINCREMENT, church_id INTEGER NOT NULL REFERENCES churches(id), youtube_id TEXT NOT NULL UNIQUE, title TEXT NOT NULL, thumbnail_url TEXT NOT NULL, published_at TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'published', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_church_shorts_status_published ON church_shorts(status, published_at DESC)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_church_shorts_church_status_published ON church_shorts(church_id, status, published_at DESC)"),
  ]);
});
export const ensureChurchRecommendationTables = memoizeEnsure(async (db:D1Database) => {
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS maintenance_state (key TEXT PRIMARY KEY,completed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE TABLE IF NOT EXISTS church_recommendations (id INTEGER PRIMARY KEY AUTOINCREMENT, church_name TEXT NOT NULL, pastor TEXT NOT NULL, region TEXT NOT NULL, denomination TEXT NOT NULL, youtube_url TEXT, reason TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', fingerprint TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, reviewed_at TEXT)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_church_recommendations_status_created ON church_recommendations(status, created_at DESC)"),
    db.prepare("DROP INDEX IF EXISTS idx_church_recommendations_fingerprint_created"),
    db.prepare("UPDATE church_recommendations SET fingerprint='' WHERE fingerprint!='' AND NOT EXISTS (SELECT 1 FROM maintenance_state WHERE key='scrub-recommendation-fingerprints-v1')"),
    db.prepare("INSERT OR IGNORE INTO maintenance_state (key) VALUES ('scrub-recommendation-fingerprints-v1')"),
  ]);
});
export const ensureContactTables = memoizeEnsure(async (db:D1Database) => {
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS maintenance_state (key TEXT PRIMARY KEY,completed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE TABLE IF NOT EXISTS contact_requests (id INTEGER PRIMARY KEY AUTOINCREMENT, category TEXT NOT NULL, name TEXT NOT NULL, contact TEXT NOT NULL, message TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', fingerprint TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, reviewed_at TEXT)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_contact_requests_status_created ON contact_requests(status, created_at DESC)"),
    db.prepare("DROP INDEX IF EXISTS idx_contact_requests_fingerprint_created"),
    db.prepare("UPDATE contact_requests SET fingerprint='' WHERE fingerprint!='' AND NOT EXISTS (SELECT 1 FROM maintenance_state WHERE key='scrub-contact-fingerprints-v1')"),
    db.prepare("INSERT OR IGNORE INTO maintenance_state (key) VALUES ('scrub-contact-fingerprints-v1')"),
  ]);
});
export const ensureReviewerTables = memoizeEnsure(async (db:D1Database) => {
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS maintenance_state (key TEXT PRIMARY KEY,completed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE TABLE IF NOT EXISTS reviewer_accounts (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, contact TEXT NOT NULL, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, password_salt TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', fingerprint TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, reviewed_at TEXT)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_reviewer_accounts_status_created ON reviewer_accounts(status, created_at DESC)"),
    db.prepare("DROP INDEX IF EXISTS idx_reviewer_accounts_fingerprint_created"),
    db.prepare("UPDATE reviewer_accounts SET fingerprint='' WHERE fingerprint!='' AND NOT EXISTS (SELECT 1 FROM maintenance_state WHERE key='scrub-reviewer-fingerprints-v1')"),
    db.prepare("INSERT OR IGNORE INTO maintenance_state (key) VALUES ('scrub-reviewer-fingerprints-v1')"),
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
});
export const ensureAnalyticsTables = memoizeEnsure(async (db:D1Database) => {
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS page_views (id INTEGER PRIMARY KEY AUTOINCREMENT, path TEXT NOT NULL, referrer_domain TEXT, visitor_hash TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_page_views_created ON page_views(created_at DESC)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_page_views_visitor_created ON page_views(visitor_hash, created_at DESC)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_page_views_path_created ON page_views(path, created_at DESC)"),
    db.prepare("CREATE TABLE IF NOT EXISTS visitor_activity (visitor_hash TEXT PRIMARY KEY NOT NULL, path TEXT NOT NULL, last_seen TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_visitor_activity_last_seen ON visitor_activity(last_seen DESC)"),
  ]);
});
export const ensureAccessTables=memoizeEnsure(async(db:D1Database)=>{
  await db.batch([db.prepare("CREATE TABLE IF NOT EXISTS admin_login_attempts (fingerprint TEXT PRIMARY KEY,attempt_count INTEGER NOT NULL DEFAULT 0,window_started TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),db.prepare("DELETE FROM admin_login_attempts WHERE window_started<datetime('now','-2 days')")]);
});
export const ensureSubmissionRateTables=memoizeEnsure(async(db:D1Database)=>{
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS submission_rate_limits (purpose TEXT NOT NULL,fingerprint TEXT NOT NULL,attempt_count INTEGER NOT NULL DEFAULT 0,window_started TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(purpose,fingerprint))"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_submission_rate_limits_window ON submission_rate_limits(window_started)"),
    db.prepare("DELETE FROM submission_rate_limits WHERE window_started<datetime('now','-2 days')"),
  ]);
});
export async function consumeSubmissionLimit(db:D1Database,purpose:string,fp:string,maxAttempts:number,windowMinutes:number){
  await ensureSubmissionRateTables(db);
  await db.prepare("INSERT INTO submission_rate_limits (purpose,fingerprint,attempt_count,window_started) VALUES (?,?,1,CURRENT_TIMESTAMP) ON CONFLICT(purpose,fingerprint) DO UPDATE SET attempt_count=CASE WHEN window_started<datetime('now',?) THEN 1 ELSE attempt_count+1 END,window_started=CASE WHEN window_started<datetime('now',?) THEN CURRENT_TIMESTAMP ELSE window_started END").bind(purpose,fp,`-${windowMinutes} minutes`,`-${windowMinutes} minutes`).run();
  const row=await db.prepare("SELECT attempt_count AS attemptCount FROM submission_rate_limits WHERE purpose=? AND fingerprint=?").bind(purpose,fp).first<{attemptCount:number}>();
  return (row?.attemptCount??1)<=maxAttempts;
}
export async function fingerprint(request:Request,purpose="general") {
  const ip=request.headers.get("cf-connecting-ip")||"local",agent=request.headers.get("user-agent")||"unknown",day=new Date().toISOString().slice(0,10);
  const encoder=new TextEncoder(),bytes=encoder.encode(`${purpose}|${ip}|${agent}|${day}`);
  const secrets=env as unknown as {FINGERPRINT_SECRET?:string;ADMIN_SESSION_SECRET?:string};
  const secret=secrets.FINGERPRINT_SECRET||secrets.ADMIN_SESSION_SECRET;
  const digest=secret?await crypto.subtle.sign("HMAC",await crypto.subtle.importKey("raw",encoder.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]),bytes):await crypto.subtle.digest("SHA-256",bytes);
  return Array.from(new Uint8Array(digest)).map((b)=>b.toString(16).padStart(2,"0")).join("");
}
export function clean(value:unknown,max:number) { return typeof value === "string" ? value.trim().replace(/<[^>]*>/g,"").slice(0,max) : ""; }
export function requestBodyTooLarge(request:Request,maxBytes=16_384){const length=Number(request.headers.get("content-length"));return Number.isFinite(length)&&length>maxBytes;}
export function requestOriginIsInvalid(request:Request){const origin=request.headers.get("origin");return Boolean(origin&&origin!==new URL(request.url).origin);}
export async function readLimitedJson(request:Request,maxBytes=16_384):Promise<{data:Record<string,unknown>;tooLarge:boolean}>{
  if(requestBodyTooLarge(request,maxBytes))return {data:{},tooLarge:true};
  if(!request.body)return {data:{},tooLarge:false};
  const reader=request.body.getReader(),chunks:Uint8Array[]=[];let size=0;
  try{
    while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxBytes){void reader.cancel().catch(()=>{});return {data:{},tooLarge:true};}chunks.push(value);}
    const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
    const parsed=JSON.parse(new TextDecoder().decode(bytes)) as unknown;
    return {data:parsed&&typeof parsed==="object"&&!Array.isArray(parsed)?parsed as Record<string,unknown>:{},tooLarge:false};
  }catch{return {data:{},tooLarge:false};}
}
