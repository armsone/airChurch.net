import { hasAdminAccess } from "../../../admin-access";
import { clean,database,readLimitedJson } from "../../_shared";
import { CONTEST,contestPhase,youtubeIdFromUrl } from "../../../praise-contest/config";
import { json,maintainContest,contestDecisionStatement,validMutation } from "../../praise-contest/_server";
export const dynamic="force-dynamic";
export async function GET(request:Request){
 if(!await hasAdminAccess(request))return json({error:"관리자 권한이 필요합니다."},403);
 try{await maintainContest();const rows=await database().prepare("SELECT id,performer,title,youtube_id AS youtubeId,channel_name AS channelName,contact,source_file_url AS sourceFileUrl,status,reupload_status AS reuploadStatus,reupload_url AS reuploadUrl,admin_note AS adminNote,consent_at AS consentAt,consent_version AS consentVersion,created_at AS createdAt FROM praise_contest_entries WHERE contest_id=? ORDER BY id ASC").bind(CONTEST.id).all();return json({items:rows.results,phase:contestPhase()});}
 catch{return json({error:"접수 목록을 불러오지 못했습니다."},503);}
}
export async function PATCH(request:Request){
 if(!validMutation(request)||!await hasAdminAccess(request))return json({error:"관리자 권한이 필요합니다."},403);
 const body=await readLimitedJson(request,4096);if(body.tooLarge)return json({error:"내용이 너무 깁니다."},413);
 const d=body.data,id=Number(d.id),status=clean(d.status,30),reuploadStatus=clean(d.reuploadStatus,30),note=clean(d.note,500),reuploadUrl=clean(d.reuploadUrl,500);
 if(!Number.isSafeInteger(id)||id<1||!["published","held"].includes(status)||!["not_requested","awaiting_source","rights_review","ready","uploaded"].includes(reuploadStatus))return json({error:"입력 값을 확인해 주세요."},400);
 const uploadedId=reuploadUrl?youtubeIdFromUrl(reuploadUrl):null;
 if((reuploadUrl&&!uploadedId)||(reuploadStatus==="uploaded"&&!uploadedId))return json({error:"게시 완료 상태에는 에이처치에 실제로 게시된 영상 링크가 필요합니다."},400);
 try{
  await maintainContest();
  const db=database();const before=await db.prepare("SELECT status,reupload_status AS reuploadStatus FROM praise_contest_entries WHERE id=? AND contest_id=?").bind(id,CONTEST.id).first<{status:string;reuploadStatus:string}>();if(!before)return json({error:"참가 영상을 찾을 수 없습니다."},404);
  if(before.reuploadStatus==="not_requested"&&reuploadStatus!=="not_requested"&&(d.reuploadAgreed!==true||!note))return json({error:"참가자와 별도로 재업로드에 합의한 내용을 처리 사유에 남기고 확인해 주세요."},400);
  if(status!==before.status&&!note)return json({error:"공개·보류 변경 사유를 적어 주세요."},409);
  if(["ready","uploaded"].includes(reuploadStatus)&&d.rightsReviewed!==true)return json({error:"원본과 곡·반주·출연자 게시 권리 확인을 체크해 주세요."},400);
  const results=await db.batch([
   contestDecisionStatement(),
   db.prepare(`UPDATE praise_contest_entries SET status=?,reupload_status=?,reupload_url=?,admin_note=? WHERE id=? AND contest_id=? AND (strftime('%Y-%m-%dT%H:%M:%fZ','now')<? OR EXISTS (SELECT 1 FROM praise_contest_results WHERE contest_id=?))`).bind(status,reuploadStatus,uploadedId?`https://www.youtube.com/watch?v=${uploadedId}`:null,note,id,CONTEST.id,CONTEST.resultsAt,CONTEST.id),
   db.prepare("INSERT INTO praise_contest_audit(entry_id,action,detail,created_at) SELECT ?,'admin-update',?,strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE changes()>0").bind(id,JSON.stringify({status,reuploadStatus,note,rightsReviewed:d.rightsReviewed===true})),
  ]);
  if(!results[1].meta.changes)return json({error:"집계가 마감되어 상태를 변경하지 못했습니다."},409);
  return json({ok:true});
 }catch{return json({error:"변경 내용을 저장하지 못했습니다."},503);}
}
