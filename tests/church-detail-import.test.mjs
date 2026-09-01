import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

test("reviewed church detail import is admin-only, digest-bound, bounded, and idempotent",async()=>{
  const route=await readFile(new URL("../app/api/admin/church-details/import/route.ts",import.meta.url),"utf8");
  assert.match(route,/session\.role!=="admin"/);
  assert.match(route,/operations\.length>100/);
  assert.match(route,/confirmedDigest!==declared/);
  assert.match(route,/approvalVerified!==true/);
  assert.match(route,/ON CONFLICT\(record_id\) DO UPDATE/);
  assert.match(route,/review_status='approved'/);
  assert.match(route,/offset\+=50/);
});
