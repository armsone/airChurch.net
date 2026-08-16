import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(new Request("http://localhost/", { headers:{accept:"text/html"} }), { ASSETS:{fetch:async()=>new Response("Not found",{status:404})} }, { waitUntil(){}, passThroughOnException(){} });
}

test("server-renders the Airchurch portal", async () => {
  const response=await render(); assert.equal(response.status,200); assert.match(response.headers.get("content-type")??"",/^text\/html\b/i);
  const html=await response.text(); assert.match(html,/<title>에어처치 \| 말씀과 선한 마음이 만나는 곳<\/title>/); assert.match(html,/좋은 말씀과/); assert.match(html,/착한나눔/); assert.match(html,/달란트 브릿지/); assert.match(html,/건강한 신앙 생태계/); assert.doesNotMatch(html,/codex-preview|SkeletonPreview|react-loading-skeleton/);
});

test("keeps safety and discovery requirements in the product source", async () => {
  const [page,layout,hosting,selection]=await Promise.all([readFile(new URL("../app/page.tsx",import.meta.url),"utf8"),readFile(new URL("../app/layout.tsx",import.meta.url),"utf8"),readFile(new URL("../.openai/hosting.json",import.meta.url),"utf8"),readFile(new URL("../app/api/sermons/_selection.ts",import.meta.url),"utf8")]);
  for(const phrase of ["교회명, 목사님, 지역","작은 교회 살리기","은퇴 목회자 동행","내 달란트","소속 확인","이의제기"]) assert.match(page,new RegExp(phrase));
  for(const region of ["서울","부산","대구","인천","광주","대전","울산","세종","경기","강원","충북","충남","전북","전남","경북","경남","제주"]) assert.match(page,new RegExp(`"${region}"`));
  for(const excluded of ["찬양","광고","성경통독","쇼츠"]) assert.match(selection,new RegExp(excluded));
  assert.match(layout,/og\.png/); assert.equal(JSON.parse(hosting).d1,"DB");
});

test("does not block initial content on YouTube synchronization", async () => {
  const [page,sermonRoute,praiseRoute]=await Promise.all([
    readFile(new URL("../app/page.tsx",import.meta.url),"utf8"),
    readFile(new URL("../app/api/sermons/route.ts",import.meta.url),"utf8"),
    readFile(new URL("../app/api/praises/route.ts",import.meta.url),"utf8"),
  ]);
  assert.doesNotMatch(page,/\/api\/(?:sermons|praises)\/sync/);
  assert.match(page,/Promise\.all\(\[\s*loadItems\("\/api\/sermons"\),\s*loadItems\("\/api\/praises"\)/);
  assert.doesNotMatch(sermonRoute,/ensureSermonTables/);
  assert.doesNotMatch(praiseRoute,/ensure(?:Sermon|Praise)Tables/);
  assert.match(sermonRoute,/getRequestExecutionContext/);
  assert.match(sermonRoute,/context\.waitUntil\(pendingSync\)/);
  assert.match(praiseRoute,/getRequestExecutionContext/);
  assert.match(praiseRoute,/context\.waitUntil\(pendingSync\)/);
  assert.match(sermonRoute,/stale-while-revalidate=3600/);
  assert.match(praiseRoute,/stale-while-revalidate=3600/);
});

test("loads a larger sermon catalog in batches", async () => {
  const [page,sermonRoute]=await Promise.all([
    readFile(new URL("../app/page.tsx",import.meta.url),"utf8"),
    readFile(new URL("../app/api/sermons/route.ts",import.meta.url),"utf8"),
  ]);
  assert.match(sermonRoute,/selectWeightedRecent\([^;]+,120\)/);
  assert.match(page,/visibleSermonCount,setVisibleSermonCount\]=useState\(30\)/);
  assert.match(page,/visibleSermons = filtered\.slice\(0,visibleSermonCount\)/);
  assert.match(page,/previewSermons = filtered\.slice\(visibleSermonCount,visibleSermonCount\+3\)/);
  assert.match(page,/눌러서 말씀 더 보기/);
  assert.match(page,/말씀 30개 더 보기/);
});
