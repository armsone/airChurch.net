import assert from "node:assert/strict";
import test from "node:test";
import {buildWorshipReviewBatches,worshipReviewCandidateDigest,worshipReviewLane} from "../scripts/worship-schedules/prepare-review-batches.mjs";
import {mergeWorshipReviewBatches} from "../scripts/worship-schedules/merge-review-batches.mjs";

const bundle={metadata:{complete:true,automatic_publication:false},candidates:[{record_id:"a",church_id:2,church_name:"나교회",service_type:"주일예배",day_of_week:["SUN"],start_time:"11:00",source_url:"https://b.example/worship",confidence:"high"},{record_id:"b",church_id:1,church_name:"가교회",service_type:"주일예배",day_of_week:["SUN"],start_time:"09:00",source_url:"http://a.example/worship",confidence:"medium"},{record_id:"c",church_id:1,church_name:"가교회",service_type:"수요예배",day_of_week:["WED"],start_time:"19:30",source_url:"http://a.example/worship",confidence:"medium"}],profiles:[]};

test("keeps every church together and produces pending digest-bound review batches",()=>{
  const result=buildWorshipReviewBatches(bundle,1);
  assert.deepEqual(result.summary,{candidate_records:3,candidate_churches:2,batch_count:2,duplicate_candidates:0,automatic_approval:false});
  assert.deepEqual(result.batches.map((batch)=>batch.reviews.length),[2,1]);
  assert.ok(result.batches.every((batch)=>batch.reviews.every((review)=>review.decision==="pending")));
  assert.equal(result.batches[0].metadata.http_source_count,2);
  assert.deepEqual(result.batches[0].metadata.review_lane_counts,{quick:0,standard:2,careful:0});
  assert.match(result.batches[0].metadata.candidate_sha256,/^[a-f0-9]{64}$/);
});

test("review lanes prioritize clear evidence without penalizing HTTP churches",()=>{
  assert.equal(worshipReviewLane({confidence:"high",flags:["unencrypted_transport"]}),"quick");
  assert.equal(worshipReviewLane({confidence:"medium",flags:[]}),"standard");
  assert.equal(worshipReviewLane({confidence:"high",flags:["privacy_redacted"]}),"careful");
});

test("allows decisions to change but rejects changed candidate evidence, gaps, and duplicates",()=>{
  const generated=buildWorshipReviewBatches(bundle,1).batches;
  for(const batch of generated)for(const review of batch.reviews){review.decision="approve";review.reviewed_at="2026-09-01T03:00:00.000Z";review.note="공식 출처와 교회 정보를 대조함";}
  const merged=mergeWorshipReviewBatches(bundle,generated);
  assert.deepEqual(merged.metadata,{schema_version:1,source_candidate_count:3,review_count:3,approved_count:3,rejected_count:0,pending_count:0,complete:true,automatic_publication:false});
  const tampered=structuredClone(generated);tampered[0].reviews[0].source_url="https://wrong.example";
  assert.throws(()=>mergeWorshipReviewBatches(bundle,tampered),/candidate_digest_mismatch/);
  assert.throws(()=>mergeWorshipReviewBatches(bundle,generated.slice(0,1)),/missing_review_records/);
  const duplicate=structuredClone(generated);duplicate.push(structuredClone(generated[0]));
  assert.throws(()=>mergeWorshipReviewBatches(bundle,duplicate),/duplicate_review_record/);
});

test("rejects duplicate IDs and sensitive public review text",()=>{
  assert.throws(()=>buildWorshipReviewBatches({...bundle,candidates:[bundle.candidates[0],bundle.candidates[0]]}),/invalid_or_duplicate_candidate/);
  assert.throws(()=>buildWorshipReviewBatches({...bundle,candidates:[{...bundle.candidates[0],venue_audience:"문의 010-1234-5678"}]}),/sensitive_value_in_review_packet/);
});
