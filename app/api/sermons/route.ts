import { getRequestExecutionContext } from "vinext/shims/request-context";
import { database } from "../_shared";
import { selectWeightedRecent } from "../_weighted-content";
import { isSermonTitle } from "./_selection";

import { POST as syncSermons } from "./sync/route";

type SermonRow={youtubeId:string;title:string;thumbnailUrl:string;publishedAt:string;churchId:number;church:string;pastor:string;region:string;denomination:string;priorityWeight:number};

let pendingSync:Promise<void>|null=null;

function scheduleSync() {
  const context=getRequestExecutionContext();
  if(!context)return;
  if(!pendingSync) pendingSync=syncSermons(new Request("https://airchurch.internal/api/sermons/sync",{method:"POST"})).then(()=>undefined).catch(()=>undefined).finally(()=>{pendingSync=null;});
  context.waitUntil(pendingSync);
}

export async function GET() {
  const db=database();
  const result=await db.prepare("SELECT s.youtube_id AS youtubeId,s.title,s.thumbnail_url AS thumbnailUrl,s.published_at AS publishedAt,c.id AS churchId,c.name AS church,c.pastor,c.region,c.denomination,c.priority_weight AS priorityWeight FROM sermons s JOIN churches c ON c.id=s.church_id WHERE c.review_status='approved' AND s.status='published' ORDER BY s.published_at DESC LIMIT 1200").all<SermonRow>();
  const items=selectWeightedRecent((result.results as SermonRow[]).filter((item)=>isSermonTitle(item.title)),300).map((item)=>({youtubeId:item.youtubeId,title:item.title,thumbnailUrl:`https://i.ytimg.com/vi/${item.youtubeId}/mqdefault.jpg`,publishedAt:item.publishedAt,church:item.church,pastor:item.pastor,region:item.region,denomination:item.denomination}));
  scheduleSync();
  return Response.json({items},{headers:{"cache-control":"public, max-age=300, s-maxage=300, stale-while-revalidate=3600"}});
}
