// Same-origin relay: never forward visitor cookies, IP headers or video metadata.
export async function POST(request:Request) {
  const reply=(body:object,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"no-store"}});
  if(!request.headers.get("Content-Type")?.startsWith("application/json"))return reply({error:"invalid_request"},415);
  if(Number(request.headers.get("Content-Length")||0)>256)return reply({error:"invalid_request"},413);
  try {
    const body=await request.text();
    if(body.length>256)return reply({error:"invalid_request"},413);
    const input=JSON.parse(body) as {event?:unknown;id?:unknown};
    if(!input||!["visit","play"].includes(String(input.event))||typeof input.id!=="string"||!/^[a-zA-Z0-9-]{16,80}$/.test(input.id))return reply({error:"invalid_request"},400);
    const response=await fetch("https://ppabang.net/api/counters",{
      method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({event:input.event,id:input.id,source:"airchurch"}),
      signal:AbortSignal.timeout(6000),
    });
    if(!response.ok)return reply({error:"counter_unavailable"},503);
    return reply({ok:true});
  } catch { return reply({error:"counter_unavailable"},503); }
}
