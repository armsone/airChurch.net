import { eventRegions } from "./types";
import type { SourceConfig } from "./sources";

export const eventWords = /집회|세미나|워크숍|컨퍼런스|수련회|캠프|훈련|교육|학교|대학|강좌|강연|특강|북토크|북페어|사역자스쿨|클래스|배움터|찬양|공연|뮤지컬|음악회|콘서트|전시|봉사|선교대회|포럼|대회|영화제|예배|기도회|수양회|공청회|토론회/;
export function eventPriority(title:string){return (/채용|입찰|장학생|등록금|휴무|공사|학사|연구윤리/.test(title)?-10:0)+(/세미나|공연|음악회|콘서트|수련회|특강|컨퍼런스|사역자|콜로키움|개강예식/.test(title)?3:eventWords.test(title)?1:0);}
export function decode(value:string) { return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,"$1").replace(/&#(x[0-9a-f]+|\d+);/gi,(_,n)=>{const v=n[0].toLowerCase()==="x"?parseInt(n.slice(1),16):Number(n);return v>0&&v<=0x10ffff?String.fromCodePoint(v):"";}).replace(/&nbsp;/gi," ").replace(/&amp;/gi,"&").replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/&lt;/gi,"<").replace(/&gt;/gi,">"); }
export function plain(value:string) { return decode(value.replace(/<[^>]*>/g," ")).replace(/\s+/g," ").trim(); }
export function lines(html:string) { return decode(html.replace(/<!--[\s\S]*?-->/g,"").replace(/<(head|script|style|nav|header|footer)\b[^>]*>[\s\S]*?<\/\1>/gi,"").replace(/<\/(?:p|div|li|tr|h[1-6]|dt|dd)>|<br\s*\/?\s*>/gi,"\n").replace(/<[^>]*>/g," ")).split(/\n/).map(x=>x.replace(/\s+/g," ").trim()).filter(Boolean); }
export function links(html:string,base:string) { const found=new Map<string,string>(); for(const m of html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)){try{const u=new URL(decode(m[1]),base);if(!/^https?:$/.test(u.protocol)||u.username||u.password||u.port)continue;u.hash="";for(const key of [...u.searchParams.keys()])if(/^utm_|^(fbclid|gclid|back_url)$/.test(key))u.searchParams.delete(key);u.searchParams.sort();const key=u.href.replace(/%[0-9a-f]{2}/gi,x=>x.toUpperCase()),title=plain(m[2]);if(!title||/^(자세히\s*보기|더\s*보기|보기|바로가기|MORE)$/i.test(title)){if(!found.has(key))found.set(key,"");continue;}if(!found.get(key)||title.length>found.get(key)!.length)found.set(key,title);}catch{}}return [...found].map(([url,title])=>({url,title})); }
export function validDate(value:string){if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const d=new Date(`${value}T00:00:00Z`);return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===value;}
function dates(value:string) { return [...value.matchAll(/(20\d{2})\s*[년.\-/]\s*(\d{1,2})\s*[월.\-/]\s*(\d{1,2})\s*일?/g)].map(m=>`${m[1]}-${m[2].padStart(2,"0")}-${m[3].padStart(2,"0")}`); }
function weekdayMatches(date:string,text:string){const day=text.match(/\(([일월화수목금토])(?:요일)?\)/)?.[1];return !day||"일월화수목금토"[new Date(`${date}T00:00:00Z`).getUTCDay()]===day;}
function field(rows:string[],pattern:RegExp) { const index=rows.findIndex(x=>pattern.test(x));if(index<0)return "";const value=rows[index].replace(pattern,"").replace(/^[\s:：|｜]+/,"").trim();return (value||rows[index+1]||"").slice(0,400); }
function regionOf(venue:string){const aliases:Record<string,string>={충청북도:"충북",충청남도:"충남",전라북도:"전북",전북특별자치도:"전북",전라남도:"전남",경상북도:"경북",경상남도:"경남",춘천:"강원",익산:"전북",일산:"경기",분당:"경기",수지:"경기",성남:"경기",용인:"경기",동대문:"서울",종로:"서울"};return eventRegions.find(x=>venue.includes(x))||Object.entries(aliases).find(([a])=>venue.includes(a))?.[1]||"지역 확인 필요";}
function meta(html:string,key:string){for(const m of html.matchAll(/<meta\b[^>]*>/gi)){if(m[0].includes(`"${key}"`)||m[0].includes(`'${key}'`))return plain(m[0].match(/content=["']([\s\S]*?)["']/i)?.[1]||"");}return "";}
export type ExtractedEvent={title:string;startDate:string;endDate:string;startTime:string|null;venue:string;region:string;attendance:string;organizer:string;audience:string;category:string;registrationUrl:string|null;status:string};
// Annual regional lists contain separate events, not one continuous date range.
export function extractScheduleEntries(html:string,source:SourceConfig){
  if(source.id==="paidion"){
    const rows=lines(html),title=rows.find(row=>/^\[선착순\]\s*\[온라인 강의\].*세미나/.test(row));
    const end=rows.indexOf("지난 세미나 후기"),body=end<0?rows:rows.slice(0,end);
    if(!title||!body.some(row=>/온라인 실시간 줌\(ZOOM\)/.test(row)))return [];
    const when=body.find(row=>/^20\d{2}년.*매주.*\d+주/.test(row))||"";
    const m=when.match(/^(20\d{2})년\s*(\d{1,2})월\s*(\d{1,2})일\s*[-~]\s*(\d{1,2})월\s*(\d{1,2})일\s*\(매주\s*([월화수목금토일])요일,\s*(\d+)주\)$/);
    const clock=body.map(row=>row.match(/^(AM|PM)\s*(\d{1,2}):([0-5]\d)\s*[-~]\s*(\d{1,2}):([0-5]\d)$/i)).find(Boolean);
    if(!m||!clock)return [];
    const first=`${m[1]}-${m[2].padStart(2,"0")}-${m[3].padStart(2,"0")}`,last=`${m[1]}-${m[4].padStart(2,"0")}-${m[5].padStart(2,"0")}`,count=Number(m[7]);
    if(!validDate(first)||!validDate(last)||first>last||count<1||count>52||!weekdayMatches(first,`(${m[6]})`)||!weekdayMatches(last,`(${m[6]})`))return [];
    const hour=Number(clock[2]),endHour=Number(clock[4]);if(hour<1||hour>12||endHour<1||endHour>12||hour*60+Number(clock[3])>=endHour*60+Number(clock[5]))return [];
    const pauseRows=body.filter(row=>/휴강/.test(row)),excluded=new Set<string>();
    for(const row of pauseRows){
      if(!/^\(\s*\d{1,2}월\s*\d{1,2}일(?:\s*,\s*\d{1,2}월\s*\d{1,2}일)*\s*휴강\s*\)$/.test(row))return [];
      for(const pause of row.matchAll(/(\d{1,2})월\s*(\d{1,2})일/g)){
        const date=`${m[1]}-${pause[1].padStart(2,"0")}-${pause[2].padStart(2,"0")}`;
        if(!validDate(date)||date<first||date>last||!weekdayMatches(date,`(${m[6]})`))return [];
        excluded.add(date);
      }
    }
    const dates:string[]=[];
    for(let day=Date.parse(first);day<=Date.parse(last)&&dates.length<=52;day+=7*86400000){const date=new Date(day).toISOString().slice(0,10);if(!excluded.has(date))dates.push(date);}
    if(dates.length!==count)return [];
    const startTime=`${String(hour%12+(clock[1].toUpperCase()==="PM"?12:0)).padStart(2,"0")}:${clock[3]}`;
    return dates.map((date,i)=>{const sessionTitle=`${title} · ${i+1}회`;return {key:`${date}_${startTime}`,title:sessionTitle,evidence:`${title}\n${when}\n${pauseRows.join("\n")}\n${clock[0]}\n온라인 실시간 줌(ZOOM)`,reason:"",event:{title:sessionTitle,startDate:date,endDate:date,startTime,venue:"온라인 실시간 줌(ZOOM)",region:"온라인",attendance:"온라인",organizer:"파이디온선교회",audience:"대상 확인 필요",category:"세미나·교육",registrationUrl:null,status:noticeStatus(body.join("\n"))||"published"} satisfies ExtractedEvent};});
  }
  if(source.id==="bpu"){
    const rows=lines(html),heading=rows.find(x=>/^\[사역자스쿨\]\s*20\d{2}학년도\s*\d학기\s*프로그램\s*안내$/.test(x));
    if(!heading)return [];
    const when=rows.find(x=>/일시\s*[:：].*총\s*\d+\s*회/.test(x))||"",venue=field(rows,/^[•\s]*장소\s*[:：]\s*/),year=heading.match(/20\d{2}/)?.[0];
    const range=when.match(/(20\d{2})\s*년\s*(\d{1,2})\s*월\s*~\s*(\d{1,2})\s*월\s*\(\s*([월화수목금토일])요일\s*,\s*총\s*(\d+)\s*회\s*\)\s*(\d{2}:[0-5]\d)\s*~\s*(\d{2}:[0-5]\d)/);
    const start=rows.findIndex(x=>x.includes("주차별 커리큘럼")),end=rows.findIndex((x,i)=>i>start&&x.includes("신청 및 문의"));
    if(!range||range[1]!==year||!venue||start<0||end<=start||Number(range[5])>20||Number(range[6].slice(0,2))>23||range[6]>=range[7])return [];
    const sessions=rows.slice(start+1,end).flatMap(row=>{const m=row.match(/^[•\s]*(\d+)\s*회차\s*\((\d{1,2})\/(\d{1,2})\)\s*\|\s*(.+)$/);return m?[{row,n:Number(m[1]),month:Number(m[2]),date:`${year}-${m[2].padStart(2,"0")}-${m[3].padStart(2,"0")}`,label:m[4]}]:[];});
    if(sessions.length!==Number(range[5])||sessions.some((s,i)=>s.n!==i+1||s.month<Number(range[2])||s.month>Number(range[3])||!validDate(s.date)||"일월화수목금토"[new Date(`${s.date}T00:00:00Z`).getUTCDay()]!==range[4])||new Set(sessions.map(s=>s.date)).size!==sessions.length)return [];
    const organizer=field(rows,/^주관\s*[:：]\s*/)||source.name;
    return sessions.map(s=>{const title=`${heading.replace(/프로그램\s*안내$/,"").trim()} · ${s.n}회 ${s.label}`;return {key:`${s.date}_${range[6]}`,title,evidence:[heading,when,s.row,`장소: ${venue}`,`주관: ${organizer}`].join("\n"),reason:"",event:{title,startDate:s.date,endDate:s.date,startTime:range[6],venue,region:"지역 확인 필요",attendance:"현장",organizer,audience:"목회자",category:"세미나·교육",registrationUrl:null,status:noticeStatus(rows.slice(rows.indexOf(heading),end).join("\n"))||"published"} satisfies ExtractedEvent};});
  }
  if(source.id==="nics"){
    const rows=lines(html),title=meta(html,"og:title")||plain(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||"");
    const index=rows.findIndex(x=>/^일시\s*[｜|:：]/.test(x)),when=rows[index]||"",clock=rows[index+1]||"",method=rows.find(x=>/^방식\s*[｜|:：]/.test(x))||"";
    const year=when.match(/(20\d{2})년/)?.[1],time=clock.match(/^저녁\s*(\d{1,2})시\s*(\d{1,2})분\s*~/);
    if(!year||!time||!/콜로키움/.test(title)||!/줌\(zoom\).*온라인\s*강의/i.test(method))return [];
    const days=[...when.matchAll(/(?:(20\d{2})년\s*)?(\d{1,2})월\s*(\d{1,2})일\(([월화수목금토일])\)/g)];
    const h=Number(time[1]),m=Number(time[2]);if(days.length<2||days.length>20||h<1||h>11||m>59)return [];
    const values=days.map(d=>({date:`${d[1]||year}-${d[2].padStart(2,"0")}-${d[3].padStart(2,"0")}`,label:d[0]}));
    if(values.some(d=>!validDate(d.date)||!weekdayMatches(d.date,d.label))||new Set(values.map(d=>d.date)).size!==values.length)return [];
    const startTime=`${h+12}:${String(m).padStart(2,"0")}`;
    return values.map((d,i)=>{const sessionTitle=`${title.replace(/\s*[|>].*$/,"")} · ${i+1}회`;return {key:`${d.date}_${startTime}`,title:sessionTitle,evidence:[when,clock,method].join("\n"),reason:"",event:{title:sessionTitle,startDate:d.date,endDate:d.date,startTime,venue:"온라인 Zoom",region:"온라인",attendance:"온라인",organizer:source.name,audience:"대상 확인 필요",category:"세미나·교육",registrationUrl:null,status:noticeStatus(rows.join("\n"))||"published"} satisfies ExtractedEvent};});
  }
  if(source.id==="uofnjeju"){
    const rows=lines(html),line=rows.find(x=>/^-\s*국내\(열방대학\)\s*[:：]/.test(x)),ds=dates(line||"");
    if(!line||ds.length!==2||ds.some(d=>!validDate(d))||ds[1]<ds[0]||Date.parse(ds[1])-Date.parse(ds[0])>366*86400000)return [];
    const title=(meta(html,"og:title")||"성경연구과정").replace(/\s*[-|]\s*제주열방대학.*$/,"")+" · 국내 과정";
    return [{key:`domestic_${ds[0]}`,title,evidence:line,reason:"",event:{title,startDate:ds[0],endDate:ds[1],startTime:null,venue:"제주열방대학",region:"제주",attendance:"현장",organizer:source.name,audience:"대상 확인 필요",category:"세미나·교육",registrationUrl:null,status:noticeStatus(rows.join("\n"))||"published"} satisfies ExtractedEvent}];
  }
  if(source.id==="interserve"){
    const title=meta(html,"og:title")||plain(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||"");
    if(!/i-LAMS/i.test(title))return [];
    const rows=lines(html),when=rows.find(row=>/^일\s*정\s*[:：]/.test(row)&&/온라인\s*ZOOM/.test(row)),count=rows.join(" ").match(/총\s*(\d+)회에\s*걸쳐/);
    const m=when?.match(/(20\d{2})년\s*(\d{1,2})월\s*(\d{1,2})일\s*~\s*(\d{1,2})월\s*(\d{1,2})일\s*\(매주\s*([월화수목금토일])요일\s*저녁\s*(\d{1,2})시\s*(?:(\d{1,2})분\s*)?(?=[,，)])/);
    if(!m||!count)return [];
    const first=`${m[1]}-${m[2].padStart(2,"0")}-${m[3].padStart(2,"0")}`,last=`${m[1]}-${m[4].padStart(2,"0")}-${m[5].padStart(2,"0")}`,n=Number(count[1]),hour=Number(m[7]);
    if(!validDate(first)||!validDate(last)||n<1||n>52||hour<1||hour>11||"일월화수목금토"[new Date(`${first}T00:00:00Z`).getUTCDay()]!==m[6]||Date.parse(last)-Date.parse(first)!==(n-1)*7*86400000)return [];
    const minute=Number(m[8]||0);if(minute>59)return [];
    const startTime=`${hour+12}:${String(minute).padStart(2,"0")}`,notice=noticeStatus(rows.join("\n"));
    return Array.from({length:n},(_,i)=>{const date=new Date(Date.parse(first)+i*7*86400000).toISOString().slice(0,10),sessionTitle=`${m[1]} i-LAMS · ${i+1}회`;
      return {key:`${date}_${startTime}`,title:sessionTitle,evidence:`${title}\n${when}\n${count[0]}`,reason:"",event:{title:sessionTitle,startDate:date,endDate:date,startTime,venue:"온라인 ZOOM",region:"온라인",attendance:"온라인",organizer:"인터서브코리아",audience:"대상 확인 필요",category:"세미나·교육",registrationUrl:null,status:notice||"published"} satisfies ExtractedEvent};
    });
  }
  if(source.id==="sorrygom"){
    const year=html.match(/alt=["'](20\d{2}) 올인원 믹싱세미나 포스터["']/)?.[1],rows=lines(html),start=rows.indexOf("장소 및 일시"),end=rows.indexOf("신청 및 준비");
    if(!year||start<0||end<=start)return [];
    const schedule=rows.slice(start+1,end),time=schedule.join(" ").match(/세미나 시간\s*:\s*(\d{1,2})시\s*-\s*(\d{1,2})시/);if(!time||Number(time[1])>=Number(time[2])||Number(time[2])>23)return [];
    const entries=[];
    for(let i=0;i<schedule.length;i++){const dateParts=schedule[i].match(/^(\d{1,2})월\s*(\d{1,2})일\s*\([월화수목금토일]\)$/);if(!dateParts)continue;const place=schedule[i+1],address=schedule[i+2],region=eventRegions.find(region=>address?.startsWith(region));if(!place?.includes("·")||!region)continue;
      const date=`${year}-${dateParts[1].padStart(2,"0")}-${dateParts[2].padStart(2,"0")}`;if(!validDate(date)||!weekdayMatches(date,schedule[i]))continue;
      const title=`${year} 올인원 믹싱세미나 · ${place.split("/")[0]}`,venue=`${place.split("·").slice(1).join("·").trim()} (${address})`,startTime=`${time[1].padStart(2,"0")}:00`;
      entries.push({key:`${date}_${startTime}_${encodeURIComponent(title)}`,title,evidence:`${year} 올인원 믹싱세미나 포스터 (공식 이미지 대체텍스트)\n${schedule[i]}\n${place}\n${address}\n${time[0]}`,reason:"",event:{title,startDate:date,endDate:date,startTime,venue,region,attendance:"현장",organizer:"소리곰",audience:"대상 확인 필요",category:"세미나·교육",registrationUrl:null,status:noticeStatus(rows.join("\n"))||"published"} satisfies ExtractedEvent});
    }
    return entries;
  }
  if(source.id!=="snnh")return [];
  const rows=lines(html),heading=rows.find(x=>/^20\d{2}년 노회 행사 및 임직예배 일정$/.test(x));if(!heading)return [];
  const year=heading.slice(0,4),entries=[];
  const start=rows.indexOf(heading),end=rows.findIndex((x,i)=>i>start&&x==="다른 글 보기"),notice=noticeStatus(rows.slice(start,end<0?rows.length:end).join("\n"));
  for(const row of rows){
    const match=row.match(/^\*?\s*(\d{1,2})월\s*(\d{1,2})일\([월화수목금토일]\)\s*(오전|오후|저녁)\s*(\d{1,2})시\s*(?:(\d{1,2})분)?\s*,\s*([^,\s]+교회)\s+(.+)$/);
    if(!match||/\//.test(match[7]))continue;
    const date=`${year}-${match[1].padStart(2,"0")}-${match[2].padStart(2,"0")}`,hour=Number(match[4]),minute=Number(match[5]||0);if(!validDate(date)||!weekdayMatches(date,row)||hour<1||hour>12||minute>59)continue;
    const time=`${String(hour%12+(match[3]==="오전"?0:12)).padStart(2,"0")}:${String(minute).padStart(2,"0")}`,venue=match[6],title=`${venue} ${match[7]}`;
    entries.push({key:`${date}_${time}_${encodeURIComponent(title)}`,title,evidence:`${heading}\n${row}`,reason:"",event:{title,startDate:date,endDate:date,startTime:time,venue,region:regionOf(venue),attendance:"현장",organizer:"주최 확인 필요",audience:"대상 확인 필요",category:"집회",registrationUrl:null,status:notice||noticeStatus(row)||"published"} satisfies ExtractedEvent});
  }
  return entries;
}
export function noticeStatus(text:string){return /행사\s*취소|개최\s*취소|집회\s*취소|\[취소\]|\(취소\)/.test(text)?"cancelled":/(?:행사|공연|개최|집회|일정)(?:가|이|를|을)?\s*연기|\[연기\]|\(연기\)|잠정\s*중단|일정\s*변경(?:\s*안내|되었|합니다)/.test(text)?"checking":null;}
export function extractEvent(html:string,url:string,source:SourceConfig,knownTitle=""):{event:ExtractedEvent|null;title:string;evidence:string;reason:string} {
  const article=source.id==="biblekorea"?html.match(/<div\b[^>]*id=["']bo_v_con["'][^>]*>([\s\S]*?)<!--\s*}\s*본문 내용 끝\s*-->/i)?.[1]:null;
  const rows=lines(article||html).map(row=>source.id==="hcm"?row.replace(/^\[날\s*짜\][\s\u200B]*/,"일시: ").replace(/^\[장\s*소\][\s\u200B]*/,"장소: "):row);
  const headings=[...html.matchAll(/<h[1-4]\b[^>]*>([\s\S]*?)<\/h[1-4]>/gi)].map(m=>plain(m[1]));
  const currentHeading=headings.find(x=>knownTitle.length>2&&x.includes(knownTitle));
  const og=meta(html,"og:title");
  const boardTitle=plain(html.match(/<h[1-4][^>]*id=["']bo_v_title["'][^>]*>([\s\S]*?)<\/h[1-4]>/i)?.[1]||"");
  const specificOg=og.replace(/\s/g,"")!==source.name.replace(/\s/g,"")?og:"";
  const hcmTitle=source.id==="hcm"?rows.find(row=>/^제\d+차\s*\[.+\]\s*20\d{2}년/.test(row)):null;
  const rawTitle=(hcmTitle?`가정교회 세미나 · ${hcmTitle}`:null)||boardTitle||(source.id==="coommi"?headings.find(x=>/20\d{2}/.test(x)):null)||(source.eventOnly&&specificOg?specificOg:currentHeading)||(specificOg&&eventWords.test(specificOg)?specificOg:knownTitle)||specificOg||plain(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||"");
  const title=(source.id==="coommi"?rawTitle.replace(/^접수(?:중|마감|예정)\s*\[/,"").replace(/\s*신청\s*[:：].*\]$/,""):rawTitle).replace(new RegExp(`^${source.name}\\s*[|:>-]\\s*`),"").replace(/\s*[|>].*$/,"").trim().slice(0,180);
  const titleIndex=rows.findIndex(x=>(hcmTitle||title).length>2&&x.includes(hcmTitle||title));
  const structuredIndex=source.id==="jiguchon"?rows.findIndex(x=>x==="일정안내"):source.id==="kicrts"?rows.findIndex(x=>x==="세미나 안내"):-1;
  // This publisher hides its title and repeats it only in related links below
  // the article. Starting there drops the actual date and venue above it.
  const articleStart=article||source.id==="kocam"?0:structuredIndex>=0?structuredIndex:titleIndex;
  const articleRows=articleStart>=0?rows.slice(articleStart,Math.min(articleStart+150,rows.length)):rows;
  // Ignore related articles/navigation below the actual article.
  const end=articleRows.findIndex((x,i)=>i>1&&!(source.id==="ksh"&&x==="첨부파일")&&(/^(관련 글들|이전글|다음글|첨부파일|목록보기|댓글목록)$/.test(x)||(source.id==="kocam"&&/^관련글 보기/.test(x))||(source.id==="ksh"&&/^(이전글|다음글)\s*[▲▼]/.test(x))));
  const body=end>=0?articleRows.slice(0,end):articleRows;
  if(source.id==="worldteach"){
    const when=plain(html.match(/<tr\b[^>]*id=["']mb_commerce_product_tr_lecture_date["'][^>]*>([\s\S]*?)<\/tr>/i)?.[1]||"");
    const productHeading=plain(html.match(/<div\b[^>]*class=["'][^"']*mc-product-title-box[^"']*["'][^>]*>([\s\S]*?)<div\b[^>]*class=["']mc-product-info-box["']/i)?.[1]||"");
    const place=plain(html.match(/<tr\b[^>]*id=["']mb_commerce_product_tr_lecture_place["'][^>]*>([\s\S]*?)<\/tr>/i)?.[1]||"")||(/(?:^|\s|\[)ZOOM\s+(?:화상강의|온라인\s*강의)(?:\]|\s|$)/.test(productHeading)?"온라인 ZOOM 화상강의":"");
    const memo=plain(html.match(/<tr\b[^>]*id=["']mb_commerce_product_tr_product_memo["'][^>]*>([\s\S]*?)<\/tr>/i)?.[1]||"");
    if(when){body.splice(0,body.length,title,`일시: ${when}`,...(place?[`장소: ${place}`]:[]),memo);}
  }
  if(source.id==="kicrts"){
    for(let i=0;i<body.length;i++)if(/^일시\s*[|｜]/.test(body[i]))body[i]=body[i].replace(/(오전|오후)\s*([1-9]|1[0-2])\s*[-~]\s*([1-9]|1[0-2])\s*시/,"$1 $2시 ~ $3시");
    const places=body.filter(row=>/^장소\s*[|｜]/.test(row)).map(row=>row.replace(/^장소\s*[|｜]\s*/,""));
    if(places.length===2&&/^(서울|부산|인천|대구|대전|울산|광주|세종|제주|경기|강원|충청|전라|경상)/.test(places[1]))body.unshift(`장소: ${places[0]} (${places[1]})`);
  }
  // This music publisher puts the event date and venue in the title itself.
  // A two-digit year is usable only when that same title explicitly names it.
  if(source.id==="vitnara"){
    const schedule=title.match(/\([^()]*?(20\d{2}|\d{2})\s*\.\s*(\d{1,2})\s*\.\s*(\d{1,2})\s*\.?\s*([월화수목금토일])\s*,\s*([^()]+)\)$/);
    if(schedule){
      const years=[...new Set(title.match(/20\d{2}/g)||[])];
      const year=schedule[1].length===4?schedule[1]:years.length===1&&years[0].endsWith(schedule[1])?years[0]:null;
      if(year)body.unshift(`일시: ${year}년 ${schedule[2]}월 ${schedule[3]}일 (${schedule[4]})`,`장소: ${schedule[5].trim()}`);
    }
  }
  const evidence=body.join("\n").slice(0,2500);
  const fail=(reason:string)=>({event:null,title,evidence,reason});
  if(source.christianOnly&&!/찬양|워십|그리스도|기독교|예배|가스펠/.test(body.slice(0,8).join(" ")))return fail("outside_christian_scope");
  if((!source.eventOnly&&!eventWords.test(title)&&!body.some(x=>/^(진행\s*일시|사역\s*일정)/.test(x)))||/채용|입찰|당첨|장학생 명단|결과 보고|성료|후기|다시보기/.test(title))return fail("not_an_upcoming_event");
  if(source.id==="duranno-college"&&/녹화·편집|녹화\s*영상|녹화된\s*강의|VOD/.test(body.join("\n")))return fail("recorded_course_not_event");
  const datePattern=/^[\d\s\p{P}\p{S}\uFE0F]*(?:진행\s*일시|사역\s*일정|(?:행사|공연|전시|강의)\s*(?:일시|일정|기간)|일\s*시|일\s*정|교육\s*기간|기\s*간)(?=\s|[:：|｜]|$)\s*[:：|｜]?\s*/u;
  const datedIndex=body.findIndex(x=>datePattern.test(x)&&/20\d{2}\s*[년./-]/.test(x));
  const di=datedIndex>=0?datedIndex:body.findIndex(x=>datePattern.test(x));
  let when=field(di>=0?body.slice(di):body,datePattern);
  if(source.id==="ctc"&&di>=0&&/^(오전|오후)\s*\d{1,2}:\d{2}\s*[–~-]/.test(body[di+1]||""))when+=` ${body[di+1]}`;
  // WEC states the current meeting date in one sentence, without an 일시 label.
  // Match only that sentence; the separate next-month reminder has no venue.
  if(source.id==="weckr"&&!when){
    const meeting=body.map(row=>row.match(/^(20\d{2})년\s*(\d{1,2})월\s*정기기도회가\s*(\d{1,2})월\s*(\d{1,2})일\s*([월화수목금토일])요일\s*(오전|오후|저녁)\s*(\d{1,2})시에\s*있습니다[.]?$/)).find(match=>match&&match[2]===match[3]);
    if(meeting)when=`${meeting[1]}년 ${meeting[3]}월 ${meeting[4]}일 (${meeting[5]}) ${meeting[6]} ${meeting[7]}시`;
  }
  if(di>=0&&body[di+2]&&/^\s*[-~～–]\s*(?:20\d{2}\s*[년.\-/]\s*\d|\d{1,2}\s*[월./]\s*\d)/.test(body[di+2]))when+=` ${body[di+2]}`;
  // Short month/day labels may use a year explicitly present in the event title, never the publication date.
  if(!/20\d{2}/.test(when)){const years=[...new Set(title.match(/20\d{2}/g)||[])];if(years.length===1){const shortYear=new RegExp(`^${years[0].slice(2)}(?=\\s*[./-]\\s*\\d{1,2}\\s*[./-]\\s*\\d{1,2})`);if(shortYear.test(when))when=when.replace(shortYear,years[0]);else if(/^\d{1,2}\s*[월./]\s*\d{1,2}/.test(when))when=`${years[0]}년 ${when}`;}}
  const ds=dates(when);
  if(/[,•·]\s*(?:\d{1,2}\s*월\s*)?\d{1,2}\s*일/.test(when))return fail("multiple_sessions_require_explicit_dates");
  if(ds.length<1||ds.length>2||ds.some(x=>!validDate(x)))return fail("explicit_event_date_required");
  if(ds.length===2){const matches=[...when.matchAll(/20\d{2}\s*[년.\-/]\s*\d{1,2}\s*[월.\-/]\s*\d{1,2}\s*일?/g)],between=when.slice(matches[0].index!+matches[0][0].length,matches[1].index);if(!/[~～–—-]|부터/.test(between)||/[,•·]|및|또는/.test(between))return fail("multiple_sessions_require_explicit_dates");}
  let startDate=ds[0],endDate=ds[1]||ds[0];
  if(ds.length===1){
    const tail=when.replace(/20\d{2}\s*[년.\-/]\s*\d{1,2}\s*[월.\-/]\s*\d{1,2}\s*일?/,"");
    const range=tail.match(/[~～–-]\s*(?:(\d{1,2})\s*[월./]\s*)?(\d{1,2})\s*일?(?=\s*(?:[.(（]|$))/);
    if(range)endDate=`${startDate.slice(0,4)}-${(range[1]||startDate.slice(5,7)).padStart(2,"0")}-${range[2].padStart(2,"0")}`;
    else if(/[~～–-]/.test(tail)&&!/(?:시|:\d{2})\s*[~～–-]\s*(?:오전|오후|저녁|밤|낮)?\s*\d{1,2}\s*(?:시|:)/.test(tail)){
      const hours=tail.match(/(?:^|\s)([01]?\d|2[0-3])\s*[-~]\s*([01]?\d|2[0-3])\s*시/);
      if(!hours||Number(hours[1])>=Number(hours[2]))return fail("ambiguous_date_range");
    }
  }
  const weekly=when.match(/매주\s*[월화수목금토일]요일\s*(\d{1,2})주/);
  if(weekly&&ds.length===1&&Number(weekly[1])>=1&&Number(weekly[1])<=52)endDate=new Date(Date.parse(startDate)+(Number(weekly[1])-1)*7*86400000).toISOString().slice(0,10);
  else if(/매주|매월|격주|회차|\d+차\s*[:：]/.test(when))return fail("multiple_sessions_require_explicit_dates");
  if(!validDate(endDate)||endDate<startDate||Date.parse(endDate)-Date.parse(startDate)>366*86400000)return fail("ambiguous_date_range");
  const venue=field(body,/^[\d\s\p{P}\p{S}\uFE0F]*(?:행사\s*장소|강의\s*장소|공연장|장\s*소)(?=\s|[:：|｜]|$)\s*[:：|｜]?\s*/u)||(source.id==="chungeoram"?field(body,/^진행\s*방식\s*[:：]\s*/):"");
  const organizer=field(body,/^[\d\s\p{P}\p{S}\uFE0F]*주\s*최(?:\s*\/\s*(?:주\s*관|기획))?\s*[:：|｜]?\s*/u)||"주최 확인 필요";
  if(!venue||/추후\s*(?:공지|안내|공개|확정)|미정|확정\s*예정|TBD|장소\s*협의/i.test(venue))return fail("venue_required");
  if(source.id==="hcm"){
    const city=hcmTitle?.match(/\[(서울|부산|인천|대구|대전|울산|광주|세종|제주|경기|경남|경북|강원|충북|충남|전북|전남|안양|양주|전주|구미|천안|아산|보령|수원|용인|성남|화성|고양|남양주|김포|파주|부천|안산|시흥|평택|이천|포천|의정부|청주|충주|춘천|원주|강릉|동해|속초|순천|여수|목포|광양|익산|군산|창원|김해|양산|진주|거제|포항|경주|경산)(?=\s|\/)/)?.[1];
    if(!city||!venue.includes(city))return fail("domestic_venue_confirmation_required");
  }
  const time=when.match(/(오전|오후|저녁|밤|낮)\s*(\d{1,2})\s*(?:시|:)(?:\s*(\d{1,2})\s*분?)?/);
  let startTime:string|null=null;
  if(time){let h=Number(time[2]),m=Number(time[3]||0);if(h>=1&&h<=12&&m<60){h=h%12+(time[1]==="오전"?0:12);startTime=`${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;}}
  else{const clock=when.match(/(?:^|\s)([01]?\d|2[0-3]):([0-5]\d)/);if(clock)startTime=`${clock[1].padStart(2,"0")}:${clock[2]}`;else{const hours=when.match(/(?:^|\s)([01]?\d|2[0-3])\s*[-~]\s*([01]?\d|2[0-3])\s*시/);if(hours&&Number(hours[1])>=13&&Number(hours[1])<Number(hours[2]))startTime=`${hours[1].padStart(2,"0")}:00`;}}
  if(source.id==="duranno-college"&&!startTime){const intro=body.findIndex(x=>x==="세미나 소개"),clock=body.slice(Math.max(0,di),intro<0?di+15:intro).find(x=>/^([01]?\d|2[0-3]):[0-5]\d\s*[-~]/.test(x));if(clock)startTime=clock.match(/^\d{1,2}:\d{2}/)![0].padStart(5,"0");}
  if(source.id==="melon"&&!startTime){const clock=field(body,/^공연시간\s*[:：]?\s*/).match(/(오전|오후)\s*(\d{1,2})시(?:\s*(\d{1,2})분)?/);if(clock&&Number(clock[2])<=12&&Number(clock[2])>0&&Number(clock[3]||0)<60)startTime=`${String(Number(clock[2])%12+(clock[1]==="오후"?12:0)).padStart(2,"0")}:${String(clock[3]||0).padStart(2,"0")}`;}
  const audienceText=field(body,/^(?:[\d.•○●\s-]*)?대\s*상\s*[:：]?\s*/)||(["hcm","ctc"].includes(source.id)?"":title);
  const audience=["어린이","청소년","청년","가정","목회자"].find(x=>audienceText.includes(x))||(/목사/.test(audienceText)?"목회자":"대상 확인 필요");
  const category=/북\s*콘서트/.test(title)?"세미나·교육":(source.id==="gwangya"||source.id==="melon")||/찬양|공연|뮤지컬|음악회|콘서트|전시|영화제/.test(title)?"찬양·공연":source.id==="duranno-college"||source.id==="chungeoram"||/세미나|워크숍|컨퍼런스|교육|훈련|학교|포럼|대학|강좌|강연|클래스|배움터/.test(title)?"세미나·교육":/봉사|선교/.test(title)?"봉사·선교":/수련회|캠프|수양회/.test(title)?"수련회":/집회|예배/.test(title)?"집회":"기타 행사";
  const attendance=/온라인|[Zz][Oo][Oo][Mm]|유튜브/.test(venue)?(/현장|병행/.test(venue)?"현장·온라인":"온라인"):"현장";
  // External application buttons are followed by the user, never fetched by the collector.
  let registrationUrl=links(html,url).find(x=>/^(신청하기|신청가기|신청페이지가기|참가신청|등록하기)$/.test(x.title))?.url||null;
  if(source.id==="jiguchon"){
    // G02 navigation also has a generic H01 "신청하기" link. Only the
    // bounded post body can supply this event's application guidance.
    const content=html.match(/<div\b[^>]*id=["']bo_v_con["'][^>]*>([\s\S]*?)<!--\s*}\s*본문 내용 끝\s*-->/i)?.[1];
    registrationUrl=null;
    if(content){
      const paragraphs=[...content.replace(/<br\b[^>]*>/gi,"</p><p>").matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map(match=>match[1]);
      for(const paragraph of paragraphs){
        if(!/신청|등록\s*방법/.test(plain(paragraph)))continue;
        const application=links(paragraph,url).find(link=>{
          const target=new URL(link.url);
          return !(target.hostname==="www.jiguchon.or.kr"&&target.searchParams.get("bo_table")==="H01");
        });
        if(application){registrationUrl=application.url;break;}
      }
    }
  }
  const status=noticeStatus(`${title}\n${evidence}`)||"published";
  const explicitAddress=venue.match(/주소\s*[:：]\s*([^)]*)/)?.[1]||venue;
  return {title,evidence,reason:"",event:{title,startDate,endDate,startTime,venue:venue.slice(0,300),region:attendance==="온라인"?"온라인":regionOf(explicitAddress),attendance,organizer:organizer.slice(0,200),audience,category,registrationUrl,status}};
}
