import type { SourceConfig } from "./sources";
import { readFeedText } from "../news/feed";
import { eventWords, links, plain } from "./extract";
const AGENT="AirChurchEvents/1.0 (+https://airchurch.net/contact)";
export const host=(url:string)=>new URL(url).hostname.replace(/^www\./,"");
export function assertSourceDocument(text:string){
  const title=plain(text.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||"");
  if(/^(?:access denied|forbidden|just a moment|보안 확인)/i.test(title)||(text.length<10000&&/document\.cookie|captcha.*(?:verify|challenge)|접근이?\s*(?:제한|차단)/i.test(text)))throw Error("access_challenge");
}
export async function boundedFetch(url:string,source:SourceConfig,pace?:()=>Promise<void>,robots?:string):Promise<{text:string;status:number;finalUrl:string}> {
  for(let redirect=0;redirect<4;redirect++){
    const u=new URL(url);if(!/^https?:$/.test(u.protocol)||u.username||u.password||u.port||!(host(url)===host(source.url)||(source.kind==="rss"&&host(url)===host(source.homepage))))throw Error("source_boundary");
    if(robots!==undefined&&!robotsAllowed(robots,url))throw Error("robots_disallowed");
    await pace?.();
    const r=await fetch(url,{redirect:"manual",signal:AbortSignal.timeout(7000),headers:{"user-agent":AGENT,accept:"*/*"}});
    if(r.status>=300&&r.status<400){const next=r.headers.get("location");void r.body?.cancel();if(!next)throw Error("redirect_without_location");url=new URL(next,url).href;continue;}
    if(!r.ok){void r.body?.cancel();return {text:"",status:r.status,finalUrl:url};}
    if(source.kind==="rss"&&host(url)===host(source.url)&&/xml|rss|atom/i.test(r.headers.get("content-type")||""))return {text:(await readFeedText(r)).text,status:r.status,finalUrl:url};
    if(Number(r.headers.get("content-length")||0)>1500000){void r.body?.cancel();throw Error("response_too_large");}
    const reader=r.body?.getReader();if(!reader)return {text:"",status:r.status,finalUrl:url};const chunks:Uint8Array[]=[];let size=0;
    while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>1500000){void reader.cancel();throw Error("response_too_large");}chunks.push(value);}
    const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
    const charset=r.headers.get("content-type")?.match(/charset=([^;,\s]+)/i)?.[1]?.replace(/["']/g,"")||source.charset||"utf-8";
    const text=new TextDecoder(charset).decode(bytes);assertSourceDocument(text);
    return {text,status:r.status,finalUrl:url};
  }throw Error("too_many_redirects");
}
function robotsGroups(text:string){
  const groups:Array<{agents:string[];rules:Array<{allow:boolean;path:string}>;delay:number}>=[];let group:typeof groups[number]={agents:[],rules:[],delay:0},hasDirectives=false;
  for(const raw of text.split(/\r?\n/)){const line=raw.replace(/#.*$/,"").trim(),colon=line.indexOf(":");if(colon<0)continue;const key=line.slice(0,colon).trim().toLowerCase(),value=line.slice(colon+1).trim();
    if(key==="user-agent"){if(hasDirectives){groups.push(group);group={agents:[],rules:[],delay:0};hasDirectives=false;}if(value)group.agents.push(value.toLowerCase());}
    else if(group.agents.length){hasDirectives=true;if((key==="allow"||key==="disallow")&&value)group.rules.push({allow:key==="allow",path:value});else if(key==="crawl-delay"&&/^\d+(?:\.\d+)?$/.test(value))group.delay=Math.max(group.delay,Number(value)*1000);}
  }groups.push(group);
  const specific=groups.filter(g=>g.agents.some(a=>a!=="*"&&AGENT.toLowerCase().split("/")[0].includes(a)));
  return specific.length?specific:groups.filter(g=>g.agents.includes("*"));
}
export function robotsDelay(text:string){return Math.max(1000,...robotsGroups(text).map(g=>g.delay));}
export function robotsAllowed(text:string,url:string){
  const selected=robotsGroups(text);
  const u=new URL(url),path=u.pathname+u.search;
  const matches=selected.flatMap(g=>g.rules).filter(r=>{const end=r.path.endsWith("$"),pattern=(end?r.path.slice(0,-1):r.path).split("*").map(x=>x.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")).join(".*");return new RegExp(`^${pattern}${end?"$":""}`).test(path);}).sort((a,b)=>b.path.length-a.path.length||Number(b.allow)-Number(a.allow));
  return matches[0]?.allow??true;
}

export function isDetail(source:SourceConfig,url:string){
  try{const u=new URL(url),base=new URL(source.url);u.hash="";return host(url)===host(source.url)&&new RegExp(source.detailPattern,"i").test(u.href)&&(!base.searchParams.has("bo_table")||u.searchParams.get("bo_table")===base.searchParams.get("bo_table"));}catch{return false;}
}
export function nextListing(source:SourceConfig,html:string,base:string){
  const current=new URL(base),root=new URL(source.url),page=Number(current.searchParams.get("page")||current.pathname.match(/\/page\/(\d+)\//)?.[1]||1);
  if(page>=10)return null;
  return links(html,base).find(link=>{const u=new URL(link.url),next=Number(u.searchParams.get("page")||u.pathname.match(/\/page\/(\d+)\//)?.[1]||0);return host(link.url)===host(source.url)&&next===page+1&&(u.pathname===root.pathname||u.pathname===`${root.pathname.replace(/\/$/,"")}/page/${next}/`)&&(!root.searchParams.has("bo_table")||u.searchParams.get("bo_table")===root.searchParams.get("bo_table"));})?.url||null;
}
export async function discover(source:SourceConfig,html:string,base=source.url){
  // Public JSON used by the society's notice list, not a private/auth API.
  if(source.id==="ntsk"&&new URL(base).pathname==="/board/maininfo/article.json"){
    const data=JSON.parse(html)?.data;if(!Array.isArray(data))return [];
    return data.slice(0,20).flatMap(row=>{
      if(!Number.isSafeInteger(row.articleId)||row.articleId<1||row.secret!==0||row.deleteYn!==0||typeof row.subject!=="string")return [];
      const url=new URL(`/board/maininfo/article/${row.articleId}`,source.url).href;
      return isDetail(source,url)?[{url,title:plain(row.subject).slice(0,180)}]:[];
    });
  }
  if(source.singlePage)return [{url:source.url,title:source.name}];
  if(/<item\b/i.test(html)){
    return [...html.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)].flatMap(m=>{const title=plain(m[1].match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||""),url=plain(m[1].match(/<link[^>]*>([\s\S]*?)<\/link>/i)?.[1]||"");try{return (source.kind==="rss"?eventWords.test(title)&&host(url)===host(source.homepage):isDetail(source,url))?[{url,title}]:[];}catch{return [];}});
  }
  const found=links(html,base).filter(x=>isDetail(source,x.url)&&x.url!==source.url&&(x.title.length>2||source.eventOnly)&&(source.kind!=="rss"||eventWords.test(x.title))&&(!source.christianOnly||/찬양|워십|그리스도|기독교|예배|가스펠/.test(x.title)));
  if(source.id==="kacs")for(const match of html.matchAll(/<a\b[^>]*href=["']javascript:goView\((\d{1,12})\)["'][^>]*>([\s\S]*?)<\/a>/gi)){
    const url=new URL(`/kacs_new/community/main.php?activePage=view&no=${match[1]}`,base).href;
    if(isDetail(source,url))found.push({url,title:plain(match[2])});
  }
  if(source.id==="jdm")for(const match of html.matchAll(/<a\b[^>]*href="javascript:go_view\('(\d{1,12})','FA_M'\)"[^>]*>([\s\S]*?)<\/a>/gi)){
    const url=new URL(`/story/board_view.asp?idx=${match[1]}&BodType_CK=FA_M`,base).href;
    if(isDetail(source,url))found.push({url,title:plain(match[2])});
  }
  // The official page's locations(id) links are read as data, never executed.
  if(source.id==="duranno-college")for(const match of html.matchAll(/onclick=["']locations\((\d+)\)["']/g))found.push({url:new URL(`/biblecollege/view/seminar_detail.asp?smrnum=${match[1]}`,base).href,title:""});
  // The public notice list exposes modal IDs as data. Keep the human-facing
  // permalink as provenance; do not execute the site's JavaScript.
  if(source.id==="sarang")for(const match of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)){
    if(!/\bclass=["'][^"']*\bcls-notice-view\b/.test(match[1]))continue;
    const id=match[1].match(/\bdata-idx=["'](\d{1,12})["']/)?.[1];
    const title=plain(match[2].match(/<p\b[^>]*class=["'][^"']*\btable-notice-title\b[^"']*["'][^>]*>([\s\S]*?)<\/p>/i)?.[1]||"");
    if(id&&title)found.push({url:new URL(`/info/notice.asp?no=${id}`,base).href,title});
  }
  return [...new Map(found.map(item=>[item.url,item])).values()];
}
