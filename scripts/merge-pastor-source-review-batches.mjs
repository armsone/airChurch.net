#!/usr/bin/env node

import {createHash} from "node:crypto";
import {mkdir,readFile,readdir,rename,writeFile} from "node:fs/promises";
import path from "node:path";
import {immutablePastorSourceTask} from "./prepare-pastor-source-review-batches.mjs";

const sha=(value)=>createHash("sha256").update(JSON.stringify(value)).digest("hex");
const sensitive=/(?:[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|(?<!\d)01[016789][- .]?\d{3,4}[- .]?\d{4}(?!\d)|(?:계좌|account)\s*[:：]?\s*\d[\d -]{7,})/gi;
const allowedDecisions=new Set(["pending","ready","hold"]),allowedTypes=new Set(["official_church","official_denomination","official_presbytery","official_seminary","official_youtube"]),allowedAxes=new Set(["pastor","church","denomination","region","role"]);
export function mergePastorSourceReviewBatches(summary,batches,{allowPending=false}={}){
  const tasks=[],ids=new Set();
  for(const batch of batches){
    if(batch?.metadata?.mode!=="official_source_curation"||batch?.metadata?.automatic_approval!==false||sha((batch.tasks??[]).map(immutablePastorSourceTask))!==batch?.metadata?.candidate_sha256)throw new Error("pastor_review_candidate_digest_mismatch");
    for(const task of batch.tasks??[]){
      if(ids.has(task.subject_id))throw new Error("duplicate_pastor_review_task");ids.add(task.subject_id);
      if(!allowedDecisions.has(task.decision))throw new Error("invalid_pastor_review_decision");
      const sources=Array.isArray(task.official_sources)?task.official_sources:[];
      for(const source of sources){
        let url;try{url=new URL(String(source.url));}catch{throw new Error("invalid_official_source_url");}
        const axes=source.identity_contribution;
        if(!["http:","https:"].includes(url.protocol)||!allowedTypes.has(source.type)||!Array.isArray(axes)||!axes.length||axes.some((axis)=>!allowedAxes.has(axis))||new Set(axes).size!==axes.length)throw new Error("invalid_official_source");
        if(sensitive.test(JSON.stringify([source.fact_summary,source.note])))throw new Error("sensitive_value_in_pastor_review");sensitive.lastIndex=0;
      }
      if(task.decision==="ready"&&(!sources.length||!/^\d{4}-\d{2}-\d{2}T/.test(task.reviewed_at)||String(task.note??"").trim().length<3))throw new Error("incomplete_ready_pastor_review");
      if(task.decision==="hold"&&(!/^\d{4}-\d{2}-\d{2}T/.test(task.reviewed_at)||String(task.note??"").trim().length<3))throw new Error("incomplete_held_pastor_review");
      if(sensitive.test(String(task.note??"")))throw new Error("sensitive_value_in_pastor_review");sensitive.lastIndex=0;
      tasks.push(task);
    }
  }
  if(ids.size!==Number(summary?.candidate_pastors))throw new Error("pastor_review_task_count_mismatch");
  const pending=tasks.filter((task)=>task.decision==="pending").length;if(pending&&!allowPending)throw new Error("pastor_review_pending_tasks");
  return {metadata:{schema_version:1,mode:"official_source_curation_review",complete:pending===0,automatic_publication:false,task_count:tasks.length,ready_count:tasks.filter((task)=>task.decision==="ready").length,hold_count:tasks.filter((task)=>task.decision==="hold").length,pending_count:pending,review_sha256:sha(tasks)},tasks};
}

async function atomicJson(file,value){await mkdir(path.dirname(file),{recursive:true});const temp=`${file}.${process.pid}.tmp`;await writeFile(temp,`${JSON.stringify(value,null,2)}\n`);await rename(temp,file);}
async function main(){const args=process.argv.slice(2),arg=(name,fallback)=>{const index=args.indexOf(name);return index>=0?args[index+1]:fallback;};const inputDir=arg("--input-dir","out/pastor-source-review-batches"),summary=JSON.parse(await readFile(path.join(inputDir,"summary.json"),"utf8")),files=(await readdir(inputDir)).filter((file)=>/^batch-\d+\.json$/.test(file)).sort(),batches=await Promise.all(files.map(async(file)=>JSON.parse(await readFile(path.join(inputDir,file),"utf8")))),result=mergePastorSourceReviewBatches(summary,batches,{allowPending:args.includes("--allow-pending")});const output=arg("--output","out/pastor-history/source-review.json");await atomicJson(output,result);console.log(JSON.stringify({...result.metadata,output}));}
if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(new URL(import.meta.url).pathname))main().catch((error)=>{console.error(error.message);process.exitCode=1;});
