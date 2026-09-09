import { database } from "../api/_shared";
import { sources as newsSources } from "../api/church-news/route";
import { officialEventSources, type SourceConfig } from "./sources";
import { eventWords, extractEvent, links, noticeStatus, plain } from "./extract";
import { koreaDate } from "./types";

const AGENT="AirChurchEvents/1.0 (+https://airchurch.net/contact)";
export const collectionSources:SourceConfig[]=[...officialEventSources,...newsSources.map((s,i)=>({id:`news-${i}`,name:s.name,homepage:s.homepage,url:s.url,kind:"rss" as const,detailPattern:""}))];
const host=(url:string)=>new URL(url).hostname.replace(/^www\./,"");
export async function digest(value:string){return [...new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value)))].map(x=>x.toString(16).padStart(2,"0")).join("");}
function after(hours:number){return new Date(Date.now()+hours*3600000).toISOString();}
async function boundedFetch(url:string,source:SourceConfig,pace?:()=>Promise<void>,robots?:string):Promise<{text:string;status:number}> {
  for(let redirect=0;redirect<4;redirect++){
    const u=new URL(url);if(!/^https?:$/.test(u.protocol)||u.username||u.password||u.port||host(url)!==host(source.url))throw Error("source_boundary");
    if(robots!==undefined&&!robotsAllowed(robots,url))throw Error("robots_disallowed");
    await pace?.();
    const r=await fetch(url,{redirect:"manual",signal:AbortSignal.timeout(7000),headers:{"user-agent":AGENT,accept:"text/html,application/rss+xml,application/xml,text/plain;q=0.8"}});
    if(r.status>=300&&r.status<400){const next=r.headers.get("location");void r.body?.cancel();if(!next)throw Error("redirect_without_location");url=new URL(next,url).href;continue;}
    if(!r.ok){void r.body?.cancel();return {text:"",status:r.status};}
    if(Number(r.headers.get("content-length")||0)>1500000){void r.body?.cancel();throw Error("response_too_large");}
    const reader=r.body?.getReader();if(!reader)return {text:"",status:r.status};const chunks:Uint8Array[]=[];let size=0;
    while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>1500000){void reader.cancel();throw Error("response_too_large");}chunks.push(value);}
    const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
    const charset=r.headers.get("content-type")?.match(/charset=([^;\s]+)/i)?.[1]?.replace(/["']/g,"")||"utf-8";
    return {text:new TextDecoder(charset).decode(bytes),status:r.status};
  }throw Error("too_many_redirects");
}
function robotsAllowed(text:string,url:string){
  const groups:Array<{agents:string[];rules:Array<{allow:boolean;path:string}>}>=[];let group:typeof groups[number]={agents:[],rules:[]};
  for(const raw of text.split(/\r?\n/)){const line=raw.replace(/#.*$/,"").trim(),colon=line.indexOf(":");if(colon<0)continue;const key=line.slice(0,colon).toLowerCase(),value=line.slice(colon+1).trim();
    if(key==="user-agent"){if(group.rules.length){groups.push(group);group={agents:[],rules:[]};}group.agents.push(value.toLowerCase());}
    else if((key==="allow"||key==="disallow")&&value)group.rules.push({allow:key==="allow",path:value});
  }groups.push(group);
  const specific=groups.filter(g=>g.agents.some(a=>a!=="*"&&AGENT.toLowerCase().includes(a))),selected=specific.length?specific:groups.filter(g=>g.agents.includes("*"));
  const u=new URL(url),path=u.pathname+u.search;
  const matches=selected.flatMap(g=>g.rules).filter(r=>{const end=r.path.endsWith("$"),pattern=(end?r.path.slice(0,-1):r.path).split("*").map(x=>x.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")).join(".*");return new RegExp(`^${pattern}${end?"$":""}`).test(path);}).sort((a,b)=>b.path.length-a.path.length||Number(b.allow)-Number(a.allow));
  return matches[0]?.allow??true;
}
async function pool<T>(items:T[],limit:number,fn:(x:T)=>Promise<void>){let at=0;await Promise.all(Array.from({length:Math.min(limit,items.length)},async()=>{while(at<items.length)await fn(items[at++]);}));}

async function discover(source:SourceConfig,html:string){
  if(source.kind==="rss"){
    return [...html.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)].flatMap(m=>{const title=plain(m[1].match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||""),url=plain(m[1].match(/<link[^>]*>([\s\S]*?)<\/link>/i)?.[1]||"");try{return eventWords.test(title)&&host(url)===host(source.url)?[{url,title}]:[];}catch{return [];}});
  }
  return links(html,source.url).filter(x=>host(x.url)===host(source.url)&&new RegExp(source.detailPattern,"i").test(x.url)&&x.url!==source.url&&x.title.length>2);
}
async function enqueue(source:SourceConfig,items:Array<{url:string;title:string}>,now:string){
  const db=database();const statements=await Promise.all(items.slice(0,150).map(async item=>db.prepare("INSERT INTO event_candidates(id,source_id,url,title,evidence,content_hash,status,first_seen_at,last_seen_at) VALUES(?,?,?,?,?,'','discovered',?,?) ON CONFLICT(id) DO UPDATE SET last_seen_at=excluded.last_seen_at,title=CASE WHEN length(excluded.title)>2 THEN excluded.title ELSE event_candidates.title END").bind((await digest(`${source.id}|${item.url}`)).slice(0,32),source.id,item.url,item.title.slice(0,180),"",now,now)));
  for(let i=0;i<statements.length;i+=40)await db.batch(statements.slice(i,i+40));
}
async function processSource(source:SourceConfig){
  const db=database(),now=new Date().toISOString(),token=crypto.randomUUID();
  const claim=await db.prepare("UPDATE event_sources SET lease_token=?,lease_until=?,status='running',last_checked_at=? WHERE id=? AND enabled=1 AND next_check_at<=? AND (lease_until IS NULL OR lease_until<?)").bind(token,after(0.25),now,source.id,now,now).run();
  if(Number(claim.meta.changes)!==1)return;
  try{
    const robots=await boundedFetch(new URL("/robots.txt",source.url).href,source);
    if(robots.status!==404&&robots.status!==200)throw Error("robots_unavailable");
    if(!robotsAllowed(robots.text,source.url))throw Error("robots_disallowed");
    // Honor the most conservative declared delay, even for other bot groups.
    const delay=Math.max(1000,...[...robots.text.matchAll(/^crawl-delay:\s*([\d.]+)/gim)].map(m=>Number(m[1])*1000));
    if(!Number.isFinite(delay)||delay>5000)throw Error("crawl_delay_requires_separate_schedule");
    let previous=Date.now();const pace=async()=>{await new Promise(resolve=>setTimeout(resolve,Math.max(0,delay-(Date.now()-previous))));previous=Date.now();};
    const page=await boundedFetch(source.url,source,pace,robots.text);if(page.status!==200)throw Error(`source_http_${page.status}`);
    const found=await discover(source,page.text);await enqueue(source,found,now);
    // Oldest checked candidates first: subsequent batches cover the queue, not just the latest few posts.
    const queue=await db.prepare("SELECT id,url,title,event_id AS eventId FROM event_candidates WHERE source_id=? AND (checked_at IS NULL OR checked_at<?) AND (last_seen_at>? OR event_id IS NOT NULL) ORDER BY CASE WHEN event_id IS NOT NULL THEN 0 ELSE 1 END,COALESCE(checked_at,''),first_seen_at DESC LIMIT 4").bind(source.id,after(-4),after(-24*30)).all<{id:string;url:string;title:string;eventId:string|null}>();
    let failed=0;
    for(const candidate of queue.results){
      if(!robotsAllowed(robots.text,candidate.url)){await db.prepare("UPDATE event_candidates SET status='blocked',reason='robots_disallowed',checked_at=? WHERE id=?").bind(now,candidate.id).run();continue;}
      let doc;try{doc=await boundedFetch(candidate.url,source,pace,robots.text);if(doc.status!==200)throw Error(`detail_http_${doc.status}`);}catch(error){failed++;await db.prepare("UPDATE event_candidates SET status='failed',reason=?,checked_at=? WHERE id=?").bind(String(error).slice(0,180),now,candidate.id).run();continue;}
      if(source.kind==="rss"){
        for(const official of officialEventSources){const references=links(doc.text,candidate.url).filter(x=>host(x.url)===host(official.url)&&new RegExp(official.detailPattern,"i").test(x.url));if(references.length)await enqueue(official,references,now);}
        await db.prepare("UPDATE event_candidates SET status='discovery_only',checked_at=? WHERE id=?").bind(now,candidate.id).run();continue;
      }
      const extracted=extractEvent(doc.text,candidate.url,source,candidate.title),value=extracted.event,hash=await digest(JSON.stringify(value??extracted.evidence));
      const notice=noticeStatus(`${extracted.title}\n${extracted.evidence}`);
      if(notice&&candidate.eventId)await db.prepare("UPDATE events SET status=?,updated_at=?,checked_at=? WHERE id=? AND source_url=?").bind(notice,now,now,candidate.eventId,candidate.url).run();
      if(!value){await db.batch([
        db.prepare("UPDATE event_candidates SET evidence=?,content_hash=?,status='checking',reason=?,checked_at=? WHERE id=?").bind(extracted.evidence,hash,extracted.reason,now,candidate.id),
        db.prepare("UPDATE events SET status='checking',updated_at=? WHERE id=? AND source_url=? AND status!='cancelled'").bind(now,candidate.eventId,candidate.url),
      ]);continue;}
      if(value.startDate>koreaDate(new Date(Date.now()+366*86400000))){await db.prepare("UPDATE event_candidates SET status='checking',reason='outside_collection_window',checked_at=? WHERE id=?").bind(now,candidate.id).run();continue;}
      const identity=[value.title,value.startDate,value.organizer,value.venue].map(x=>x.normalize("NFKC").replace(/\s+/g,"").toLowerCase()).join("|");
      const eventId=candidate.eventId||(await digest(identity)).slice(0,32);
      const church=source.churchName&&value.organizer.replace(/\s/g,"")===source.churchName.replace(/\s/g,"")?await db.prepare("SELECT id FROM churches WHERE name=? AND review_status='approved' LIMIT 2").bind(source.churchName).all<{id:number}>():null;
      const churchId=church?.results.length===1?church.results[0].id:null;
      const existing=await db.prepare("SELECT source_url AS url,content_hash AS hash FROM events WHERE id=?").bind(eventId).first<{url:string;hash:string}>();
      // A secondary source never rewrites the primary source's facts or provenance.
      if(existing&&existing.url!==candidate.url){const conflict=existing.hash!==hash;await db.prepare("UPDATE event_candidates SET event_id=?,evidence=?,content_hash=?,payload=?,status=?,reason=?,checked_at=? WHERE id=?").bind(eventId,extracted.evidence,hash,JSON.stringify(value),conflict?"checking":"corroborated",conflict?"conflicting_official_sources":null,now,candidate.id).run();if(conflict)await db.prepare("UPDATE events SET status='checking',updated_at=? WHERE id=? AND status!='cancelled'").bind(now,eventId).run();continue;}
      const conflict=await db.prepare("SELECT id FROM event_candidates WHERE event_id=? AND id!=? AND reason='conflicting_official_sources' AND content_hash!=? LIMIT 1").bind(eventId,candidate.id,hash).first();
      const status=value.status==="cancelled"?"cancelled":conflict?"checking":value.endDate<koreaDate()?"ended":value.status;
      if(!existing&&status!=="published"){await db.prepare("UPDATE event_candidates SET evidence=?,content_hash=?,payload=?,status=?,reason='not_public',checked_at=? WHERE id=?").bind(extracted.evidence,hash,JSON.stringify(value),status,now,candidate.id).run();continue;}
      await db.batch([
        db.prepare("INSERT INTO events(id,source_id,church_id,title,start_date,end_date,start_time,venue,region,attendance,organizer,audience,category,source_url,registration_url,status,checked_at,valid_until,content_hash,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET church_id=excluded.church_id,title=excluded.title,start_date=excluded.start_date,end_date=excluded.end_date,start_time=excluded.start_time,venue=excluded.venue,region=excluded.region,attendance=excluded.attendance,organizer=excluded.organizer,audience=excluded.audience,category=excluded.category,registration_url=excluded.registration_url,status=excluded.status,checked_at=excluded.checked_at,valid_until=excluded.valid_until,content_hash=excluded.content_hash,updated_at=excluded.updated_at").bind(eventId,source.id,churchId,value.title,value.startDate,value.endDate,value.startTime,value.venue,value.region,value.attendance,value.organizer,value.audience,value.category,candidate.url,value.registrationUrl,status,now,after(24),hash,now),
        db.prepare("UPDATE event_candidates SET event_id=?,title=?,evidence=?,content_hash=?,payload=?,status=?,reason=?,checked_at=? WHERE id=?").bind(eventId,value.title,extracted.evidence,hash,JSON.stringify(value),status,conflict?"conflicting_official_sources":null,now,candidate.id),
      ]);
    }
    const remaining=await db.prepare("SELECT COUNT(*) AS n FROM event_candidates WHERE source_id=? AND (checked_at IS NULL OR checked_at<?)").bind(source.id,after(-4)).first<{n:number}>();
    await db.prepare("UPDATE event_sources SET status=?,last_success_at=CASE WHEN ?=0 THEN ? ELSE last_success_at END,next_check_at=?,lease_until=NULL,lease_token=NULL,failures=?,candidate_count=?,last_error=? WHERE id=? AND lease_token=?").bind(failed?"failed":found.length||source.kind==="rss"?"ok":"blocked",failed,now,after(remaining?.n?0.25:failed?0.5:4),failed,found.length,failed?"detail_fetch_failed":null,source.id,token).run();
  }catch(error){await db.prepare("UPDATE event_sources SET status=?,next_check_at=?,lease_until=NULL,lease_token=NULL,failures=failures+1,last_error=? WHERE id=? AND lease_token=?").bind(String(error).includes("robots_disallowed")?"blocked":"failed",after(0.5),String(error).slice(0,180),source.id,token).run();}
}
export async function syncEvents(){
  const db=database(),now=new Date().toISOString();
  const seeds=collectionSources.map(s=>db.prepare("INSERT INTO event_sources(id,name,homepage,url,kind) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,homepage=excluded.homepage,url=excluded.url,kind=excluded.kind").bind(s.id,s.name,s.homepage,s.url,s.kind));
  await db.batch(seeds);
  const due=await db.prepare("SELECT id FROM event_sources WHERE enabled=1 AND next_check_at<=? AND (lease_until IS NULL OR lease_until<?) ORDER BY next_check_at,CASE kind WHEN 'official' THEN 0 ELSE 1 END LIMIT 3").bind(now,now).all<{id:string}>();
  await pool(due.results,3,async row=>{const source=collectionSources.find(s=>s.id===row.id);if(source)await processSource(source);});
  await db.batch([
    db.prepare("UPDATE events SET status='ended',updated_at=? WHERE end_date<? AND status='published'").bind(now,koreaDate()),
    db.prepare("UPDATE events SET status='checking',updated_at=? WHERE valid_until<? AND status='published'").bind(now,now),
  ]);
  return {ok:true,sourcesProcessed:due.results.length};
}
