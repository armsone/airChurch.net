type Track = { id:string; title:string; channel:string; duration:number };
let cached:{items:Track[];at:number}|undefined;
let pending:Promise<Track[]>|undefined;

async function catalog() {
  if(cached && Date.now()-cached.at<600_000)return cached.items;
  if(!pending)pending=(async()=>{
    const response=await fetch("https://ppabang.net/api/catalog/select",{
      method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({category:"ccm",limit:260,excludeIds:[]}),signal:AbortSignal.timeout(12000),
    });
    if(!response.ok)throw new Error("CCM unavailable");
    const body=await response.json() as {items?:unknown[]};
    const seen=new Set<string>();
    const items:Track[]=[];
    for(const value of body.items||[]) {
      if(!value||typeof value!=="object")continue;
      const item=value as Record<string,unknown>;
      if(typeof item.id!=="string"||! /^[\w-]{11}$/.test(item.id)||seen.has(item.id)||typeof item.title!=="string")continue;
      seen.add(item.id);
      items.push({id:item.id,title:item.title.slice(0,300),channel:typeof item.channel==="string"?item.channel.slice(0,150):"YouTube",duration:typeof item.duration==="number"&&Number.isFinite(item.duration)?Math.max(0,item.duration):0});
    }
    if(!items.length)throw new Error("CCM empty");
    cached={items,at:Date.now()};
    return items;
  })().finally(()=>{pending=undefined;});
  return pending;
}

export async function GET() {
  try{return Response.json({items:await catalog()},{headers:{"Cache-Control":"public, max-age=300, s-maxage=600"}});}
  catch {
    if(cached)return Response.json({items:cached.items},{headers:{"Cache-Control":"no-store"}});
    return Response.json({error:"찬양 목록을 불러오지 못했습니다. 다시 시도해 주세요."},{status:503,headers:{"Cache-Control":"no-store"}});
  }
}
