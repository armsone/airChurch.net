import { adminCookie, createAccessToken, verifyCredentials } from "../../../admin-access";
import { readLimitedJson, requestOriginIsInvalid } from "../../_shared";

export async function POST(request: Request) {
  if(requestOriginIsInvalid(request)) return Response.json({ error: "요청을 확인할 수 없습니다." }, { status: 403,headers:{"cache-control":"no-store"} });
  const body=await readLimitedJson(request);if(body.tooLarge)return Response.json({error:"요청 내용이 너무 큽니다."},{status:413,headers:{"cache-control":"no-store"}});const data=body.data;
  if (typeof data.username !== "string" || typeof data.password !== "string") {
    return Response.json({ error: "아이디 또는 비밀번호가 맞지 않습니다." }, { status: 403, headers: { "cache-control": "no-store" } });
  }
  const session=await verifyCredentials(data.username,data.password);
  if(!session) return Response.json({ error: "아이디 또는 비밀번호가 맞지 않습니다." }, { status: 403, headers: { "cache-control": "no-store" } });
  const token = await createAccessToken(session);
  return Response.json({ ok: true,role:session.role }, { headers: { "cache-control": "no-store", "set-cookie": adminCookie(token) } });
}
