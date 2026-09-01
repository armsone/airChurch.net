import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

const read=(path)=>readFile(new URL(path,import.meta.url),"utf8");

test("binds a pastor signup to one reviewed church and limits change requests to it",async()=>{
  const [signup,form,manage,admin,schema,migration]=await Promise.all([read("../app/api/reviewer-signup/route.ts"),read("../app/pastor/join/reviewer-signup.tsx"),read("../app/api/admin/manage/route.ts"),read("../app/admin/page.tsx"),read("../db/schema.ts"),read("../drizzle/0019_reviewer_church_affiliation.sql")]);
  assert.match(form,/name="churchName"/);
  assert.match(signup,/review_status='approved'/);
  assert.match(signup,/churches\.results\.length!==1/);
  assert.match(signup,/fingerprint,church_id/);
  assert.match(manage,/a\.church_id=c\.id WHERE c\.id=\?/);
  assert.match(admin,/신청 교회/);
  assert.match(schema,/churchId:integer\("church_id"\)/);
  assert.match(migration,/reviewer_accounts.*church_id/s);
});
