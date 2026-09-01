#!/usr/bin/env node

import {mkdir,readFile,readdir,rename,writeFile} from "node:fs/promises";
import path from "node:path";

const identityKeys=["subject_id","church_id","pastor_name","church_name","denomination","region","role_category"];
const reviewKeys=["decision","official_sources","discovered_roles","reviewed_at","note","confirmed_role_title","confirmed_role_status"];
export function applyPastorSourceReviewUpdates(batches,updates){
  const changed=new Set();let applied=0,alreadyApplied=0;
  for(const update of updates){
    if(!["ready","hold"].includes(update?.decision)||!update.subject_id||!update.reviewed_at||String(update.note??"").length<10)throw new Error("invalid_review_update");
    const matches=[];for(const [file,batch] of batches)for(const task of batch.tasks??[])if(task.subject_id===update.subject_id)matches.push({file,task});
    if(matches.length!==1)throw new Error(`review_subject_match_count:${update.subject_id}:${matches.length}`);
    const {file,task}=matches[0];
    if(identityKeys.some((key)=>update[key]!==task[key]))throw new Error(`review_identity_mismatch:${update.subject_id}`);
    if(update.decision==="ready"&&(!(update.official_sources?.length)||!task.eligible_role_titles?.includes(update.confirmed_role_title)||!update.confirmed_role_status))throw new Error(`invalid_ready_update:${update.subject_id}`);
    const next=Object.fromEntries(reviewKeys.filter((key)=>key in update).map((key)=>[key,update[key]]));
    if(task.decision!=="pending"){
      if(reviewKeys.every((key)=>!(key in next)||JSON.stringify(task[key])===JSON.stringify(next[key])))alreadyApplied++;
      else throw new Error(`review_update_conflict:${update.subject_id}`);
      continue;
    }
    Object.assign(task,next);changed.add(file);applied++;
  }
  return {changed:[...changed],applied,alreadyApplied};
}

async function atomicJson(file,value){await mkdir(path.dirname(file),{recursive:true});const temp=`${file}.${process.pid}.tmp`;await writeFile(temp,`${JSON.stringify(value,null,2)}\n`);await rename(temp,file);}
async function main(){const args=process.argv.slice(2),value=(name,fallback)=>{const index=args.indexOf(name);return index>=0?args[index+1]:fallback;},input=value("--input",null),batchDir=value("--batch-dir","out/pastor-source-review-batches");if(!input)throw new Error("--input is required");const updates=JSON.parse(await readFile(input,"utf8")),files=(await readdir(batchDir)).filter((file)=>/^batch-\d+\.json$/.test(file)).sort(),batches=new Map(await Promise.all(files.map(async(file)=>[file,JSON.parse(await readFile(path.join(batchDir,file),"utf8"))]))),result=applyPastorSourceReviewUpdates(batches,Array.isArray(updates)?updates:[updates]);for(const file of result.changed)await atomicJson(path.join(batchDir,file),batches.get(file));console.log(JSON.stringify({...result,changed_batches:result.changed.length}));}
if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(new URL(import.meta.url).pathname))main().catch((error)=>{console.error(error.message);process.exitCode=1;});
