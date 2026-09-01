import assert from "node:assert/strict";
import test from "node:test";
import {buildGapckPastorReviewUpdate} from "../scripts/build-gapck-pastor-review-updates.mjs";

const task={subject_id:"p1",church_id:1,pastor_name:"김한명",church_name:"한교회",denomination:"대한예수교장로회 합동",region:"서울 양천",role_category:"current_primary",eligible_role_titles:["담임목사"],decision:"pending"};
test("builds a robots-bound GAPCK review without using a blocked church homepage",()=>{
  const update=buildGapckPastorReviewUpdate(task,{subject_id:"p1",decision:"ready",reviewed_at:"2026-09-01T00:00:00.000Z",note:"총회 실시간 교회와 교역자 명부를 교차 확인함."});
  assert.equal(update.official_sources.length,3);assert.ok(update.official_sources.every((item)=>new URL(item.url).hostname==="gapck.org"));assert.equal(update.official_sources[1].assertions[0].role,"담임목사");assert.deepEqual(update.official_sources[1].identity_evidence.region,["서울","양천"]);
});
test("rejects a non-GAPCK, non-pending, or unreviewed candidate",()=>{
  assert.throws(()=>buildGapckPastorReviewUpdate({...task,denomination:"다른교단"},{decision:"ready",reviewed_at:"2026-09-01",note:"충분히 긴 검토 내용입니다."}),/invalid_gapck/);
});
