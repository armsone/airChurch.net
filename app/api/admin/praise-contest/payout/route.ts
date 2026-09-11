import { hasAdminAccess } from "../../../../admin-access";
import { database,readLimitedJson } from "../../../_shared";
import { CONTEST } from "../../../../praise-contest/config";
import { json,validMutation,maintainContest } from "../../../praise-contest/_server";
import { openPayout } from "../../../praise-contest/payout-private";
export async function POST(request:Request){
 if(!validMutation(request)||!await hasAdminAccess(request))return json({error:"관리자 로그인을 확인해 주세요."},403);
 try{await maintainContest();const body=await readLimitedJson(request,1024);if(body.tooLarge)return json({error:"요청을 확인해 주세요."},413);const id=Number(body.data.id);if(!Number.isSafeInteger(id)||id<1)return json({error:"참가 정보를 확인해 주세요."},400);
 const db=database();const row=await db.prepare("SELECT payout_ciphertext AS value,youtube_id AS youtubeId FROM praise_contest_entries WHERE id=? AND contest_id=?").bind(id,CONTEST.id).first<{value:string|null;youtubeId:string}>();
 if(!row?.value)return json({error:"보관 중인 지급 정보가 없습니다."},404);
 const details=await openPayout(row.value,`${CONTEST.id}|${row.youtubeId}`);
 await db.prepare("INSERT INTO praise_contest_audit(entry_id,action,detail,created_at) VALUES (?,'payout-view','Administrator viewed private payout details',strftime('%Y-%m-%dT%H:%M:%fZ','now'))").bind(id).run();
 return json({details});
 }catch{return json({error:"지급 정보를 열지 못했습니다. 관리자 설정을 확인해 주세요."},503);}
}
