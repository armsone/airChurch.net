import { clean, consumeSubmissionLimit, database, fingerprint, readLimitedJson } from "../_shared";
import { CONTEST, contestPhase, youtubeIdFromUrl } from "../../praise-contest/config";
import { browser, entriesWithRanks, json, maintainContest, validMutation } from "./_server";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    await maintainContest();
    const phase=contestPhase(), identity=await browser(request,phase==="open"||phase==="voting");
    const [items,vote]=await Promise.all([entriesWithRanks(phase==="finished"),identity?database().prepare("SELECT entry_id AS entryId FROM praise_contest_votes WHERE contest_id=? AND browser_hash=? AND vote_day=date('now','+9 hours')").bind(CONTEST.id,identity.hash).first<{entryId:number}>():null]);
    return json({items,phase,serverNow:new Date().toISOString(),votedEntryId:vote?.entryId??null,finalized:phase==="finished"},200,identity?.cookie);
  } catch { return json({error:"대회 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."},503); }
}
export async function POST(request: Request) {
  if(!validMutation(request))return json({error:"같은 사이트에서 다시 접수해 주세요."},403);
  if(contestPhase()!=="open")return json({error:"영상 접수는 10월 1일부터 15일까지입니다."},409);
  try {
    const identity=await browser(request);
    if(!identity)return json({error:"쿠키를 허용한 뒤 페이지를 새로 열어 주세요."},403);
    const body=await readLimitedJson(request,8192);if(body.tooLarge)return json({error:"입력 내용이 너무 깁니다."},413);
    const d=body.data,performer=clean(d.performer,60),title=clean(d.title,120),contact=clean(d.contact,160),videoId=youtubeIdFromUrl(clean(d.youtubeUrl,500));
    if(!videoId||performer.length<2||title.length<2||!/^\S+@\S+\.\S+$/.test(contact))return json({error:"참가자명·곡명·유튜브 링크·연락 이메일을 확인해 주세요."},400);
    if(d.rightsConsent!==true||d.reuploadConsent!==true||d.privacyConsent!==true||d.ageConsent!==true)return json({error:"참가 및 재업로드 동의 항목을 모두 확인해 주세요."},400);
    const source=clean(d.sourceFileUrl,1000);let sourceFileUrl:string|null=null;
    if(source){try{const url=new URL(source);if(url.protocol!=="https:"||url.username||url.password)throw new Error();sourceFileUrl=url.href;}catch{return json({error:"원본 파일은 https 공유 링크로 입력해 주세요."},400);}}
    const db=database();
    if(!await consumeSubmissionLimit(db,"contest-submit",await fingerprint(request,"contest-submit"),5,60))return json({error:"접수가 많습니다. 한 시간 뒤 다시 시도해 주세요."},429);
    if(await db.prepare("SELECT id FROM praise_contest_entries WHERE contest_id=? AND youtube_id=?").bind(CONTEST.id,videoId).first())return json({error:"이미 등록된 영상입니다."},409);
    const response=await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}&format=json`,{signal:AbortSignal.timeout(8000),redirect:"error"});
    if(!response.ok)return json({error:"공개 재생 가능한 유튜브 영상을 확인해 주세요."},400);
    const metadata=await response.json() as {author_name?:string};
    const inserted=await db.prepare(`INSERT INTO praise_contest_entries(contest_id,youtube_id,performer,title,channel_name,contact,source_file_url,browser_hash,consent_version,consent_at,status,reupload_status,created_at)
      SELECT ?,?,?,?,?,?,?,?,?,strftime('%Y-%m-%dT%H:%M:%fZ','now'),'published',?,strftime('%Y-%m-%dT%H:%M:%fZ','now')
      WHERE strftime('%Y-%m-%dT%H:%M:%fZ','now')>=? AND strftime('%Y-%m-%dT%H:%M:%fZ','now')<?`).bind(CONTEST.id,videoId,performer,title,clean(metadata.author_name,120),contact,sourceFileUrl,identity.hash,CONTEST.consentVersion,sourceFileUrl?"rights_review":"awaiting_source",CONTEST.startsAt,CONTEST.submissionEndsAt).run();
    if(!inserted.meta.changes)return json({error:"영상 접수가 마감되었습니다."},409);
    return json({ok:true,id:Number(inserted.meta.last_row_id)},201);
  }catch(error){if(String(error).includes("UNIQUE constraint"))return json({error:"이미 등록된 영상입니다."},409);return json({error:"접수를 완료하지 못했습니다. 잠시 후 다시 시도해 주세요."},503);}
}
