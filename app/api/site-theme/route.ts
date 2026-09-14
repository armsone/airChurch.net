import { accessSession } from "../../admin-access";
import { siteIdentityForHost } from "../../site-identity";
import { isSiteThemeId, saveSelectedSiteTheme } from "../../site-theme";
import { readLimitedJson, requestOriginIsInvalid } from "../_shared";

export async function PUT(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || requestOriginIsInvalid(request)) return Response.json({ error: "요청 출처를 확인할 수 없습니다." }, { status: 403, headers: { "cache-control": "no-store" } });
  const host = request.headers.get("x-site-brand-host") ?? new URL(request.url).host;
  if (siteIdentityForHost(host).domain !== "airchurch.net") return Response.json({ error: "에어처치에서만 테마를 변경할 수 있습니다." }, { status: 404, headers: { "cache-control": "no-store" } });
  const session = await accessSession(request);
  if (session?.role !== "admin") return Response.json({ error: "관리자 권한이 필요합니다." }, { status: 403, headers: { "cache-control": "no-store" } });
  const body = await readLimitedJson(request);
  if (body.tooLarge || !isSiteThemeId(body.data.theme)) return Response.json({ error: "선택한 테마를 확인해 주세요." }, { status: 400, headers: { "cache-control": "no-store" } });
  try {
    await saveSelectedSiteTheme(body.data.theme);
    return Response.json({ ok: true, theme: body.data.theme }, { headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json({ error: "테마 설정을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요." }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
