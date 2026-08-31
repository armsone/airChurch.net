import { hashReviewerPassword } from "../../admin-access";
import { clean, consumeSubmissionLimit, database, ensureReviewerTables, fingerprint, readLimitedJson, requestOriginIsInvalid } from "../_shared";

export async function POST(request:Request) {
  if(requestOriginIsInvalid(request))return Response.json({error:"요청을 확인할 수 없습니다."},{status:403});
  const body=await readLimitedJson(request);if(body.tooLarge)return Response.json({error:"요청 내용이 너무 큽니다."},{status:413});const data=body.data;
  if(clean(data.company,20))return Response.json({ok:true},{headers:{"cache-control":"no-store"}});
  const name=clean(data.name,80),contact=clean(data.contact,120),username=clean(data.username,40).toLowerCase();
  const password=typeof data.password==="string"?data.password:"";
  if(name.length<2||contact.length<5||!/^[a-z0-9._-]{4,40}$/.test(username)||password.length<10||password.length>128) return Response.json({error:"성함·연락처, 4자 이상의 영문 아이디와 10자 이상의 비밀번호를 확인해 주세요."},{status:400});
  const db=database();await ensureReviewerTables(db);
  const requestFingerprint=await fingerprint(request,"reviewer-signup");
  if(!await consumeSubmissionLimit(db,"reviewer-signup",requestFingerprint,3,24*60)) return Response.json({error:"가입 신청 횟수를 초과했습니다. 내일 다시 시도해 주세요."},{status:429,headers:{"cache-control":"no-store","retry-after":"86400"}});
  const existing=await db.prepare("SELECT id FROM reviewer_accounts WHERE username=? LIMIT 1").bind(username).first();
  if(existing) return Response.json({error:"이미 사용 중이거나 신청된 아이디입니다."},{status:409});
  const {hash,salt}=await hashReviewerPassword(password);
  await db.prepare("INSERT INTO reviewer_accounts (name,contact,username,password_hash,password_salt,status,fingerprint) VALUES (?,?,?,?,?,'pending',?)").bind(name,contact,username,hash,salt,"").run();
  return Response.json({ok:true},{status:201,headers:{"cache-control":"no-store"}});
}
