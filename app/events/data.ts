import { database } from "../api/_shared";
import { sources as newsSources } from "../api/church-news/route";
import { officialEventSources } from "./sources";
import { eventAudiences,eventCategories,eventRegions,koreaDate,type ChurchEvent,type EventSource } from "./types";
import { validDate } from "./extract";

const columns="e.id,e.title,e.start_date AS startDate,e.end_date AS endDate,e.start_time AS startTime,e.venue,e.region,e.attendance,e.organizer,e.audience,e.category,e.source_url AS sourceUrl,e.registration_url AS registrationUrl,e.checked_at AS checkedAt,e.status,c.public_id AS churchPublicId,s.name AS sourceName";
const joins="FROM events e JOIN event_sources s ON s.id=e.source_id LEFT JOIN churches c ON c.id=e.church_id";
const visible="s.enabled=1 AND (e.church_id IS NULL OR c.review_status='approved')";
export async function withDeadline<T>(work:Promise<T>,ms=4500){let timer:ReturnType<typeof setTimeout>|undefined;try{return await Promise.race([work,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error("database_timeout")),ms);})]);}finally{clearTimeout(timer);}}
export async function readEventSources():Promise<EventSource[]>{
  const configs=[...officialEventSources,...newsSources.map((s,i)=>({id:`news-${i}`,name:s.name,homepage:s.homepage,url:s.url,kind:"rss"}))];
  const rows=await database().prepare("SELECT s.id,s.enabled,s.last_checked_at AS lastCheckedAt,s.last_success_at AS lastSuccessAt,s.status,s.candidate_count AS candidateCount,(SELECT COUNT(*) FROM events e LEFT JOIN churches c ON c.id=e.church_id WHERE e.source_id=s.id AND (e.church_id IS NULL OR c.review_status='approved') AND e.status='published' AND e.end_date>=? AND e.valid_until>?) AS eventCount FROM event_sources s").bind(koreaDate(),new Date().toISOString()).all<EventSource&{enabled:number}>();
  return configs.filter(s=>rows.results.find(r=>r.id===s.id)?.enabled!==0).map(s=>{const row=rows.results.find(r=>r.id===s.id);return {...s,lastCheckedAt:null,lastSuccessAt:null,status:"pending",candidateCount:0,eventCount:0,...row,...(row?.lastCheckedAt&&Date.now()-Date.parse(row.lastCheckedAt)>12*3600000?{status:"stale"}:{})};});
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
  const cursor=params.get("cursor");if(cursor){const [date,id]=cursor.split("|");if(!validDate(date)||!id?.match(/^[a-f0-9]{32}$/))throw Error("invalid_filter");filters.push("(e.start_date>? OR (e.start_date=? AND e.id>?))");values.push(date,date,id);}
  const limit=Math.max(1,Math.min(100,Math.floor(Number(params.get("limit"))||100)));
  const [rows,sources]=await Promise.all([database().prepare(`SELECT ${columns} ${joins} WHERE ${filters.join(" AND ")} ORDER BY e.start_date,e.id LIMIT ?`).bind(...values,limit+1).all<ChurchEvent>(),readEventSources()]);
  const items=rows.results.slice(0,limit),last=items.at(-1);
  return {items,sources,nextCursor:rows.results.length>limit&&last?`${last.startDate}|${last.id}`:null};
}
export async function readEvent(id:string){if(!/^[a-f0-9]{32}$/.test(id))return null;return database().prepare(`SELECT ${columns},e.valid_until AS validUntil ${joins} WHERE e.id=? AND ${visible} LIMIT 1`).bind(id).first<ChurchEvent&{validUntil:string}>();}
