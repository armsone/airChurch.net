import { createHash } from "node:crypto";

const attr=(tag,name)=>tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`,"i"))?.[1]??"";
const clean=value=>String(value??"").replace(/<[^>]*>/g," ").replace(/&nbsp;|&#160;/gi," ").replace(/&amp;/gi,"&").replace(/\s+/g," ").trim();
const hidden=tag=>/\bhidden(?:\s|=|>)/i.test(tag)||attr(tag,"aria-hidden")==="true"||/(?:^|\s)(?:hide|hidden|d-none)(?:\s|$)/i.test(attr(tag,"class"))||/(?:display\s*:\s*none|visibility\s*:\s*hidden)/i.test(attr(tag,"style"));

// component8961 is reused for all three sections. Scope by visible section
// headings and table structure, never by first occurrence of the duplicate ID.
function tables(html){
  const body=String(html).replace(/<!--[\s\S]*?-->/g,"").replace(/<(script|style|head|nav|header|footer)\b[^>]*>[\s\S]*?<\/\1>/gi,"");
  const stack=[],result=[];let section=null;
  for(const token of body.matchAll(/<table\b[^>]*>[\s\S]*?<\/table>|<[^>]+>|[^<]+/gi)){
    const text=token[0],parent=stack.at(-1);
    if(/^<table\b/i.test(text)){
      if(parent?.component==="component8961"&&!parent.hidden&&section&&!hidden(text.slice(0,text.indexOf(">")+1)))result.push({section,html:text});
      section=null;continue;
    }
    const closing=text.match(/^<\/([\w-]+)/);
    if(closing){const index=stack.findLastIndex(x=>x.tag===closing[1].toLowerCase());if(index>=0)stack.length=index;continue;}
    const opening=text.match(/^<([\w-]+)/);
    if(opening){const tag=opening[1].toLowerCase();if(!/^(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/.test(tag)&&!text.endsWith("/>"))stack.push({tag,hidden:Boolean(parent?.hidden)||hidden(text),component:attr(text,"id")==="component8961"?"component8961":parent?.component});continue;}
    if(parent?.component==="component8961"&&!parent.hidden&&["주일예배","평일예배","다음세대"].includes(clean(text)))section=clean(text);
  }
  return new Set(result.map(x=>x.section)).size===result.length?result:[];
}

function grid(table,width){
  const rows=[...table.matchAll(/<tr\b([^>]*)>([\s\S]*?)<\/tr>/gi)],spans=[],result=[];
  for(const [index,row]of rows.entries()){
    if(hidden(`<tr ${row[1]}>`))return null;
    const cells=[];let col=0;
    for(let i=0;i<spans.length;i++)if(spans[i]?.left>0){cells[i]=spans[i].text;spans[i].left--;}
    for(const cell of row[2].matchAll(/<t[dh]\b([^>]*)>([\s\S]*?)<\/t[dh]>/gi)){
      const tag=`<td ${cell[1]}>`,text=clean(cell[2]),w=Number(attr(tag,"colspan")||1),h=Number(attr(tag,"rowspan")||1);
      if(hidden(tag)||!Number.isInteger(w)||w<1||w>width||!Number.isInteger(h)||h<1||h>rows.length-index)return null;
      while(cells[col]!==undefined)col++;
      for(let i=0;i<w;i++){if(col>=width||cells[col]!==undefined)return null;cells[col]=text;spans[col]={text,left:h-1};col++;}
    }
    if(cells.length!==width||cells.some(x=>x===undefined))return null;
    result.push(cells);
  }
  return result;
}

export function extractAllakSchedules({church,sourceUrl,html,collectedAt=new Date().toISOString(),sourceLastModified=null}){
  let url;try{url=new URL(sourceUrl);}catch{return null;}
  if(url.hostname.replace(/^www\./,"")!=="allak.or.kr")return null;
  if(!["http:","https:"].includes(url.protocol)||url.hostname!=="www.allak.or.kr"||url.port||url.username||url.password||url.pathname!=="/Page/Index/35"||url.search||url.hash)return [];
  if(Number(church.church_id)!==1739||church.church_name!=="안락교회"||church.region?.replace(/\s/g,"")!=="부산동래"||church.denomination?.replace(/\s/g,"")!=="대한예수교장로회통합")return [];
  const records=[];
  for(const table of tables(html)){
    const width=table.section==="다음세대"?5:4,rows=grid(table.html,width);
    if(!rows||JSON.stringify(rows[0].map(x=>x.replace(/\s/g,"")))!==JSON.stringify([...Array(width-2).fill("구분"),"시간","장소"]))continue;
    for(const cells of rows.slice(1)){
      const label=table.section==="주일예배"?(cells[0]==="주일"?`주일예배 ${cells[1]}`:cells[1]):cells[width-3],clock=cells[width-2],venue=cells[width-1];
      const time=clock.match(/^(?:주일\s+)?(오전|오후)\s*(\d{1,2}):([0-5]\d)$/);
      if(!label||!venue||!time||Number(time[2])<1||Number(time[2])>12)continue;
      const clues=new Set();if(table.section==="주일예배"||/주일/.test(clock))clues.add("SUN");if(/수요/.test(label))clues.add("WED");if(/금요/.test(label))clues.add("FRI");
      // The weekday table's dawn service has no precise weekdays: skip it.
      if(clues.size!==1)continue;
      const days=[...clues],start=`${String(Number(time[2])%12+(time[1]==="오후"?12:0)).padStart(2,"0")}:${time[3]}`;
      const record={record_id:"",church_id:church.church_id,church_name:church.church_name,service_type:label,day_of_week:days,start_time:start,venue_audience:venue,source_text:`${table.section} | ${label} | ${clock} | ${venue}`.slice(0,500),source_url:sourceUrl,collected_at:collectedAt,source_last_modified:sourceLastModified,confidence:"medium",review_status:"hold",flags:["manual_review_required"]};
      record.record_id=createHash("sha256").update([record.church_id,label,days.join(","),start,venue].join("|")).digest("hex").slice(0,24);records.push(record);
    }
  }
  return [...new Map(records.map(r=>[r.record_id,r])).values()];
}
