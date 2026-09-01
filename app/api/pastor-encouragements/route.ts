import {clean,consumeSubmissionLimit,database,ensurePastorPeopleTables,fingerprint,readLimitedJson,requestOriginIsInvalid} from "../_shared";

export async function GET(request:Request){
  const pastorId=Number(new URL(request.url).searchParams.get("pastorId"));
  if(!Number.isInteger(pastorId)||pastorId<1)return Response.json({error:"대상을 확인해 주세요."},{status:400});
  const db=database();await ensurePastorPeopleTables(db);
  const rows=await db.prepare("SELECT e.id,e.nickname,e.content,e.created_at AS createdAt FROM pastor_encouragement_messages e JOIN pastor_people p ON p.id=e.pastor_id WHERE e.pastor_id=? AND e.status='approved' AND p.review_status='approved' ORDER BY e.created_at DESC,e.id DESC LIMIT 30").bind(pastorId).all();
  return Response.json({items:rows.results},{headers:{"cache-control":"public, max-age=10, s-maxage=10, stale-while-revalidate=20"}});
}

export async function POST(request:Request){
  if(requestOriginIsInvalid(request))return Response.json({error:"요청을 확인할 수 없습니다."},{status:403,headers:{"cache-control":"no-store"}});
  const body=await readLimitedJson(request,4096);if(body.tooLarge)return Response.json({error:"응원글이 너무 깁니다."},{status:413});
  const data=body.data;if(clean(data.company,20))return Response.json({ok:true});
  const pastorId=Number(data.pastorId),nickname=clean(data.nickname,16),content=clean(data.content,300);
  if(!Number.isInteger(pastorId)||pastorId<1||nickname.length<2||content.length<5)return Response.json({error:"이름은 2자, 응원글은 5자 이상 적어 주세요."},{status:400});
  const db=database();await ensurePastorPeopleTables(db);
  if(!await db.prepare("SELECT id FROM pastor_people WHERE id=? AND review_status='approved' LIMIT 1").bind(pastorId).first())return Response.json({error:"현재 응원할 수 없는 목회자입니다."},{status:404});
  const browserToken=clean(request.headers.get("x-airchurch-browser"),80),fp=await fingerprint(request,/^[0-9a-f-]{20,80}$/i.test(browserToken)?`pastor-encouragement:${browserToken}`:"pastor-encouragement");
  if(!await consumeSubmissionLimit(db,"encouragement-write",fp,1,30))return Response.json({error:"응원글은 같은 브라우저에서 30분에 한 번 남길 수 있습니다."},{status:429,headers:{"cache-control":"no-store","retry-after":"1800"}});
  const inserted=await db.prepare("INSERT INTO pastor_encouragement_messages (pastor_id,nickname,content,status) VALUES (?,?,?,'approved')").bind(pastorId,nickname,content).run();
  return Response.json({ok:true,item:{id:Number(inserted.meta.last_row_id),nickname,content,createdAt:new Date().toISOString()}},{status:201,headers:{"cache-control":"no-store"}});
}
