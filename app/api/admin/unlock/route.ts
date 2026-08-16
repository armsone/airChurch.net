import { adminCookie, createAccessToken, verifyCredentials } from "../../../admin-access";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: "요청을 확인할 수 없습니다." }, { status: 403 });
  const data = await request.json().catch(() => ({})) as { username?: unknown; password?: unknown };
  if (typeof data.username !== "string" || typeof data.password !== "string") {
    return Response.json({ error: "아이디 또는 비밀번호가 맞지 않습니다." }, { status: 403, headers: { "cache-control": "no-store" } });
  }
  const role=await verifyCredentials(data.username,data.password);
  if(!role) return Response.json({ error: "아이디 또는 비밀번호가 맞지 않습니다." }, { status: 403, headers: { "cache-control": "no-store" } });
  const token = await createAccessToken(role);
  return Response.json({ ok: true,role }, { headers: { "cache-control": "no-store", "set-cookie": adminCookie(token) } });
}
