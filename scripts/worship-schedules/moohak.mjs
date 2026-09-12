import { createHash } from "node:crypto";

const attr=(tag,name)=>tag.match(new RegExp(`\\s${name}\\s*=\\s*["']([^"']*)["']`,"i"))?.[1]??"";
const clean=value=>String(value??"").replace(/<[^>]*>/g," ").replace(/&nbsp;|&#160;/gi," ").replace(/&#(x[0-9a-f]+|\d+);/gi,(_,n)=>{const p=n[0].toLowerCase()==="x"?parseInt(n.slice(1),16):Number(n);return p>0&&p<=0x10ffff?String.fromCodePoint(p):" ";}).replace(/&amp;/gi,"&").replace(/[\u200b\ufeff]/g,"").replace(/\s+/g," ").trim();
const hidden=tag=>/\shidden(?:\s|=|>)/i.test(tag)||attr(tag,"aria-hidden").toLowerCase()==="true"||/(?:^|\s)(?:hide|hidden|d-none)(?:\s|$)/i.test(attr(tag,"class"))||/display\s*:\s*none|visibility\s*:\s*hidden/i.test(attr(tag,"style"));

function contentTables(html){
  const body=String(html).replace(/<!--[\s\S]*?-->/g,"").replace(/<(head|script|style|nav|header|footer)\b[^>]*>[\s\S]*?<\/\1>/gi,"");
  const stack=[],tables=[];
  for(const token of body.matchAll(/<\/?div\b[^>]*>|<table\b[^>]*>[\s\S]*?<\/table>/gi)){
    const tag=token[0],p=stack.at(-1);
    if(/^<\/div/i.test(tag)){stack.pop();continue;}
    if(/^<div/i.test(tag)){const id=attr(tag,"id");stack.push({content:Boolean(p?.content)||/(?:^|\s)page-content(?:\s|$)/.test(attr(tag,"class")),component:/^component\d+$/.test(id)?id:p?.component,hidden:Boolean(p?.hidden)||hidden(tag)});continue;}
    const opening=tag.slice(0,tag.indexOf(">")+1);
    if(p?.content&&p.component==="component9965"&&!p.hidden&&!hidden(opening)&&/(?:^|\s)worship_01(?:\s|$)/.test(attr(opening,"class")))tables.push(tag);
  }
  return tables;
}

function expandedRows(table){
  if([...table.matchAll(/<[a-z][^>]*>/gi)].some(m=>hidden(m[0])))return null;
  const rows=[...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)],spans=[],result=[];
  let width=0;
  for(const [index,row] of rows.entries()){
    const values=[];let column=0;
    for(let i=0;i<spans.length;i++)if(spans[i]?.left>0){values[i]=spans[i].text;spans[i].left--;}
    for(const cell of row[1].matchAll(/<td\b([^>]*)>([\s\S]*?)<\/td>/gi)){
      const tag=`<td ${cell[1]}>`,w=Number(attr(tag,"colspan")||1),h=Number(attr(tag,"rowspan")||1),text=clean(cell[2]);
      if(w!==1||!Number.isInteger(h)||h<1||h>rows.length-index)return null;
      while(values[column]!==undefined)column++;
      if(column>=4)return null;
      values[column]=text;spans[column]={text,left:h-1};column++;
    }
    if(index===0)width=values.length;
    if(![3,4].includes(width)||values.length!==width||Array.from({length:width},(_,i)=>values[i]).some(x=>x===undefined))return null;
    result.push(values);
  }
  return result;
}

export function extractMoohakSchedules({church,sourceUrl,html,collectedAt=new Date().toISOString(),sourceLastModified=null}){
  let url;try{url=new URL(sourceUrl);}catch{return null;}
  if(url.hostname.replace(/^www\./,"")!=="moohak.org")return null;
  if(sourceUrl!=="http://www.moohak.org/Page/Index/20")return [];
  if(Number(church.church_id)!==1600||church.church_name!=="무학교회"||church.region?.replace(/\s/g,"")!=="서울성동"||church.denomination?.replace(/\s/g,"")!=="대한예수교장로회통합")return [];
  const tables=contentTables(html);if(tables.length!==3)return [];
  const records=[],dayMap={주일:"SUN",일요일:"SUN",월요일:"MON",화요일:"TUE",수요일:"WED",목요일:"THU",금요일:"FRI",토요일:"SAT"};
  for(const table of tables){
    const rows=expandedRows(table);if(!rows)return [];
    for(const cells of rows){
      const label=cells[0],clock=cells.at(-2),venue=cells.at(-1);
      if(!label||!venue||/매월|월삭/.test(`${label} ${clock}`))continue;
      const time=clock.match(/^(주일|[월화수목금토일]요일|매일|월\s*[~～–-]\s*[금토])\s+(오전|오후|새벽)\s+(\d{1,2}:[0-5]\d(?:\s*\/\s*\d{1,2}:[0-5]\d)*)$/);
      if(!time)continue;
      const clocks=time[3].split(/\s*\/\s*/);
      if(clocks.some(c=>{const hour=Number(c.split(":")[0]);return hour<1||hour>12||(time[2]==="새벽"&&hour===12);}))continue;
      const days=time[1]==="매일"?["MON","TUE","WED","THU","FRI","SAT","SUN"]:/^월/.test(time[1])&&/[금토]$/.test(time[1])?["MON","TUE","WED","THU","FRI",...(time[1].endsWith("토")?["SAT"]:[])]:[dayMap[time[1]]];
      if(days.some(x=>!x))continue;
      for(const c of clocks){const [h,m]=c.split(":"),start=`${String(Number(h)%12+(time[2]==="오후"?12:0)).padStart(2,"0")}:${m}`;
        // Keep the shared 1/2부 name and the age cell in evidence; do not
        // guess a one-to-one session assignment from the order of clocks.
        const record={record_id:"",church_id:church.church_id,church_name:church.church_name,service_type:label,day_of_week:days,start_time:start,venue_audience:venue,source_text:`component9965 | ${cells.join(" | ")}`,source_url:sourceUrl,collected_at:collectedAt,source_last_modified:sourceLastModified,confidence:"medium",review_status:"hold",flags:["manual_review_required",...(clocks.length>1?["shared_session_label"]:[])]};
        record.record_id=createHash("sha256").update([record.church_id,label,days.join(","),start,venue].join("|")).digest("hex").slice(0,24);records.push(record);
      }
    }
  }
  return [...new Map(records.map(r=>[r.record_id,r])).values()];
}
