import { env } from "cloudflare:workers";
import { hasTemporaryAdminAccess } from "../../../admin-access";
import { getChatGPTUser } from "../../../chatgpt-auth";
import { clean, database, ensureCommunityTables, ensureSermonTables } from "../../_shared";

async function isAdmin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return false;
  if (await hasTemporaryAdminAccess(request)) return true;
  const user = await getChatGPTUser();
  const allowedEmail = (env as unknown as { ADMIN_EMAIL?: string }).ADMIN_EMAIL?.trim().toLowerCase();
  return Boolean(user && allowedEmail && user.email.toLowerCase() === allowedEmail);
}

export async function PATCH(request: Request) {
  if (!(await isAdmin(request))) return Response.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });

  const data = await request.json().catch(() => ({})) as Record<string, unknown>;
  const id = Number(data.id);
  const kind = clean(data.kind, 20);
  if (!Number.isInteger(id) || id < 1) return Response.json({ error: "대상을 확인해 주세요." }, { status: 400 });

  const db = database();
  await Promise.all([ensureCommunityTables(db), ensureSermonTables(db)]);

  if (kind === "church") {
    const status = clean(data.status, 20);
    if (status) {
      if (!["approved", "removed", "deleted"].includes(status)) return Response.json({ error: "상태를 확인해 주세요." }, { status: 400 });
      if (status === "deleted") {
        const church = await db.prepare("SELECT review_status FROM churches WHERE id=?").bind(id).first<{ review_status: string }>();
        if (!church) return Response.json({ error: "교회를 찾을 수 없습니다." }, { status: 404 });
        if (church.review_status !== "removed") return Response.json({ error: "보류된 교회만 삭제할 수 있습니다." }, { status: 409 });
      }
      await db.prepare("UPDATE churches SET review_status=? WHERE id=?").bind(status, id).run();
      if (status === "removed" || status === "deleted") await db.prepare("UPDATE sermons SET status='hidden' WHERE church_id=?").bind(id).run();
    } else {
      const name = clean(data.name, 100), pastor = clean(data.pastor, 80), region = clean(data.region, 80), denomination = clean(data.denomination, 120);
      if (!name || !pastor || !region || !denomination) return Response.json({ error: "교회 정보를 모두 입력해 주세요." }, { status: 400 });
      await db.prepare("UPDATE churches SET name=?, pastor=?, region=?, denomination=? WHERE id=?").bind(name, pastor, region, denomination, id).run();
    }
  } else if (kind === "sermon") {
    const status = clean(data.status, 20);
    if (!["published", "hidden"].includes(status)) return Response.json({ error: "상태를 확인해 주세요." }, { status: 400 });
    await db.prepare("UPDATE sermons SET status=? WHERE id=?").bind(status, id).run();
  } else if (kind === "post" || kind === "talent") {
    const status = clean(data.status, 20);
    if (!["pending", "approved", "rejected"].includes(status)) return Response.json({ error: "상태를 확인해 주세요." }, { status: 400 });
    const table = kind === "post" ? "community_posts" : "talent_offers";
    await db.prepare(`UPDATE ${table} SET status=? WHERE id=?`).bind(status, id).run();
  } else {
    return Response.json({ error: "지원하지 않는 작업입니다." }, { status: 400 });
  }

  return Response.json({ ok: true }, { headers: { "cache-control": "no-store" } });
}
