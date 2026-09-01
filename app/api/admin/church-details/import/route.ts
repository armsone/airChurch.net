import { accessSession } from "../../../../admin-access";
import { clean,database,ensureChurchDetailTables,ensureMinistryProfileTables,ensureSermonTables,readLimitedJson,requestOriginIsInvalid } from "../../../_shared";
import { safeHttpUrl } from "../../../../safe-url";

type Operation={action?:unknown;key?:unknown;values?:Record<string,unknown>};
const SENSITIVE=/(?:[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|(?:헌금|후원|입금)\s*계좌|(?:휴대폰|핸드폰)\s*[:：]?\s*01[016789][\d-]{7,})/i;
const iso=(value:string)=>/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value);
const dateLike=(value:string)=>/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z)?$/.test(value);
const ROLE_CATEGORIES=new Set(["current_primary","associate","education","cooperating","emeritus","retired"]);
const ROLE_TITLES=new Set(["담임목사","위임목사","대표목사","수석부목사","부목사","행정목사","목양목사","교육목사","강도사","전임전도사","교육전도사","전도사","협동목사","원로목사","은퇴목사"]);
async function digest(value:unknown){const bytes=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(JSON.stringify(value)));return [...new Uint8Array(bytes)].map((item)=>item.toString(16).padStart(2,"0")).join("")}

export async function POST(request:Request){
  if(requestOriginIsInvalid(request))return Response.json({error:"요청을 확인할 수 없습니다."},{status:403});
  const session=await accessSession(request);if(!session||session.role!=="admin")return Response.json({error:"관리자 권한이 필요합니다."},{status:403});
  const body=await readLimitedJson(request,524_288);if(body.tooLarge)return Response.json({error:"가져오기 파일이 너무 큽니다."},{status:413});
  const plan=body.data.plan as {metadata?:Record<string,unknown>;operations?:Operation[]}|undefined,confirmedDigest=clean(body.data.confirmedDigest,64);
  const operations=plan?.operations,metadata=plan?.metadata;
  if(!Array.isArray(operations)||operations.length<1||operations.length>100)return Response.json({error:"한 번에 1~100건만 반영할 수 있습니다."},{status:400});
  const calculated=await digest(operations),declared=clean(metadata?.sha256,64);
  if(metadata?.reviewComplete!==true||metadata?.approvalVerified!==true||metadata?.requires_separate_apply_authorization!==true||!/^[0-9a-f]{64}$/.test(declared)||declared!==calculated||confirmedDigest!==declared)return Response.json({error:"전체 검토와 승인 해시를 다시 확인해 주세요."},{status:409});
  const parsed:Array<{action:"schedule"|"profile"|"minister"|"appearance";churchId:number;values:Record<string,string|null>}>=[];
  for(const operation of operations){
    const values=operation.values??{},churchId=Number(values.church_id),sourceUrl=safeHttpUrl(clean(values.source_url,500)),reviewedAt=clean(values.reviewed_at,40),reviewStatus=clean(values.review_status,20);
    if(!Number.isInteger(churchId)||churchId<1||!sourceUrl||reviewStatus!=="approved"||!iso(reviewedAt))return Response.json({error:"승인된 출처와 교회 ID를 확인해 주세요."},{status:400});
    if(operation.action==="upsert_reviewed_worship_schedule"){
      const recordId=clean(values.record_id,80),serviceType=clean(values.service_type,100),days=clean(values.day_of_week,80),startTime=clean(values.start_time,5),venue=clean(values.venue_audience,200)||null,sourceText=clean(values.source_text,1000),collectedAt=clean(values.collected_at,40),confidence=clean(values.confidence,20);
      if(!/^[0-9a-f]{24}$/.test(recordId)||!serviceType||!/^\[(?:"(?:MON|TUE|WED|THU|FRI|SAT|SUN)"(?:,)*)+\]$/.test(days)||!/^\d{2}:\d{2}$/.test(startTime)||!iso(collectedAt)||!confidence||SENSITIVE.test(sourceText)||SENSITIVE.test(venue??""))return Response.json({error:"예배시간 항목의 형식 또는 공개 범위를 확인해 주세요."},{status:400});
      parsed.push({action:"schedule",churchId,values:{recordId,serviceType,days,startTime,venue,sourceText,sourceUrl,collectedAt,confidence,reviewedAt}});
    }else if(operation.action==="upsert_reviewed_church_profile"){
      const slogan=clean(values.slogan,200)||null,vision=clean(values.vision,600)||null,summary=clean(values.summary,1000)||null,address=clean(values.address,300)||null,collectedAt=clean(values.collected_at,40);
      if(!iso(collectedAt)||[slogan,vision,summary,address].some((value)=>SENSITIVE.test(value??"")))return Response.json({error:"교회 소개 항목의 형식 또는 공개 범위를 확인해 주세요."},{status:400});
      parsed.push({action:"profile",churchId,values:{slogan,vision,summary,address,sourceUrl,collectedAt,reviewedAt}});
    }else if(operation.action==="upsert_reviewed_ministry_profile"){
      const name=clean(values.name,60).replace(/\s*목사(?:님)?$/u,""),roleTitle=clean(values.role_title,40),roleCategory=clean(values.role_category,30),roleStatus=clean(values.role_status,20),sourceCheckedAt=clean(values.source_checked_at,40);
      if(name.length<2||!ROLE_TITLES.has(roleTitle)||!ROLE_CATEGORIES.has(roleCategory)||!["current","former"].includes(roleStatus)||!iso(sourceCheckedAt)||SENSITIVE.test(name))return Response.json({error:"목회자 이력의 신원·직분·출처를 확인해 주세요."},{status:400});
      parsed.push({action:"minister",churchId,values:{name,roleTitle,roleCategory,roleStatus,sourceUrl,sourceCheckedAt,reviewedAt}});
    }else if(operation.action==="upsert_reviewed_ministry_appearance"){
      const ministerName=clean(values.minister_name,60).replace(/\s*목사(?:님)?$/u,""),roleTitle=clean(values.role_title,40),hostChurchName=clean(values.host_church_name,100),eventTitle=clean(values.event_title,200),videoId=clean(values.video_id,20)||null,occurredAt=clean(values.occurred_at,40),sourceCheckedAt=clean(values.source_checked_at,40);
      if(ministerName.length<2||!ROLE_TITLES.has(roleTitle)||!hostChurchName||!eventTitle||videoId&&!/^[\w-]{11}$/.test(videoId)||!dateLike(occurredAt)||!iso(sourceCheckedAt)||[ministerName,hostChurchName,eventTitle].some((value)=>SENSITIVE.test(value)))return Response.json({error:"초청 설교·외부 사역의 인물·날짜·공식 출처를 확인해 주세요."},{status:400});
      parsed.push({action:"appearance",churchId,values:{ministerName,roleTitle,hostChurchName,eventTitle,sourceUrl,videoId,occurredAt,sourceCheckedAt,reviewedAt}});
    }else return Response.json({error:"지원하지 않는 반영 작업입니다."},{status:400});
  }
  const db=database();await Promise.all([ensureSermonTables(db),ensureChurchDetailTables(db),ensureMinistryProfileTables(db)]);
  const churchIds=[...new Set(parsed.map((item)=>item.churchId))],placeholders=churchIds.map(()=>"?").join(",");
  const approved=await db.prepare(`SELECT id FROM churches WHERE review_status='approved' AND id IN (${placeholders})`).bind(...churchIds).all<{id:number}>();
  if(new Set(approved.results.map((item)=>item.id)).size!==churchIds.length)return Response.json({error:"보류되었거나 등록되지 않은 교회가 포함되어 있습니다."},{status:409});
  let schedules=0,profiles=0,ministers=0,appearances=0;
  for(let offset=0;offset<parsed.length;offset+=50){const statements=parsed.slice(offset,offset+50).map((item)=>{
    if(item.action==="schedule"){schedules++;return db.prepare("INSERT INTO worship_schedules (record_id,church_id,service_type,day_of_week,start_time,venue_audience,source_text,source_url,collected_at,confidence,review_status,reviewed_at) VALUES (?,?,?,?,?,?,?,?,?,?,'approved',?) ON CONFLICT(record_id) DO UPDATE SET church_id=excluded.church_id,service_type=excluded.service_type,day_of_week=excluded.day_of_week,start_time=excluded.start_time,venue_audience=excluded.venue_audience,source_text=excluded.source_text,source_url=excluded.source_url,collected_at=excluded.collected_at,confidence=excluded.confidence,review_status='approved',reviewed_at=excluded.reviewed_at,updated_at=CURRENT_TIMESTAMP").bind(item.values.recordId,item.churchId,item.values.serviceType,item.values.days,item.values.startTime,item.values.venue,item.values.sourceText,item.values.sourceUrl,item.values.collectedAt,item.values.confidence,item.values.reviewedAt);}
    if(item.action==="profile"){profiles++;return db.prepare("INSERT INTO church_profiles (church_id,slogan,vision,summary,address,source_url,source_text,collected_at,review_status,reviewed_at) VALUES (?,?,?,?,?,?,?,?,'approved',?) ON CONFLICT(church_id) DO UPDATE SET slogan=excluded.slogan,vision=excluded.vision,summary=excluded.summary,address=excluded.address,source_url=excluded.source_url,source_text=excluded.source_text,collected_at=excluded.collected_at,review_status='approved',reviewed_at=excluded.reviewed_at,updated_at=CURRENT_TIMESTAMP").bind(item.churchId,item.values.slogan,item.values.vision,item.values.summary,item.values.address,item.values.sourceUrl,"관리자 승인 import plan",item.values.collectedAt,item.values.reviewedAt);}
    if(item.action==="minister"){ministers++;return db.prepare("INSERT INTO church_ministry_profiles (church_id,name,role_title,role_category,role_status,source_url,source_checked_at,review_status) VALUES (?,?,?,?,?,?,?,'approved') ON CONFLICT(church_id,name,role_title,role_status) DO UPDATE SET role_category=excluded.role_category,source_url=excluded.source_url,source_checked_at=excluded.source_checked_at,review_status='approved',updated_at=CURRENT_TIMESTAMP").bind(item.churchId,item.values.name,item.values.roleTitle,item.values.roleCategory,item.values.roleStatus,item.values.sourceUrl,item.values.sourceCheckedAt);}
    appearances++;return db.prepare("INSERT INTO ministry_appearances (church_id,minister_name,role_title,host_church_name,event_title,source_url,video_id,occurred_at,source_checked_at,review_status) VALUES (?,?,?,?,?,?,?,?,?,'approved') ON CONFLICT(source_url,minister_name,event_title) DO UPDATE SET church_id=excluded.church_id,role_title=excluded.role_title,host_church_name=excluded.host_church_name,video_id=excluded.video_id,occurred_at=excluded.occurred_at,source_checked_at=excluded.source_checked_at,review_status='approved'").bind(item.churchId,item.values.ministerName,item.values.roleTitle,item.values.hostChurchName,item.values.eventTitle,item.values.sourceUrl,item.values.videoId,item.values.occurredAt,item.values.sourceCheckedAt);
  });
    await db.batch(statements);
  }
  return Response.json({ok:true,digest:calculated,operations:parsed.length,schedules,profiles,ministers,appearances},{headers:{"cache-control":"no-store"}});
}
