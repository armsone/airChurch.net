import { internalTaskRequestAllowed } from "../../_shared";
import { refreshChurchNewsSnapshot } from "../route";

export async function POST(request:Request){
  if(!internalTaskRequestAllowed(request))return Response.json({error:"Not found"},{status:404,headers:{"cache-control":"no-store"}});
  const payload=await refreshChurchNewsSnapshot();
  return Response.json(payload?{ok:true,items:payload.items.length}:{ok:false,error:"News feeds temporarily unavailable"},{status:payload?200:502,headers:{"cache-control":"no-store"}});
}
