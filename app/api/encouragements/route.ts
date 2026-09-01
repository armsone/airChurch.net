import { clean,consumeSubmissionLimit,database,ensureEncouragementTables,ensureSermonTables,fingerprint,readLimitedJson,requestOriginIsInvalid } from "../_shared";

const targets=new Set(["church","pastor"]);
export async function GET(request:Request){
  const url=new URL(request.url),churchId=Number(url.searchParams.get("churchId")),targetType=clean(url.searchParams.get("targetType"),20);
  if(!Number.isInteger(churchId)||churchId<1||!targets.has(targetType))return Response.json({error:"대상을 확인해 주세요."},{status:400});
  const db=database();await ensureEncouragementTables(db);
  const rows=await db.prepare("SELECT e.id,e.nickname,e.content,e.created_at AS createdAt FROM encouragement_messages e JOIN churches c ON c.id=e.church_id WHERE e.church_id=? AND e.target_type=? AND e.status='approved' AND c.review_status='approved' ORDER BY e.created_at DESC,e.id DESC LIMIT 30").bind(churchId,targetType).all();
  return Response.json({items:rows.results},{headers:{"cache-control":"public, max-age=10, s-maxage=10, stale-while-revalidate=20"}});
}
export async function POST(request:Request){
  if(requestOriginIsInvalid(request))return Response.json({error:"요청을 확인할 수 없습니다."},{status:403,headers:{"cache-control":"no-store"}});
  const body=await readLimitedJson(request,4096);if(body.tooLarge)return Response.json({error:"응원글이 너무 깁니다."},{status:413});
  const data=body.data;if(clean(data.company,20))return Response.json({ok:true});
  const churchId=Number(data.churchId),targetType=clean(data.targetType,20),nickname=clean(data.nickname,16),content=clean(data.content,300);
  if(!Number.isInteger(churchId)||churchId<1||!targets.has(targetType)||nickname.length<2||content.length<5)return Response.json({error:"이름은 2자, 응원글은 5자 이상 적어 주세요."},{status:400});
  const db=database();await Promise.all([ensureSermonTables(db),ensureEncouragementTables(db)]);
  if(!await db.prepare("SELECT id FROM churches WHERE id=? AND review_status='approved' LIMIT 1").bind(churchId).first())return Response.json({error:"현재 응원할 수 없는 대상입니다."},{status:404});
  const browserToken=clean(request.headers.get("x-airchurch-browser"),80);
  const fp=await fingerprint(request,/^[0-9a-f-]{20,80}$/i.test(browserToken)?`encouragement-write:${browserToken}`:"encouragement-write");
  if(!await consumeSubmissionLimit(db,"encouragement-write",fp,1,30))return Response.json({error:"응원글은 같은 브라우저에서 30분에 한 번 남길 수 있습니다."},{status:429,headers:{"cache-control":"no-store","retry-after":"1800"}});
  const inserted=await db.prepare("INSERT INTO encouragement_messages (church_id,target_type,nickname,content,status) VALUES (?,?,?,?,'approved')").bind(churchId,targetType,nickname,content).run();
  return Response.json({ok:true,item:{id:Number(inserted.meta.last_row_id),nickname,content,createdAt:new Date().toISOString()}},{status:201,headers:{"cache-control":"no-store"}});
}
