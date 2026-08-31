import { clean, consumeSubmissionLimit, database, ensureChurchRecommendationTables, ensureSermonTables, fingerprint, readLimitedJson, requestOriginIsInvalid } from "../_shared";
import { normalizeSearchValue, sqlNormalized } from "../../search-domain";

function validYoutubeUrl(value:string) {
  if(!value) return true;
  try {
    const url=new URL(value),host=url.hostname.toLowerCase();
    return (url.protocol==="https:"||url.protocol==="http:")&&(host==="youtu.be"||host==="youtube.com"||host.endsWith(".youtube.com"));
  } catch { return false; }
}

export async function POST(request:Request) {
  if(requestOriginIsInvalid(request))return Response.json({error:"요청을 확인할 수 없습니다."},{status:403});
  const body=await readLimitedJson(request);if(body.tooLarge)return Response.json({error:"요청 내용이 너무 큽니다."},{status:413});const data=body.data;
  if(clean(data.company,20)) return Response.json({ok:true});
  const churchName=clean(data.churchName,100),pastor=clean(data.pastor,80),region=clean(data.region,80),denomination=clean(data.denomination,120),youtubeUrl=clean(data.youtubeUrl,300),reason=clean(data.reason,800);
  if(churchName.length<2||pastor.length<2||region.length<2||denomination.length<2||reason.length<10||!validYoutubeUrl(youtubeUrl)) return Response.json({error:"교회 정보와 추천 이유를 확인해 주세요."},{status:400});
  const db=database();
  await Promise.all([ensureChurchRecommendationTables(db),ensureSermonTables(db)]);
  const existing=await db.prepare(`SELECT review_status AS status FROM churches WHERE ${sqlNormalized("name")}=? AND ${sqlNormalized("region")}=? LIMIT 1`).bind(normalizeSearchValue(churchName),normalizeSearchValue(region)).first<{status:string}>();
  if(existing) return Response.json({ok:true,status:existing.status==="approved"?"already_listed":"already_held"});
  const fp=await fingerprint(request,"church-recommendation");
  if(!await consumeSubmissionLimit(db,"church-recommendation",fp,2,10)) return Response.json({error:"잠시 후 다시 추천해 주세요."},{status:429,headers:{"cache-control":"no-store","retry-after":"600"}});
  const inserted=await db.prepare(`INSERT INTO church_recommendations (church_name,pastor,region,denomination,youtube_url,reason,fingerprint) SELECT ?,?,?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM church_recommendations WHERE ${sqlNormalized("church_name")}=? AND ${sqlNormalized("region")}=? AND status IN ('pending','approved'))`).bind(churchName,pastor,region,denomination,youtubeUrl||null,reason,"",normalizeSearchValue(churchName),normalizeSearchValue(region)).run();
  if(Number(inserted.meta?.changes??0)!==1)return Response.json({ok:true,status:"already_received"});
  return Response.json({ok:true,status:"pending"},{status:201,headers:{"cache-control":"no-store"}});
}
