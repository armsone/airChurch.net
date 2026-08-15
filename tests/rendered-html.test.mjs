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
  const [page,layout,hosting]=await Promise.all([readFile(new URL("../app/page.tsx",import.meta.url),"utf8"),readFile(new URL("../app/layout.tsx",import.meta.url),"utf8"),readFile(new URL("../.openai/hosting.json",import.meta.url),"utf8")]);
  for(const phrase of ["교회명, 목사님, 지역","작은 교회 살리기","은퇴 목회자 동행","내 달란트","소속 확인","이의제기"]) assert.match(page,new RegExp(phrase));
  assert.match(layout,/og\.png/); assert.equal(JSON.parse(hosting).d1,"DB");
});
