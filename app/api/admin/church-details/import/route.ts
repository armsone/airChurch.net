import { accessSession } from "../../../../admin-access";
import { clean,database,ensureChurchDetailTables,ensureMinistryProfileTables,ensureSermonTables,readLimitedJson,requestOriginIsInvalid } from "../../../_shared";
import { safeHttpUrl } from "../../../../safe-url";
import { isValidPastorName } from "../../../../pastor-name";

type Operation={action?:unknown;key?:unknown;values?:Record<string,unknown>};
const SENSITIVE=/(?:[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|(?:헌금|후원|입금)\s*계좌|(?:휴대폰|핸드폰)\s*[:：]?\s*01[016789][\d-]{7,})/i;
const iso=(value:string)=>/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value);
const validDays=(value:string)=>{try{const days=JSON.parse(value);return Array.isArray(days)&&days.length>0&&days.length<=7&&new Set(days).size===days.length&&days.every(day=>typeof day==="string"&&["MON","TUE","WED","THU","FRI","SAT","SUN"].includes(day));}catch{return false;}};
// Comparison only: ASCII space/tab/CR/LF, NBSP and ideographic space.
// Keep these exact code points identical in JS and SQLite; never rewrite source fields.
const scheduleSpaceCodes=[32,9,13,10,160,12288];
const scheduleText=(value:string|null)=>String(value??"").replace(/[ \t\r\n\u00a0\u3000]/g,"");
const scheduleSqlText=(column:string)=>scheduleSpaceCodes.reduce((sql,code)=>`replace(${sql},char(${code}),'')`,`coalesce(${column},'')`);
const safeScheduleDays="CASE WHEN json_valid(ws.day_of_week) THEN CASE WHEN json_type(ws.day_of_week)='array' THEN ws.day_of_week ELSE '[]' END ELSE '[]' END";
// Exact sorted JSON equality also rejects malformed, repeated or unsupported day values:
// the incoming array has already passed validDays and contains unique supported strings.
const sameScheduleSql=`ws.church_id=? AND ${scheduleSqlText("ws.service_type") }=? AND ws.start_time=? AND ${scheduleSqlText("ws.venue_audience") }=? AND (SELECT json_group_array(value) FROM (SELECT value FROM json_each(${safeScheduleDays}) ORDER BY value))=?`;
const scheduleComparison=(item:{churchId:number;values:Record<string,string|null>})=>[item.churchId,scheduleText(item.values.serviceType),item.values.startTime!,scheduleText(item.values.venue),JSON.stringify((JSON.parse(item.values.days!) as string[]).sort())] as const;
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
  if(body.data.preserveExisting!==undefined&&typeof body.data.preserveExisting!=="boolean")return Response.json({error:"기존 자료 보존 여부는 true 또는 false로 지정해 주세요."},{status:400});
  const preserveExisting=body.data.preserveExisting===true;
  if(!Array.isArray(operations)||operations.length<1||operations.length>100)return Response.json({error:"한 번에 1~100건만 반영할 수 있습니다."},{status:400});
  if(preserveExisting&&operations.some(operation=>operation.action!=="upsert_reviewed_worship_schedule"))return Response.json({error:"기존 자료 보존 모드에서는 예배시간만 신규 등록할 수 있습니다."},{status:400});
  const calculated=await digest(operations),declared=clean(metadata?.sha256,64);
  if(metadata?.reviewComplete!==true||metadata?.approvalVerified!==true||metadata?.requires_separate_apply_authorization!==true||!/^[0-9a-f]{64}$/.test(declared)||declared!==calculated||confirmedDigest!==declared)return Response.json({error:"전체 검토와 승인 해시를 다시 확인해 주세요."},{status:409});
  const parsed:Array<{action:"schedule"|"profile"|"minister"|"appearance";churchId:number;values:Record<string,string|null>}>=[];
  for(const operation of operations){
    const values=operation.values??{},churchId=Number(values.church_id),sourceUrl=safeHttpUrl(clean(values.source_url,500)),reviewedAt=clean(values.reviewed_at,40),reviewStatus=clean(values.review_status,20);
    if(!Number.isInteger(churchId)||churchId<1||!sourceUrl||reviewStatus!=="approved"||!iso(reviewedAt))return Response.json({error:"승인된 출처와 교회 ID를 확인해 주세요."},{status:400});
    if(operation.action==="upsert_reviewed_worship_schedule"){
      const recordId=clean(values.record_id,80),serviceType=clean(values.service_type,100),days=clean(values.day_of_week,80),startTime=clean(values.start_time,5),venue=clean(values.venue_audience,200)||null,sourceText=clean(values.source_text,1000),collectedAt=clean(values.collected_at,40),confidence=clean(values.confidence,20);
      if(!/^[0-9a-f]{24}$/.test(recordId)||!serviceType||!validDays(days)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime)||!iso(collectedAt)||!confidence||SENSITIVE.test(sourceText)||SENSITIVE.test(venue??""))return Response.json({error:"예배시간 항목의 형식 또는 공개 범위를 확인해 주세요."},{status:400});
      parsed.push({action:"schedule",churchId,values:{recordId,serviceType,days,startTime,venue,sourceText,sourceUrl,collectedAt,confidence,reviewedAt}});
    }else if(operation.action==="upsert_reviewed_church_profile"){
      const slogan=clean(values.slogan,200)||null,vision=clean(values.vision,600)||null,summary=clean(values.summary,1000)||null,address=clean(values.address,300)||null,collectedAt=clean(values.collected_at,40);
      if(!iso(collectedAt)||[slogan,vision,summary,address].some((value)=>SENSITIVE.test(value??"")))return Response.json({error:"교회 소개 항목의 형식 또는 공개 범위를 확인해 주세요."},{status:400});
      parsed.push({action:"profile",churchId,values:{slogan,vision,summary,address,sourceUrl,collectedAt,reviewedAt}});
    }else if(operation.action==="upsert_reviewed_ministry_profile"){
      const name=clean(values.name,60).replace(/\s*목사(?:님)?$/u,""),roleTitle=clean(values.role_title,40),roleCategory=clean(values.role_category,30),roleStatus=clean(values.role_status,20),sourceCheckedAt=clean(values.source_checked_at,40);
      if(name.length<2||!isValidPastorName(name)||!ROLE_TITLES.has(roleTitle)||!ROLE_CATEGORIES.has(roleCategory)||!["current","former"].includes(roleStatus)||!iso(sourceCheckedAt)||SENSITIVE.test(name))return Response.json({error:"목회자 이력의 신원·직분·출처를 확인해 주세요."},{status:400});
      parsed.push({action:"minister",churchId,values:{name,roleTitle,roleCategory,roleStatus,sourceUrl,sourceCheckedAt,reviewedAt}});
    }else if(operation.action==="upsert_reviewed_ministry_appearance"){
      const ministerName=clean(values.minister_name,60).replace(/\s*목사(?:님)?$/u,""),roleTitle=clean(values.role_title,40),hostChurchName=clean(values.host_church_name,100),eventTitle=clean(values.event_title,200),videoId=clean(values.video_id,20)||null,occurredAt=clean(values.occurred_at,40),sourceCheckedAt=clean(values.source_checked_at,40);
      if(ministerName.length<2||!isValidPastorName(ministerName)||!ROLE_TITLES.has(roleTitle)||!hostChurchName||!eventTitle||videoId&&!/^[\w-]{11}$/.test(videoId)||!dateLike(occurredAt)||!iso(sourceCheckedAt)||[ministerName,hostChurchName,eventTitle].some((value)=>SENSITIVE.test(value)))return Response.json({error:"초청 설교·외부 사역의 인물·날짜·공식 출처를 확인해 주세요."},{status:400});
      parsed.push({action:"appearance",churchId,values:{ministerName,roleTitle,hostChurchName,eventTitle,sourceUrl,videoId,occurredAt,sourceCheckedAt,reviewedAt}});
    }else return Response.json({error:"지원하지 않는 반영 작업입니다."},{status:400});
  }
  const db=database();await Promise.all([ensureSermonTables(db),ensureChurchDetailTables(db),ensureMinistryProfileTables(db)]);
  const churchIds=[...new Set(parsed.map((item)=>item.churchId))],placeholders=churchIds.map(()=>"?").join(",");
  const approved=await db.prepare(`SELECT id FROM churches WHERE review_status='approved' AND id IN (${placeholders})`).bind(...churchIds).all<{id:number}>();
  if(new Set(approved.results.map((item)=>item.id)).size!==churchIds.length)return Response.json({error:"보류되었거나 등록되지 않은 교회가 포함되어 있습니다."},{status:409});
  if(preserveExisting){
    const recordIds=parsed.map(item=>item.values.recordId!);
    if(new Set(recordIds).size!==recordIds.length)return Response.json({error:"중복된 예배 기록이 있어 반영하지 않았습니다."},{status:409});
    const comparisons=parsed.map(scheduleComparison),comparisonKeys=comparisons.map(value=>JSON.stringify(value));
    if(new Set(comparisonKeys).size!==comparisonKeys.length)return Response.json({error:"공백이나 요일 순서만 다른 동일 일정이 있어 반영하지 않았습니다.",insertedRecordIds:[]},{status:409,headers:{"cache-control":"no-store"}});
    const existing=await db.prepare(`SELECT record_id FROM worship_schedules WHERE record_id IN (${recordIds.map(()=>"?").join(",")})`).bind(...recordIds).all<{record_id:string}>();
    if(existing.results.length)return Response.json({error:"이미 있는 예배 기록은 덮어쓰지 않았습니다. 상태 변경은 개별 검토로 진행해 주세요.",conflictingRecordIds:existing.results.map(row=>row.record_id),insertedRecordIds:[]},{status:409,headers:{"cache-control":"no-store"}});
    const duplicates=await db.batch<{record_id:string}>(comparisons.map(values=>db.prepare(`SELECT ws.record_id FROM worship_schedules ws WHERE ${sameScheduleSql}`).bind(...values)));
    const duplicateIds=[...new Set(duplicates.flatMap(result=>result.results.map(row=>row.record_id)))];
    if(duplicateIds.length)return Response.json({error:"공백이나 요일 순서만 다른 기존 일정이 있습니다. 보류 자료도 개별 검토로 처리해 주세요.",conflictingRecordIds:duplicateIds,insertedRecordIds:[]},{status:409,headers:{"cache-control":"no-store"}});
    const results=await db.batch<{record_id:string}>(parsed.map((item,index)=>db.prepare(`INSERT INTO worship_schedules (record_id,church_id,service_type,day_of_week,start_time,venue_audience,source_text,source_url,collected_at,confidence,review_status,reviewed_at) SELECT ?,?,?,?,?,?,?,?,?,?,'approved',? WHERE EXISTS (SELECT 1 FROM churches WHERE id=? AND review_status='approved') AND NOT EXISTS (SELECT 1 FROM worship_schedules ws WHERE ${sameScheduleSql}) ON CONFLICT(record_id) DO NOTHING RETURNING record_id`).bind(item.values.recordId,item.churchId,item.values.serviceType,item.values.days,item.values.startTime,item.values.venue,item.values.sourceText,item.values.sourceUrl,item.values.collectedAt,item.values.confidence,item.values.reviewedAt,item.churchId,...comparisons[index])));
    const insertedRecordIds=results.flatMap(result=>result.results.map(row=>row.record_id)),inserted=new Set(insertedRecordIds),skippedRecordIds=recordIds.filter(id=>!inserted.has(id));
    if(skippedRecordIds.length)return Response.json({error:"등록 중 자료나 교회 상태가 변경되었습니다. 기존 기록은 보존했으며 신규 반영 결과를 확인해 주세요.",insertedRecordIds,skippedRecordIds,schedules:insertedRecordIds.length},{status:409,headers:{"cache-control":"no-store"}});
    return Response.json({ok:true,digest:calculated,operations:parsed.length,schedules:insertedRecordIds.length,profiles:0,ministers:0,appearances:0,insertedRecordIds},{headers:{"cache-control":"no-store"}});
  }
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
