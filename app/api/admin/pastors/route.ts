import {accessSession} from "../../../admin-access";
import {database,ensureAdminTables} from "../../_shared";
import {expandSearchTerm,sqlMetadataSearchValue,sqlRelevance,tokenizeSearchQuery} from "../../../search-domain";
import {safeHttpUrl} from "../../../safe-url";
import {sqlValidPastorName} from "../../../pastor-name";

type PastorRow={id:number;role_id:number|null;name:string;review_status:string;photo_url:string|null;photo_review_status:string;role_title:string|null;role_status:string|null;church_name:string|null;region:string|null;denomination:string|null;source_url:string|null};

export async function GET(request:Request){
  const session=await accessSession(request);
  if(session?.role!=="admin")return Response.json({error:"관리자 권한이 필요합니다."},{status:403,headers:{"cache-control":"no-store"}});
  const url=new URL(request.url),query=(url.searchParams.get("q")??"").trim().slice(0,100),groups=tokenizeSearchQuery(query).map(expandSearchTerm);
  if(query&&!groups.length)return Response.json({items:[],total:0,page:1,pageSize:24},{headers:{"cache-control":"no-store"}});
  const requestedPage=Number(url.searchParams.get("page")||1),page=Number.isInteger(requestedPage)?Math.min(200,Math.max(1,requestedPage)):1,pageSize=query?24:20,offset=(page-1)*pageSize;
  const db=database();await ensureAdminTables(db);
  const roleJoin="LEFT JOIN pastor_church_roles r ON r.id=(SELECT rr.id FROM pastor_church_roles rr WHERE rr.pastor_id=p.id ORDER BY CASE rr.role_status WHEN 'current' THEN 0 ELSE 1 END,rr.id DESC LIMIT 1)";
  const haystack=sqlMetadataSearchValue("p.name","coalesce(r.church_name,'')","coalesce(r.role_title,'')","coalesce(r.region,'')","coalesce(r.denomination,'')");
  const conditions=[sqlValidPastorName("p.name"),...groups.map((group)=>`(${group.map(()=>`instr(${haystack},?)>0`).join(" OR ")})`)],bindings=groups.flat(),where=`WHERE ${conditions.join(" AND ")}`;
  const relevance=sqlRelevance([["p.name",40],["coalesce(r.church_name,'')",25],["coalesce(r.role_title,'')",20],["coalesce(r.region,'')",12],["coalesce(r.denomination,'')",10]],groups);
  const order=query&&groups.length?`(${relevance.sql}) DESC,p.name`:`CASE p.review_status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END,RANDOM()`;
  const [rows,count]=await Promise.all([
    db.prepare(`SELECT p.id,r.id AS role_id,p.name,p.review_status,p.photo_url,p.photo_review_status,r.role_title,r.role_status,r.church_name,r.region,r.denomination,r.source_url FROM pastor_people p ${roleJoin} ${where} ORDER BY ${order} LIMIT ? OFFSET ?`).bind(...bindings,...(groups.length?relevance.bindings:[]),pageSize,offset).all<PastorRow>(),
    db.prepare(`SELECT COUNT(*) AS total FROM pastor_people p ${roleJoin} ${where}`).bind(...bindings).first<{total:number}>(),
  ]);
  return Response.json({items:rows.results.map((item)=>({...item,photo_url:safeHttpUrl(item.photo_url),source_url:safeHttpUrl(item.source_url)})),total:count?.total??0,page,pageSize},{headers:{"cache-control":"no-store"}});
}
