import { clean, database, ensureAnalyticsTables, requestBodyTooLarge, requestOriginIsInvalid } from "../../_shared";

let cleanupPromise:Promise<void>|null=null;
let cleanedAt=0;

async function cleanupExpiredAnalytics(db:D1Database){
  if(Date.now()-cleanedAt<24*60*60*1000)return;
  if(!cleanupPromise)cleanupPromise=db.batch([
    db.prepare("DELETE FROM page_views WHERE created_at < datetime('now','-90 days')"),
    db.prepare("DELETE FROM visitor_activity WHERE last_seen < datetime('now','-30 days')"),
  ]).then(()=>{cleanedAt=Date.now();}).finally(()=>{cleanupPromise=null;});
  await cleanupPromise;
}

function referrerDomain(value: unknown): string | null {
  const raw = clean(value, 500);
  if (!raw) return null;
  try {
    const hostname = new URL(raw).hostname.toLowerCase();
    return hostname.endsWith("airchurch.net") || hostname.endsWith("chatgpt.site") ? null : hostname.slice(0, 120);
  } catch {
    return null;
  }
}

async function hashVisitor(visitorId: string): Promise<string> {
  const bytes = new TextEncoder().encode(visitorId);
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function POST(request: Request) {
  if(requestBodyTooLarge(request,2_048))return Response.json({error:"request too large"},{status:413,headers:{"cache-control":"no-store"}});
  if(requestOriginIsInvalid(request))return Response.json({error:"invalid origin"},{status:403,headers:{"cache-control":"no-store"}});
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const visitorId = clean(body.visitorId, 80);
  const path = clean(body.path, 160);
  if (!/^[0-9a-f-]{36}$/i.test(visitorId) || !path.startsWith("/") || path.startsWith("//")) {
    return Response.json({ error: "invalid visit" }, { status: 400 });
  }

  const db = database();
  await ensureAnalyticsTables(db);
  await cleanupExpiredAnalytics(db);
  const visitorHash = await hashVisitor(visitorId);
  await db.prepare("INSERT INTO visitor_activity (visitor_hash,path,last_seen) VALUES (?,?,CURRENT_TIMESTAMP) ON CONFLICT(visitor_hash) DO UPDATE SET path=excluded.path,last_seen=CURRENT_TIMESTAMP").bind(visitorHash, path).run();
  const recent = await db.prepare("SELECT id FROM page_views WHERE visitor_hash=? AND path=? AND created_at >= datetime('now','-30 minutes') LIMIT 1").bind(visitorHash, path).first();
  if (recent) return Response.json({ ok: true, skipped: "recent" });

  await db.prepare("INSERT INTO page_views (path,referrer_domain,visitor_hash) VALUES (?,?,?)").bind(path, referrerDomain(body.referrer), visitorHash).run();
  return Response.json({ ok: true }, { status: 201 });
}
