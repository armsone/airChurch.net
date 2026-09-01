#!/usr/bin/env node

import {createHash} from "node:crypto";
import {mkdir,readFile,rename,writeFile} from "node:fs/promises";
import path from "node:path";

const sensitive=/(?:[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|(?<!\d)01[016789][- .]?\d{3,4}[- .]?\d{4}(?!\d)|(?:계좌|account)\s*[:：]?\s*\d[\d -]{7,})/gi;
const text=(value,max)=>String(value??"").trim().slice(0,max);
const sha=(value)=>createHash("sha256").update(JSON.stringify(value)).digest("hex");
export const immutablePastorSourceTask=(task)=>({subject_id:task.subject_id,church_id:task.church_id,pastor_name:task.pastor_name,church_name:task.church_name,denomination:task.denomination,region:task.region,role_category:task.role_category,eligible_role_titles:task.eligible_role_titles,official_homepage_url:task.official_homepage_url,discovery_queries:task.discovery_queries});

export function buildPastorSourceReviewBatches(roster,churchLimit=25){
  if(roster?.metadata?.dryRun!==true||roster?.metadata?.published!==false||roster?.metadata?.fairnessPolicy!=="equal_across_role_categories"||roster?.metadata?.privacyScan?.status!=="passed")throw new Error("unsafe_pastor_roster");
  const ids=new Set(),groups=new Map();
  for(const candidate of roster.candidates??[]){
    const subjectId=text(candidate.subjectId,80),churchId=Number(candidate.churchId),identity=candidate.identity??{};
    if(!subjectId||ids.has(subjectId)||!Number.isInteger(churchId)||churchId<1||candidate.publicationEligible!==false||candidate.reviewStatus!=="needs_source_curation")throw new Error("invalid_or_duplicate_pastor_candidate");
    const task={subject_id:subjectId,church_id:churchId,pastor_name:text(identity.pastorName,80),church_name:text(identity.churchName,100),denomination:text(identity.denomination,100),region:text(identity.region,100),role_category:text(candidate.roleCategory,40),eligible_role_titles:(candidate.eligibleRoleTitles??[]).map((item)=>text(item,40)).filter(Boolean),official_homepage_url:text(candidate.officialHomepageUrl,500)||null,discovery_queries:(candidate.discoveryQueries??[]).map((item)=>({purpose:text(item.purpose,40),query:text(item.query,180),accepted_sources:(item.acceptedSources??[]).map((source)=>text(source,60))})),decision:"pending",confirmed_role_title:"",confirmed_role_status:"",official_sources:[],discovered_roles:[],reviewed_at:"",note:""};
    const publicReviewText=JSON.stringify([task.pastor_name,task.church_name,task.denomination,task.region,task.eligible_role_titles,task.discovery_queries]);
    if(!task.pastor_name||!task.church_name||!task.denomination||!task.region||sensitive.test(publicReviewText))throw new Error("unsafe_pastor_review_task");
    sensitive.lastIndex=0;ids.add(subjectId);
    const group=groups.get(churchId)??{church_id:churchId,church_name:task.church_name,tasks:[]};group.tasks.push(task);groups.set(churchId,group);
  }
  const churches=[...groups.values()].sort((a,b)=>a.church_name.localeCompare(b.church_name,"ko")||a.church_id-b.church_id),batches=[];
  for(let offset=0;offset<churches.length;offset+=churchLimit){const selected=churches.slice(offset,offset+churchLimit),tasks=selected.flatMap((church)=>church.tasks);batches.push({metadata:{schema_version:1,mode:"official_source_curation",automatic_approval:false,church_count:selected.length,task_count:tasks.length,candidate_sha256:sha(tasks.map(immutablePastorSourceTask)),privacy_scan:{status:"passed",sensitive_findings:0,raw_html_stored:false}},tasks});}
  return {summary:{candidate_pastors:ids.size,candidate_churches:churches.length,batch_count:batches.length,automatic_approval:false},batches};
}

async function atomicJson(file,value){await mkdir(path.dirname(file),{recursive:true});const temp=`${file}.${process.pid}.tmp`;await writeFile(temp,`${JSON.stringify(value,null,2)}\n`);await rename(temp,file);}
async function main(){const args=process.argv.slice(2),arg=(name,fallback)=>{const index=args.indexOf(name);return index>=0?args[index+1]:fallback;};const input=arg("--input","out/pastor-history/roster.json"),outputDir=arg("--output-dir","out/pastor-source-review-batches"),limit=Math.max(1,Math.min(50,Number(arg("--churches-per-batch","25"))||25)),result=buildPastorSourceReviewBatches(JSON.parse(await readFile(input,"utf8")),limit);for(let index=0;index<result.batches.length;index++)await atomicJson(path.join(outputDir,`batch-${String(index+1).padStart(2,"0")}.json`),result.batches[index]);await atomicJson(path.join(outputDir,"summary.json"),result.summary);console.log(JSON.stringify({...result.summary,output_dir:outputDir}));}
if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(new URL(import.meta.url).pathname))main().catch((error)=>{console.error(error.message);process.exitCode=1;});
