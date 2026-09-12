import { createHash } from "node:crypto";

const clean=value=>String(value??"").replace(/<[^>]*>/g," ").replace(/&nbsp;|&#160;/gi," ").replace(/&#(x[0-9a-f]+|\d+);/gi,(_,value)=>{const point=value[0].toLowerCase()==="x"?parseInt(value.slice(1),16):Number(value);return point>0&&point<=0x10ffff?String.fromCodePoint(point):" ";}).replace(/&amp;/gi,"&").replace(/\s+/g," ").trim();
const attribute=(tag,name)=>tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`,"i"))?.[1]??"";
const hidden=tag=>/\bhidden(?:\s|=|>)/i.test(tag)||attribute(tag,"aria-hidden")==="true"||/(?:^|\s)(?:hide|hidden|d-none)(?:\s|$)/i.test(attribute(tag,"class"))||/(?:display\s*:\s*none|visibility\s*:\s*hidden)/i.test(attribute(tag,"style"));

// The saved page repeats component7595 as a hidden, older timetable. Keep
// ancestor visibility and component scope instead of deduplicating by ID.
function visibleTables(html){
  const body=String(html).replace(/<!--[\s\S]*?-->/g,"").replace(/<(script|style|head|nav|header|footer)\b[^>]*>[\s\S]*?<\/\1>/gi,"");
  const stack=[],tables=[];
  for(const token of body.matchAll(/<\/?div\b[^>]*>|<table\b[^>]*>[\s\S]*?<\/table>/gi)){
    const tag=token[0];
    if(/^<\/div/i.test(tag)){stack.pop();continue;}
    if(/^<div/i.test(tag)){
      const parent=stack.at(-1),id=attribute(tag,"id");
      stack.push({hidden:Boolean(parent?.hidden)||hidden(tag),component:/^component\d+$/.test(id)?id:parent?.component});
      continue;
    }
    const parent=stack.at(-1);
    if(parent&&!parent.hidden&&!hidden(tag.slice(0,tag.indexOf(">")+1))&&["component7595","component1845"].includes(parent.component))tables.push({component:parent.component,html:tag});
  }
  // A second visible copy is ambiguous; do not choose whichever comes first.
  return new Set(tables.map(table=>table.component)).size===tables.length?tables:[];
}

function daysFor(label,clock){
  if(/월\s*[~～-]\s*금/.test(clock))return ["MON","TUE","WED","THU","FRI"];
  const days=new Set();
  const text=`${label} ${clock}`;
  for(const [pattern,day] of [[/주일|일요일/,"SUN"],[/월요일/,"MON"],[/화요일/,"TUE"],[/수요일|수요/,"WED"],[/목요일/,"THU"],[/금요일|금요/,"FRI"],[/토요일/,"SAT"]])if(pattern.test(text))days.add(day);
  return days.size===1?[...days]:[];
}

export function extractYeondongSchedules({church,sourceUrl,html,collectedAt,sourceLastModified}){
  let url;try{url=new URL(sourceUrl);}catch{return null;}
  if(url.hostname.replace(/^www\./,"")!=="ydpc.org")return null;
  if(url.origin!=="https://ydpc.org"||url.username||url.password||url.port||url.pathname!=="/Page/Index/163"||url.search||url.hash)return [];
  if(Number(church.church_id)!==291||church.church_name!=="연동교회"||church.region?.replace(/\s/g,"")!=="서울종로"||church.denomination?.replace(/\s/g,"")!=="대한예수교장로회통합")return [];
  const records=[];
  for(const table of visibleTables(html)){
    const rows=[...table.html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)];
    const headings=[...(rows[0]?.[1]??"").matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi)].map(cell=>clean(cell[1]).replace(/\s/g,""));
    const expected=table.component==="component7595"?["정기예배","시간","장소"]:["부서","구분","모임시간","장소"];
    if(JSON.stringify(headings)!==JSON.stringify(expected))continue;
    const timeColumn=headings.length-2,venueColumn=headings.length-1,spans=[];
    for(const row of rows.slice(1)){
      const cells=[];let column=0;
      for(let i=0;i<spans.length;i++)if(spans[i]?.left>0){cells[i]=spans[i].value;spans[i].left--;}
      for(const cell of row[1].matchAll(/<td\b([^>]*)>([\s\S]*?)<\/td>/gi)){
        while(cells[column]!==undefined)column++;
        const attrs=`<td ${cell[1]}>`,count=Number(attribute(attrs,"colspan")||1),height=Number(attribute(attrs,"rowspan")||1),value=clean(cell[2]);
        if(!Number.isInteger(count)||count<1||count>headings.length||!Number.isInteger(height)||height<1||height>rows.length)return [];
        for(let i=0;i<count;i++){cells[column]=value;spans[column]={value,left:height-1};column++;}
      }
      if(cells.length!==headings.length||!cells[0]||!cells[venueColumn])continue;
      const label=cells[0],clock=cells[timeColumn],days=daysFor(label,clock);
      // One range represents one service. Convert its first clock only; an
      // omitted afternoon marker on the endpoint never becomes a new service.
      const time=clock.match(/(?:^|\s)(오전|오후)\s*(\d{1,2}):([0-5]\d)\s*[-~～–]\s*(?:(?:오전|오후)\s*)?(\d{1,2}):([0-5]\d)\s*$/);
      if(!days.length||!time||Number(time[2])<1||Number(time[2])>12||Number(time[4])<1||Number(time[4])>12)continue;
      const startTime=`${String(Number(time[2])%12+(time[1]==="오후"?12:0)).padStart(2,"0")}:${time[3]}`;
      const record={record_id:"",church_id:church.church_id,church_name:church.church_name,service_type:label,day_of_week:days,start_time:startTime,venue_audience:cells[venueColumn],source_text:`${table.component} | ${cells.join(" | ")}`.slice(0,500),source_url:sourceUrl,collected_at:collectedAt,source_last_modified:sourceLastModified,confidence:"medium",review_status:"hold",flags:["manual_review_required"]};
      record.record_id=createHash("sha256").update([record.church_id,label,days.join(","),startTime,record.venue_audience].join("|")).digest("hex").slice(0,24);
      records.push(record);
    }
  }
  return [...new Map(records.map(record=>[record.record_id,record])).values()];
}
