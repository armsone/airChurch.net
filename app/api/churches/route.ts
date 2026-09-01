import { database, ensureSermonTables, maybeRunDataRetention } from "../_shared";
import { churchHomepageUrls } from "../../church-homepages";
import { churchImageUrls } from "../../church-images";
import { expandSearchTerm as expand, sqlMetadataSearchValue, sqlRelevance, tokenizeSearchQuery } from "../../search-domain";
import { safeHttpUrl } from "../../safe-url";

type ChurchRow={id:number;name:string;pastor:string;region:string;denomination:string;youtubeChannelId:string|null;channelImageUrl:string|null;homepageUrl:string|null;priorityWeight:number};
type CountRow={total:number};

export async function GET(request:Request) {
  const url=new URL(request.url);
  const query=url.searchParams.get("q")?.trim().slice(0,100)??"";
  const globalQuery=url.searchParams.get("global")?.trim().toLowerCase().slice(0,100)??"";
  const region=url.searchParams.get("region")?.trim().slice(0,40)??"";
  const denomination=url.searchParams.get("denomination")?.trim().slice(0,80)??"";
  const terms=tokenizeSearchQuery(query),globalTerms=tokenizeSearchQuery(globalQuery);
  const searchGroups=[...terms,...globalTerms].map(expand);
  const responseHeaders={"cache-control":url.searchParams.has("adminFresh")?"private, no-store":"public, max-age=300, s-maxage=300, stale-while-revalidate=1800"};
  const db=database();
  await ensureSermonTables(db);
  await maybeRunDataRetention(db);
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
  const relevance=sqlRelevance([["name",40],["pastor",25],["region",15],["denomination",12]],searchGroups);
  const order=isSearch&&searchGroups.length?`(${relevance.sql}) DESC,priority_weight DESC,name`:isSearch?"priority_weight DESC,name":`CASE WHEN priority_weight>1 THEN 0 ELSE 1 END,CASE WHEN priority_weight>1 THEN priority_weight END DESC,RANDOM()`;
  const selectSql=`SELECT id,name,pastor,region,denomination,youtube_channel_id AS youtubeChannelId,channel_image_url AS channelImageUrl,homepage_url AS homepageUrl,priority_weight AS priorityWeight FROM churches WHERE ${where} ORDER BY ${order} LIMIT ${limit}`;
  const result=await db.prepare(selectSql).bind(...bindings,...(searchGroups.length?relevance.bindings:[])).all<ChurchRow>();
  const count=result.results.length<limit?{total:result.results.length}:await db.prepare(`SELECT COUNT(*) AS total FROM churches WHERE ${where}`).bind(...bindings).first<CountRow>();
  const items=result.results.map((church)=>{
    const homepageUrl=safeHttpUrl(churchHomepageUrls[church.name]||church.homepageUrl);
    const channelImageUrl=safeHttpUrl(churchImageUrls[church.name]||church.channelImageUrl);
    return {...church,homepageUrl,channelImageUrl};
  });
  return Response.json({items,total:count?.total??items.length},{headers:responseHeaders});
}
