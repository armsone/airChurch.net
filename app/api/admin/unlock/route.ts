import { adminCookie, createAccessToken, verifyCredentials } from "../../../admin-access";
import { database, ensureAccessTables, fingerprint, readLimitedJson, requestOriginIsInvalid } from "../../_shared";

export async function POST(request: Request) {
  if(requestOriginIsInvalid(request)) return Response.json({ error: "요청을 확인할 수 없습니다." }, { status: 403,headers:{"cache-control":"no-store"} });
  const body=await readLimitedJson(request);if(body.tooLarge)return Response.json({error:"요청 내용이 너무 큽니다."},{status:413,headers:{"cache-control":"no-store"}});const data=body.data;
  if (typeof data.username !== "string" || typeof data.password !== "string") {
    return Response.json({ error: "아이디 또는 비밀번호가 맞지 않습니다." }, { status: 403, headers: { "cache-control": "no-store" } });
  }
  const db=database();await ensureAccessTables(db);const fp=await fingerprint(request,"admin-login");
  const attempts=await db.prepare("SELECT attempt_count AS attemptCount,window_started AS windowStarted FROM admin_login_attempts WHERE fingerprint=?").bind(fp).first<{attemptCount:number;windowStarted:string}>();
  if(attempts&&Date.now()-Date.parse(`${attempts.windowStarted}Z`)<15*60*1000&&attempts.attemptCount>=10){const retryAfter=Math.max(1,Math.ceil((15*60*1000-(Date.now()-Date.parse(`${attempts.windowStarted}Z`)))/1000));return Response.json({error:"로그인 시도가 너무 많습니다. 15분 후 다시 시도해 주세요."},{status:429,headers:{"cache-control":"no-store","retry-after":String(retryAfter)}});}
  const session=await verifyCredentials(data.username,data.password);
  if(!session) {await db.prepare("INSERT INTO admin_login_attempts (fingerprint,attempt_count,window_started) VALUES (?,1,CURRENT_TIMESTAMP) ON CONFLICT(fingerprint) DO UPDATE SET attempt_count=CASE WHEN window_started<datetime('now','-15 minutes') THEN 1 ELSE attempt_count+1 END,window_started=CASE WHEN window_started<datetime('now','-15 minutes') THEN CURRENT_TIMESTAMP ELSE window_started END").bind(fp).run();return Response.json({ error: "아이디 또는 비밀번호가 맞지 않습니다." }, { status: 403, headers: { "cache-control": "no-store" } });}
  await db.prepare("DELETE FROM admin_login_attempts WHERE fingerprint=?").bind(fp).run();
  const token = await createAccessToken(session);
  return Response.json({ ok: true,role:session.role }, { headers: { "cache-control": "no-store", "set-cookie": adminCookie(token) } });
}
