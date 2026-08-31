import { database } from "../_shared";
import { scheduleSermonSync } from "../_sermon-sync-scheduler";
import { selectWeightedRecent } from "../_weighted-content";

type ShortRow={youtubeId:string;title:string;publishedAt:string;churchId:number;church:string;pastor:string;region:string;denomination:string;priorityWeight:number};

export async function GET(request:Request) {
  const db=database();
  const requested=Number(new URL(request.url).searchParams.get("limit")||300),limit=Number.isInteger(requested)?Math.min(300,Math.max(12,requested)):300;
  const poolLimit=Math.min(1200,Math.max(96,limit*4));
  const result=await db.prepare(`SELECT s.youtube_id AS youtubeId,s.title,s.published_at AS publishedAt,c.id AS churchId,c.name AS church,c.pastor,c.region,c.denomination,c.priority_weight AS priorityWeight FROM church_shorts s JOIN churches c ON c.id=s.church_id WHERE c.review_status='approved' AND s.status='published' ORDER BY s.published_at DESC LIMIT ${poolLimit}`).all<ShortRow>();
  const items=selectWeightedRecent(result.results as ShortRow[],limit).map((item)=>({youtubeId:item.youtubeId,title:item.title,thumbnailUrl:`https://i.ytimg.com/vi/${item.youtubeId}/mqdefault.jpg`,publishedAt:item.publishedAt,church:item.church,pastor:item.pastor,region:item.region,denomination:item.denomination}));
  scheduleSermonSync();
  return Response.json({items},{headers:{"cache-control":"public, max-age=300, s-maxage=300, stale-while-revalidate=3600"}});
}
