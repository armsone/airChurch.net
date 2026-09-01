import { env } from "cloudflare:workers";
export function database() { if (!env.DB) throw new Error("Database unavailable"); return env.DB as D1Database; }
export function internalTaskRequestAllowed(request:Request){
  if(new URL(request.url).hostname==="airchurch.internal")return true;
  const token=(env as unknown as {MAINTENANCE_TOKEN?:string}).MAINTENANCE_TOKEN;
  return Boolean(token&&token.length>=32&&request.headers.get("authorization")===`Bearer ${token}`);
}
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
const ensureMaintenanceState=memoizeEnsure(async(db:D1Database)=>{
  await db.prepare("CREATE TABLE IF NOT EXISTS maintenance_state (key TEXT PRIMARY KEY,completed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)").run();
});
export const ensureCommunityTables = memoizeEnsure(async (db: D1Database) => {
  await ensureMaintenanceState(db);
  const ready=await db.prepare("SELECT key FROM maintenance_state WHERE key='schema-community-v1' LIMIT 1").first<{key:string}>();
  if(ready)return;
  await db.batch([
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
    db.prepare("INSERT OR REPLACE INTO maintenance_state (key,completed_at) VALUES ('schema-community-v1',CURRENT_TIMESTAMP)"),
  ]);
});
export const ensureSermonTables = memoizeEnsure(async (db:D1Database) => {
  await ensureMaintenanceState(db);
  const ready=await db.prepare("SELECT key FROM maintenance_state WHERE key='schema-sermons-v5' LIMIT 1").first<{key:string}>();
  if(ready)return;
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS churches (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, pastor TEXT NOT NULL, region TEXT NOT NULL, denomination TEXT NOT NULL, youtube_channel_id TEXT UNIQUE, review_status TEXT NOT NULL DEFAULT 'pending', hold_reason TEXT, hold_note TEXT, held_at TEXT, priority_weight INTEGER NOT NULL DEFAULT 1, reviewer_status TEXT NOT NULL DEFAULT 'unreviewed', reviewer_note TEXT, reviewed_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE TABLE IF NOT EXISTS sermons (id INTEGER PRIMARY KEY AUTOINCREMENT, church_id INTEGER NOT NULL REFERENCES churches(id), youtube_id TEXT NOT NULL UNIQUE, title TEXT NOT NULL, thumbnail_url TEXT NOT NULL, published_at TEXT NOT NULL, view_count INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_sermons_published_at ON sermons(published_at DESC)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_churches_search ON churches(region, name, pastor)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_churches_review_region ON churches(review_status, region)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_churches_review_denomination ON churches(review_status, denomination)"),
    db.prepare("CREATE TABLE IF NOT EXISTS sync_state (key TEXT PRIMARY KEY, last_synced_at TEXT NOT NULL)"),
    db.prepare("CREATE TABLE IF NOT EXISTS church_status_events (id INTEGER PRIMARY KEY AUTOINCREMENT,church_id INTEGER NOT NULL,church_name TEXT NOT NULL,previous_status TEXT,new_status TEXT NOT NULL,reason TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_church_status_events_created ON church_status_events(created_at DESC)"),
    db.prepare("CREATE TRIGGER IF NOT EXISTS log_church_insert AFTER INSERT ON churches BEGIN INSERT INTO church_status_events (church_id,church_name,previous_status,new_status,reason) VALUES (NEW.id,NEW.name,NULL,NEW.review_status,COALESCE(NEW.hold_reason,'registration')); END"),
    db.prepare("CREATE TRIGGER IF NOT EXISTS log_church_status_update AFTER UPDATE OF review_status ON churches WHEN OLD.review_status<>NEW.review_status BEGIN INSERT INTO church_status_events (church_id,church_name,previous_status,new_status,reason) VALUES (NEW.id,NEW.name,OLD.review_status,NEW.review_status,COALESCE(NEW.hold_reason,'status_change')); END"),
  ]);
  const columns = await db.prepare("PRAGMA table_info(sermons)").all<{ name: string }>();
  if (!columns.results.some((column) => column.name === "status")) {
    await db.prepare("ALTER TABLE sermons ADD COLUMN status TEXT NOT NULL DEFAULT 'published'").run();
  }
  const churchColumns = await db.prepare("PRAGMA table_info(churches)").all<{ name: string }>();
  await addColumnIfMissing(db,churchColumns.results,"hold_reason","ALTER TABLE churches ADD COLUMN hold_reason TEXT");
  await addColumnIfMissing(db,churchColumns.results,"hold_note","ALTER TABLE churches ADD COLUMN hold_note TEXT");
  await addColumnIfMissing(db,churchColumns.results,"held_at","ALTER TABLE churches ADD COLUMN held_at TEXT");
  await addColumnIfMissing(db,churchColumns.results,"priority_weight","ALTER TABLE churches ADD COLUMN priority_weight INTEGER NOT NULL DEFAULT 1");
  await addColumnIfMissing(db,churchColumns.results,"reviewer_status","ALTER TABLE churches ADD COLUMN reviewer_status TEXT NOT NULL DEFAULT 'unreviewed'");
  await addColumnIfMissing(db,churchColumns.results,"reviewer_note","ALTER TABLE churches ADD COLUMN reviewer_note TEXT");
  await addColumnIfMissing(db,churchColumns.results,"reviewed_at","ALTER TABLE churches ADD COLUMN reviewed_at TEXT");
  await addColumnIfMissing(db,churchColumns.results,"channel_image_url","ALTER TABLE churches ADD COLUMN channel_image_url TEXT");
  await addColumnIfMissing(db,churchColumns.results,"homepage_url","ALTER TABLE churches ADD COLUMN homepage_url TEXT");
  await addColumnIfMissing(db,churchColumns.results,"review_resolution_token","ALTER TABLE churches ADD COLUMN review_resolution_token TEXT");
  await db.prepare("CREATE INDEX IF NOT EXISTS idx_sermons_status_published ON sermons(status, published_at DESC)").run();
  await db.prepare("CREATE INDEX IF NOT EXISTS idx_sermons_church_status_published ON sermons(church_id, status, published_at DESC)").run();
  await db.prepare("INSERT OR REPLACE INTO maintenance_state (key,completed_at) VALUES ('schema-sermons-v5',CURRENT_TIMESTAMP)").run();
});
export const ensureChurchDetailTables = memoizeEnsure(async(db:D1Database)=>{
  await ensureMaintenanceState(db);
  const ready=await db.prepare("SELECT key FROM maintenance_state WHERE key='schema-church-details-v1' LIMIT 1").first<{key:string}>();
  if(ready)return;
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS church_profiles (church_id INTEGER PRIMARY KEY NOT NULL REFERENCES churches(id),slogan TEXT,vision TEXT,summary TEXT,address TEXT,source_url TEXT NOT NULL,source_text TEXT NOT NULL,collected_at TEXT NOT NULL,review_status TEXT NOT NULL DEFAULT 'pending',reviewed_at TEXT,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_church_profiles_review_church ON church_profiles(review_status,church_id)"),
    db.prepare("CREATE TABLE IF NOT EXISTS worship_schedules (record_id TEXT PRIMARY KEY NOT NULL,church_id INTEGER NOT NULL REFERENCES churches(id),service_type TEXT NOT NULL,day_of_week TEXT NOT NULL,start_time TEXT NOT NULL,venue_audience TEXT,source_text TEXT NOT NULL,source_url TEXT NOT NULL,collected_at TEXT NOT NULL,confidence TEXT NOT NULL,review_status TEXT NOT NULL DEFAULT 'pending',reviewed_at TEXT,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_worship_schedules_church_review ON worship_schedules(church_id,review_status,day_of_week,start_time)"),
    db.prepare("INSERT OR REPLACE INTO maintenance_state (key,completed_at) VALUES ('schema-church-details-v1',CURRENT_TIMESTAMP)"),
  ]);
});
export const ensurePraiseTables = memoizeEnsure(async (db:D1Database) => {
  await ensureMaintenanceState(db);
  const ready=await db.prepare("SELECT key FROM maintenance_state WHERE key='schema-praises-v1' LIMIT 1").first<{key:string}>();
  if(ready)return;
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS praise_videos (id INTEGER PRIMARY KEY AUTOINCREMENT, church_id INTEGER NOT NULL REFERENCES churches(id), youtube_id TEXT NOT NULL UNIQUE, title TEXT NOT NULL, thumbnail_url TEXT NOT NULL, published_at TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'published', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_praise_videos_status_published ON praise_videos(status, published_at DESC)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_praise_videos_church_status_published ON praise_videos(church_id, status, published_at DESC)"),
    db.prepare("INSERT OR REPLACE INTO maintenance_state (key,completed_at) VALUES ('schema-praises-v1',CURRENT_TIMESTAMP)"),
  ]);
});
export const ensureShortsTables = memoizeEnsure(async (db:D1Database) => {
  await ensureMaintenanceState(db);
  const ready=await db.prepare("SELECT key FROM maintenance_state WHERE key='schema-shorts-v1' LIMIT 1").first<{key:string}>();
  if(ready)return;
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS church_shorts (id INTEGER PRIMARY KEY AUTOINCREMENT, church_id INTEGER NOT NULL REFERENCES churches(id), youtube_id TEXT NOT NULL UNIQUE, title TEXT NOT NULL, thumbnail_url TEXT NOT NULL, published_at TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'published', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_church_shorts_status_published ON church_shorts(status, published_at DESC)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_church_shorts_church_status_published ON church_shorts(church_id, status, published_at DESC)"),
    db.prepare("INSERT OR REPLACE INTO maintenance_state (key,completed_at) VALUES ('schema-shorts-v1',CURRENT_TIMESTAMP)"),
  ]);
});
export const ensureChurchRecommendationTables = memoizeEnsure(async (db:D1Database) => {
  await ensureMaintenanceState(db);
  const ready=await db.prepare("SELECT key FROM maintenance_state WHERE key='schema-recommendations-v1' LIMIT 1").first<{key:string}>();
  if(ready)return;
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS church_recommendations (id INTEGER PRIMARY KEY AUTOINCREMENT, church_name TEXT NOT NULL, pastor TEXT NOT NULL, region TEXT NOT NULL, denomination TEXT NOT NULL, youtube_url TEXT, reason TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', fingerprint TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, reviewed_at TEXT)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_church_recommendations_status_created ON church_recommendations(status, created_at DESC)"),
    db.prepare("DROP INDEX IF EXISTS idx_church_recommendations_fingerprint_created"),
    db.prepare("UPDATE church_recommendations SET fingerprint='' WHERE fingerprint!='' AND NOT EXISTS (SELECT 1 FROM maintenance_state WHERE key='scrub-recommendation-fingerprints-v1')"),
    db.prepare("INSERT OR IGNORE INTO maintenance_state (key) VALUES ('scrub-recommendation-fingerprints-v1')"),
    db.prepare("INSERT OR REPLACE INTO maintenance_state (key,completed_at) VALUES ('schema-recommendations-v1',CURRENT_TIMESTAMP)"),
  ]);
});
export const ensureContactTables = memoizeEnsure(async (db:D1Database) => {
  await ensureMaintenanceState(db);
  const ready=await db.prepare("SELECT key FROM maintenance_state WHERE key='schema-contact-v1' LIMIT 1").first<{key:string}>();
  if(ready)return;
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS contact_requests (id INTEGER PRIMARY KEY AUTOINCREMENT, category TEXT NOT NULL, name TEXT NOT NULL, contact TEXT NOT NULL, message TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', fingerprint TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, reviewed_at TEXT)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_contact_requests_status_created ON contact_requests(status, created_at DESC)"),
    db.prepare("DROP INDEX IF EXISTS idx_contact_requests_fingerprint_created"),
    db.prepare("UPDATE contact_requests SET fingerprint='' WHERE fingerprint!='' AND NOT EXISTS (SELECT 1 FROM maintenance_state WHERE key='scrub-contact-fingerprints-v1')"),
    db.prepare("INSERT OR IGNORE INTO maintenance_state (key) VALUES ('scrub-contact-fingerprints-v1')"),
    db.prepare("INSERT OR REPLACE INTO maintenance_state (key,completed_at) VALUES ('schema-contact-v1',CURRENT_TIMESTAMP)"),
  ]);
});
export const ensureReviewerTables = memoizeEnsure(async (db:D1Database) => {
  await ensureMaintenanceState(db);
  const ready=await db.prepare("SELECT key FROM maintenance_state WHERE key='schema-reviewers-v4' LIMIT 1").first<{key:string}>();
  if(ready)return;
  await db.batch([
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
    db.prepare("CREATE INDEX IF NOT EXISTS idx_church_change_requests_reviewer_pending ON church_change_requests(reviewer_id,status,church_id,request_type)"),
  ]);
  const reviewColumns=await db.prepare("PRAGMA table_info(reviewer_church_reviews)").all<{name:string}>();
  const accountColumns=await db.prepare("PRAGMA table_info(reviewer_accounts)").all<{name:string}>();
  await addColumnIfMissing(db,accountColumns.results,"church_id","ALTER TABLE reviewer_accounts ADD COLUMN church_id INTEGER REFERENCES churches(id)");
  await addColumnIfMissing(db,reviewColumns.results,"handled_at","ALTER TABLE reviewer_church_reviews ADD COLUMN handled_at TEXT");
  await addColumnIfMissing(db,reviewColumns.results,"admin_resolution","ALTER TABLE reviewer_church_reviews ADD COLUMN admin_resolution TEXT");
  await addColumnIfMissing(db,reviewColumns.results,"admin_note","ALTER TABLE reviewer_church_reviews ADD COLUMN admin_note TEXT");
  await addColumnIfMissing(db,reviewColumns.results,"resolved_by","ALTER TABLE reviewer_church_reviews ADD COLUMN resolved_by TEXT");
  await db.prepare("INSERT OR REPLACE INTO maintenance_state (key,completed_at) VALUES ('schema-reviewers-v4',CURRENT_TIMESTAMP)").run();
});
export const ensureAnalyticsTables = memoizeEnsure(async (db:D1Database) => {
  await ensureMaintenanceState(db);
  const ready=await db.prepare("SELECT key FROM maintenance_state WHERE key='schema-analytics-v1' LIMIT 1").first<{key:string}>();
  if(ready)return;
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS page_views (id INTEGER PRIMARY KEY AUTOINCREMENT, path TEXT NOT NULL, referrer_domain TEXT, visitor_hash TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_page_views_created ON page_views(created_at DESC)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_page_views_visitor_created ON page_views(visitor_hash, created_at DESC)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_page_views_path_created ON page_views(path, created_at DESC)"),
    db.prepare("CREATE TABLE IF NOT EXISTS visitor_activity (visitor_hash TEXT PRIMARY KEY NOT NULL, path TEXT NOT NULL, last_seen TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_visitor_activity_last_seen ON visitor_activity(last_seen DESC)"),
    db.prepare("INSERT OR REPLACE INTO maintenance_state (key,completed_at) VALUES ('schema-analytics-v1',CURRENT_TIMESTAMP)"),
  ]);
});
export const ensureAccessTables=memoizeEnsure(async(db:D1Database)=>{
  await ensureMaintenanceState(db);
  const ready=await db.prepare("SELECT key FROM maintenance_state WHERE key='schema-access-v1' LIMIT 1").first<{key:string}>();
  if(ready)return;
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS admin_login_attempts (fingerprint TEXT PRIMARY KEY,attempt_count INTEGER NOT NULL DEFAULT 0,window_started TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE TABLE IF NOT EXISTS access_sessions (id TEXT PRIMARY KEY,role TEXT NOT NULL,reviewer_id INTEGER NOT NULL,expires_at TEXT NOT NULL,revoked_at TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_access_sessions_expires ON access_sessions(expires_at)"),
    db.prepare("INSERT OR REPLACE INTO maintenance_state (key,completed_at) VALUES ('schema-access-v1',CURRENT_TIMESTAMP)"),
  ]);
});
export const ensureSubmissionRateTables=memoizeEnsure(async(db:D1Database)=>{
  await ensureMaintenanceState(db);
  const ready=await db.prepare("SELECT key FROM maintenance_state WHERE key='schema-submission-rate-v1' LIMIT 1").first<{key:string}>();
  if(ready)return;
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS submission_rate_limits (purpose TEXT NOT NULL,fingerprint TEXT NOT NULL,attempt_count INTEGER NOT NULL DEFAULT 0,window_started TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(purpose,fingerprint))"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_submission_rate_limits_window ON submission_rate_limits(window_started)"),
    db.prepare("INSERT OR REPLACE INTO maintenance_state (key,completed_at) VALUES ('schema-submission-rate-v1',CURRENT_TIMESTAMP)"),
  ]);
});
export const ensurePrivateContactTables=memoizeEnsure(async(db:D1Database)=>{
  await ensureMaintenanceState(db);
  const ready=await db.prepare("SELECT key FROM maintenance_state WHERE key='schema-private-contacts-v1' LIMIT 1").first<{key:string}>();
  if(ready)return;
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS private_church_contacts (id INTEGER PRIMARY KEY AUTOINCREMENT,church_id INTEGER NOT NULL REFERENCES churches(id),contact_type TEXT NOT NULL,encrypted_value TEXT NOT NULL,value_digest TEXT NOT NULL,scope TEXT NOT NULL DEFAULT 'organization',source_url TEXT NOT NULL,review_status TEXT NOT NULL DEFAULT 'approved',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_private_church_contacts_church ON private_church_contacts(church_id,review_status,contact_type)"),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_private_church_contacts_unique ON private_church_contacts(church_id,contact_type,value_digest)"),
    db.prepare("CREATE TABLE IF NOT EXISTS private_contact_access_events (id INTEGER PRIMARY KEY AUTOINCREMENT,actor_role TEXT NOT NULL,actor_id INTEGER NOT NULL DEFAULT 0,record_count INTEGER NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_private_contact_access_created ON private_contact_access_events(created_at DESC)"),
    db.prepare("INSERT OR REPLACE INTO maintenance_state (key,completed_at) VALUES ('schema-private-contacts-v1',CURRENT_TIMESTAMP)"),
  ]);
});
export const ensureEncouragementTables=memoizeEnsure(async(db:D1Database)=>{
  await ensureMaintenanceState(db);
  const ready=await db.prepare("SELECT key FROM maintenance_state WHERE key='schema-encouragement-v2' LIMIT 1").first<{key:string}>();
  if(ready)return;
  await db.prepare("CREATE TABLE IF NOT EXISTS encouragement_messages (id INTEGER PRIMARY KEY AUTOINCREMENT,church_id INTEGER NOT NULL REFERENCES churches(id),target_type TEXT NOT NULL,target_ref TEXT NOT NULL DEFAULT '',nickname TEXT NOT NULL,content TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'approved',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,moderated_at TEXT)").run();
  const columns=await db.prepare("PRAGMA table_info(encouragement_messages)").all<{name:string}>();
  await addColumnIfMissing(db,columns.results,"target_ref","ALTER TABLE encouragement_messages ADD COLUMN target_ref TEXT NOT NULL DEFAULT ''");
  await db.batch([
    db.prepare("DROP INDEX IF EXISTS idx_encouragement_target_status_created"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_encouragement_target_status_created ON encouragement_messages(church_id,target_type,target_ref,status,created_at DESC)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_encouragement_status_created ON encouragement_messages(status,created_at DESC)"),
    db.prepare("INSERT OR REPLACE INTO maintenance_state (key,completed_at) VALUES ('schema-encouragement-v2',CURRENT_TIMESTAMP)"),
  ]);
});
export const ensureMinistryProfileTables=memoizeEnsure(async(db:D1Database)=>{
  await ensureMaintenanceState(db);
  const ready=await db.prepare("SELECT key FROM maintenance_state WHERE key='schema-ministry-profiles-v4' LIMIT 1").first<{key:string}>();if(ready)return;
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS church_ministry_profiles (id INTEGER PRIMARY KEY AUTOINCREMENT,church_id INTEGER NOT NULL REFERENCES churches(id),name TEXT NOT NULL,role_title TEXT NOT NULL,role_category TEXT NOT NULL,role_status TEXT NOT NULL DEFAULT 'current',source_url TEXT NOT NULL,source_checked_at TEXT NOT NULL,review_status TEXT NOT NULL DEFAULT 'pending',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_ministry_profiles_church_review ON church_ministry_profiles(church_id,review_status,role_category,name)"),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_ministry_profiles_identity ON church_ministry_profiles(church_id,name,role_title,role_status)"),
    db.prepare("CREATE TABLE IF NOT EXISTS ministry_appearances (id INTEGER PRIMARY KEY AUTOINCREMENT,church_id INTEGER NOT NULL REFERENCES churches(id),minister_name TEXT NOT NULL,role_title TEXT NOT NULL,host_church_name TEXT NOT NULL,event_title TEXT NOT NULL,source_url TEXT NOT NULL,video_id TEXT,occurred_at TEXT NOT NULL,source_checked_at TEXT NOT NULL,review_status TEXT NOT NULL DEFAULT 'pending',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_ministry_appearances_person_review ON ministry_appearances(church_id,minister_name,review_status,occurred_at DESC)"),
    db.prepare("DROP INDEX IF EXISTS idx_ministry_appearances_source"),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_ministry_appearances_source_person_event ON ministry_appearances(source_url,minister_name,event_title)"),
    db.prepare("CREATE TABLE IF NOT EXISTS ministry_profile_suggestions (id INTEGER PRIMARY KEY AUTOINCREMENT,church_id INTEGER NOT NULL REFERENCES churches(id),name TEXT NOT NULL,role_title TEXT NOT NULL,source_url TEXT,note TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',fingerprint TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,reviewed_at TEXT)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_ministry_suggestions_status_created ON ministry_profile_suggestions(status,created_at DESC)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_ministry_suggestions_church_created ON ministry_profile_suggestions(church_id,created_at DESC)"),
    db.prepare("DELETE FROM church_ministry_profiles WHERE REPLACE(TRIM(COALESCE(name,'')),' ','') IN ('','확인필요','이름확인필요','성명확인필요','목회자확인필요','담임목사확인필요','미상','없음','공석','청빙중','-','?')"),
    db.prepare("INSERT OR REPLACE INTO maintenance_state (key,completed_at) VALUES ('schema-ministry-profiles-v4',CURRENT_TIMESTAMP)"),
  ]);
});
export const ensurePastorPeopleTables=memoizeEnsure(async(db:D1Database)=>{
  await ensureMaintenanceState(db);
  const ready=await db.prepare("SELECT key FROM maintenance_state WHERE key='schema-pastor-people-v6' LIMIT 1").first<{key:string}>();if(ready)return;
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS pastor_people (id INTEGER PRIMARY KEY AUTOINCREMENT,directory_id TEXT UNIQUE,name TEXT NOT NULL,public_summary TEXT,photo_url TEXT,photo_source_url TEXT,photo_sha256 TEXT,photo_usage_basis TEXT,photo_review_status TEXT NOT NULL DEFAULT 'pending',review_status TEXT NOT NULL DEFAULT 'pending',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_pastor_people_review_name ON pastor_people(review_status,name)"),
    db.prepare("CREATE TABLE IF NOT EXISTS pastor_church_roles (id INTEGER PRIMARY KEY AUTOINCREMENT,pastor_id INTEGER NOT NULL REFERENCES pastor_people(id),church_id INTEGER REFERENCES churches(id),church_name TEXT,denomination TEXT,region TEXT,role_title TEXT NOT NULL,role_category TEXT NOT NULL,role_status TEXT NOT NULL DEFAULT 'current',start_date TEXT,end_date TEXT,source_url TEXT,review_status TEXT NOT NULL DEFAULT 'pending',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_pastor_roles_identity ON pastor_church_roles(pastor_id,COALESCE(church_id,-1),COALESCE(church_name,''),role_title,role_status,COALESCE(start_date,''),COALESCE(end_date,''))"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_pastor_roles_person_review ON pastor_church_roles(pastor_id,review_status,role_status)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_pastor_roles_church_review ON pastor_church_roles(church_id,review_status,role_category)"),
    db.prepare("CREATE TABLE IF NOT EXISTS pastor_encouragement_messages (id INTEGER PRIMARY KEY AUTOINCREMENT,pastor_id INTEGER NOT NULL REFERENCES pastor_people(id),nickname TEXT NOT NULL,content TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'approved',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,moderated_at TEXT)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_pastor_encouragement_person_status ON pastor_encouragement_messages(pastor_id,status,created_at DESC)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_pastor_encouragement_status ON pastor_encouragement_messages(status,created_at DESC)"),
    db.prepare("CREATE TABLE IF NOT EXISTS pastor_private_contact_values (id INTEGER PRIMARY KEY AUTOINCREMENT,pastor_id INTEGER NOT NULL REFERENCES pastor_people(id),contact_type TEXT NOT NULL,encrypted_value TEXT NOT NULL,value_digest TEXT NOT NULL,scope TEXT NOT NULL DEFAULT 'pastoral_support',source_url TEXT,review_status TEXT NOT NULL DEFAULT 'approved',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_pastor_private_contact_identity ON pastor_private_contact_values(pastor_id,contact_type,value_digest)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_pastor_private_contact_person_review ON pastor_private_contact_values(pastor_id,review_status,contact_type)"),
    db.prepare("CREATE TABLE IF NOT EXISTS pastor_identity_candidates (id INTEGER PRIMARY KEY AUTOINCREMENT,left_pastor_id INTEGER NOT NULL REFERENCES pastor_people(id),right_pastor_id INTEGER NOT NULL REFERENCES pastor_people(id),evidence_type TEXT NOT NULL,evidence_value TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,reviewed_at TEXT)"),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_pastor_identity_pair_evidence ON pastor_identity_candidates(left_pastor_id,right_pastor_id,evidence_type,evidence_value)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_pastor_identity_status ON pastor_identity_candidates(status,created_at,id)"),
  ]);
  const personColumns=await db.prepare("PRAGMA table_info(pastor_people)").all<{name:string}>();
  await addColumnIfMissing(db,personColumns.results,"photo_url","ALTER TABLE pastor_people ADD COLUMN photo_url TEXT");
  await addColumnIfMissing(db,personColumns.results,"photo_source_url","ALTER TABLE pastor_people ADD COLUMN photo_source_url TEXT");
  await addColumnIfMissing(db,personColumns.results,"photo_sha256","ALTER TABLE pastor_people ADD COLUMN photo_sha256 TEXT");
  await addColumnIfMissing(db,personColumns.results,"photo_usage_basis","ALTER TABLE pastor_people ADD COLUMN photo_usage_basis TEXT");
  await addColumnIfMissing(db,personColumns.results,"photo_review_status","ALTER TABLE pastor_people ADD COLUMN photo_review_status TEXT NOT NULL DEFAULT 'pending'");
  const invalidPeople="SELECT id FROM pastor_people WHERE REPLACE(TRIM(COALESCE(name,'')),' ','') IN ('','확인필요','이름확인필요','성명확인필요','목회자확인필요','담임목사확인필요','미상','없음','공석','청빙중','-','?')";
  await db.batch([
    db.prepare(`DELETE FROM pastor_identity_candidates WHERE left_pastor_id IN (${invalidPeople}) OR right_pastor_id IN (${invalidPeople})`),
    db.prepare(`DELETE FROM pastor_encouragement_messages WHERE pastor_id IN (${invalidPeople})`),
    db.prepare(`DELETE FROM pastor_private_contact_values WHERE pastor_id IN (${invalidPeople})`),
    db.prepare(`DELETE FROM pastor_church_roles WHERE pastor_id IN (${invalidPeople})`),
    db.prepare(`DELETE FROM pastor_people WHERE id IN (${invalidPeople})`),
    db.prepare("UPDATE churches SET pastor='' WHERE REPLACE(TRIM(COALESCE(pastor,'')),' ','') IN ('확인필요','이름확인필요','성명확인필요','목회자확인필요','담임목사확인필요','미상','없음','공석','청빙중','-','?')"),
    db.prepare("INSERT OR REPLACE INTO maintenance_state (key,completed_at) VALUES ('schema-pastor-people-v6',CURRENT_TIMESTAMP)"),
  ]);
});
const schemaBundleReady=async(db:D1Database,keys:string[])=>{
  await ensureMaintenanceState(db);
  const placeholders=keys.map(()=>"?").join(",");
  const row=await db.prepare(`SELECT COUNT(*) AS count FROM maintenance_state WHERE key IN (${placeholders})`).bind(...keys).first<{count:number}>();
  return Number(row?.count??0)===keys.length;
};
// Multi-table pages use one exact-version gate per isolate instead of one D1 round trip
// for every table family. Changing any component schema key automatically invalidates the gate.
export const ensureMediaTables=memoizeEnsure(async(db:D1Database)=>{
  if(await schemaBundleReady(db,["schema-sermons-v5","schema-praises-v1"]))return;
  await Promise.all([ensureSermonTables(db),ensurePraiseTables(db)]);
});
export const ensureMediaCollectionTables=memoizeEnsure(async(db:D1Database)=>{
  if(await schemaBundleReady(db,["schema-sermons-v5","schema-praises-v1","schema-shorts-v1"]))return;
  await Promise.all([ensureSermonTables(db),ensurePraiseTables(db),ensureShortsTables(db)]);
});
export const ensureAdminTables=memoizeEnsure(async(db:D1Database)=>{
  const keys=["schema-analytics-v1","schema-community-v1","schema-contact-v1","schema-sermons-v5","schema-praises-v1","schema-shorts-v1","schema-recommendations-v1","schema-reviewers-v3","schema-private-contacts-v1","schema-encouragement-v2","schema-ministry-profiles-v4","schema-pastor-people-v6"];
  if(await schemaBundleReady(db,keys))return;
  await Promise.all([ensureAnalyticsTables(db),ensureCommunityTables(db),ensureContactTables(db),ensureSermonTables(db),ensurePraiseTables(db),ensureShortsTables(db),ensureChurchRecommendationTables(db),ensureReviewerTables(db),ensurePrivateContactTables(db),ensureEncouragementTables(db),ensureMinistryProfileTables(db),ensurePastorPeopleTables(db)]);
});
let retentionCheckAfter=0;
let retentionPromise:Promise<void>|null=null;
export async function maybeRunDataRetention(db:D1Database){
  if(Date.now()<retentionCheckAfter)return;
  if(!retentionPromise)retentionPromise=(async()=>{
    retentionCheckAfter=Date.now()+10*60*1000;
    await ensureMaintenanceState(db);
    await db.prepare("INSERT OR IGNORE INTO maintenance_state (key,completed_at) VALUES ('personal-data-retention-v1',datetime('now','-2 days'))").run();
    const lease=await db.prepare("UPDATE maintenance_state SET completed_at=CURRENT_TIMESTAMP WHERE key='personal-data-retention-v1' AND completed_at<datetime('now','-1 day')").run();
    if(Number(lease.meta?.changes??0)!==1)return;
    const existing=await db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all<{name:string}>();
    const tables=new Set(existing.results.map((row)=>row.name));
    const statements:Array<ReturnType<typeof db.prepare>>=[];
    if(tables.has("contact_requests"))statements.push(db.prepare("DELETE FROM contact_requests WHERE (status IN ('approved','rejected') AND COALESCE(reviewed_at,created_at)<datetime('now','-90 days')) OR (status='pending' AND created_at<datetime('now','-180 days'))"));
    if(tables.has("church_recommendations"))statements.push(db.prepare("DELETE FROM church_recommendations WHERE status IN ('approved','rejected','pending') AND COALESCE(reviewed_at,created_at)<datetime('now','-180 days')"));
    if(tables.has("community_posts"))statements.push(db.prepare("DELETE FROM community_posts WHERE (status='rejected' AND created_at<datetime('now','-30 days')) OR (status='pending' AND created_at<datetime('now','-180 days'))"));
    if(tables.has("talent_offers"))statements.push(db.prepare("DELETE FROM talent_offers WHERE (status='rejected' AND created_at<datetime('now','-30 days')) OR (status='pending' AND created_at<datetime('now','-180 days'))"));
    if(tables.has("reviewer_accounts"))statements.push(db.prepare("DELETE FROM reviewer_accounts WHERE (status='rejected' AND COALESCE(reviewed_at,created_at)<datetime('now','-30 days')) OR (status='pending' AND created_at<datetime('now','-90 days'))"));
    if(tables.has("church_change_requests"))statements.push(db.prepare("DELETE FROM church_change_requests WHERE (status IN ('approved','rejected') AND COALESCE(reviewed_at,created_at)<datetime('now','-180 days')) OR (status IN ('pending','deferred') AND created_at<datetime('now','-365 days'))"));
    if(tables.has("reviewer_church_reviews"))statements.push(db.prepare("DELETE FROM reviewer_church_reviews WHERE handled_at IS NOT NULL AND handled_at<datetime('now','-180 days')"));
    if(tables.has("page_views"))statements.push(db.prepare("DELETE FROM page_views WHERE created_at<datetime('now','-90 days')"));
    if(tables.has("visitor_activity"))statements.push(db.prepare("DELETE FROM visitor_activity WHERE last_seen<datetime('now','-30 days')"));
    if(tables.has("admin_login_attempts"))statements.push(db.prepare("DELETE FROM admin_login_attempts WHERE window_started<datetime('now','-2 days')"));
    if(tables.has("access_sessions"))statements.push(db.prepare("DELETE FROM access_sessions WHERE expires_at<datetime('now','-2 days')"));
    if(tables.has("submission_rate_limits"))statements.push(db.prepare("DELETE FROM submission_rate_limits WHERE window_started<datetime('now','-2 days')"));
    if(tables.has("private_contact_access_events"))statements.push(db.prepare("DELETE FROM private_contact_access_events WHERE created_at<datetime('now','-180 days')"));
    if(tables.has("encouragement_messages"))statements.push(db.prepare("DELETE FROM encouragement_messages WHERE status IN ('rejected','deleted') AND COALESCE(moderated_at,created_at)<datetime('now','-90 days')"));
    if(tables.has("ministry_profile_suggestions"))statements.push(db.prepare("DELETE FROM ministry_profile_suggestions WHERE (status='pending' AND created_at<datetime('now','-180 days')) OR (status IN ('approved','rejected') AND COALESCE(reviewed_at,created_at)<datetime('now','-30 days'))"));
    if(statements.length)try{await db.batch(statements);}catch(error){await db.prepare("UPDATE maintenance_state SET completed_at=datetime('now','-2 days') WHERE key='personal-data-retention-v1'").run().catch(()=>{});throw error;}
  })().catch(()=>{retentionCheckAfter=Date.now()+60*1000;}).finally(()=>{retentionPromise=null;});
  await retentionPromise;
}
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
