import { getRequestExecutionContext } from "vinext/shims/request-context";
import { database } from "../_shared";
import { selectWeightedRecent } from "../_weighted-content";

import { POST as syncPraises } from "./sync/route";

let pendingSync:Promise<void>|null=null;

function scheduleSync() {
  const context=getRequestExecutionContext();
  if(!context)return;
  if(!pendingSync) pendingSync=syncPraises().then(()=>undefined).catch(()=>undefined).finally(()=>{pendingSync=null;});
  context.waitUntil(pendingSync);
}

export async function GET() {
  const db = database();
  const rows = await db.prepare("SELECT p.youtube_id AS youtubeId,p.title,p.thumbnail_url AS thumbnailUrl,p.published_at AS publishedAt,c.id AS churchId,c.name AS church,c.pastor,c.region,c.denomination,c.priority_weight AS priorityWeight FROM praise_videos p JOIN churches c ON c.id=p.church_id WHERE c.review_status='approved' AND p.status='published' ORDER BY p.published_at DESC LIMIT 120").all<{ youtubeId: string; title: string; thumbnailUrl: string; publishedAt: string; churchId: number; church: string; pastor: string; region: string; denomination: string; priorityWeight: number }>();
  const items = selectWeightedRecent(rows.results, 12).map((item) => ({ youtubeId: item.youtubeId, title: item.title, thumbnailUrl: item.thumbnailUrl, publishedAt: item.publishedAt, church: item.church, pastor: item.pastor, region: item.region, denomination: item.denomination }));
  scheduleSync();
  return Response.json({ items }, { headers: { "cache-control": "public, max-age=300, s-maxage=300, stale-while-revalidate=3600" } });
}
