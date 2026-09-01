import {database,maybeRunDataRetention} from "../../_shared";

export async function POST(request:Request){
  if(new URL(request.url).hostname!=="airchurch.internal")return Response.json({error:"Not found"},{status:404,headers:{"cache-control":"no-store"}});
  await maybeRunDataRetention(database());
  return Response.json({ok:true},{headers:{"cache-control":"no-store"}});
}
