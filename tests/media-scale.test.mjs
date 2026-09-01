import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

const read=(path)=>readFile(new URL(path,import.meta.url),"utf8");

test("keeps visitor payload bounded while allowing a much larger media catalog",async()=>{
  const [sermons,praises,shorts,home]=await Promise.all([read("../app/api/sermons/route.ts"),read("../app/api/praises/route.ts"),read("../app/api/shorts/route.ts"),read("../app/home-client.tsx")]);
  for(const route of [sermons,praises,shorts]){assert.match(route,/Math\.min\(300/);assert.match(route,/Math\.min\(1200/);assert.match(route,/cdn-cache-control/);assert.doesNotMatch(route,/s-maxage/)}
  assert.match(home,/lowData\?12:60/);
  assert.match(home,/lowData\?12:48/);
});

test("archives more items from one fetched playlist in one bounded database batch",async()=>{
  const sync=await read("../app/api/sermons/sync/route.ts");
  assert.match(sync,/recentSermons\.slice\(0,18\)/);
  assert.match(sync,/recentShorts\.slice\(0,12\)/);
  assert.match(sync,/recentPraises\.slice\(0,12\)/);
  assert.match(sync,/if\(mediaStatements\.length\)await db\.batch\(mediaStatements\)/);
  assert.doesNotMatch(sync,/for\(const item of recentSermons\.slice/);
  assert.doesNotMatch(sync,/UPDATE churches SET review_status='removed'/);
  assert.match(sync,/missing or quiet YouTube channel is a collection gap/);
  assert.match(sync,/finally \{/);
  assert.match(sync,/DELETE FROM sync_state WHERE key=\?/);
});

test("admin health reports catalog and church coverage rather than only freshness",async()=>{
  const admin=await read("../app/admin/page.tsx");
  for(const metric of ["sermon_count","sermon_church_count","praise_count","praise_church_count","short_count","short_church_count","ministry_profile_count","ministry_appearance_count"])assert.match(admin,new RegExp(metric));
});

test("keeps media synchronization internal and releases both collection leases",async()=>{
  const [sermons,praises]=await Promise.all([read("../app/api/sermons/sync/route.ts"),read("../app/api/praises/sync/route.ts")]);
  assert.match(sermons,/hostname!=="airchurch\.internal"/);
  assert.match(praises,/if\(request\)return Response\.json\(\{error:"Not found"\}/);
  for(const route of [sermons,praises]){assert.match(route,/finally \{/);assert.match(route,/DELETE FROM sync_state WHERE key=\?/);}
});

test("unified search promotes approved pastor profiles before videos",async()=>{
  const search=await read("../app/search/page.tsx");
  assert.match(search,/FROM church_ministry_profiles p JOIN churches c/);
  assert.match(search,/p\.review_status='approved'/);
  assert.match(search,/id="pastor-results"/);
  assert.match(search,/\?minister=\$\{pastor\.minister_id\}/);
});
