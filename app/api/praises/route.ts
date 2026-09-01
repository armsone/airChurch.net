import { getRequestExecutionContext } from "vinext/shims/request-context";
import { database } from "../_shared";
import { PIN_UP_WEIGHT, selectWeightedRecent } from "../_weighted-content";

import { POST as syncPraises } from "./sync/route";

type PraiseRow={youtubeId:string;title:string;publishedAt:string;churchId:number;church:string;pastor:string;region:string;denomination:string;priorityWeight:number};

let pendingSync:Promise<void>|null=null;
let lastSyncAttemptAt=0;

function scheduleSync() {
  const context=getRequestExecutionContext();
  if(!context||Date.now()-lastSyncAttemptAt<5*60*1000)return;
  if(!pendingSync) {lastSyncAttemptAt=Date.now();pendingSync=syncPraises().then(()=>undefined).catch(()=>undefined).finally(()=>{pendingSync=null;});}
  context.waitUntil(pendingSync);
}

export async function GET(request:Request) {
  const db = database();
  const requested=Number(new URL(request.url).searchParams.get("limit")||300),limit=Number.isInteger(requested)?Math.min(300,Math.max(12,requested)):300;
  const poolLimit=Math.min(1200,Math.max(96,limit*4));
  const rows = await db.prepare(`SELECT p.youtube_id AS youtubeId,p.title,p.published_at AS publishedAt,c.id AS churchId,c.name AS church,c.pastor,c.region,c.denomination,c.priority_weight AS priorityWeight FROM praise_videos p JOIN churches c ON c.id=p.church_id WHERE c.review_status='approved' AND p.status='published' ORDER BY p.published_at DESC LIMIT ${poolLimit}`).all<PraiseRow>();
  const items = selectWeightedRecent(rows.results as PraiseRow[], limit).map((item) => ({ youtubeId: item.youtubeId, title: item.title, thumbnailUrl: `https://i.ytimg.com/vi/${item.youtubeId}/mqdefault.jpg`, publishedAt: item.publishedAt, church: item.church, pastor: item.pastor, region: item.region, denomination: item.denomination, pinned: item.priorityWeight >= PIN_UP_WEIGHT }));
  scheduleSync();
  return Response.json({ items }, { headers: { "cache-control": "public, max-age=60, stale-while-revalidate=3600", "cdn-cache-control":"public, max-age=300, stale-while-revalidate=3600" } });
}
