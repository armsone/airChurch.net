#!/usr/bin/env node

import {mkdir,readFile,readdir,rename,writeFile} from "node:fs/promises";
import path from "node:path";
import {buildWorshipReviewBatches,immutableWorshipReviewRecord,worshipReviewCandidateDigest} from "./prepare-review-batches.mjs";

const canonical=(value)=>JSON.stringify(value);
export function mergeWorshipReviewBatches(collection,batches,{requireComplete=true}={}){
  const expected=buildWorshipReviewBatches(collection,25).batches.flatMap((batch)=>batch.reviews),expectedById=new Map(expected.map((item)=>[item.record_id,item]));
  const merged=new Map();
  for(const batch of batches){
    if(batch?.metadata?.mode!=="human_review_only"||batch?.metadata?.automatic_approval!==false||!Array.isArray(batch.reviews))throw new Error("invalid_review_batch");
    if(worshipReviewCandidateDigest(batch.reviews)!==batch.metadata.candidate_sha256)throw new Error("candidate_digest_mismatch");
    for(const review of batch.reviews){
      if(merged.has(review.record_id))throw new Error("duplicate_review_record");
      const source=expectedById.get(review.record_id);if(!source)throw new Error("unknown_review_record");
      if(canonical(immutableWorshipReviewRecord(review))!==canonical(immutableWorshipReviewRecord(source)))throw new Error("candidate_context_changed");
      if(!["pending","approve","reject"].includes(review.decision))throw new Error("invalid_review_decision");
      if(review.decision!=="pending"&&(!Number.isFinite(Date.parse(review.reviewed_at))||String(review.note??"").trim().length<3))throw new Error("review_evidence_required");
      merged.set(review.record_id,{record_id:review.record_id,decision:review.decision,reviewed_at:review.reviewed_at||"",note:String(review.note??"").trim().slice(0,500)});
    }
  }
  const missing=[...expectedById.keys()].filter((id)=>!merged.has(id)),pending=[...merged.values()].filter((item)=>item.decision==="pending");
  if(missing.length)throw new Error(`missing_review_records:${missing.length}`);
  if(requireComplete&&pending.length)throw new Error(`pending_review_records:${pending.length}`);
  const reviews=[...merged.values()].sort((a,b)=>a.record_id.localeCompare(b.record_id));
  return {metadata:{schema_version:1,source_candidate_count:expected.length,review_count:reviews.length,approved_count:reviews.filter((item)=>item.decision==="approve").length,rejected_count:reviews.filter((item)=>item.decision==="reject").length,pending_count:pending.length,complete:pending.length===0,automatic_publication:false},reviews};
}

async function atomicJson(file,value){await mkdir(path.dirname(file),{recursive:true});const temp=`${file}.${process.pid}.tmp`;await writeFile(temp,`${JSON.stringify(value,null,2)}\n`);await rename(temp,file);}
async function main(){const args=process.argv.slice(2),arg=(name,fallback)=>{const index=args.indexOf(name);return index>=0?args[index+1]:fallback;};const input=arg("--input","data/worship-schedules/all-output.json"),batchDir=arg("--batch-dir","out/worship-review-batches"),output=arg("--output","out/worship-reviews.merged.json"),files=(await readdir(batchDir)).filter((name)=>/^batch-\d+\.json$/.test(name)).sort(),batches=await Promise.all(files.map(async(name)=>JSON.parse(await readFile(path.join(batchDir,name),"utf8")))),result=mergeWorshipReviewBatches(JSON.parse(await readFile(input,"utf8")),batches,{requireComplete:!args.includes("--allow-pending")});await atomicJson(output,result);console.log(JSON.stringify({...result.metadata,output}));}
if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(new URL(import.meta.url).pathname))main().catch((error)=>{console.error(error.message);process.exitCode=1;});
