import { clean, database, ensureAnalyticsTables, maybeRunDataRetention, readLimitedJson, requestOriginIsInvalid } from "../../_shared";

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
  if(requestOriginIsInvalid(request))return Response.json({error:"invalid origin"},{status:403,headers:{"cache-control":"no-store"}});
  const parsed=await readLimitedJson(request,2_048);if(parsed.tooLarge)return Response.json({error:"request too large"},{status:413,headers:{"cache-control":"no-store"}});const body=parsed.data;
  const visitorId = clean(body.visitorId, 80);
  const path = clean(body.path, 160);
  if (!/^[0-9a-f-]{36}$/i.test(visitorId) || !path.startsWith("/") || path.startsWith("//")) {
    return Response.json({ error: "invalid visit" }, { status: 400,headers:{"cache-control":"no-store"} });
  }

  const db = database();
  await ensureAnalyticsTables(db);
  await maybeRunDataRetention(db);
  const visitorHash = await hashVisitor(visitorId);
  await db.prepare("INSERT INTO visitor_activity (visitor_hash,path,last_seen) VALUES (?,?,CURRENT_TIMESTAMP) ON CONFLICT(visitor_hash) DO UPDATE SET path=excluded.path,last_seen=CURRENT_TIMESTAMP").bind(visitorHash, path).run();
  const pageView=await db.prepare("INSERT INTO page_views (path,referrer_domain,visitor_hash) SELECT ?,?,? WHERE NOT EXISTS (SELECT 1 FROM page_views WHERE visitor_hash=? AND path=? AND created_at>=datetime('now','-30 minutes'))").bind(path,referrerDomain(body.referrer),visitorHash,visitorHash,path).run();
  const inserted=Number(pageView.meta.changes)>0;
  return Response.json(inserted?{ok:true}:{ok:true,skipped:"recent"},{status:inserted?201:200,headers:{"cache-control":"no-store"}});
}
