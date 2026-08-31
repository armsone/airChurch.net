import { clean, consumeSubmissionLimit, database, ensureCommunityTables, fingerprint, readLimitedJson, requestOriginIsInvalid } from "../../_shared";

export async function POST(request:Request){
  if(requestOriginIsInvalid(request))return Response.json({error:"요청을 확인할 수 없습니다."},{status:403,headers:{"cache-control":"no-store"}});
  const body=await readLimitedJson(request,2_048);if(body.tooLarge)return Response.json({error:"요청 내용이 너무 큽니다."},{status:413,headers:{"cache-control":"no-store"}});
  const id=Number(body.data.id),reason=clean(body.data.reason,80);
  if(!Number.isInteger(id)||id<1||!reason)return Response.json({error:"신고 내용을 확인해 주세요."},{status:400,headers:{"cache-control":"no-store"}});
  const db=database();await ensureCommunityTables(db);
  if(!await db.prepare("SELECT id FROM community_posts WHERE id=? AND status='approved' LIMIT 1").bind(id).first())return Response.json({error:"이미 검토 중이거나 찾을 수 없는 글입니다."},{status:404,headers:{"cache-control":"no-store"}});
  const fp=await fingerprint(request,"community-report");
  if(!await consumeSubmissionLimit(db,`community-report:${id}`,fp,1,24*60))return Response.json({error:"이미 이 글을 신고했습니다."},{status:409,headers:{"cache-control":"no-store"}});
  if(!await consumeSubmissionLimit(db,"community-report:daily",fp,10,24*60))return Response.json({error:"오늘 접수할 수 있는 신고 수를 초과했습니다."},{status:429,headers:{"cache-control":"no-store","retry-after":"86400"}});
  const result=await db.prepare("UPDATE community_posts SET report_count=report_count+1,status=CASE WHEN report_count+1>=3 THEN 'pending' ELSE status END WHERE id=? AND status='approved'").bind(id).run();
  if(Number(result.meta?.changes??0)!==1)return Response.json({error:"이미 검토 중이거나 찾을 수 없는 글입니다."},{status:404,headers:{"cache-control":"no-store"}});
  const post=await db.prepare("SELECT status FROM community_posts WHERE id=?").bind(id).first<{status:string}>();
  return Response.json({ok:true,hidden:post?.status!=="approved"},{headers:{"cache-control":"no-store"}});
}
