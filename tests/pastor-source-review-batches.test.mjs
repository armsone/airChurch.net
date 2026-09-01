import assert from "node:assert/strict";
import test from "node:test";
import {buildPastorSourceReviewBatches,immutablePastorSourceTask} from "../scripts/prepare-pastor-source-review-batches.mjs";

const candidate=(id,churchId,name)=>({subjectId:id,churchId,identity:{pastorName:name,churchName:`교회${churchId}`,denomination:"공식교단",region:"서울"},roleCategory:"current_primary",eligibleRoleTitles:["담임목사"],officialHomepageUrl:null,discoveryQueries:[{purpose:"official_identity",query:`교회${churchId} ${name} 목사`,acceptedSources:["official_church"]}],publicationEligible:false,reviewStatus:"needs_source_curation"});
const roster=(candidates)=>({metadata:{dryRun:true,published:false,fairnessPolicy:"equal_across_role_categories",privacyScan:{status:"passed"}},candidates});

test("groups equal-priority pastor source work by church without auto approval",()=>{
  const result=buildPastorSourceReviewBatches(roster([candidate("p1",1,"김한명"),candidate("p2",1,"이두명"),candidate("p3",2,"박세명")]),1);
  assert.deepEqual(result.summary,{candidate_pastors:3,candidate_churches:2,batch_count:2,automatic_approval:false});
  assert.equal(result.batches[0].tasks.length,2);
  assert.ok(result.batches.flatMap((batch)=>batch.tasks).every((task)=>task.decision==="pending"&&task.official_sources.length===0&&task.discovered_roles.length===0));
  assert.equal(result.batches[0].metadata.privacy_scan.status,"passed");
  assert.deepEqual(Object.keys(immutablePastorSourceTask(result.batches[0].tasks[0])),["subject_id","church_id","pastor_name","church_name","denomination","region","role_category","eligible_role_titles","official_homepage_url","discovery_queries"]);
});

test("rejects duplicate candidates and contact values",()=>{
  assert.throws(()=>buildPastorSourceReviewBatches(roster([candidate("p1",1,"김한명"),candidate("p1",2,"이두명")])),/invalid_or_duplicate/);
  const unsafe=candidate("p2",2,"010-1234-5678");
  assert.throws(()=>buildPastorSourceReviewBatches(roster([unsafe])),/unsafe_pastor_review_task/);
});
