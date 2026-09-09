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
    const [events,news]=await Promise.all([syncEvents(),refreshChurchNewsSnapshot()]);
    return Response.json({...events,newsSourcesProcessed:news.sourcesProcessed||0},{headers:{"cache-control":"no-store"}});
  }catch(error){
    console.error("event_sync_failed",error instanceof Error?error.message:"unknown_error");
    return Response.json({error:"행사 수집 저장소 연결 지연"},{status:503,headers:{"cache-control":"no-store"}});
  }
}
