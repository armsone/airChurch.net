import { database, ensureSermonTables } from "../_shared";
import { churchHomepageUrls } from "../../church-homepages";
import { churchImageUrls } from "../../church-images";
import { expandSearchTerm as expand, normalizeSearchValue as normalize, sqlMetadataSearchValue } from "../../search-domain";
import { safeHttpUrl } from "../../safe-url";

type ChurchRow={id:number;name:string;pastor:string;region:string;denomination:string;youtubeChannelId:string|null;channelImageUrl:string|null;homepageUrl:string|null;priorityWeight:number};
type CountRow={total:number};

export async function GET(request:Request) {
  const url=new URL(request.url);
  const query=url.searchParams.get("q")?.trim().slice(0,100)??"";
  const globalQuery=url.searchParams.get("global")?.trim().toLowerCase().slice(0,100)??"";
  const region=url.searchParams.get("region")?.trim().slice(0,40)??"";
  const denomination=url.searchParams.get("denomination")?.trim().slice(0,80)??"";
  const terms=query.toLowerCase().split(/\s+/).map(normalize).filter(Boolean).slice(0,5);
  const globalTerms=globalQuery.split(/\s+/).map(normalize).filter(Boolean).slice(0,5);
  const searchGroups=[...terms,...globalTerms].map(expand);
  const responseHeaders={"cache-control":"public, max-age=300, s-maxage=300, stale-while-revalidate=1800"};
  if((query||globalQuery)&&!searchGroups.length)return Response.json({items:[],total:0},{headers:responseHeaders});
  const db=database();
  await ensureSermonTables(db);
  const haystack=sqlMetadataSearchValue("name","pastor","region","denomination");
  const conditions=["review_status='approved'",...searchGroups.map((group)=>`(${group.map(()=>`instr(${haystack}, ?) > 0`).join(" OR ")})`)];
  const bindings:Array<string>=searchGroups.flat();
  if(region&&region!=="전체") { conditions.push("substr(region,1,length(?))=?");bindings.push(region,region); }
  if(denomination&&denomination!=="전체 교단") { conditions.push("denomination=?");bindings.push(denomination); }
  const where=conditions.join(" AND ");
  if(url.searchParams.get("countOnly")==="1") {
    const count=await db.prepare(`SELECT COUNT(*) AS total FROM churches WHERE ${where}`).bind(...bindings).first<CountRow>();
    return Response.json({total:count?.total??0},{headers:responseHeaders});
  }
  const isSearch=Boolean(query||globalQuery||region&&region!=="전체"||denomination&&denomination!=="전체 교단");
  const limit=isSearch?200:36;
  const order=isSearch?"priority_weight DESC,name":`CASE WHEN priority_weight>1 THEN 0 ELSE 1 END,CASE WHEN priority_weight>1 THEN priority_weight END DESC,RANDOM()`;
  const selectSql=`SELECT id,name,pastor,region,denomination,youtube_channel_id AS youtubeChannelId,channel_image_url AS channelImageUrl,homepage_url AS homepageUrl,priority_weight AS priorityWeight FROM churches WHERE ${where} ORDER BY ${order} LIMIT ${limit}`;
  const result=await db.prepare(selectSql).bind(...bindings).all<ChurchRow>();
  const count=await db.prepare(`SELECT COUNT(*) AS total FROM churches WHERE ${where}`).bind(...bindings).first<CountRow>();
  const items=result.results.map((church)=>{
    const homepageUrl=safeHttpUrl(churchHomepageUrls[church.name]||church.homepageUrl);
    const channelImageUrl=safeHttpUrl(churchImageUrls[church.name]||church.channelImageUrl);
    return {...church,homepageUrl,channelImageUrl};
  });
  return Response.json({items,total:count?.total??items.length},{headers:responseHeaders});
}
