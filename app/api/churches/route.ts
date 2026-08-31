import { database, ensureSermonTables } from "../_shared";
import { churchHomepageUrls } from "../../church-homepages";
import { churchImageUrls } from "../../church-images";

type ChurchRow={id:number;name:string;pastor:string;region:string;denomination:string;youtubeChannelId:string|null;channelImageUrl:string|null;homepageUrl:string|null;priorityWeight:number};
type CountRow={total:number};
const denominationAliases:Record<string,string[]>={감리:["감리","기감","기독교대한감리회"],감리교:["감리","기감","기독교대한감리회"],기감:["감리","기감","기독교대한감리회"],통합:["통합","대한예수교장로회통합"],예장통합:["통합","대한예수교장로회통합"],합동:["합동","대한예수교장로회합동"],예장합동:["합동","대한예수교장로회합동"],고신:["고신","대한예수교장로회고신"],침례:["침례","기독교한국침례회"],침례교:["침례","기독교한국침례회"],성결:["성결","기독교대한성결교회"],성결교:["성결","기독교대한성결교회"],합신:["합신","대한예수교장로회합신"],백석:["백석","대한예수교장로회백석"],순복음:["순복음","기독교대한하나님의성회"],기하성:["순복음","기독교대한하나님의성회"],기장:["한국기독교장로회"],독립:["독립교회","한국독립교회선교단체연합회"]};
const normalize=(value:string)=>value.toLowerCase().replace(/\s/g,"").replace(/목사(?:님)?$/,""),expand=(term:string)=>denominationAliases[normalize(term)]??[normalize(term)];

export async function GET(request:Request) {
  const db=database();
  await ensureSermonTables(db);
  const url=new URL(request.url);
  const query=url.searchParams.get("q")?.trim().slice(0,100)??"";
  const globalQuery=url.searchParams.get("global")?.trim().toLowerCase().slice(0,100)??"";
  const region=url.searchParams.get("region")?.trim().slice(0,40)??"";
  const denomination=url.searchParams.get("denomination")?.trim().slice(0,80)??"";
  const terms=query.toLowerCase().split(/\s+/).map(normalize).filter(Boolean).slice(0,5);
  const globalTerms=globalQuery.split(/\s+/).map(normalize).filter(Boolean).slice(0,5);
  const searchGroups=[...terms,...globalTerms].map(expand);
  const haystack="replace(lower(name || pastor || region || denomination), ' ', '')";
  const conditions=["review_status='approved'",...searchGroups.map((group)=>`(${group.map(()=>`instr(${haystack}, ?) > 0`).join(" OR ")})`)];
  const bindings:Array<string>=searchGroups.flat();
  if(region&&region!=="전체") { conditions.push("substr(region,1,length(?))=?");bindings.push(region,region); }
  if(denomination&&denomination!=="전체 교단") { conditions.push("denomination=?");bindings.push(denomination); }
  const where=conditions.join(" AND ");
  if(url.searchParams.get("countOnly")==="1") {
    const count=await db.prepare(`SELECT COUNT(*) AS total FROM churches WHERE ${where}`).bind(...bindings).first<CountRow>();
    return Response.json({total:count?.total??0},{headers:{"cache-control":"public, max-age=300, s-maxage=300, stale-while-revalidate=1800"}});
  }
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
