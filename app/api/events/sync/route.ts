import { internalTaskRequestAllowed } from "../../_shared";
import { syncEvents } from "../../../events/collection";
import { env } from "cloudflare:workers";
import { refreshChurchNewsSnapshot } from "../../church-news/route";
export async function POST(request:Request){
  const token=(env as unknown as {EVENTS_SYNC_TOKEN?:string}).EVENTS_SYNC_TOKEN;
  const authorized=Boolean(token&&token.length>=32&&request.headers.get("authorization")===`Bearer ${token}`);
  if(!authorized&&!internalTaskRequestAllowed(request))return Response.json({error:"Not found"},{status:404,headers:{"cache-control":"no-store"}});
  try{
    // The event discovery scheduler also maintains its news-feed inputs.
    const [events,news]=await Promise.allSettled([syncEvents(),refreshChurchNewsSnapshot()]);
    for(const [stage,result] of [["events",events],["news",news]] as const){
      if(result.status==="rejected")console.error("event_sync_stage_failed",stage,result.reason instanceof Error?result.reason.message:"unknown_error");
    }
    if(events.status==="rejected")throw events.reason;
    if(news.status==="rejected")throw news.reason;
    return Response.json({...events.value,newsSourcesProcessed:news.value.sourcesProcessed||0},{headers:{"cache-control":"no-store"}});
  }catch(error){
    console.error("event_sync_failed",error instanceof Error?error.message:"unknown_error");
    return Response.json({error:"행사 수집 저장소 연결 지연"},{status:503,headers:{"cache-control":"no-store","retry-after":"30"}});
  }
}
