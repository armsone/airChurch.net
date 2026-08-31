import { accessSession } from "../../../admin-access";
import { database, ensureSermonTables } from "../../_shared";
import { expandSearchTerm, sqlMetadataSearchValue, sqlRelevance, tokenizeSearchQuery } from "../../../search-domain";
import { safeHttpUrl } from "../../../safe-url";

type ChurchRow={id:number;name:string;pastor:string;region:string;denomination:string;review_status:string;hold_reason:string|null;hold_note:string|null;held_at:string|null;priority_weight:number;homepage_url:string|null;youtube_channel_id:string|null;channel_image_url:string|null};

export async function GET(request:Request){
  const session=await accessSession(request);
  if(session?.role!=="admin")return Response.json({error:"관리자 권한이 필요합니다."},{status:403,headers:{"cache-control":"no-store"}});
  const url=new URL(request.url),status=url.searchParams.get("status")==="removed"?"removed":"approved";
  const query=(url.searchParams.get("q")??"").trim().slice(0,100),groups=tokenizeSearchQuery(query).map(expandSearchTerm);
  if(query&&!groups.length)return Response.json({items:[],total:0,page:1,pageSize:24},{headers:{"cache-control":"no-store"}});
  const requestedPage=Number(url.searchParams.get("page")||1),page=Number.isInteger(requestedPage)?Math.min(100,Math.max(1,requestedPage)):1;
  const pageSize=query?24:status==="removed"?10:20,offset=(page-1)*pageSize;
  const db=database();await ensureSermonTables(db);
  const haystack=sqlMetadataSearchValue("name","pastor","region","denomination",status==="removed"?"coalesce(hold_reason,'')||coalesce(hold_note,'')":"''");
  const conditions=["review_status=?",...groups.map((group)=>`(${group.map(()=>`instr(${haystack},?)>0`).join(" OR ")})`)];
  const bindings:Array<string|number>=[status,...groups.flat()];
  const where=conditions.join(" AND "),relevance=sqlRelevance([["name",40],["pastor",25],["region",15],["denomination",12]],groups);
  const order=query&&groups.length?`(${relevance.sql}) DESC,name`:"RANDOM()";
  const [rows,count]=await Promise.all([
    db.prepare(`SELECT id,name,pastor,region,denomination,review_status,hold_reason,hold_note,held_at,priority_weight,homepage_url,youtube_channel_id,channel_image_url FROM churches WHERE ${where} ORDER BY ${order} LIMIT ? OFFSET ?`).bind(...bindings,...(groups.length?relevance.bindings:[]),pageSize,offset).all<ChurchRow>(),
    db.prepare(`SELECT COUNT(*) AS total FROM churches WHERE ${where}`).bind(...bindings).first<{total:number}>(),
  ]);
  return Response.json({items:rows.results.map((church)=>({...church,homepage_url:safeHttpUrl(church.homepage_url),channel_image_url:safeHttpUrl(church.channel_image_url)})),total:count?.total??0,page,pageSize},{headers:{"cache-control":"no-store"}});
}
