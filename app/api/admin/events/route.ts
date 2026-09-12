import { accessSession } from "../../../admin-access";
import { syncEvents } from "../../../events/collection";
import { database, readLimitedJson } from "../../_shared";

const refreshableSources=["sorrygom","jiguchon","duranno-college","gwangya","melon","paidion","ncck","acts"];
type SourceHealth={id:string;enabled:number;status:string;nextCheckAt:string;leaseUntil:string|null;lastCheckedAt:string|null;lastSuccessAt:string|null;lastError:string|null;collectorVersion:number};
const healthColumns="id,enabled,status,next_check_at AS nextCheckAt,lease_until AS leaseUntil,last_checked_at AS lastCheckedAt,last_success_at AS lastSuccessAt,last_error AS lastError,collector_version AS collectorVersion";
const isDue=(source:SourceHealth,now:string)=>source.enabled===1&&source.nextCheckAt<=now&&(source.leaseUntil===null||source.leaseUntil<now);

export async function GET(request:Request){
  const headers={"cache-control":"no-store"};
  const url=new URL(request.url),origin=request.headers.get("origin");
  if((origin!==null&&origin!==url.origin)||request.headers.get("sec-fetch-site")==="cross-site")return Response.json({error:"접근할 수 없습니다."},{status:403,headers});
  if((await accessSession(request))?.role!=="admin")return Response.json({error:"관리자 권한이 필요합니다."},{status:403,headers});
  if(url.searchParams.get("view")==="health"){
    if(url.searchParams.getAll("view").length!==1||url.searchParams.has("sourceId"))return Response.json({error:"조회 조건을 확인해 주세요."},{status:400,headers});
    try{
      const now=new Date().toISOString();
      const rows=await database().prepare(`SELECT ${healthColumns} FROM event_sources WHERE enabled=1 ORDER BY id LIMIT 201`).all<SourceHealth>();
      return Response.json({checkedAt:now,limit:200,truncated:rows.results.length>200,sources:rows.results.slice(0,200).map(source=>({...source,due:isDue(source,now),refreshAllowed:refreshableSources.includes(source.id)}))},{headers});
    }catch{return Response.json({error:"출처 상태를 불러오지 못했습니다."},{status:503,headers});}
  }
  const sourceId=url.searchParams.get("sourceId");
  if(url.searchParams.getAll("sourceId").length!==1||!sourceId||!["sorrygom","jiguchon","duranno-college","gwangya","melon","ncck","paidion","acts"].includes(sourceId))return Response.json({error:"확인할 출처를 선택해 주세요."},{status:400,headers});
  try{
    const db=database(),now=new Date().toISOString();
    const source=await db.prepare("SELECT id,enabled,status,next_check_at AS nextCheckAt,lease_until AS leaseUntil,last_checked_at AS lastCheckedAt,last_success_at AS lastSuccessAt,last_error AS lastError,collector_version AS collectorVersion FROM event_sources WHERE id=?").bind(sourceId).first<{id:string;enabled:number;status:string;nextCheckAt:string;leaseUntil:string|null;lastCheckedAt:string|null;lastSuccessAt:string|null;lastError:string|null;collectorVersion:number}>();
    if(!source)return Response.json({error:"출처 상태를 찾을 수 없습니다."},{status:404,headers});
    const [sample,linked]=await Promise.all([
      db.prepare("SELECT status,checked_at AS checkedAt,last_seen_at AS lastSeenAt,event_id AS eventId FROM event_candidates WHERE source_id=? ORDER BY COALESCE(checked_at,''),first_seen_at DESC LIMIT 501").bind(sourceId).all<{status:string;checkedAt:string|null;lastSeenAt:string;eventId:string|null}>(),
      db.prepare("SELECT id,url,status,reason,checked_at AS checkedAt FROM event_candidates WHERE source_id=? AND event_id IS NOT NULL ORDER BY COALESCE(checked_at,''),id LIMIT 50").bind(sourceId).all<{id:string;url:string;status:string;reason:string|null;checkedAt:string|null}>(),
    ]);
    const rows=sample.results.slice(0,500),at=Date.parse(now),byStatus:Record<string,number>={};
    let unchecked=0,recheckDue=0,queueEligible=0;
    for(const row of rows){
      byStatus[row.status]=(byStatus[row.status]||0)+1;
      if(row.checkedAt===null)unchecked++;
      const due=row.checkedAt===null||Date.parse(row.checkedAt)<at-(["ignored","ended"].includes(row.status)?168:4)*3600000;
      if(due)recheckDue++;
      if(due&&(row.eventId!==null||Date.parse(row.lastSeenAt)>at-30*86400000))queueEligible++;
    }
    return Response.json({checkedAt:now,source:{...source,due:source.enabled===1&&source.nextCheckAt<=now&&(source.leaseUntil===null||source.leaseUntil<now)},queue:{sampleLimit:500,sampled:rows.length,truncated:sample.results.length>500,unchecked,recheckDue,queueEligible,byStatus},linkedCandidateLimit:50,linkedCandidates:linked.results},{headers});
  }catch{return Response.json({error:"출처 진단을 불러오지 못했습니다."},{status:503,headers});}
}

export async function POST(request:Request){
  if(request.headers.get("origin")!==new URL(request.url).origin)return Response.json({error:"접근할 수 없습니다."},{status:403});
  const session=await accessSession(request);
  if(session?.role!=="admin")return Response.json({error:"관리자 권한이 필요합니다."},{status:403});
  const body=await readLimitedJson(request);
  if(body.tooLarge)return Response.json({error:"요청이 너무 큽니다."},{status:413});
  if(!refreshableSources.includes(String(body.data.sourceId)))return Response.json({error:"확인할 출처를 선택해 주세요."},{status:400});
  try{return Response.json(await syncEvents(String(body.data.sourceId)),{headers:{"cache-control":"no-store"}});}
  catch{return Response.json({error:"출처 확인을 마치지 못했습니다."},{status:503,headers:{"cache-control":"no-store"}});}
}
