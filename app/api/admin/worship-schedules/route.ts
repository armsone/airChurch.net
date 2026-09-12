import { accessSession } from "../../../admin-access";
import { clean, database, ensureChurchDetailTables, readLimitedJson } from "../../_shared";

const headers={"cache-control":"no-store"};
async function authorized(request:Request,mutation=false){
  const origin=request.headers.get("origin"),expected=new URL(request.url).origin;
  if((mutation?origin!==expected:Boolean(origin&&origin!==expected))||request.headers.get("sec-fetch-site")==="cross-site")return false;
  return (await accessSession(request))?.role==="admin";
}
async function approvedChurch(db:D1Database,publicId:number){
  if(!Number.isSafeInteger(publicId)||publicId<1)return null;
  return db.prepare("SELECT id,COALESCE(public_id,1000000+id) AS public_id,name,region,denomination FROM churches WHERE COALESCE(public_id,1000000+id)=? AND review_status='approved' LIMIT 1").bind(publicId).first<{id:number;public_id:number;name:string;region:string;denomination:string}>();
}

export async function GET(request:Request){
  if(!await authorized(request))return Response.json({error:"관리자 권한이 필요합니다."},{status:403,headers});
  const raw=new URL(request.url).searchParams.get("churchId");
  if(!raw||!/^[1-9]\d*$/.test(raw)||!Number.isSafeInteger(Number(raw)))return Response.json({error:"공개 교회 번호를 확인해 주세요."},{status:400,headers});
  const db=database(),church=await approvedChurch(db,Number(raw));
  if(!church)return Response.json({error:"공개 중인 교회를 찾을 수 없습니다."},{status:404,headers});
  await ensureChurchDetailTables(db);
  const rows=await db.prepare("SELECT record_id,church_id,service_type,day_of_week,start_time,venue_audience,source_text,source_url,collected_at,confidence,review_status,reviewed_at,updated_at FROM worship_schedules WHERE church_id=? ORDER BY service_type,day_of_week,start_time,record_id").bind(church.id).all();
  return Response.json({church,items:rows.results},{headers});
}

export async function PATCH(request:Request){
  if(!await authorized(request,true))return Response.json({error:"관리자 권한과 요청 출처를 확인해 주세요."},{status:403,headers});
  const body=await readLimitedJson(request);
  if(body.tooLarge)return Response.json({error:"요청이 너무 큽니다."},{status:413,headers});
  const data=body.data,publicId=Number(data.churchId),recordId=clean(data.record_id,80),status=clean(data.status,20),expectedStatus=clean(data.expectedStatus,20);
  const expectedUpdatedAt=clean(data.expectedUpdatedAt,40),expectedSource=clean(data.expectedSource,500);
  if(!Number.isSafeInteger(publicId)||publicId<1||!/^[0-9a-f]{24}$/.test(recordId)||!["hold","approved"].includes(status)||!["pending","hold","approved"].includes(expectedStatus)||status===expectedStatus||!expectedUpdatedAt||!expectedSource)return Response.json({error:"예배 기록과 현재 상태·출처·갱신 시각을 확인해 주세요."},{status:400,headers});
  const db=database(),church=await approvedChurch(db,publicId);
  if(!church)return Response.json({error:"공개 중인 교회를 찾을 수 없습니다."},{status:404,headers});
  await ensureChurchDetailTables(db);
  const result=await db.prepare("UPDATE worship_schedules SET review_status=?,reviewed_at=CASE WHEN ?='approved' THEN ? ELSE reviewed_at END,updated_at=CURRENT_TIMESTAMP WHERE record_id=? AND church_id=? AND review_status=? AND updated_at=? AND source_url=? AND EXISTS (SELECT 1 FROM churches c WHERE c.id=worship_schedules.church_id AND c.review_status='approved') RETURNING record_id,review_status,reviewed_at,updated_at").bind(status,status,new Date().toISOString(),recordId,church.id,expectedStatus,expectedUpdatedAt,expectedSource).all();
  if(result.results.length!==1)return Response.json({error:"확인 이후 자료가 변경되어 상태를 바꾸지 않았습니다."},{status:409,headers});
  return Response.json({ok:true,item:result.results[0]},{headers});
}
