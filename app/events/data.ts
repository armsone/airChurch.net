import type { EventParticipation } from "./participation";
import { database } from "../api/_shared";
import { sources as newsSources } from "../api/church-news/route";
import { officialEventSources, additionalDiscoverySources, eventSourceCandidates } from "./sources";
import { eventAudiences,eventCategories,eventRegions,koreaDate,type ChurchEvent,type EventSource } from "./types";
import { validDate } from "./extract";

const columns="e.id,e.title,e.start_date AS startDate,e.end_date AS endDate,e.start_time AS startTime,e.venue,e.region,e.attendance,e.organizer,e.audience,e.category,e.source_url AS sourceUrl,e.registration_url AS registrationUrl,e.checked_at AS checkedAt,e.status,c.public_id AS churchPublicId,s.name AS sourceName";
const participationColumn="(SELECT ec.payload FROM event_candidates ec WHERE ec.event_id=e.id AND ec.source_id=e.source_id AND ec.url=e.source_url AND ec.content_hash=e.content_hash AND ec.status=e.status ORDER BY ec.checked_at DESC LIMIT 1) AS participationPayload";
const joins="FROM events e JOIN event_sources s ON s.id=e.source_id LEFT JOIN churches c ON c.id=e.church_id";
const visible="s.enabled=1 AND (e.church_id IS NULL OR c.review_status='approved')";
export async function withDeadline<T>(work:Promise<T>,ms=4500){let timer:ReturnType<typeof setTimeout>|undefined;try{return await Promise.race([work,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error("database_timeout")),ms);})]);}finally{clearTimeout(timer);}}
export async function readEventSources():Promise<EventSource[]>{
  const configs=[...officialEventSources,...additionalDiscoverySources,...newsSources.map((s,i)=>({id:`news-${i}`,name:s.name,homepage:s.homepage,url:s.url,kind:"rss"})).filter(s=>!additionalDiscoverySources.some(other=>other.homepage.replace(/\/$/,"")===s.homepage.replace(/\/$/,"")))];
  const rows=await database().prepare("SELECT s.id,s.enabled,s.last_checked_at AS lastCheckedAt,s.last_success_at AS lastSuccessAt,s.status,s.candidate_count AS candidateCount,(SELECT COUNT(*) FROM events e LEFT JOIN churches c ON c.id=e.church_id WHERE e.source_id=s.id AND (e.church_id IS NULL OR c.review_status='approved') AND e.status='published' AND e.end_date>=? AND e.valid_until>?) AS eventCount FROM event_sources s").bind(koreaDate(),new Date().toISOString()).all<EventSource&{enabled:number}>();
  return [...configs.filter(s=>rows.results.find(r=>r.id===s.id)?.enabled!==0).map(s=>{const row=rows.results.find(r=>r.id===s.id);return {...s,lastCheckedAt:null,lastSuccessAt:null,status:"pending",candidateCount:0,eventCount:0,...row,...(row?.lastCheckedAt&&Date.now()-Date.parse(row.lastCheckedAt)>12*3600000?{status:"stale"}:{})};}),...eventSourceCandidates.map((s,i)=>({...s,id:`candidate-${i}`,homepage:s.url,kind:"candidate",lastCheckedAt:null,lastSuccessAt:null,status:"candidate",candidateCount:0,eventCount:0}))];
}
export async function readEvents(params:URLSearchParams){
  const today=koreaDate(),now=new Date().toISOString();
  const from=params.get("from")||today,to=params.get("to")||koreaDate(new Date(Date.now()+365*86400000));
  if(!validDate(from)||!validDate(to)||from>to||Date.parse(to)-Date.parse(from)>366*86400000)throw Error("invalid_filter");
  const filters=[visible,"e.status='published'","e.valid_until>?","e.end_date>=?","e.end_date>=?","e.start_date<=?"],values:Array<string|number>=[now,today,from,to];
  const region=params.get("region"),category=params.get("category"),audience=params.get("audience"),church=params.get("church");
  if(region){if(!eventRegions.includes(region))throw Error("invalid_filter");filters.push("e.region=?");values.push(region);}
  if(category){if(!eventCategories.includes(category))throw Error("invalid_filter");filters.push("e.category=?");values.push(category);}
  if(audience){if(!eventAudiences.includes(audience))throw Error("invalid_filter");filters.push("e.audience=?");values.push(audience);}
  if(church){if(!/^\d+$/.test(church))throw Error("invalid_filter");filters.push("c.public_id=?");values.push(Number(church));}
  if(params.get("online")==="1")filters.push("e.attendance IN ('온라인','현장·온라인')");
  const timeOrder="COALESCE(e.start_time,'99:99')";
  const cursor=params.get("cursor");if(cursor){const parts=cursor.split("|"),[date,time,id]=parts;if(parts.length!==3||!validDate(date)||!(time==="99:99"||/^([01]\d|2[0-3]):[0-5]\d$/.test(time))||!id?.match(/^[a-f0-9]{32}$/)||params.get("preview")==="1")throw Error("invalid_filter");filters.push(`(e.start_date>? OR (e.start_date=? AND (${timeOrder}>? OR (${timeOrder}=? AND e.id>?))))`);values.push(date,date,time,time,id);}
  const limit=Math.max(1,Math.min(100,Math.floor(Number(params.get("limit"))||100)));
  const preview=params.get("preview")==="1";
  const order=`${preview?"CASE WHEN e.start_date<? THEN 1 ELSE 0 END,":""}e.start_date,${timeOrder},e.id`;
  const [rows,sources]=await Promise.all([database().prepare(`SELECT ${columns},${participationColumn} ${joins} WHERE ${filters.join(" AND ")} ORDER BY ${order} LIMIT ?`).bind(...values,...(preview?[today]:[]),limit+1).all<ChurchEvent&{participationPayload:string|null}>(),readEventSources()]);
  const items=rows.results.slice(0,limit).map(({participationPayload,...item})=>{
    const {participation}=readParticipationPayload(participationPayload);
    const cardParticipation:EventParticipation={};
    if(participation?.registrationClosesOn)cardParticipation.registrationClosesOn=participation.registrationClosesOn;
    if(participation?.audienceText)cardParticipation.audienceText=participation.audienceText;
    return {...item,...(Object.keys(cardParticipation).length?{participation:cardParticipation}:{})};
  }),last=items.at(-1);
  return {items,sources,nextCursor:!preview&&rows.results.length>limit&&last?`${last.startDate}|${last.startTime||"99:99"}|${last.id}`:null};
}
export async function readEvent(id:string){
  if(!/^[a-f0-9]{32}$/.test(id))return null;
  const row=await database().prepare(`SELECT ${columns},e.valid_until AS validUntil,${participationColumn} ${joins} WHERE e.id=? AND ${visible} LIMIT 1`).bind(id).first<ChurchEvent&{validUntil:string;participationPayload:string|null}>();
  if(!row)return null;
  const {participationPayload,...item}=row;
  return {...item,...readParticipationPayload(participationPayload)};
}
function readParticipationPayload(participationPayload:string|null){
  let participation:EventParticipation|null=null,scheduleChanged=false;
  try{
    const payload=JSON.parse(participationPayload||"null");
    scheduleChanged=payload?.status==="checking";
    const value=payload?.participation;
    if(value&&typeof value==="object"&&!Array.isArray(value)){
      const parsed:EventParticipation={};
      for(const key of ["audienceText","cost","registrationInstructions","preparation","registrationDeadline"] as const){
        if(typeof value[key]==="string"&&value[key].trim()&&value[key].length<=2000)parsed[key]=value[key];
      }
      if(typeof value.registrationClosesOn==="string"&&validDate(value.registrationClosesOn))parsed.registrationClosesOn=value.registrationClosesOn;
      if(Object.keys(parsed).length)participation=parsed;
    }
  }catch{/* Unavailable source details remain absent. */}
  return {participation,scheduleChanged};
}
