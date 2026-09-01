import assert from "node:assert/strict";
import test from "node:test";
import {buildWorshipReviewBatches} from "../scripts/worship-schedules/prepare-review-batches.mjs";

const bundle={metadata:{complete:true,automatic_publication:false},candidates:[{record_id:"a",church_id:2,church_name:"나교회",service_type:"주일예배",day_of_week:["SUN"],start_time:"11:00",source_url:"https://b.example/worship",confidence:"high"},{record_id:"b",church_id:1,church_name:"가교회",service_type:"주일예배",day_of_week:["SUN"],start_time:"09:00",source_url:"http://a.example/worship",confidence:"medium"},{record_id:"c",church_id:1,church_name:"가교회",service_type:"수요예배",day_of_week:["WED"],start_time:"19:30",source_url:"http://a.example/worship",confidence:"medium"}],profiles:[]};

test("keeps every church together and produces pending digest-bound review batches",()=>{
  const result=buildWorshipReviewBatches(bundle,1);
  assert.deepEqual(result.summary,{candidate_records:3,candidate_churches:2,batch_count:2,duplicate_candidates:0,automatic_approval:false});
  assert.deepEqual(result.batches.map((batch)=>batch.reviews.length),[2,1]);
  assert.ok(result.batches.every((batch)=>batch.reviews.every((review)=>review.decision==="pending")));
  assert.equal(result.batches[0].metadata.http_source_count,2);
  assert.match(result.batches[0].metadata.sha256,/^[a-f0-9]{64}$/);
});

test("rejects duplicate IDs and sensitive public review text",()=>{
  assert.throws(()=>buildWorshipReviewBatches({...bundle,candidates:[bundle.candidates[0],bundle.candidates[0]]}),/invalid_or_duplicate_candidate/);
  assert.throws(()=>buildWorshipReviewBatches({...bundle,candidates:[{...bundle.candidates[0],venue_audience:"문의 010-1234-5678"}]}),/sensitive_value_in_review_packet/);
});
