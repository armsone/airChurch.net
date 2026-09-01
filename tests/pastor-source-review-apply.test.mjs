import assert from "node:assert/strict";
import test from "node:test";
import {applyPastorSourceReviewUpdates} from "../scripts/apply-pastor-source-review-updates.mjs";

const task={subject_id:"p1",church_id:1,pastor_name:"김한명",church_name:"한교회",denomination:"공식교단",region:"서울",role_category:"current_primary",eligible_role_titles:["담임목사"],decision:"pending",official_sources:[],discovered_roles:[],reviewed_at:"",note:""};
const update={...Object.fromEntries(["subject_id","church_id","pastor_name","church_name","denomination","region","role_category"].map((key)=>[key,task[key]])),decision:"ready",official_sources:[{url:"https://church.example/pastor"}],discovered_roles:[],reviewed_at:"2026-09-01T00:00:00.000Z",note:"공식 출처에서 다섯 축을 확인했습니다.",confirmed_role_title:"담임목사",confirmed_role_status:"current"};

test("applies a review only to its exact immutable subject identity",()=>{
  const batches=new Map([["batch-01.json",{tasks:[structuredClone(task)]}]]),result=applyPastorSourceReviewUpdates(batches,[update]);assert.equal(result.applied,1);assert.equal(batches.get("batch-01.json").tasks[0].decision,"ready");
  const mismatch={...update,pastor_name:"다른목사"};assert.throws(()=>applyPastorSourceReviewUpdates(new Map([["batch-01.json",{tasks:[structuredClone(task)]}]]),[mismatch]),/identity_mismatch/);
});

test("is idempotent but rejects conflicting repeated review content",()=>{
  const ready={...structuredClone(task),...structuredClone(update)},batches=new Map([["batch-01.json",{tasks:[ready]}]]);assert.equal(applyPastorSourceReviewUpdates(batches,[update]).alreadyApplied,1);assert.throws(()=>applyPastorSourceReviewUpdates(batches,[{...update,note:"서로 다른 충분히 긴 검토 내용입니다."}]),/conflict/);
});
