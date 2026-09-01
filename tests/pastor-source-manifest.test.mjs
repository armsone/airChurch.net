import assert from "node:assert/strict";
import test from "node:test";
import {buildPastorSourceManifest} from "../scripts/build-pastor-source-manifest.mjs";

const roster={metadata:{dryRun:true,published:false,selectionPolicyId:"policy-1"},candidates:[{subjectId:"p1",churchId:1,identity:{pastorName:"김한명",churchName:"한교회",denomination:"공식교단",region:"서울"},roleCategory:"current_primary",eligibleRoleTitles:["담임목사"]}]};
const policy={collection_allowed:true,allowed_path_prefixes:["/church/"],minimum_delay_ms:3000,policy_reviewed_at:"2026-09-01",policy_url:"https://church.example/"};
const review={metadata:{mode:"official_source_curation_review",complete:true,automatic_publication:false,review_sha256:"abc"},tasks:[{subject_id:"p1",church_id:1,pastor_name:"김한명",church_name:"한교회",denomination:"공식교단",region:"서울",role_category:"current_primary",confirmed_role_title:"담임목사",confirmed_role_status:"current",decision:"ready",official_sources:[{type:"official_church",url:"https://church.example/church/pastor",identity_contribution:["pastor","church","role"],identity_evidence:{pastor:["김한명"],church:["한교회"],role:["담임목사"]},assertions:[{event_type:"position",role:"담임목사",role_category:"current_primary",role_status:"current",organization:"한교회",fact_summary:"한교회 담임목사로 소개되어 있다.",evidence_all:["김한명","담임목사"],is_primary_role:true}],site_policy:policy},{type:"official_church",url:"https://church.example/church/about",identity_contribution:["church","denomination","region"],identity_evidence:{church:["한교회"],denomination:["공식교단"],region:["서울"]},assertions:[],site_policy:policy}]}]};

test("builds a roster-bound complementary official collection manifest",()=>{
  const manifest=buildPastorSourceManifest(review,roster);
  assert.equal(manifest.policy.selectionPolicyId,"policy-1");assert.equal(manifest.reviewMetadata.automaticPublication,false);assert.equal(manifest.subjects[0].identityEvidenceMode,"complementary");assert.equal(manifest.subjects[0].minimumIdentitySources,2);assert.equal(manifest.sites[0].minimumDelayMs,3000);assert.equal(manifest.subjects[0].sources[0].assertions[0].eventType,"position");
});

test("rejects roster mismatch and missing identity axes",()=>{
  const mismatch=structuredClone(review);mismatch.tasks[0].pastor_name="다른 이름";assert.throws(()=>buildPastorSourceManifest(mismatch,roster),/roster_mismatch/);
  const incomplete=structuredClone(review);incomplete.tasks[0].official_sources.pop();assert.throws(()=>buildPastorSourceManifest(incomplete,roster),/five_axis/);
});
