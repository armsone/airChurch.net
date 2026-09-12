import { createHash } from "node:crypto";

const clean=value=>String(value??"").replace(/<[^>]*>/g," ").replace(/&nbsp;|&#160;/gi," ").replace(/&#(x[0-9a-f]+|\d+);/gi,(_,value)=>{const point=value[0].toLowerCase()==="x"?parseInt(value.slice(1),16):Number(value);return point>0&&point<=0x10ffff?String.fromCodePoint(point):" ";}).replace(/&amp;/gi,"&").replace(/\s+/g," ").trim();
const attribute=(tag,name)=>tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`,"i"))?.[1]??"";
const hidden=tag=>/\shidden(?:\s|=|>)/i.test(tag)||attribute(tag,"aria-hidden")==="true"||/(?:^|\s)(?:hide|hidden|d-none)(?:\s|$)/i.test(attribute(tag,"class"))||/(?:display\s*:\s*none|visibility\s*:\s*hidden)/i.test(attribute(tag,"style"));

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
    // This publisher legitimately repeats component8998 for its worship and
    // church-school tables. Read both visible tables, not just the first ID.
    if(parent?.component==="component8998"&&!parent.hidden&&!hidden(tag.slice(0,tag.indexOf(">")+1)))tables.push(tag);
  }
  return tables;
}

export function extractAhyeonSchedules({church,sourceUrl,html,collectedAt,sourceLastModified}){
  let url;try{url=new URL(sourceUrl);}catch{return null;}
  if(url.hostname.replace(/^www\./,"")!=="ajmc.or.kr")return null;
  if(url.origin!=="https://ajmc.or.kr"||url.username||url.password||url.port||url.pathname!=="/Page/Index/17"||url.search||url.hash)return [];
  if(Number(church.church_id)!==1919||church.church_name!=="아현중앙교회"||church.region?.replace(/\s/g,"")!=="서울서대문"||church.denomination?.replace(/\s/g,"")!=="기독교대한감리회")return [];
  const records=[],dayMap={주일:"SUN",일요일:"SUN",월요일:"MON",화요일:"TUE",수요일:"WED",목요일:"THU",금요일:"FRI",토요일:"SAT"};
  for(const table of visibleTables(html)){
    const rows=[...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)];
    const headings=[...(rows[0]?.[1]??"").matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi)].map(cell=>clean(cell[1]).replace(/\s/g,""));
    if(JSON.stringify(headings)!==JSON.stringify(["구분","예배시간","예배장소"]))continue;
    const spans=[];
    for(const row of rows.slice(1)){
      const cells=[];let column=0;
      for(let i=0;i<spans.length;i++)if(spans[i]?.left>0){cells[i]=spans[i].value;spans[i].left--;}
      for(const cell of row[1].matchAll(/<td\b([^>]*)>([\s\S]*?)<\/td>/gi)){
        while(cells[column]!==undefined)column++;
        const attrs=`<td ${cell[1]}>`,count=Number(attribute(attrs,"colspan")||1),height=Number(attribute(attrs,"rowspan")||1),value=clean(cell[2]);
        if(!Number.isInteger(count)||count<1||count>3||!Number.isInteger(height)||height<1||height>rows.length)return [];
        for(let i=0;i<count;i++){cells[column]=value;spans[column]={value,left:height-1};column++;}
      }
      if(cells.length!==3||!cells[0]||!cells[2])continue;
      // A stated day and start clock are mandatory. "금요일 혹은 속회별로"
      // has no fixed time and must never borrow the previous row's clock.
      const time=cells[1].match(/^(매일|주일|[월화수목금토일]요일)\s+(오전|오후)\s+(\d{1,2}):([0-5]\d)$/);
      if(!time||Number(time[3])<1||Number(time[3])>12)continue;
      const days=time[1]==="매일"?["MON","TUE","WED","THU","FRI","SAT","SUN"]:[dayMap[time[1]]];
      const startTime=`${String(Number(time[3])%12+(time[2]==="오후"?12:0)).padStart(2,"0")}:${time[4]}`;
      const record={record_id:"",church_id:church.church_id,church_name:church.church_name,service_type:cells[0],day_of_week:days,start_time:startTime,venue_audience:cells[2],source_text:`component8998 | ${cells.join(" | ")}`.slice(0,500),source_url:sourceUrl,collected_at:collectedAt,source_last_modified:sourceLastModified,confidence:"medium",review_status:"hold",flags:["manual_review_required"]};
      record.record_id=createHash("sha256").update([record.church_id,record.service_type,days.join(","),startTime,record.venue_audience].join("|")).digest("hex").slice(0,24);
      records.push(record);
    }
  }
  return [...new Map(records.map(record=>[record.record_id,record])).values()];
}
