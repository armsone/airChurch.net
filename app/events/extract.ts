import { eventRegions } from "./types";
import type { SourceConfig } from "./sources";

export const eventWords = /집회|세미나|워크숍|컨퍼런스|수련회|캠프|훈련|교육|학교|대학|강좌|강연|클래스|배움터|찬양|공연|뮤지컬|음악회|콘서트|전시|봉사|선교대회|포럼|대회|영화제|예배|기도회|수양회|공청회|토론회/;
export function decode(value:string) { return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,"$1").replace(/&#(x[0-9a-f]+|\d+);/gi,(_,n)=>{const v=n[0].toLowerCase()==="x"?parseInt(n.slice(1),16):Number(n);return v>0&&v<=0x10ffff?String.fromCodePoint(v):"";}).replace(/&nbsp;/gi," ").replace(/&amp;/gi,"&").replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/&lt;/gi,"<").replace(/&gt;/gi,">"); }
export function plain(value:string) { return decode(value.replace(/<[^>]*>/g," ")).replace(/\s+/g," ").trim(); }
export function lines(html:string) { return decode(html.replace(/<!--[\s\S]*?-->/g,"").replace(/<(head|script|style|nav|header|footer)\b[^>]*>[\s\S]*?<\/\1>/gi,"").replace(/<\/(?:p|div|li|tr|h[1-6]|dt|dd)>|<br\s*\/?\s*>/gi,"\n").replace(/<[^>]*>/g," ")).split(/\n/).map(x=>x.replace(/\s+/g," ").trim()).filter(Boolean); }
export function links(html:string,base:string) { const found=new Map<string,string>(); for(const m of html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)){try{const u=new URL(decode(m[1]),base);if(!/^https?:$/.test(u.protocol)||u.username||u.password||u.port)continue;u.hash="";for(const key of [...u.searchParams.keys()])if(/^utm_|^(fbclid|gclid|back_url)$/.test(key))u.searchParams.delete(key);u.searchParams.sort();const key=u.href.replace(/%[0-9a-f]{2}/gi,x=>x.toUpperCase()),title=plain(m[2]);if(!title||/^(자세히\s*보기|더\s*보기|보기|바로가기|MORE)$/i.test(title)){if(!found.has(key))found.set(key,"");continue;}if(!found.get(key)||title.length>found.get(key)!.length)found.set(key,title);}catch{}}return [...found].map(([url,title])=>({url,title})); }
export function validDate(value:string){if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const d=new Date(`${value}T00:00:00Z`);return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===value;}
function dates(value:string) { return [...value.matchAll(/(20\d{2})\s*[년.\-/]\s*(\d{1,2})\s*[월.\-/]\s*(\d{1,2})\s*일?/g)].map(m=>`${m[1]}-${m[2].padStart(2,"0")}-${m[3].padStart(2,"0")}`); }
function field(rows:string[],pattern:RegExp) { const index=rows.findIndex(x=>pattern.test(x));if(index<0)return "";const value=rows[index].replace(pattern,"").replace(/^[\s:：|｜]+/,"").trim();return (value||rows[index+1]||"").slice(0,400); }
function regionOf(venue:string){const aliases:Record<string,string>={충청북도:"충북",충청남도:"충남",전라북도:"전북",전북특별자치도:"전북",전라남도:"전남",경상북도:"경북",경상남도:"경남",분당:"경기",수지:"경기",성남:"경기",용인:"경기",동대문:"서울",종로:"서울"};return eventRegions.find(x=>venue.includes(x))||Object.entries(aliases).find(([a])=>venue.includes(a))?.[1]||"지역 확인 필요";}
function meta(html:string,key:string){for(const m of html.matchAll(/<meta\b[^>]*>/gi)){if(m[0].includes(`"${key}"`)||m[0].includes(`'${key}'`))return plain(m[0].match(/content=["']([\s\S]*?)["']/i)?.[1]||"");}return "";}
export type ExtractedEvent={title:string;startDate:string;endDate:string;startTime:string|null;venue:string;region:string;attendance:string;organizer:string;audience:string;category:string;registrationUrl:string|null;status:string};
// Annual regional lists contain separate events, not one continuous date range.
export function extractScheduleEntries(html:string,source:SourceConfig){
  if(source.id!=="snnh")return [];
  const rows=lines(html),heading=rows.find(x=>/^20\d{2}년 노회 행사 및 임직예배 일정$/.test(x));if(!heading)return [];
  const year=heading.slice(0,4),entries=[];
  const start=rows.indexOf(heading),end=rows.findIndex((x,i)=>i>start&&x==="다른 글 보기"),notice=noticeStatus(rows.slice(start,end<0?rows.length:end).join("\n"));
  for(const row of rows){
    const match=row.match(/^\*?\s*(\d{1,2})월\s*(\d{1,2})일\([월화수목금토일]\)\s*(오전|오후|저녁)\s*(\d{1,2})시\s*(?:(\d{1,2})분)?\s*,\s*([^,\s]+교회)\s+(.+)$/);
    if(!match||/\//.test(match[7]))continue;
    const date=`${year}-${match[1].padStart(2,"0")}-${match[2].padStart(2,"0")}`,hour=Number(match[4]),minute=Number(match[5]||0);if(!validDate(date)||hour<1||hour>12||minute>59)continue;
    const time=`${String(hour%12+(match[3]==="오전"?0:12)).padStart(2,"0")}:${String(minute).padStart(2,"0")}`,venue=match[6],title=`${venue} ${match[7]}`;
    entries.push({key:`${date}_${time}_${encodeURIComponent(title)}`,title,evidence:`${heading}\n${row}`,reason:"",event:{title,startDate:date,endDate:date,startTime:time,venue,region:regionOf(venue),attendance:"현장",organizer:"주최 확인 필요",audience:"대상 확인 필요",category:"집회",registrationUrl:null,status:notice||noticeStatus(row)||"published"} satisfies ExtractedEvent});
  }
  return entries;
}
export function noticeStatus(text:string){return /행사\s*취소|개최\s*취소|집회\s*취소|\[취소\]|\(취소\)/.test(text)?"cancelled":/(?:행사|공연|개최|집회|일정)(?:가|이|를|을)?\s*연기|\[연기\]|\(연기\)|잠정\s*중단|일정\s*변경(?:\s*안내|되었|합니다)/.test(text)?"checking":null;}
export function extractEvent(html:string,url:string,source:SourceConfig,knownTitle=""):{event:ExtractedEvent|null;title:string;evidence:string;reason:string} {
  const rows=lines(html);
  const headings=[...html.matchAll(/<h[1-4]\b[^>]*>([\s\S]*?)<\/h[1-4]>/gi)].map(m=>plain(m[1]));
  const currentHeading=headings.find(x=>knownTitle.length>2&&x.includes(knownTitle));
  const og=meta(html,"og:title");
  const boardTitle=plain(html.match(/<h[1-4][^>]*id=["']bo_v_title["'][^>]*>([\s\S]*?)<\/h[1-4]>/i)?.[1]||"");
  const rawTitle=boardTitle||(source.eventOnly&&og?og:currentHeading)||(og&&eventWords.test(og)?og:knownTitle)||og||plain(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||"");
  const title=rawTitle.replace(new RegExp(`^${source.name}\\s*[|:>-]\\s*`),"").replace(/\s*[|>].*$/,"").trim().slice(0,180);
  const titleIndex=rows.findIndex(x=>title.length>2&&x.includes(title));
  const structuredIndex=source.id==="jiguchon"?rows.findIndex(x=>x==="일정안내"):-1;
  const articleStart=structuredIndex>=0?structuredIndex:titleIndex;
  const articleRows=articleStart>=0?rows.slice(articleStart,Math.min(articleStart+150,rows.length)):rows;
  // Ignore related articles/navigation below the actual article.
  const end=articleRows.findIndex((x,i)=>i>1&&/^(관련 글들|이전글|다음글|첨부파일|목록보기|댓글목록)$/.test(x));
  const body=end>=0?articleRows.slice(0,end):articleRows;
  const evidence=body.join("\n").slice(0,2500);
  const fail=(reason:string)=>({event:null,title,evidence,reason});
  if((!source.eventOnly&&!eventWords.test(title)&&!body.some(x=>/^(진행\s*일시|사역\s*일정)/.test(x)))||/채용|입찰|당첨|장학생 명단|결과 보고|성료|후기|다시보기/.test(title))return fail("not_an_upcoming_event");
  if(source.id==="duranno-college"&&/녹화·편집|녹화\s*영상|녹화된\s*강의|VOD/.test(body.join("\n")))return fail("recorded_course_not_event");
  const datePattern=/^[\d\s\p{P}\p{S}\uFE0F]*(?:진행\s*일시|사역\s*일정|(?:행사|공연|전시|강의)\s*(?:일시|일정|기간)|일\s*시|일\s*정|교육\s*기간|기\s*간)(?=\s|[:：|｜]|$)\s*[:：|｜]?\s*/u;
  const datedIndex=body.findIndex(x=>datePattern.test(x)&&/20\d{2}\s*[년./-]/.test(x));
  const di=datedIndex>=0?datedIndex:body.findIndex(x=>datePattern.test(x));
  let when=field(di>=0?body.slice(di):body,datePattern);
  if(di>=0&&body[di+2]&&/^\s*[-~～–]/.test(body[di+2]))when+=` ${body[di+2]}`;
  // Short month/day labels may use a year explicitly present in the event title, never the publication date.
  if(!/20\d{2}/.test(when)){const years=[...new Set(title.match(/20\d{2}/g)||[])];if(years.length===1&&/^\d{1,2}\s*[월./]\s*\d{1,2}/.test(when))when=`${years[0]}년 ${when}`;}
  const ds=dates(when);
  if(/[,•·]\s*(?:\d{1,2}\s*월\s*)?\d{1,2}\s*일/.test(when))return fail("multiple_sessions_require_explicit_dates");
  if(ds.length<1||ds.length>2||ds.some(x=>!validDate(x)))return fail("explicit_event_date_required");
  if(ds.length===2){const matches=[...when.matchAll(/20\d{2}\s*[년.\-/]\s*\d{1,2}\s*[월.\-/]\s*\d{1,2}\s*일?/g)],between=when.slice(matches[0].index!+matches[0][0].length,matches[1].index);if(!/[~～–—-]|부터/.test(between)||/[,•·]|및|또는/.test(between))return fail("multiple_sessions_require_explicit_dates");}
  let startDate=ds[0],endDate=ds[1]||ds[0];
  if(ds.length===1){
    const tail=when.replace(/20\d{2}\s*[년.\-/]\s*\d{1,2}\s*[월.\-/]\s*\d{1,2}\s*일?/,"");
    const range=tail.match(/[~～–-]\s*(?:(\d{1,2})\s*[월./]\s*)?(\d{1,2})\s*일?(?=\s*(?:[.(（]|$))/);
    if(range)endDate=`${startDate.slice(0,4)}-${(range[1]||startDate.slice(5,7)).padStart(2,"0")}-${range[2].padStart(2,"0")}`;
    else if(/[~～–-]/.test(tail)&&!/(?:시|:\d{2})\s*[~～–-]\s*(?:오전|오후|저녁|밤|낮)?\s*\d{1,2}\s*(?:시|:)/.test(tail))return fail("ambiguous_date_range");
  }
  const weekly=when.match(/매주\s*[월화수목금토일]요일\s*(\d{1,2})주/);
  if(weekly&&ds.length===1&&Number(weekly[1])>=1&&Number(weekly[1])<=52)endDate=new Date(Date.parse(startDate)+(Number(weekly[1])-1)*7*86400000).toISOString().slice(0,10);
  else if(/매주|매월|격주|회차|\d+차\s*[:：]/.test(when))return fail("multiple_sessions_require_explicit_dates");
  if(!validDate(endDate)||endDate<startDate||Date.parse(endDate)-Date.parse(startDate)>366*86400000)return fail("ambiguous_date_range");
  const venue=field(body,/^[\d\s\p{P}\p{S}\uFE0F]*(?:행사\s*장소|강의\s*장소|공연장|장\s*소)(?=\s|[:：|｜]|$)\s*[:：|｜]?\s*/u)||(source.id==="chungeoram"?field(body,/^진행\s*방식\s*[:：]\s*/):"");
  const organizer=field(body,/^[\d\s\p{P}\p{S}\uFE0F]*주\s*최\s*[:：|｜]?\s*/u)||"주최 확인 필요";
  if(!venue)return fail("venue_required");
  const time=when.match(/(오전|오후|저녁|밤|낮)\s*(\d{1,2})\s*(?:시|:)(?:\s*(\d{1,2})\s*분?)?/);
  let startTime:string|null=null;
  if(time){let h=Number(time[2]),m=Number(time[3]||0);if(h>=1&&h<=12&&m<60){h=h%12+(time[1]==="오전"?0:12);startTime=`${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;}}
  else{const clock=when.match(/(?:^|\s)([01]?\d|2[0-3]):([0-5]\d)/);if(clock)startTime=`${clock[1].padStart(2,"0")}:${clock[2]}`;}
  if(source.id==="duranno-college"&&!startTime){const intro=body.findIndex(x=>x==="세미나 소개"),clock=body.slice(Math.max(0,di),intro<0?di+15:intro).find(x=>/^([01]?\d|2[0-3]):[0-5]\d\s*[-~]/.test(x));if(clock)startTime=clock.match(/^\d{1,2}:\d{2}/)![0].padStart(5,"0");}
  const audienceText=field(body,/^(?:[\d.•○●\s-]*)?대\s*상\s*[:：]?\s*/)||title;
  const audience=["어린이","청소년","청년","가정","목회자"].find(x=>audienceText.includes(x))||(/목사/.test(audienceText)?"목회자":"대상 확인 필요");
  const category=source.id==="gwangya"||/찬양|공연|뮤지컬|음악회|콘서트|전시|영화제/.test(title)?"찬양·공연":source.id==="duranno-college"||source.id==="chungeoram"||/세미나|워크숍|컨퍼런스|교육|훈련|학교|포럼|대학|강좌|강연|클래스|배움터/.test(title)?"세미나·교육":/봉사|선교/.test(title)?"봉사·선교":/수련회|캠프|수양회/.test(title)?"수련회":/집회|예배/.test(title)?"집회":"기타 행사";
  const attendance=/온라인|[Zz][Oo][Oo][Mm]|유튜브/.test(venue)?(/현장|병행/.test(venue)?"현장·온라인":"온라인"):"현장";
  // External application buttons are followed by the user, never fetched by the collector.
  const registrationUrl=links(html,url).find(x=>/^(신청하기|신청가기|신청페이지가기|참가신청|등록하기)$/.test(x.title))?.url||null;
  const status=noticeStatus(`${title}\n${evidence}`)||"published";
  return {title,evidence,reason:"",event:{title,startDate,endDate,startTime,venue:venue.slice(0,300),region:regionOf(venue),attendance,organizer:organizer.slice(0,200),audience,category,registrationUrl,status}};
}
