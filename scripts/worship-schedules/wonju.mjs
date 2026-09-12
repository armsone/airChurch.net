import { createHash } from "node:crypto";

const clean=value=>String(value??"").replace(/<[^>]*>/g," ").replace(/&nbsp;/gi," ").replace(/&#(x[0-9a-f]+|\d+);/gi,(_,n)=>{const p=n[0].toLowerCase()==="x"?parseInt(n.slice(1),16):Number(n);return p>0&&p<=0x10ffff?String.fromCodePoint(p):" ";}).replace(/&amp;/gi,"&").replace(/\s+/g," ").trim();
const attr=(tag,name)=>tag.match(new RegExp(`\\s${name}\\s*=\\s*["']([^"']*)["']`,"i"))?.[1]??"";
const hidden=tag=>/\shidden(?:\s|=|>)/i.test(tag)||attr(tag,"aria-hidden")==="true"||/(?:^|\s)(?:hidden|hide|d-none)(?:\s|$)/i.test(attr(tag,"class"))||/(?:display\s*:\s*none|visibility\s*:\s*hidden)/i.test(attr(tag,"style"));

function tablesInContent(html){
  const body=String(html).replace(/<!--[\s\S]*?-->/g,"").replace(/<(head|script|style|nav|header|footer)\b[^>]*>[\s\S]*?<\/\1>/gi,"");
  const stack=[],tables=[];
  for(const token of body.matchAll(/<\/?div\b[^>]*>|<table\b[^>]*>[\s\S]*?<\/table>/gi)){
    const tag=token[0];
    if(/^<\/div/i.test(tag)){stack.pop();continue;}
    if(/^<div/i.test(tag)){const p=stack.at(-1);stack.push({content:p?.content||attr(tag,"id")==="content",hidden:p?.hidden||hidden(tag)});continue;}
    const p=stack.at(-1),opening=tag.slice(0,tag.indexOf(">")+1);
    if(p?.content&&!p.hidden&&!hidden(opening)&&/(?:^|\s)timetable(?:\s|$)/.test(attr(opening,"class")))tables.push(tag);
  }
  return tables;
}

export function extractWonjuSchedules({church,sourceUrl,html,collectedAt=new Date().toISOString(),sourceLastModified=null}){
  let url;try{url=new URL(sourceUrl);}catch{return null;}
  if(url.hostname.replace(/^www\./,"")!=="wjmc.or.kr")return null;
  if(url.origin!=="https://wjmc.or.kr"||url.username||url.password||url.port||url.pathname!=="/worship/worship-information/"||url.search||url.hash)return [];
  if(Number(church.church_id)!==251||church.church_name!=="원주제일교회"||church.region?.replace(/\s/g,"")!=="강원원주"||church.denomination?.replace(/\s/g,"")!=="기독교대한감리회")return [];
  const tables=tablesInContent(html);if(tables.length!==1)return [];
  const rows=[...tables[0].matchAll(/<tr\b([^>]*)>([\s\S]*?)<\/tr>/gi)];
  const cells=row=>[...row.matchAll(/<t[hd]\b([^>]*)>([\s\S]*?)<\/t[hd]>/gi)];
  if(JSON.stringify(cells(rows[0]?.[2]||"").map(c=>clean(c[2])))!==JSON.stringify(["예배","시간","위치"]))return [];
  const records=[];
  for(const row of rows.slice(1)){
    if(hidden(`<tr ${row[1]}>`))continue;
    const raw=cells(row[2]);
    // This source has independent three-cell rows. Changed merge geometry
    // requires review rather than borrowing a previous row's label or time.
    if(raw.length!==3||raw.some(c=>hidden(`<td ${c[1]}>`)||/\b(?:rowspan|colspan)\s*=/i.test(c[1])))return [];
    const [label,clock]=raw.map(c=>clean(c[2]));
    const venue=raw[2][2].split(/<br\s*\/?\s*>/i).map(clean).filter(Boolean).join(" / ");
    if(!label||!venue||/매월|월삭/.test(`${label} ${clock}`))continue;
    const daySet=new Set();
    for(const m of `${label} ${clock}`.matchAll(/주일|일요일|월요일|화요일|수요일|목요일|금요일|토요일|수요(?=예배|오전기도회)/g))daySet.add(({주일:"SUN",일요일:"SUN",월요일:"MON",화요일:"TUE",수요일:"WED",목요일:"THU",금요일:"FRI",토요일:"SAT",수요:"WED"})[m[0]]);
    if(daySet.size!==1)continue;
    const time=clock.match(/^(?:(?:주일|[월화수목금토일]요일)\s+)?(오전|오후|저녁)\s+(\d{1,2}):([0-5]\d)$/);
    if(!time||Number(time[2])<1||Number(time[2])>12)continue;
    const days=[...daySet],startTime=`${String(Number(time[2])%12+(time[1]==="오전"?0:12)).padStart(2,"0")}:${time[3]}`;
    const record={record_id:"",church_id:church.church_id,church_name:church.church_name,service_type:label,day_of_week:days,start_time:startTime,venue_audience:venue,source_text:`${label} | ${clock} | ${venue}`,source_url:sourceUrl,collected_at:collectedAt,source_last_modified:sourceLastModified,confidence:"medium",review_status:"hold",flags:["manual_review_required"]};
    record.record_id=createHash("sha256").update([record.church_id,label,days.join(","),startTime,venue].join("|")).digest("hex").slice(0,24);
    records.push(record);
  }
  // Both official names stay separate candidates; their shared slot is not
  // evidence that they are different services or that they may be merged.
  const youth=records.filter(r=>["청년부","젊은이예배"].includes(r.service_type));
  if(youth.length===2&&youth[0].start_time===youth[1].start_time&&youth[0].day_of_week.join()===youth[1].day_of_week.join()&&youth[0].venue_audience===youth[1].venue_audience)for(const r of youth)r.flags.push("possible_duplicate_young_adult_service");
  return [...new Map(records.map(r=>[r.record_id,r])).values()];
}
