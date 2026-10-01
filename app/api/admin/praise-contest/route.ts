import { hasAdminAccess } from "../../../admin-access";
import { clean,database,readLimitedJson } from "../../_shared";
import { CONTEST,contestPhase,youtubeIdFromUrl } from "../../../praise-contest/config";
import { json,maintainContest,contestDecisionStatement,validMutation } from "../../praise-contest/_server";
export const dynamic="force-dynamic";
export async function GET(request:Request){
 if(!await hasAdminAccess(request))return json({error:"관리자 권한이 필요합니다."},403);
 const params=new URL(request.url).searchParams,q=(params.get("q")??"").trim(),status=params.get("status")??"all",sort=params.get("sort")??"newest",pageInput=params.get("page")??"1";
 const orders:Record<string,string>={newest:"created_at DESC,id DESC",oldest:"created_at ASC,id ASC",name:"performer COLLATE NOCASE ASC,id ASC"};
 if(q.length>80||!["all","published","held"].includes(status)||!Object.hasOwn(orders,sort)||!/^\d+$/.test(pageInput)||!Number.isSafeInteger(Number(pageInput))||Number(pageInput)<1)return json({error:"검색 조건을 확인해 주세요."},400);
 try{
  await maintainContest();const db=database();
  const summary=await db.prepare("SELECT COUNT(*) AS total,SUM(CASE WHEN status='published' THEN 1 ELSE 0 END) AS published,SUM(CASE WHEN status='held' THEN 1 ELSE 0 END) AS held FROM praise_contest_entries WHERE contest_id=?").bind(CONTEST.id).first<{total:number;published:number;held:number}>();
  const counts={total:Number(summary?.total??0),published:Number(summary?.published??0),held:Number(summary?.held??0)};
  const clauses=["contest_id=?"],values:(string|number)[]=[CONTEST.id];
  if(status!=="all"){clauses.push("status=?");values.push(status);}
  if(q){const pattern=`%${q.replace(/[\\%_]/g,"\\$&")}%`,id=/^\d+$/.test(q)&&Number.isSafeInteger(Number(q))?Number(q):0;clauses.push("(performer LIKE ? ESCAPE '\\' OR title LIKE ? ESCAPE '\\' OR id=?)");values.push(pattern,pattern,id);}
  const where=clauses.join(" AND ");
  const matching=q||status!=="all"?await db.prepare(`SELECT COUNT(*) AS total FROM praise_contest_entries WHERE ${where}`).bind(...values).first<{total:number}>():counts;
  const total=Number(matching?.total??0),pageSize=20,totalPages=Math.max(1,Math.ceil(total/pageSize)),page=Math.min(Number(pageInput),totalPages);
  const rows=await db.prepare(`SELECT id,performer,title,youtube_id AS youtubeId,channel_name AS channelName,contact,source_file_url AS sourceFileUrl,status,reupload_status AS reuploadStatus,reupload_url AS reuploadUrl,admin_note AS adminNote,consent_at AS consentAt,consent_version AS consentVersion,created_at AS createdAt FROM praise_contest_entries WHERE ${where} ORDER BY ${orders[sort]} LIMIT ? OFFSET ?`).bind(...values,pageSize,(page-1)*pageSize).all();
  return json({items:rows.results,phase:contestPhase(),counts,pagination:{page,pageSize,total,totalPages}});
 }catch{return json({error:"접수 목록을 불러오지 못했습니다."},503);}
}
export async function PATCH(request:Request){
 if(!validMutation(request)||!await hasAdminAccess(request))return json({error:"관리자 권한이 필요합니다."},403);
 const body=await readLimitedJson(request,4096);if(body.tooLarge)return json({error:"내용이 너무 깁니다."},413);
 const d=body.data,id=d.id,hiding=d.action==="hide",note=clean(d.note,500);
 if(typeof id!=="number"||!Number.isSafeInteger(id)||id<1||(d.action!==undefined&&!hiding))return json({error:"입력 값을 확인해 주세요."},400);
 const status=hiding?"held":clean(d.status,30),requestedReuploadStatus=clean(d.reuploadStatus,30),reuploadUrl=clean(d.reuploadUrl,500);
 if(!hiding&&(!["published","held"].includes(status)||!["not_requested","awaiting_source","rights_review","ready","uploaded"].includes(requestedReuploadStatus)))return json({error:"입력 값을 확인해 주세요."},400);
 const uploadedId=reuploadUrl?youtubeIdFromUrl(reuploadUrl):null;
 if(!hiding&&((reuploadUrl&&!uploadedId)||(requestedReuploadStatus==="uploaded"&&!uploadedId)))return json({error:"게시 완료 상태에는 에이처치에 실제로 게시된 영상 링크가 필요합니다."},400);
 try{
  await maintainContest();
  const db=database();const before=await db.prepare("SELECT performer,title,status,reupload_status AS reuploadStatus,reupload_url AS reuploadUrl FROM praise_contest_entries WHERE id=? AND contest_id=?").bind(id,CONTEST.id).first<{performer:string;title:string;status:string;reuploadStatus:string;reuploadUrl:string|null}>();if(!before)return json({error:"참가 영상을 찾을 수 없습니다."},404);
  const performer=hiding||d.performer===undefined?before.performer:clean(d.performer,60),title=hiding||d.title===undefined?before.title:clean(d.title,120);
  if(performer.length<2||title.length<2)return json({error:"참가자명과 곡명을 두 글자 이상 입력해 주세요."},400);
  if(contestPhase()==="finished"&&(performer!==before.performer||title!==before.title))return json({error:"수상 결과 확정 후에는 참가자명과 곡명을 변경할 수 없습니다."},409);
  // Hiding preserves the entry, votes, encrypted contact and upload-review state.
  const reuploadStatus=hiding?before.reuploadStatus:requestedReuploadStatus,finalReuploadUrl=hiding?before.reuploadUrl:uploadedId?`https://www.youtube.com/watch?v=${uploadedId}`:null;
  if(!hiding&&before.reuploadStatus==="not_requested"&&reuploadStatus!=="not_requested"&&(d.reuploadAgreed!==true||!note))return json({error:"참가자와 별도로 재업로드에 합의한 내용을 처리 사유에 남기고 확인해 주세요."},400);
  if((status!==before.status||performer!==before.performer||title!==before.title)&&!note)return json({error:"내용 수정이나 공개·삭제 변경 사유를 적어 주세요."},409);
  if(!hiding&&["ready","uploaded"].includes(reuploadStatus)&&d.rightsReviewed!==true)return json({error:"원본과 곡·반주·출연자 게시 권리 확인을 체크해 주세요."},400);
  const results=await db.batch([
   contestDecisionStatement(),
   db.prepare(`UPDATE praise_contest_entries SET performer=?,title=?,status=?,reupload_status=?,reupload_url=?,admin_note=? WHERE id=? AND contest_id=? AND (strftime('%Y-%m-%dT%H:%M:%fZ','now')<? OR EXISTS (SELECT 1 FROM praise_contest_results WHERE contest_id=?))`).bind(performer,title,status,reuploadStatus,finalReuploadUrl,note,id,CONTEST.id,CONTEST.resultsAt,CONTEST.id),
   db.prepare("INSERT INTO praise_contest_audit(entry_id,action,detail,created_at) SELECT ?,'admin-update',?,strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE changes()>0").bind(id,JSON.stringify({status,reuploadStatus,note,rightsReviewed:d.rightsReviewed===true,fieldsChanged:[...(performer!==before.performer?["performer"]:[]),...(title!==before.title?["title"]:[]),...(status!==before.status?["status"]:[])]})),
  ]);
  if(!results[1].meta.changes)return json({error:"집계가 마감되어 상태를 변경하지 못했습니다."},409);
  return json({ok:true});
 }catch{return json({error:"변경 내용을 저장하지 못했습니다."},503);}
}
