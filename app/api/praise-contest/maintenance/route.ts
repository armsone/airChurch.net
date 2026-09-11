import { internalTaskRequestAllowed } from "../../_shared";
import { json,maintainContest } from "../_server";
export async function POST(request:Request){
 if(!internalTaskRequestAllowed(request))return json({error:"권한이 필요합니다."},403);
 try{await maintainContest();return json({ok:true});}catch{return json({error:"대회 집계를 처리하지 못했습니다."},503);}
}
