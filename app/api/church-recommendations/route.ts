import { clean, database, ensureChurchRecommendationTables, ensureSermonTables, fingerprint, readLimitedJson, requestOriginIsInvalid } from "../_shared";

function validYoutubeUrl(value:string) {
  if(!value) return true;
  try {
    const host=new URL(value).hostname.toLowerCase();
    return host==="youtu.be"||host==="youtube.com"||host.endsWith(".youtube.com");
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
  const held=await db.prepare("SELECT id FROM churches WHERE name=? AND review_status='removed' LIMIT 1").bind(churchName).first();
  if(held) return Response.json({ok:true,status:"already_held"});
  const fp=await fingerprint(request);
  const recent=await db.prepare("SELECT COUNT(*) AS count FROM church_recommendations WHERE fingerprint=? AND created_at>datetime('now','-10 minutes')").bind(fp).first<{count:number}>();
  if((recent?.count||0)>=2) return Response.json({error:"잠시 후 다시 추천해 주세요."},{status:429,headers:{"cache-control":"no-store","retry-after":"600"}});
  const duplicate=await db.prepare("SELECT id FROM church_recommendations WHERE church_name=? AND region=? AND status IN ('pending','approved') LIMIT 1").bind(churchName,region).first();
  if(duplicate) return Response.json({ok:true,status:"already_received"});
  await db.prepare("INSERT INTO church_recommendations (church_name,pastor,region,denomination,youtube_url,reason,fingerprint) VALUES (?,?,?,?,?,?,?)").bind(churchName,pastor,region,denomination,youtubeUrl||null,reason,fp).run();
  return Response.json({ok:true,status:"pending"},{status:201,headers:{"cache-control":"no-store"}});
}
