import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read=(path)=>readFile(new URL(path,import.meta.url),"utf8");
test("encouragements publish only approved messages and enforce a 30 minute browser limit",async()=>{
  const [route,board]=await Promise.all([read("../app/api/encouragements/route.ts"),read("../app/encouragement-board.tsx")]);
  assert.match(route,/e\.status='approved' AND c\.review_status='approved'/);
  assert.match(route,/consumeSubmissionLimit\(db,"encouragement-write",fp,1,30\)/);
  assert.match(board,/30\*60\*1000/);
  assert.match(board,/airchurch\.encouragement\.browserId/);
  assert.match(route,/target_ref=\?/);
  assert.match(route,/minister:/);
});

test("church and pastor pages keep separate encouragement streams",async()=>{
  const [church,pastor,admin]=await Promise.all([read("../app/church/[id]/page.tsx"),read("../app/pastors/[id]/page.tsx"),read("../app/admin/page.tsx")]);
  assert.match(church,/target_type='church'/);
  assert.match(pastor,/target_type='pastor'/);
  assert.match(admin,/교회·목사 응원글 전체/);
  assert.match(admin,/ReviewControls kind="encouragement"/);
});
