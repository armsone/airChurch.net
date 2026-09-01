import {database,internalTaskRequestAllowed,maybeRunDataRetention} from "../../_shared";

export async function POST(request:Request){
  if(!internalTaskRequestAllowed(request))return Response.json({error:"Not found"},{status:404,headers:{"cache-control":"no-store"}});
  await maybeRunDataRetention(database());
  return Response.json({ok:true},{headers:{"cache-control":"no-store"}});
}
