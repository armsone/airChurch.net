import { hashReviewerPassword } from "../../admin-access";
import { clean, database, ensureReviewerTables, fingerprint } from "../_shared";

export async function POST(request:Request) {
  const origin=request.headers.get("origin");
  if(origin&&origin!==new URL(request.url).origin) return Response.json({error:"요청을 확인할 수 없습니다."},{status:403});
  const data=await request.json().catch(()=>({})) as Record<string,unknown>;
  const name=clean(data.name,80),contact=clean(data.contact,120),username=clean(data.username,40).toLowerCase();
  const password=typeof data.password==="string"?data.password:"";
  if(name.length<2||contact.length<5||!/^[a-z0-9._-]{4,40}$/.test(username)||password.length<8||password.length>100) return Response.json({error:"성함·연락처와 4자 이상의 영문 아이디, 8자 이상의 비밀번호를 확인해 주세요."},{status:400});
  const db=database();await ensureReviewerTables(db);
  const requestFingerprint=await fingerprint(request);
  const recent=await db.prepare("SELECT COUNT(*) AS count FROM reviewer_accounts WHERE fingerprint=? AND created_at>=datetime('now','-1 day')").bind(requestFingerprint).first<{count:number}>();
  if((recent?.count??0)>=3) return Response.json({error:"가입 신청 횟수를 초과했습니다. 내일 다시 시도해 주세요."},{status:429});
  const existing=await db.prepare("SELECT id FROM reviewer_accounts WHERE username=? LIMIT 1").bind(username).first();
  if(existing) return Response.json({error:"이미 사용 중이거나 신청된 아이디입니다."},{status:409});
  const {hash,salt}=await hashReviewerPassword(password);
  await db.prepare("INSERT INTO reviewer_accounts (name,contact,username,password_hash,password_salt,status,fingerprint) VALUES (?,?,?,?,?,'pending',?)").bind(name,contact,username,hash,salt,requestFingerprint).run();
  return Response.json({ok:true},{status:201,headers:{"cache-control":"no-store"}});
}
