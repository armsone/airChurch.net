#!/usr/bin/env node

import {mkdir,readFile,readdir,rename,writeFile} from "node:fs/promises";
import path from "node:path";
import {parseRobots,USER_AGENT} from "./pastor-history-core.mjs";

const normalized=(value)=>String(value??"").toLowerCase().replace(/[^\p{L}\p{N}]/gu,"");
const regionMatches=(address,region)=>region.split(/\s+/).filter(Boolean).every((part)=>normalized(address).includes(normalized(part)));
export function selectGapckTasks(tasks,excludedSubjectIds,limit){return tasks.filter((task)=>task.decision==="pending"&&task.denomination==="대한예수교장로회 합동"&&task.role_category==="current_primary"&&!excludedSubjectIds.has(task.subject_id)).slice(0,limit);}
export function classifyGapckCandidate(task,churchPayload,ministerPayload){
  const churchRows=(churchPayload?.list??[]).filter((row)=>normalized(row.org_nm)===normalized(task.church_name)&&normalized(row.pastor)===normalized(task.pastor_name)&&regionMatches(row.adrs,task.region));
  const ministerRows=(ministerPayload?.list??[]).filter((row)=>normalized(row.mber_nm)===normalized(task.pastor_name)&&normalized(row.ch_nm)===normalized(task.church_name)&&regionMatches(row.ch_adrs,task.region));
  const status=churchRows.length===1&&ministerRows.length===1?"ready_candidate":churchRows.length||ministerRows.length?"ambiguous":"not_found";
  return {subject_id:task.subject_id,pastor_name:task.pastor_name,church_name:task.church_name,denomination:task.denomination,region:task.region,status,church_exact_matches:churchRows.length,minister_exact_matches:ministerRows.length,requires_human_review:true,automatic_approval:false};
}

const sleep=(ms)=>new Promise((resolve)=>setTimeout(resolve,ms));
async function getJson(url){const response=await fetch(url,{headers:{"user-agent":USER_AGENT,"accept":"application/json"},signal:AbortSignal.timeout(15_000)});if(!response.ok)throw new Error(`gapck_http_${response.status}`);const type=response.headers.get("content-type")??"";if(!/application\/json/i.test(type))throw new Error("gapck_not_json");return response.json();}
async function atomicJson(file,value){await mkdir(path.dirname(file),{recursive:true});const temporary=`${file}.${process.pid}.tmp`;await writeFile(temporary,`${JSON.stringify(value,null,2)}\n`);await rename(temporary,file);}
async function main(){const args=process.argv.slice(2),value=(name,fallback)=>{const index=args.indexOf(name);return index>=0?args[index+1]:fallback;},values=(name)=>args.flatMap((arg,index)=>arg===name&&args[index+1]?[args[index+1]]:[]),batchDir=value("--batch-dir","out/pastor-source-review-batches"),output=value("--output","out/gapck-pastor-review-candidates.json"),limit=Math.min(25,Math.max(1,Number(value("--limit","10"))||10)),files=(await readdir(batchDir)).filter((file)=>/^batch-\d+\.json$/.test(file)).sort(),allTasks=(await Promise.all(files.map(async(file)=>(JSON.parse(await readFile(path.join(batchDir,file),"utf8"))).tasks??[]))).flat(),excludedSubjectIds=new Set();
  for(const excludeFile of values("--exclude-output")){const prior=JSON.parse(await readFile(excludeFile,"utf8"));for(const item of prior.items??[])excludedSubjectIds.add(item.subject_id);}
  const tasks=selectGapckTasks(allTasks,excludedSubjectIds,limit);
  const robotsResponse=await fetch("https://gapck.org/robots.txt",{headers:{"user-agent":USER_AGENT},signal:AbortSignal.timeout(15_000)}),robots=parseRobots(robotsResponse.ok?await robotsResponse.text():"",USER_AGENT),items=[];
  for(const task of tasks){const churchUrl=`https://gapck.org/api/v1/eORG_USER_HOMEPAGE_CHURCH_LIST?skip=0&limit=10&sort=1&org_nm=${encodeURIComponent(task.church_name)}`,ministerUrl=`https://gapck.org/api/v1/eMBER_USER_HOMEPAGE_LIST?skip=0&limit=10&sort=15&search_type=minister&mber_nm=${encodeURIComponent(task.pastor_name)}`;if(!robots.isAllowed(churchUrl)||!robots.isAllowed(ministerUrl))throw new Error("gapck_robots_disallowed");try{const church=await getJson(churchUrl);await sleep(2500);const minister=await getJson(ministerUrl);items.push({...classifyGapckCandidate(task,church,minister),official_source_urls:[churchUrl,ministerUrl]});}catch(error){items.push({subject_id:task.subject_id,pastor_name:task.pastor_name,church_name:task.church_name,status:"collection_error",error:String(error?.message??error).slice(0,120),requires_human_review:true,automatic_approval:false});}await sleep(2500);}
  const result={version:1,metadata:{generated_at:new Date().toISOString(),mode:"official_gapck_discovery",subjects:items.length,excluded_subjects:excludedSubjectIds.size,database_writes:0,published:false,automatic_approval:false,minimum_delay_ms:2500,raw_responses_stored:false,contact_values_stored:false},summary:Object.fromEntries(["ready_candidate","ambiguous","not_found","collection_error"].map((status)=>[status,items.filter((item)=>item.status===status).length])),items};await atomicJson(output,result);console.log(JSON.stringify(result.summary));}
if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(new URL(import.meta.url).pathname))main().catch((error)=>{console.error(error.message);process.exitCode=1;});
