import assert from "node:assert/strict";
import test from "node:test";
import {reviewUpdateAlreadyApplied,verifiedPilotReviewUpdates} from "../scripts/seed-verified-pastor-source-reviews.mjs";

const manifest={policy:{pilotOnly:true,defaultRecrawlDays:30},sites:[{host:"church.example",collectionAllowed:true,allowedPathPrefixes:["/pastor"],minimumDelayMs:2500,policyReviewedAt:"2026-09-01",policyUrl:"https://church.example/",note:"공개 소개만 확인"}],subjects:[{id:"pilot",identity:{pastorName:"김한명",churchName:"한교회",denomination:"공식교단",region:"서울"},role:{title:"담임목사",status:"current"},sources:[{type:"official_church",url:"https://church.example/pastor",identityEvidence:{pastor:["김한명"],church:["한교회"],denomination:["공식교단"],region:["서울"],role:["담임목사"]},assertions:[]}]}]};

test("turns only hold-free verified pilot evidence into pending-review updates",()=>{
  const collected={metadata:{selectionMode:"official_sample_pilot",dryRun:true,published:false,generatedAt:"2026-09-01T00:00:00.000Z"},subjects:[{subjectId:"pilot",identityStatus:"verified",holds:[]}]};
  const updates=verifiedPilotReviewUpdates(manifest,collected);assert.equal(updates.length,1);assert.equal(updates[0].decision,"ready");assert.equal(updates[0].official_sources[0].site_policy.collection_allowed,true);assert.deepEqual(updates[0].official_sources[0].identity_contribution,["pastor","church","denomination","region","role"]);
  const held=structuredClone(collected);held.subjects[0].holds=[{reason:"conflict"}];assert.equal(verifiedPilotReviewUpdates(manifest,held).length,0);
});

test("recognizes an identical ready review as an idempotent rerun",()=>{
  const collected={metadata:{selectionMode:"official_sample_pilot",dryRun:true,published:false,generatedAt:"2026-09-01T00:00:00.000Z"},subjects:[{subjectId:"pilot",identityStatus:"verified",holds:[]}]};
  const update=verifiedPilotReviewUpdates(manifest,collected)[0],task={...update};delete task.match;
  assert.equal(reviewUpdateAlreadyApplied(task,update),true);
  task.note="다른 검토 내용";
  assert.equal(reviewUpdateAlreadyApplied(task,update),false);
});
