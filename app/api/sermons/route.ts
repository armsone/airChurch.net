import { database } from "../_shared";
import { selectWeightedRecent } from "../_weighted-content";
import { isSermonTitle } from "./_selection";
export async function GET() {
  const db=database();
  const result=await db.prepare("SELECT s.youtube_id AS youtubeId,s.title,s.thumbnail_url AS thumbnailUrl,s.published_at AS publishedAt,c.id AS churchId,c.name AS church,c.pastor,c.region,c.denomination,c.priority_weight AS priorityWeight FROM sermons s JOIN churches c ON c.id=s.church_id WHERE c.review_status='approved' AND s.status='published' ORDER BY s.published_at DESC LIMIT 240").all<{youtubeId:string;title:string;thumbnailUrl:string;publishedAt:string;churchId:number;church:string;pastor:string;region:string;denomination:string;priorityWeight:number}>();
  const items=selectWeightedRecent(result.results.filter((item)=>isSermonTitle(item.title)),120).map((item)=>({youtubeId:item.youtubeId,title:item.title,thumbnailUrl:item.thumbnailUrl,publishedAt:item.publishedAt,church:item.church,pastor:item.pastor,region:item.region,denomination:item.denomination}));
  return Response.json({items},{headers:{"cache-control":"public, max-age=300, s-maxage=300, stale-while-revalidate=3600"}});
}
