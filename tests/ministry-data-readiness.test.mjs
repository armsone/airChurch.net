import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import test from "node:test";
import {buildMinistryDataReadiness} from "../scripts/report-ministry-data-readiness.mjs";

const plan=(operations)=>({metadata:{sha256:createHash("sha256").update(JSON.stringify(operations)).digest("hex"),requires_separate_apply_authorization:true},operations});
const base={worshipReport:{complete:true,registered_churches:2,attempted_churches:2,collection_errors:0,collection_holds:1,churches_with_schedule_candidates:1,hold_reasons:{missing_homepage:1},automatic_publication:false},worshipCollection:{},approvedWorshipPlan:plan([{action:"upsert_reviewed_worship_schedule",values:{church_id:1,source_url:"https://church.example/worship"}}]),pastorRoster:{metadata:{dryRun:true,published:false},candidates:[{id:"p1"}],roleDiscoveryQueue:[{id:"q1"}],holds:[]}};

test("reports the real partial nationwide state instead of treating a pilot approval as completion",()=>{
  const report=buildMinistryDataReadiness(base);
  assert.equal(report.status,"in_progress");
  assert.equal(report.coverage.approved_worship_churches,1);
  assert.equal(report.checks.pastor_official_collection_received,false);
  assert.deepEqual(report.blocking,["pastor_official_collection_not_received"]);
});

test("becomes release ready only after guarded pastor collection and approval arrive",()=>{
  const pastorOps=[{action:"upsert_reviewed_ministry_profile",values:{church_id:1,source_url:"http://church.example/staff"}}];
  const report=buildMinistryDataReadiness({...base,pastorCollected:{metadata:{dryRun:true,published:false},events:[{id:"event"}]},approvedPastorPlan:plan(pastorOps)});
  assert.equal(report.status,"release_ready");
  assert.equal(report.coverage.verified_pastor_events,1);
  assert.equal(report.coverage.approved_pastor_profiles,1);
});

test("fails integrity when a plan digest or public payload is unsafe",()=>{
  const unsafe={metadata:{sha256:"wrong",requires_separate_apply_authorization:true},operations:[{action:"upsert_reviewed_ministry_profile",values:{church_id:1,source_url:"https://church.example",note:"010-1234-5678"}}]};
  const report=buildMinistryDataReadiness({...base,pastorCollected:{metadata:{dryRun:true,published:false},events:[]},approvedPastorPlan:unsafe});
  assert.equal(report.status,"in_progress");
  assert.equal(report.checks.public_plans_have_no_sensitive_values,false);
  assert.equal(report.checks.operation_digests_match,false);
  assert.ok(report.blocking.includes("safety_or_integrity_check_failed"));
});
