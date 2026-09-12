import { createHash } from "node:crypto";

const attr=(tag,name)=>tag.match(new RegExp(`\\s${name}\\s*=\\s*["']([^"']*)["']`,"i"))?.[1]??"";
const clean=value=>String(value??"").replace(/<[^>]*>/g," ").replace(/&nbsp;|&#160;/gi," ").replace(/&amp;/gi,"&").replace(/\s+/g," ").trim();
const hidden=tag=>/\shidden(?:\s|=|>)/i.test(tag)||attr(tag,"aria-hidden")==="true"||/(?:^|\s)(?:hide|hidden|d-none)(?:\s|$)/i.test(attr(tag,"class"))||/(?:display\s*:\s*none|visibility\s*:\s*hidden)/i.test(attr(tag,"style"));

function contentTables(html){
  const body=String(html).replace(/<!--[\s\S]*?-->/g,"").replace(/<(head|script|style|nav|header|footer)\b[^>]*>[\s\S]*?<\/\1>/gi,"");
  const stack=[],tables=[];
  for(const token of body.matchAll(/<\/?div\b[^>]*>|<table\b[^>]*>[\s\S]*?<\/table>/gi)){
    const tag=token[0],parent=stack.at(-1);
    if(/^<\/div/i.test(tag)){stack.pop();continue;}
    if(/^<div/i.test(tag)){stack.push({content:Boolean(parent?.content)||/(?:^|\s)page-content(?:\s|$)/.test(attr(tag,"class")),hidden:Boolean(parent?.hidden)||hidden(tag),component:attr(tag,"id")==="component6166"?"component6166":parent?.component});continue;}
    const opening=tag.slice(0,tag.indexOf(">")+1),kind=attr(opening,"class").split(/\s+/).filter(x=>["t_1","t_2"].includes(x));
    if(parent?.content&&!parent.hidden&&parent.component==="component6166"&&!hidden(opening)&&kind.length===1)tables.push({kind:kind[0],html:tag});
  }
  // Duplicate component IDs are expected, but duplicate table kinds are not.
  return tables.length===2&&new Set(tables.map(x=>x.kind)).size===2?tables:[];
}

function tableRows(html,width){
  const rows=[...html.matchAll(/<tr\b([^>]*)>([\s\S]*?)<\/tr>/gi)],spans=[],result=[];
  for(const[index,row]of rows.entries()){
    if(hidden(`<tr ${row[1]}>`))return null;
    const cells=[];let col=0;
    for(let i=0;i<spans.length;i++)if(spans[i]?.left>0){cells[i]=spans[i].text;spans[i].left--;}
    for(const cell of row[2].matchAll(/<t[dh]\b([^>]*)>([\s\S]*?)<\/t[dh]>/gi)){
      const tag=`<td ${cell[1]}>`,text=clean(cell[2]),w=Number(attr(tag,"colspan")||1),h=Number(attr(tag,"rowspan")||1);
      if(hidden(tag)||!Number.isInteger(w)||w<1||w>width||!Number.isInteger(h)||h<1||h>rows.length-index)return null;
      while(cells[col]!==undefined)col++;
      for(let i=0;i<w;i++){if(col>=width||cells[col]!==undefined)return null;cells[col]=text;spans[col]={text,left:h-1};col++;}
    }
    if(cells.length!==width||Array.from({length:width},(_,i)=>cells[i]).some(x=>x===undefined))return null;
    result.push(cells);
  }
  return result;
}

export function extractChangsinSchedules({church,sourceUrl,html,collectedAt=new Date().toISOString(),sourceLastModified=null}){
  let url;try{url=new URL(sourceUrl);}catch{return null;}
  if(url.hostname.replace(/^www\./,"")!=="csjch.or.kr")return null;
  if(url.origin!=="https://www.csjch.or.kr"||url.username||url.password||url.port||url.pathname!=="/Page/Index/610"||url.search||url.hash)return [];
  if(Number(church.church_id)!==603||church.church_name!=="창신제일교회"||church.region?.replace(/\s/g,"")!=="서울종로"||church.denomination?.replace(/\s/g,"")!=="대한예수교장로회합동")return [];
  const records=[];
  for(const table of contentTables(html)){
    const adult=table.kind==="t_1",rows=tableRows(table.html,adult?4:3);
    if(!rows||JSON.stringify(rows[0].map(x=>x.replace(/\s/g,"")))!==JSON.stringify(adult?["구분","시간","시간","장소"]:["구분","시간","장소"]))return [];
    for(const cells of rows.slice(1)){
      const rawLabel=cells[0].replace(/\s/g,""),session=adult&&rawLabel==="주일예배"?cells[1]:null;
      if(session&&!/^[1-9]\d*부$/.test(session))continue;
      const label=session?`${rawLabel} ${session}`:rawLabel,clock=cells[adult?2:1],venue=cells.at(-1);
      const time=clock.match(/^(매일|주일|[월화수목금토일]요일)\s+(새벽|오전|오후)\s*(\d{1,2})시(?:\s*(\d{1,2})분)?$|^(오전|오후)\s*(\d{1,2})시(?:\s*(\d{1,2})분)?$/);
      if(!label||!venue||!time)continue;
      const day=time[1],period=time[2]||time[5],hour=Number(time[3]||time[6]),minute=Number(time[4]||time[7]||0);
      if(hour<1||hour>12||minute>59||(period==="새벽"&&hour===12))continue;
      let days=[];
      if(day==="매일")days=["MON","TUE","WED","THU","FRI","SAT","SUN"];
      else if(day)days=[({주일:"SUN",일요일:"SUN",월요일:"MON",화요일:"TUE",수요일:"WED",목요일:"THU",금요일:"FRI",토요일:"SAT"})[day]];
      else if(session)days=["SUN"]; // The rowspan cell explicitly says 주일예배.
      if(!days.length||days.some(x=>!x))continue;
      if((/주일/.test(label)&&!days.includes("SUN"))||(/수요/.test(label)&&!days.includes("WED"))||(/금요/.test(label)&&!days.includes("FRI")))continue;
      const start=`${String(hour%12+(period==="오후"?12:0)).padStart(2,"0")}:${String(minute).padStart(2,"0")}`;
      const record={record_id:"",church_id:church.church_id,church_name:church.church_name,service_type:label,day_of_week:days,start_time:start,venue_audience:venue,source_text:`본문 ${table.kind} | ${label} | ${clock} | ${venue}`,source_url:sourceUrl,collected_at:collectedAt,source_last_modified:sourceLastModified,confidence:"medium",review_status:"hold",flags:["manual_review_required"]};
      record.record_id=createHash("sha256").update([record.church_id,label,days.join(","),start,venue].join("|")).digest("hex").slice(0,24);records.push(record);
    }
  }
  return [...new Map(records.map(r=>[r.record_id,r])).values()];
}
