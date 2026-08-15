import { createTemporaryAdminToken, temporaryAdminCookie, verifyTemporaryAdminCode } from "../../../admin-access";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: "요청을 확인할 수 없습니다." }, { status: 403 });
  const data = await request.json().catch(() => ({})) as { code?: unknown };
  if (typeof data.code !== "string" || !(await verifyTemporaryAdminCode(data.code))) {
    return Response.json({ error: "관리자 암호가 맞지 않습니다." }, { status: 403, headers: { "cache-control": "no-store" } });
  }
  const token = await createTemporaryAdminToken();
  return Response.json({ ok: true }, { headers: { "cache-control": "no-store", "set-cookie": temporaryAdminCookie(token) } });
}
