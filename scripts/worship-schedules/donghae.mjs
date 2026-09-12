import { createHash } from "node:crypto";

const clean=value=>String(value??"").replace(/<[^>]*>/g," ").replace(/&nbsp;|&#160;/gi," ").replace(/&#(x[0-9a-f]+|\d+);/gi,(_,value)=>{const point=value[0].toLowerCase()==="x"?parseInt(value.slice(1),16):Number(value);return point>0&&point<=0x10ffff?String.fromCodePoint(point):" ";}).replace(/&amp;/gi,"&").replace(/\s+/g," ").trim();
const attribute=(tag,name)=>tag.match(new RegExp(`(?:\\s|<)${name}\\s*=\\s*["']([^"']*)["']`,"i"))?.[1]??"";
const hidden=tag=>/\shidden(?:\s|=|>)/i.test(tag)||attribute(tag,"aria-hidden").toLowerCase()==="true"||/(?:^|\s)(?:hide|hidden|d-none)(?:\s|$)/i.test(attribute(tag,"class"))||/(?:display\s*:\s*none|visibility\s*:\s*hidden)/i.test(attribute(tag,"style"));

function visibleTables(html){
  const body=String(html).replace(/<!--[\s\S]*?-->/g,"").replace(/<(script|style|head|nav|header|footer)\b[^>]*>[\s\S]*?<\/\1>/gi,"");
  const stack=[],tables=[];
  for(const token of body.matchAll(/<div\b[^>]*class=["']font-xl["'][^>]*>[^<]*<\/div>|<\/?div\b[^>]*>|<table\b[^>]*>[\s\S]*?<\/table>/gi)){
    const tag=token[0],parent=stack.at(-1);
    if(/^<div\b[^>]*class=["']font-xl["']/i.test(tag)){
      if(parent?.component==="component6833")parent.section=!parent.hidden&&!hidden(tag.slice(0,tag.indexOf(">")+1))?clean(tag):"";
      continue;
    }
    if(/^<\/div/i.test(tag)){stack.pop();continue;}
    if(/^<div/i.test(tag)){
      const id=attribute(tag,"id"),newComponent=/^component\d+$/.test(id);
      stack.push({hidden:Boolean(parent?.hidden)||hidden(tag),component:newComponent?id:parent?.component,section:newComponent?"":parent?.section??""});
      continue;
    }
    if(parent?.component!=="component6833"||parent.hidden||!["주일예배","주중예배","다음세대 예배"].includes(parent.section)||hidden(tag.slice(0,tag.indexOf(">")+1)))continue;
    if(!/(?:^|\s)worship_01(?:\s|$)/.test(attribute(tag.slice(0,tag.indexOf(">")+1),"class")))continue;
    // Hidden rows/cells with merged cells need a separate review; do not let
    // their values propagate into visible rows as inherited names or places.
    if([...tag.matchAll(/<(?:tr|td|th)\b[^>]*>/gi)].some(match=>hidden(match[0])))continue;
    tables.push({html:tag,section:parent.section});
  }
  return tables;
}

export function extractDonghaeSchedules({church,sourceUrl,html,collectedAt=new Date().toISOString(),sourceLastModified=null}){
  let url;try{url=new URL(sourceUrl);}catch{return null;}
  if(url.hostname.replace(/^www\./,"")!=="dhchurch.net")return null;
  if(url.origin!=="https://www.dhchurch.net"||url.username||url.password||url.port||url.pathname!=="/Page/Index/16"||url.search||url.hash)return [];
  if(Number(church.church_id)!==335||church.church_name!=="동해교회"||church.region?.replace(/\s/g,"")!=="강원동해"||church.denomination?.replace(/\s/g,"")!=="기독교대한감리회")return [];
  const records=[],dayMap={주일:"SUN",일요일:"SUN",월요일:"MON",화요일:"TUE",수요일:"WED",목요일:"THU",금요일:"FRI",토요일:"SAT"};
  for(const table of visibleTables(html)){
    const rows=[...table.html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)];
    const headings=[...(rows[0]?.[1]??"").matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi)].map(cell=>clean(cell[1]).replace(/\s/g,""));
    if(JSON.stringify(headings)!==JSON.stringify(["구분","시간","장소"]))continue;
    const spans=[];
    for(const row of rows.slice(1)){
      const cells=[];let column=0;
      for(let i=0;i<spans.length;i++)if(spans[i]?.left>0){cells[i]=spans[i].value;spans[i].left--;}
      for(const cell of row[1].matchAll(/<td\b([^>]*)>([\s\S]*?)<\/td>/gi)){
        const attrs=`<td ${cell[1]}>`,count=Number(attribute(attrs,"colspan")||1),height=Number(attribute(attrs,"rowspan")||1),value=clean(cell[2]);
        if(!Number.isInteger(count)||count<1||count>3||!Number.isInteger(height)||height<1||height>rows.length)return [];
        while(cells[column]!==undefined)column++;
        for(let i=0;i<count;i++){if(cells[column]!==undefined)return [];cells[column]=value;spans[column]={value,left:height-1};column++;}
      }
      if(cells.length!==3||!cells[0]||!cells[2])continue;
      const time=cells[1].match(/^(?:(주일|[월화수목금토일]요일|월\s*[~～–-]\s*금)\s+)?(오전|오후)\s+(\d{1,2}):([0-5]\d)$/);
      if(!time||Number(time[3])<1||Number(time[3])>12)continue;
      const days=time[1]?(/^월\s*[~～–-]\s*금$/.test(time[1])?["MON","TUE","WED","THU","FRI"]:[dayMap[time[1]]]):table.section==="주일예배"?["SUN"]:[];
      if(!days.length||days.some(day=>!day))continue;
      const startTime=`${String(Number(time[3])%12+(time[2]==="오후"?12:0)).padStart(2,"0")}:${time[4]}`;
      const record={record_id:"",church_id:church.church_id,church_name:church.church_name,service_type:cells[0],day_of_week:days,start_time:startTime,venue_audience:cells[2],source_text:`component6833 | ${table.section} | ${cells.join(" | ")}`.slice(0,500),source_url:sourceUrl,collected_at:collectedAt,source_last_modified:sourceLastModified,confidence:"medium",review_status:"hold",flags:["manual_review_required"]};
      record.record_id=createHash("sha256").update([record.church_id,record.service_type,days.join(","),startTime,record.venue_audience].join("|")).digest("hex").slice(0,24);
      records.push(record);
    }
  }
  return [...new Map(records.map(record=>[record.record_id,record])).values()];
}
