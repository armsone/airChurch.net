import {accessSession} from "../../../admin-access";
import {database,ensureAdminTables} from "../../_shared";
import {expandSearchTerm,sqlMetadataSearchValue,sqlRelevance,tokenizeSearchQuery} from "../../../search-domain";
import {safeHttpUrl} from "../../../safe-url";
import {sqlValidPastorName} from "../../../pastor-name";

type PastorRow={id:number;public_id:number;role_id:number|null;church_id:number|null;name:string;review_status:string;photo_url:string|null;photo_review_status:string;role_title:string|null;role_status:string|null;church_name:string|null;region:string|null;denomination:string|null;source_url:string|null};

export async function GET(request:Request){
  const session=await accessSession(request);
  if(session?.role!=="admin")return Response.json({error:"관리자 권한이 필요합니다."},{status:403,headers:{"cache-control":"no-store"}});
  const url=new URL(request.url),query=(url.searchParams.get("q")??"").trim().slice(0,100),groups=tokenizeSearchQuery(query).map(expandSearchTerm);
  if(query&&!groups.length)return Response.json({items:[],total:0,page:1,pageSize:24},{headers:{"cache-control":"no-store"}});
  const requestedPage=Number(url.searchParams.get("page")||1),page=Number.isInteger(requestedPage)?Math.min(200,Math.max(1,requestedPage)):1,pageSize=24,offset=(page-1)*pageSize,bucket=Math.min(49,Math.max(0,Number(url.searchParams.get("bucket")??Math.floor(Math.random()*50))||0));
  const db=database();await ensureAdminTables(db);
  const roleJoin="LEFT JOIN pastor_church_roles r ON r.id=(SELECT rr.id FROM pastor_church_roles rr WHERE rr.pastor_id=p.id ORDER BY CASE rr.role_status WHEN 'current' THEN 0 ELSE 1 END,rr.id DESC LIMIT 1)";
  const haystack=sqlMetadataSearchValue("p.name","coalesce(r.church_name,'')","coalesce(r.role_title,'')","coalesce(r.region,'')","coalesce(r.denomination,'')");
  const conditions=[sqlValidPastorName("p.name"),...groups.map((group)=>`(${group.map(()=>`instr(${haystack},?)>0`).join(" OR ")})`)],bindings=groups.flat(),where=`WHERE ${conditions.join(" AND ")}`;
  const relevance=sqlRelevance([["p.name",40],["coalesce(r.church_name,'')",25],["coalesce(r.role_title,'')",20],["coalesce(r.region,'')",12],["coalesce(r.denomination,'')",10]],groups);
  if(!query){
    const [rows,count]=await Promise.all([
      db.prepare(`SELECT p.id,COALESCE(p.public_id,1000000+p.id) AS public_id,r.id AS role_id,r.church_id,p.name,p.review_status,p.photo_url,p.photo_review_status,r.role_title,r.role_status,r.church_name,r.region,r.denomination,r.source_url FROM pastor_admin_buckets b JOIN pastor_people p ON p.id=b.pastor_id ${roleJoin} WHERE b.bucket_index=? ORDER BY b.position`).bind(bucket).all<PastorRow>(),
      db.prepare(`SELECT COUNT(*) AS total FROM pastor_people p WHERE ${sqlValidPastorName("p.name")}`).first<{total:number}>(),
    ]);
    return Response.json({items:rows.results.map((item)=>({...item,photo_url:safeHttpUrl(item.photo_url),source_url:safeHttpUrl(item.source_url)})),total:count?.total??0,page:1,pageSize,bucket},{headers:{"cache-control":"no-store"}});
  }
  const order=`(${relevance.sql}) DESC,p.name`;
  const [rows,count]=await Promise.all([
    db.prepare(`SELECT p.id,COALESCE(p.public_id,1000000+p.id) AS public_id,r.id AS role_id,r.church_id,p.name,p.review_status,p.photo_url,p.photo_review_status,r.role_title,r.role_status,r.church_name,r.region,r.denomination,r.source_url FROM pastor_people p ${roleJoin} ${where} ORDER BY ${order} LIMIT ? OFFSET ?`).bind(...bindings,...(groups.length?relevance.bindings:[]),pageSize,offset).all<PastorRow>(),
    db.prepare(`SELECT COUNT(*) AS total FROM pastor_people p ${roleJoin} ${where}`).bind(...bindings).first<{total:number}>(),
  ]);
  return Response.json({items:rows.results.map((item)=>({...item,photo_url:safeHttpUrl(item.photo_url),source_url:safeHttpUrl(item.source_url)})),total:count?.total??0,page,pageSize},{headers:{"cache-control":"no-store"}});
}
