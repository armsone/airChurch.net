import { database, ensureSermonTables } from "../_shared";
import { churchHomepageUrls } from "../../church-homepages";
import { churchImageUrls } from "../../church-images";

type ChurchRow={id:number;name:string;pastor:string;region:string;denomination:string;youtubeChannelId:string|null;channelImageUrl:string|null;homepageUrl:string|null;priorityWeight:number};
type CountRow={total:number};

export async function GET(request:Request) {
  const db=database();
  await ensureSermonTables(db);
  const url=new URL(request.url);
  const query=url.searchParams.get("q")?.trim().slice(0,100)??"";
  const globalQuery=url.searchParams.get("global")?.trim().toLowerCase().slice(0,100)??"";
  const region=url.searchParams.get("region")?.trim().slice(0,40)??"";
  const denomination=url.searchParams.get("denomination")?.trim().slice(0,80)??"";
  const terms=query.toLowerCase().split(/\s+/).filter(Boolean).slice(0,5);
  const searchParts=[...terms,...(globalQuery?[globalQuery]:[])];
  const haystack="lower(name || ' ' || pastor || ' ' || region || ' ' || denomination)";
  const conditions=["review_status='approved'",...searchParts.map(()=>`instr(${haystack}, ?) > 0`)];
  const bindings:Array<string>=[...searchParts];
  if(region&&region!=="전체") { conditions.push("substr(region,1,length(?))=?");bindings.push(region,region); }
  if(denomination&&denomination!=="전체 교단") { conditions.push("denomination=?");bindings.push(denomination); }
  const where=conditions.join(" AND ");
  const isSearch=Boolean(query);
  const limit=isSearch?200:1000;
  const selectSql=`SELECT id,name,pastor,region,denomination,youtube_channel_id AS youtubeChannelId,channel_image_url AS channelImageUrl,homepage_url AS homepageUrl,priority_weight AS priorityWeight FROM churches WHERE ${where} ORDER BY priority_weight DESC,name LIMIT ${limit}`;
  const result=await db.prepare(selectSql).bind(...bindings).all<ChurchRow>();
  const count=await db.prepare(`SELECT COUNT(*) AS total FROM churches WHERE ${where}`).bind(...bindings).first<CountRow>();
  const items=result.results.map((church)=>{
    const homepageUrl=churchHomepageUrls[church.name]||church.homepageUrl||null;
    const channelImageUrl=churchImageUrls[church.name]||church.channelImageUrl||null;
    return {...church,homepageUrl,channelImageUrl};
  });
  return Response.json({items,total:count?.total??items.length},{headers:{"cache-control":"public, max-age=300, s-maxage=300, stale-while-revalidate=1800"}});
}
