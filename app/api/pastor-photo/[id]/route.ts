import {database,ensurePastorPeopleTables} from "../../_shared";

type PhotoRecord={photo_url:string};
const allowedTypes=new Set(["image/jpeg","image/png","image/webp","image/gif"]);

function safeRemoteImage(value:string){
  try{
    const url=new URL(value),host=url.hostname.toLowerCase();
    if(!["http:","https:"].includes(url.protocol)||host==="localhost"||host.endsWith(".local")||host.includes(":"))return null;
    const parts=host.split(".").map(Number);
    if(parts.length===4&&parts.every((part)=>Number.isInteger(part)&&part>=0&&part<=255)){
      const [a,b]=parts;if(a===0||a===10||a===127||a>=224||(a===100&&b>=64&&b<=127)||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&b===168))return null;
    }
    return url;
  }catch{return null;}
}

async function fetchImage(initial:URL){
  let url=initial;
  for(let redirect=0;redirect<4;redirect++){
    const response=await fetch(url,{redirect:"manual",signal:AbortSignal.timeout(10_000),headers:{"user-agent":"airChurch-public-directory/1.0 (+https://airchurch.net)",accept:"image/jpeg,image/png,image/webp,image/gif"}});
    if(response.status>=300&&response.status<400){const next=safeRemoteImage(new URL(response.headers.get("location")??"",url).href);if(!next)throw new Error("unsafe_redirect");url=next;continue;}
    if(!response.ok)throw new Error(`upstream_${response.status}`);
    const contentType=(response.headers.get("content-type")??"").split(";")[0].toLowerCase(),declared=Number(response.headers.get("content-length"));
    if(!allowedTypes.has(contentType)||Number.isFinite(declared)&&declared>4_000_000)throw new Error("unsupported_image");
    const bytes=await response.arrayBuffer();if(bytes.byteLength>4_000_000)throw new Error("image_too_large");
    return {bytes,contentType};
  }
  throw new Error("too_many_redirects");
}

export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
  const id=Number((await params).id);if(!Number.isInteger(id)||id<0)return new Response(null,{status:404});
  const db=database();await ensurePastorPeopleTables(db);
  const photo=await db.prepare("SELECT photo_url FROM pastor_people WHERE public_id=? AND review_status='approved' AND photo_review_status='approved' AND photo_usage_basis IN ('permission','open_license','owned','official_public_clergy_profile') LIMIT 1").bind(id).first<PhotoRecord>();
  const url=photo?.photo_url?safeRemoteImage(photo.photo_url):null;if(!url)return new Response(null,{status:404});
  try{const image=await fetchImage(url);return new Response(image.bytes,{headers:{"content-type":image.contentType,"cache-control":"public, max-age=86400, stale-while-revalidate=604800","x-content-type-options":"nosniff"}});}catch{return new Response(null,{status:502,headers:{"cache-control":"public, max-age=300"}});}
}
