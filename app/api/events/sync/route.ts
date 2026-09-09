import { internalTaskRequestAllowed } from "../../_shared";
import { syncEvents } from "../../../events/collection";
import { env } from "cloudflare:workers";
export async function POST(request:Request){
  const token=(env as unknown as {EVENTS_SYNC_TOKEN?:string}).EVENTS_SYNC_TOKEN;
  const authorized=Boolean(token&&token.length>=32&&request.headers.get("authorization")===`Bearer ${token}`);
  if(!authorized&&!internalTaskRequestAllowed(request))return Response.json({error:"Not found"},{status:404,headers:{"cache-control":"no-store"}});
  try{return Response.json(await syncEvents(),{headers:{"cache-control":"no-store"}});}catch{return Response.json({error:"행사 수집 저장소 연결 지연"},{status:503,headers:{"cache-control":"no-store"}});}
}
