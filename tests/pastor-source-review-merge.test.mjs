import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import test from "node:test";
import {buildPastorSourceReviewBatches,immutablePastorSourceTask} from "../scripts/prepare-pastor-source-review-batches.mjs";
import {mergePastorSourceReviewBatches} from "../scripts/merge-pastor-source-review-batches.mjs";

const candidate={subjectId:"p1",churchId:1,identity:{pastorName:"김한명",churchName:"한교회",denomination:"공식교단",region:"서울"},roleCategory:"current_primary",eligibleRoleTitles:["담임목사"],officialHomepageUrl:"https://church.example/",discoveryQueries:[],publicationEligible:false,reviewStatus:"needs_source_curation"};
const prepared=()=>buildPastorSourceReviewBatches({metadata:{dryRun:true,published:false,fairnessPolicy:"equal_across_role_categories",privacyScan:{status:"passed"}},candidates:[candidate]});
const rehash=(batch)=>{batch.metadata.candidate_sha256=createHash("sha256").update(JSON.stringify(batch.tasks.map(immutablePastorSourceTask))).digest("hex");};

test("merges reviewed official sources without publishing them",()=>{
  const result=prepared(),task=result.batches[0].tasks[0];task.decision="ready";task.reviewed_at="2026-09-01T00:00:00.000Z";task.note="공식 페이지 확인";task.official_sources=[{type:"official_church",url:"https://church.example/pastor",identity_contribution:["pastor","church","role"],fact_summary:"담임목사 소개 확인"}];
  const merged=mergePastorSourceReviewBatches(result.summary,result.batches);
  assert.equal(merged.metadata.complete,true);assert.equal(merged.metadata.ready_count,1);assert.equal(merged.metadata.automatic_publication,false);
});

test("rejects immutable changes, pending work, and unsafe source notes",()=>{
  const changed=prepared();changed.batches[0].tasks[0].pastor_name="다른 이름";assert.throws(()=>mergePastorSourceReviewBatches(changed.summary,changed.batches,{allowPending:true}),/digest_mismatch/);
  const pending=prepared();assert.throws(()=>mergePastorSourceReviewBatches(pending.summary,pending.batches),/pending_tasks/);
  const unsafe=prepared(),task=unsafe.batches[0].tasks[0];task.decision="ready";task.reviewed_at="2026-09-01T00:00:00.000Z";task.note="공식 확인";task.official_sources=[{type:"official_church",url:"https://church.example/pastor",identity_contribution:["pastor","church","role"],note:"010-1234-5678"}];rehash(unsafe.batches[0]);assert.throws(()=>mergePastorSourceReviewBatches(unsafe.summary,unsafe.batches),/sensitive_value/);
});
