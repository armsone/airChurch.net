import { clearAdminCookie, revokeAccessSession } from "../../../admin-access";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return new Response(null, { status: 403 });
  await revokeAccessSession(request);
  return new Response(null, { status: 303, headers: { location: "/", "set-cookie": clearAdminCookie(), "cache-control": "no-store" } });
}
