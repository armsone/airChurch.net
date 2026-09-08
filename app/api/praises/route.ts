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
  const params=new URL(request.url).searchParams;
  if(params.get("browse")==="1") {
    const MAX_BROWSE_PRAISES=300;
    const terms=(params.get("q")||"").trim().slice(0,120).toLowerCase().split(/\s+/).filter(Boolean).slice(0,6);
    const conditions=["c.review_status='approved'","p.status='published'"];
    const bindings:(string|number)[]=[];
    for(const term of terms){conditions.push("instr(lower(p.title||' '||c.name||' '||c.region||' '||c.pastor||' '||c.denomination),?)>0");bindings.push(term);}
    const region=(params.get("region")||"").slice(0,60),denomination=(params.get("denomination")||"").slice(0,100);
    if(region&&region!=="전체"){conditions.push("instr(c.region,?)=1");bindings.push(region);}
    if(denomination&&denomination!=="전체 교단"){conditions.push("c.denomination=?");bindings.push(denomination);}
    const where=conditions.join(" AND ");
    const offset=Number(params.get("before")||0);
    if(!Number.isSafeInteger(offset)||offset<0||offset>=MAX_BROWSE_PRAISES)return Response.json({error:"잘못된 목록 위치입니다."},{status:400});
    const rows=await db.prepare(`SELECT p.id,p.youtube_id AS youtubeId,p.title,c.name AS church,c.region FROM praise_videos p JOIN churches c ON c.id=p.church_id WHERE ${where} ORDER BY p.published_at DESC,p.id DESC LIMIT 51 OFFSET ?`).bind(...bindings,offset).all<{id:number;youtubeId:string;title:string;church:string;region:string}>();
    const page=rows.results.slice(0,50);
    const matched=(await db.prepare(`SELECT COUNT(*) AS total FROM praise_videos p JOIN churches c ON c.id=p.church_id WHERE ${where}`).bind(...bindings).first<{total:number}>())?.total||0;
    const total=Math.min(MAX_BROWSE_PRAISES,matched);
    return Response.json({items:page.map(item=>({id:item.youtubeId,title:item.title,channel:`${item.church} · ${item.region}`,duration:0})),total,nextCursor:offset+page.length<total?offset+page.length:null},{headers:{"cache-control":"public, max-age=60, s-maxage=300, stale-while-revalidate=600"}});
  }
  const requested=Number(new URL(request.url).searchParams.get("limit")||300),limit=Number.isInteger(requested)?Math.min(300,Math.max(12,requested)):300;
  const poolLimit=Math.min(1200,Math.max(96,limit*4));
  const rows = await db.prepare(`SELECT p.youtube_id AS youtubeId,p.title,p.published_at AS publishedAt,c.id AS churchId,c.name AS church,c.pastor,c.region,c.denomination,c.priority_weight AS priorityWeight FROM praise_videos p JOIN churches c ON c.id=p.church_id WHERE c.review_status='approved' AND p.status='published' ORDER BY c.priority_weight DESC,p.published_at DESC LIMIT ${poolLimit}`).all<PraiseRow>();
  const items = selectWeightedRecent(rows.results as PraiseRow[], limit).map((item) => ({ youtubeId: item.youtubeId, title: item.title, thumbnailUrl: `https://i.ytimg.com/vi/${item.youtubeId}/mqdefault.jpg`, publishedAt: item.publishedAt, church: item.church, pastor: item.pastor, region: item.region, denomination: item.denomination, pinned: item.priorityWeight >= PIN_UP_WEIGHT }));
  scheduleSync();
  return Response.json({ items }, { headers: { "cache-control": "public, max-age=60, stale-while-revalidate=3600", "cdn-cache-control":"public, max-age=300, stale-while-revalidate=3600" } });
}
