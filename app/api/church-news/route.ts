import { database } from "../_shared";
import { getRequestExecutionContext } from "vinext/shims/request-context";
import { boundedFetch, robotsAllowed, robotsDelay } from "../../events/source-reader";

import { sources, readFeedText, parseFeed, plainText, tag, type FeedSource, type NewsItem, type FeedState, type NewsPayload, type SnapshotRow } from "../../news/feed";
export { sources, readFeedText } from "../../news/feed";

const FEED_VERSION=7;
async function loadSource(source:FeedSource,previous?:FeedState):Promise<FeedState> {
  const checkedAt=new Date().toISOString();
  try{
    // Automatically qualified feeds use exactly the qualification crawler's
    // identity, robots rules, byte limit and redirect boundary in production.
    if(source.kind==="rss"){
      const config={...source,homepage:source.url,kind:"rss" as const,detailPattern:""};
      const rules=await boundedFetch(new URL("/robots.txt",source.url).href,config);
      if(![200,404].includes(rules.status))throw Error("robots_unavailable");
      if(!robotsAllowed(rules.text,source.url))throw Error("robots_disallowed");
      const delay=robotsDelay(rules.text);if(delay>10000)throw Error("crawl_delay_requires_separate_schedule");
      const response=await boundedFetch(source.url,config,()=>new Promise(resolve=>setTimeout(resolve,delay)),rules.text);
      if(response.status!==200)throw Error(`feed_http_${response.status}`);
      const fresh=parseFeed(response.text,source);if(!fresh.length)throw Error("feed_has_no_valid_articles");
      const items=[...new Map([...(previous?.items||[]),...fresh].map(item=>[item.url,item])).values()].sort((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt)).slice(0,10);
      return {items,checkedAt,lastSuccessAt:checkedAt,nextCheckAt:new Date(Date.now()+2*3600000).toISOString(),failures:0,version:FEED_VERSION};
    }
    const headers:Record<string,string>={accept:"application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.1","user-agent":"AirChurchNews/1.0 (+https://airchurch.net/contact)"};
    if(previous?.etag)headers["if-none-match"]=previous.etag;
    if(previous?.modified)headers["if-modified-since"]=previous.modified;
    const signal=AbortSignal.timeout(15_000);
    let response=await fetch(source.url,{headers,signal});
    const nextCheckAt=new Date(Date.now()+2*3600000).toISOString();
    if(response.status===304&&previous?.items.length)return {...previous,checkedAt,lastSuccessAt:checkedAt,nextCheckAt,failures:0,version:FEED_VERSION,lastError:undefined};
    if(!response.ok){void response.body?.cancel();throw Error(`feed_http_${response.status}`);}
    let feed=await readFeedText(response);
    // Some legacy feeds negotiate an HTML wrapper for an XML-specific Accept.
    // Retry only that successful non-feed response once, with the same identity,
    // URL and overall deadline. Never retry a denied/challenge page this way.
    if(!/<(?:rss|feed|rdf:RDF)\b/i.test(feed.text)&&/<html\b/i.test(feed.text)&&! /captcha|document\.cookie|access\s*denied|forbidden|challenge|접근\s*(?:제한|차단)|보안\s*확인/i.test(feed.text)){
      response=await fetch(source.url,{headers:{accept:"*/*","user-agent":headers["user-agent"]},signal});
      if(!response.ok){void response.body?.cancel();throw Error(`feed_http_${response.status}`);}
      feed=await readFeedText(response);
    }
    const fresh=parseFeed(feed.text,source);
    if(!fresh.length){
      const entries=[...feed.text.matchAll(/<(?:item|entry)\b/gi)].length;
      const dates=[...feed.text.matchAll(/<(?:pubDate|dc:date|atom:updated|published|updated)\b/gi)].length;
      if(!entries&&/<html\b/i.test(feed.text))throw Error(`feed_not_xml:${plainText(tag(feed.text,"title")).slice(0,70)||"HTML page returned"}`);
      throw Error(`feed_has_no_valid_articles:entries=${entries},dates=${dates},bytes=${feed.text.length},type=${response.headers.get("content-type")||"unknown"}`);
    }
    // A bounded prefix can add/update articles but cannot erase the last good tail.
    const items=[...new Map([...(feed.truncated?previous?.items||[]:[]),...fresh].map(item=>[item.url,item])).values()].sort((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt)).slice(0,10);
    return {items,checkedAt,lastSuccessAt:checkedAt,nextCheckAt,failures:0,version:FEED_VERSION,etag:feed.truncated?undefined:response.headers.get("etag")||undefined,modified:feed.truncated?undefined:response.headers.get("last-modified")||undefined};
  }catch(error){
    const failures=(previous?.failures||0)+1;
    console.warn("church_news_source_failed",source.name,error instanceof Error?error.message.slice(0,100):"feed_unavailable");
    return {...previous,items:previous?.items||[],checkedAt,nextCheckAt:new Date(Date.now()+Math.min(24,2**failures)*3600000).toISOString(),failures,version:FEED_VERSION,lastError:error instanceof Error?error.message.slice(0,100):"feed_unavailable"};
  }
}

async function mapWithConcurrency<T,R>(items:T[],limit:number,task:(item:T)=>Promise<R>):Promise<R[]> {
  const results=new Array<R>(items.length);
  let next=0;
  await Promise.all(Array.from({length:Math.min(limit,items.length)},async()=>{
    while(true){const index=next++;if(index>=items.length)return;results[index]=await task(items[index]);}
  }));
  return results;
}

const MAX_PER_SOURCE=10;

function capPerSource(items:NewsItem[],limit:number) {
  const counts=new Map<string,number>();
  const result:NewsItem[]=[];
  for(const item of items) {
    const count=counts.get(item.source)||0;
    if(count>=limit) continue;
    counts.set(item.source,count+1);
    result.push(item);
  }
  return result;
}

const feedKey=(source:FeedSource)=>`feed:${source.allowedHost}`;
const publicSources=(states=new Map<string,FeedState>())=>sources.map(source=>{
  const state=states.get(feedKey(source));
  return {name:source.name,rssUrl:source.url,homepage:source.homepage,status:!state?"pending":state.failures?state.lastError?.startsWith("feed_not_xml")?"invalid":"failed":Date.now()-Date.parse(state.checkedAt)>6*3600000?"stale":"ok",lastSuccessAt:state?.lastSuccessAt};
});

// One short batch per lease. Public reads never wait for fifty external servers.
export async function refreshChurchNewsSnapshot() {
  const db=database(),now=new Date().toISOString(),token=crypto.randomUUID();
  const claim=await db.prepare("INSERT INTO church_news_snapshots(key,payload,item_count,refreshed_at) VALUES('refresh-lock',?,0,?) ON CONFLICT(key) DO UPDATE SET payload=excluded.payload,refreshed_at=excluded.refreshed_at WHERE church_news_snapshots.refreshed_at<?").bind(token,new Date(Date.now()+60000).toISOString(),now).run();
  if(Number(claim.meta.changes)!==1)return {...(await readChurchNewsSnapshot()||{items:[],sources:publicSources(),target:sources.length}),sourcesProcessed:0};
  try{
    const rows=await db.prepare("SELECT key,payload FROM church_news_snapshots WHERE key LIKE 'feed:%'").all<{key:string;payload:string}>();
    const states=new Map<string,FeedState>();
    for(const row of rows.results){try{states.set(row.key,JSON.parse(row.payload));}catch{/* Retain the last aggregate until this feed can be refreshed. */}}
    const due=sources.filter(s=>{const state=states.get(feedKey(s));return !state||state.nextCheckAt<=now||(state.failures>0&&(state.version||0)<FEED_VERSION);}).sort((a,b)=>(states.get(feedKey(a))?.nextCheckAt||"").localeCompare(states.get(feedKey(b))?.nextCheckAt||"")).slice(0,6);
    if(!due.length)return {...(await readChurchNewsSnapshot()||{items:[],sources:publicSources(),target:sources.length}),sourcesProcessed:0};
    const loaded=await mapWithConcurrency(due,3,async source=>({source,state:await loadSource(source,states.get(feedKey(source)))}));
    // Keep bounded health metadata before article bodies for operational reads.
    // The content and the snapshot's last-good preservation are unchanged.
    await db.batch(loaded.map(({source,state})=>{const {items,...health}=state;return db.prepare("INSERT INTO church_news_snapshots(key,payload,item_count,refreshed_at) VALUES(?,?,?,?) ON CONFLICT(key) DO UPDATE SET payload=excluded.payload,item_count=excluded.item_count,refreshed_at=excluded.refreshed_at").bind(feedKey(source),JSON.stringify({...health,items}),items.length,state.checkedAt);}));
    for(const {source,state} of loaded)states.set(feedKey(source),state);
    const previous=await readChurchNewsSnapshot();
    const current=sources.flatMap(s=>states.get(feedKey(s))?.items.length?states.get(feedKey(s))!.items:previous?.items.filter(i=>i.source===s.name)||[]);
    const items=capPerSource([...new Map(current.map(item=>[item.url,item])).values()].sort((a,b)=>(Date.parse(b.publishedAt)||0)-(Date.parse(a.publishedAt)||0)),MAX_PER_SOURCE).slice(0,sources.length*MAX_PER_SOURCE);
    const payload:NewsPayload={items,sources:publicSources(states),refreshedAt:now,sourcesProcessed:due.length,target:sources.length};
    await db.prepare("INSERT INTO church_news_snapshots (key,payload,item_count,refreshed_at) VALUES ('latest',?,?,?) ON CONFLICT(key) DO UPDATE SET payload=excluded.payload,item_count=excluded.item_count,refreshed_at=excluded.refreshed_at").bind(JSON.stringify(payload),items.length,now).run();
    return payload;
  }finally{
    await db.prepare("UPDATE church_news_snapshots SET refreshed_at=? WHERE key='refresh-lock' AND payload=?").bind(new Date().toISOString(),token).run();
  }
}

async function readChurchNewsSnapshot(){
  const row=await database().prepare("SELECT payload,refreshed_at AS refreshedAt FROM church_news_snapshots WHERE key='latest' LIMIT 1").first<SnapshotRow>();
  if(!row)return null;
  try {
    const payload=JSON.parse(row.payload) as NewsPayload;
    const marks=new Map(sources.map((source)=>[source.name,source.markUrl]));
    return {...payload,target:sources.length,refreshedAt:row.refreshedAt,sources:publicSources().map(source=>({...source,...payload.sources.find(s=>s.name===source.name),rssUrl:source.rssUrl})),items:payload.items.map((item)=>({...item,markUrl:item.markUrl||marks.get(item.source)||""}))};
  } catch{return null;}
}

export async function GET() {
  const stored=await readChurchNewsSnapshot();
  if(!stored||Date.now()-Date.parse(stored.refreshedAt||"")>5*60000)getRequestExecutionContext()?.waitUntil(refreshChurchNewsSnapshot().catch(()=>null));
  const payload=stored??{items:[],sources:publicSources(),target:sources.length};
  const cacheControl=payload.items.length?"public, max-age=0, s-maxage=60, must-revalidate":"no-store";
  return Response.json(payload,{headers:{"cache-control":cacheControl}});
}
