# vinext-starter

A clean full-stack starter running on
[vinext](https://github.com/cloudflare/vinext), with optional Cloudflare D1 and
Drizzle support.

## Prerequisites

- Node.js `>=22.13.0`

## Quick Start

```bash
npm install
npm run dev
npm run build
```

This starter does not use `wrangler.jsonc`.

## Included Shape

- edit site code under `app/`
- `.openai/hosting.json` declares optional Sites D1 and R2 bindings
- `vite.config.ts` simulates declared bindings for local development
- `db/schema.ts` starts intentionally empty
- `examples/d1/` contains an optional D1 example surface
- `drizzle.config.ts` supports local migration generation when needed

## Workspace Auth Headers

Signed-in visitors receive both `oai-authenticated-user-id` and `oai-authenticated-user-email`. Private Sites require every visitor to sign in; public Sites may also have anonymous visitors, for whom neither header is present.

The user ID is stable for the same user on the same Site and different across Sites. Email and name are intended for display or contact purposes.

SIWC-authenticated workspace sites may also receive
`oai-authenticated-user-full-name` when the user's SIWC profile has a non-empty
`name` claim. The full-name value is percent-encoded UTF-8 and is accompanied by
`oai-authenticated-user-full-name-encoding: percent-encoded-utf-8`.

Treat the full name as optional and fall back to email when it is absent:

```tsx
import { headers } from "next/headers";

export default async function Home() {
  const requestHeaders = await headers();
  const userId = requestHeaders.get("oai-authenticated-user-id");
  const email = requestHeaders.get("oai-authenticated-user-email");
  const encodedFullName = requestHeaders.get("oai-authenticated-user-full-name");
  const fullName =
    encodedFullName &&
    requestHeaders.get("oai-authenticated-user-full-name-encoding") ===
      "percent-encoded-utf-8"
      ? decodeURIComponent(encodedFullName)
      : null;

  const displayName = fullName ?? email;
  // ...
}
```

## Optional Dispatch-Owned ChatGPT Sign-In

Import the ready-to-use helpers from `app/chatgpt-auth.ts` when the site needs
optional or required ChatGPT sign-in:

- Use `getChatGPTUser()` for optional signed-in UI.
- Use `requireChatGPTUser(returnTo)` for server-rendered pages that should send
  anonymous visitors through Sign in with ChatGPT.
- Use `chatGPTSignInPath(returnTo)` and `chatGPTSignOutPath(returnTo)` for
  browser links or actions.
- Pass a same-origin relative `returnTo` path for the destination after sign-in
  or sign-out. The helper validates and safely encodes it.
- Mark protected pages with `export const dynamic = "force-dynamic"` because
  they depend on per-request identity headers.

Dispatch owns `/signin-with-chatgpt`, `/signout-with-chatgpt`, `/callback`, the
OAuth cookies, and identity header injection. Do not implement app routes for
those reserved paths. Routes that do not import and call the helper remain
anonymous-compatible.

SIWC establishes identity only; it does not prove workspace membership. Use the
Sites hosting platform's access policy controls for workspace-wide restrictions,
or enforce explicit server-side membership or allowlist checks.

Use SIWC for account pages, user-specific dashboards, saved records, and write
actions tied to the current ChatGPT user. Leave public content anonymous.

## Useful Commands

- `npm run dev`: start local development
- `npm run build`: verify the vinext build output
- `npm test`: build the starter and verify its rendered loading skeleton
- `npm run db:generate`: generate Drizzle migrations after schema changes
- `npm run pastor-history:collect`: collect review-only public pastor history and write official-role contact candidates to a separate admin-input artifact
- `npm run pastor-history:roster -- --input <approved-church-export.json>`: build a non-public, equal-priority curation queue for every supported official pastor role
- `npm run pastor-history:import:dry-run`: create a no-write import preview that requires a matching human approval artifact for eligibility
- `npm run test:pastor-history`: verify source boundaries, robots handling, identity matching, deduplication, and approval gating
- `npm run db:generate`: generate Drizzle migrations after schema changes

The pastor-history workflow is intentionally disconnected from the production database, encryption keys, and public pages. Contact values never enter the public history artifact. See [the collection and approval policy](docs/pastor-history-pipeline.md).

## Learn More

- [vinext Documentation](https://github.com/cloudflare/vinext)
- [Drizzle D1 Guide](https://orm.drizzle.team/docs/get-started/d1-new)

## 빠방 CCM 집계 연동

빠방에서 가져온 CCM 플레이어가 보일 때 `/api/ccm/counters`로 방문을 보내고, YouTube의 실제 PLAYING 상태 누적 10초마다 재생 건당 한 번 전송합니다. 일시정지·버퍼링·오류에서는 타이머를 멈춥니다. 교회 찬양·바이블뮤직은 제외합니다. 서버는 고정된 빠방 `/api/counters`에 `source: "airchurch"`, `event`, 무작위 `id`만 전달합니다. 쿠키·계정·영상 정보·사용자 IP 헤더는 전달하지 않습니다. 추적 금지를 따르고 저장소 차단 시 방문을 생략합니다. 같은 ID로 한 번 재시도하며, 방문·재생 ID는 서로 독립적입니다. 한국 시간 일별 중복 제거와 30일 합산은 빠방 서버가 담당합니다. 공개 참고용 집계이며 출처 필드는 인증 수단이 아닙니다.
