import { hasAdminAccess } from "../../../../admin-access";
import { clean,database,readLimitedJson } from "../../../_shared";
import { CONTEST } from "../../../../praise-contest/config";
import { entriesWithRanks,json,maintainContest,resolvedContestPhase,validMutation } from "../../../praise-contest/_server";
export async function GET(request:Request){
 if(!await hasAdminAccess(request))return json({error:"관리자 로그인을 확인해 주세요."},403);
 try{await maintainContest();const phase=await resolvedContestPhase();const winners=phase==="finished"?(await entriesWithRanks(true)).filter(x=>x.prize>0):[];
 const payments=await database().prepare("SELECT p.entry_id AS entryId,p.rank,p.amount,p.attempt_id AS attemptId,p.status,p.reference,p.note,p.updated_at AS updatedAt,e.performer,e.title FROM praise_contest_payments p JOIN praise_contest_entries e ON e.id=p.entry_id WHERE p.contest_id=? ORDER BY p.rank").bind(CONTEST.id).all<{entryId:number;rank:number;amount:number;status:string;performer:string;title:string}>();
 const retained=payments.results.filter(p=>!winners.some(w=>w.id===p.entryId)).map(p=>({id:p.entryId,rank:p.rank,prize:p.amount,performer:p.performer,title:p.title}));
 return json({phase,winners:[...winners,...retained].sort((a,b)=>(a.rank??0)-(b.rank??0)),payments:payments.results});}catch{return json({error:"지급 기록을 불러오지 못했습니다."},503);}
}
export async function POST(request:Request){
 if(!validMutation(request)||!await hasAdminAccess(request))return json({error:"관리자 로그인을 확인해 주세요."},403);
 try{const body=await readLimitedJson(request,4096);if(body.tooLarge)return json({error:"요청을 확인해 주세요."},413);const d=body.data,id=Number(d.id),action=clean(d.action,20),note=clean(d.note,500),reference=clean(d.reference,100),attemptId=clean(d.attemptId,60);
 if(!Number.isSafeInteger(id)||id<1||!["reserve","paid","failed"].includes(action)||note.length<5)return json({error:"대상과 처리 사유를 확인해 주세요."},400);
 await maintainContest();if(await resolvedContestPhase()!=="finished")return json({error:"수상 확정 이후 지급을 기록할 수 있습니다."},409);
 const db=database();
 const currentWinner=(await entriesWithRanks(true)).find(x=>x.id===id&&x.prize>0);
 const existing=await db.prepare("SELECT rank,amount AS prize FROM praise_contest_payments WHERE contest_id=? AND entry_id=? AND status='processing'").bind(CONTEST.id,id).first<{rank:number;prize:number}>();
 const winner=action==="reserve"?currentWinner:existing;
 if(!winner||!winner.rank)return json({error:action==="reserve"?"현재 확정 수상자만 지급을 예약할 수 있습니다.":"처리 중인 지급 기록을 확인해 주세요."},409);
 let statement;
 if(action==="reserve"){
  const check=await db.prepare(`SELECT COUNT(*) AS mismatches FROM praise_contest_entries e WHERE e.contest_id=? AND
   (SELECT COUNT(*) FROM praise_contest_votes v WHERE v.contest_id=e.contest_id AND v.entry_id=e.id) <> COALESCE((SELECT SUM(delta) FROM praise_contest_vote_events x WHERE x.contest_id=e.contest_id AND x.entry_id=e.id),0)`).bind(CONTEST.id).first<{mismatches:number}>();
  if(!check||check.mismatches>0)return json({error:"집계와 투표 변경 기록을 먼저 대조해야 합니다. 지급 예약을 보류합니다."},409);
  if(d.recipientChecked!==true||d.accountChecked!==true||d.issuesChecked!==true)return json({error:"수상자·계좌·관련 문의 확인을 모두 완료해 주세요."},400);
  statement=db.prepare(`INSERT INTO praise_contest_payments(contest_id,entry_id,rank,amount,status,note,attempt_id,updated_at)
   SELECT ?,?,?,?,'processing',?,?,strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE EXISTS(SELECT 1 FROM praise_contest_entries WHERE id=? AND contest_id=? AND status='published' AND payout_ciphertext IS NOT NULL)
   ON CONFLICT(contest_id,entry_id) DO UPDATE SET status='processing',note=excluded.note,attempt_id=excluded.attempt_id,updated_at=excluded.updated_at WHERE praise_contest_payments.status='failed'`).bind(CONTEST.id,id,winner.rank,winner.prize,note,crypto.randomUUID(),id,CONTEST.id);
 }else{
  if(!attemptId)return json({error:"최신 지급 예약을 새로 확인해 주세요."},409);
  if(action==="paid"&&(!reference||d.bankConfirmed!==true))return json({error:"실제 이체 완료 확인과 거래번호가 필요합니다."},400);
  if(action==="failed"&&d.bankConfirmed!==true)return json({error:"은행에서 미입금을 확인한 경우에만 실패로 기록해 주세요. 결과가 불명확하면 처리 중으로 유지합니다."},400);
  statement=db.prepare("UPDATE praise_contest_payments SET status=?,reference=?,note=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE contest_id=? AND entry_id=? AND status='processing' AND attempt_id=?").bind(action,action==="paid"?reference:null,note,CONTEST.id,id,attemptId);
 }
 const results=await db.batch([statement,db.prepare("INSERT INTO praise_contest_audit(entry_id,action,detail,created_at) SELECT ?,?,?,strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE changes()>0").bind(id,`payment-${action}`,JSON.stringify({note,reference:action==="paid"?reference:null,amount:winner.prize}))]);
 if(!results[0].meta.changes)return json({error:"다른 처리자가 이미 변경했거나 지급이 완료되었습니다. 최신 기록을 확인해 주세요."},409);
 return json({ok:true,bankTransferExecuted:false});
 }catch(error){if(String(error).includes("UNIQUE constraint"))return json({error:"이미 사용한 거래번호 또는 수상 지급 기록입니다."},409);return json({error:"지급 기록을 저장하지 못했습니다. 다시 이체하지 말고 최신 기록과 은행 결과부터 확인해 주세요."},503);}
}
