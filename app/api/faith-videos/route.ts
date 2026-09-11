import catalog from "../../../data/faith-discovery-videos.json";
import { plainText, tag, readFeedText } from "../../news/feed";
import type { FaithVideo, FaithPayload } from "../../faith-videos";

let cached:FaithPayload|undefined;
let inFlight:Promise<FaithPayload>|undefined;
const seed=catalog.items as FaithVideo[];
async function refresh():Promise<FaithPayload>{
  const previous=cached?.items||seed;
  const results=await Promise.all(catalog.sources.map(async source=>{
    try{
      const response=await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${source.channelId}`,{signal:AbortSignal.timeout(8000),headers:{accept:"application/atom+xml","user-agent":"AirChurch/1.0 (+https://airchurch.net/contact)"}});
      if(!response.ok)throw Error("feed_unavailable");
      const {text}=await readFeedText(response);
      const items:FaithVideo[]=[];
      for(const match of text.matchAll(/<entry\b[^>]*>([\s\S]*?)<\/entry>/gi)){
        const entry=match[1],id=tag(entry,"yt:videoId").trim(),title=plainText(tag(entry,"title")),publishedAt=tag(entry,"published").trim();
        if(!/^[\w-]{11}$/.test(id)||!title||!Number.isFinite(Date.parse(publishedAt))||Date.parse(publishedAt)>Date.now())continue;
        items.push({id,youtubeId:id,title,publishedAt,source:source.source,category:source.category,url:`https://www.youtube.com/watch?v=${id}`,thumbnail:`https://i.ytimg.com/vi/${id}/mqdefault.jpg`});
      }
      if(!items.length)throw Error("empty_feed");
      return {items:items.slice(0,12),failed:""};
    }catch{return {items:previous.filter(item=>item.source===source.source&&item.category===source.category),failed:source.source};}
  }));
  return {items:[...seed.filter(item=>item.source==="CTS"),...results.flatMap(result=>result.items)],checkedAt:new Date().toISOString(),failedSources:[...new Set(results.map(result=>result.failed).filter(Boolean))]};
}
export async function GET(){
  if(!cached||Date.now()-Date.parse(cached.checkedAt)>600000){
    if(!inFlight)inFlight=refresh().then(result=>{cached=result;return result;}).finally(()=>{inFlight=undefined;});
    await inFlight;
  }
  return Response.json(cached,{headers:{"cache-control":"public, max-age=120, s-maxage=600, stale-while-revalidate=600"}});
}

// Manual refresh bypasses browser/CDN caches and shares any ongoing source fetch.
export async function POST(){
  if(!inFlight)inFlight=refresh().then(result=>{cached=result;return result;}).finally(()=>{inFlight=undefined;});
  const result=await inFlight;
  return Response.json(result,{headers:{"cache-control":"no-store"}});
}
