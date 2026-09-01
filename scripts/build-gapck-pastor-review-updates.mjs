#!/usr/bin/env node

import {readFile,readdir,writeFile} from "node:fs/promises";
import path from "node:path";

const policy={collection_allowed:true,allowed_path_prefixes:["/api/v1/","/customer-support","/presbytery","/history"],minimum_delay_ms:2500,policy_reviewed_at:"2026-09-01",policy_url:"https://gapck.org/robots.txt",note:"일반 봇에 허용된 총회 공개 명부만 확인하고 /code-admin은 접근하지 않는다."};
const source=(url,contribution,evidence,assertions=[])=>({type:"official_denomination",url,recrawl_days:90,identity_contribution:contribution,identity_evidence:evidence,assertions,site_policy:structuredClone(policy)});
export function buildGapckPastorReviewUpdate(task,review){
  if(task?.decision!=="pending"||task.denomination!=="대한예수교장로회 합동"||task.role_category!=="current_primary"||review?.decision!=="ready"||!review.reviewed_at||String(review.note??"").length<10)throw new Error("invalid_gapck_review_input");
  const region=task.region.split(/\s+/).filter(Boolean),churchQuery=encodeURIComponent(task.church_name),pastorQuery=encodeURIComponent(task.pastor_name),base={subject_id:task.subject_id,church_id:task.church_id,pastor_name:task.pastor_name,church_name:task.church_name,denomination:task.denomination,region:task.region,role_category:task.role_category};
  const event={event_type:"position",role:"담임목사",role_category:"current_primary",role_status:"current",organization:task.church_name,start_date:null,end_date:null,fact_summary:`${task.church_name} 공식 교단 명부가 ${task.pastor_name}을 담임교역자로 연결한다.`,evidence_all:[task.pastor_name,task.church_name,"pastor"],is_primary_role:true};
  return {...base,decision:"ready",reviewed_at:review.reviewed_at,note:review.note,confirmed_role_title:"담임목사",confirmed_role_status:"current",discovered_roles:[],official_sources:[
    source(`https://gapck.org/api/v1/eMBER_USER_HOMEPAGE_LIST?skip=0&limit=10&sort=15&search_type=minister&mber_nm=${pastorQuery}`,["pastor","church","region"],{pastor:[task.pastor_name],church:[task.church_name],region}),
    source(`https://gapck.org/api/v1/eORG_USER_HOMEPAGE_CHURCH_LIST?skip=0&limit=10&sort=1&org_nm=${churchQuery}`,["pastor","church","region","role"],{pastor:[task.pastor_name],church:[task.church_name],region,role:["pastor"]},[event]),
    source("https://gapck.org/history?cat=ideology",["denomination"],{denomination:["대한예수교장로회총회"]}),
  ]};
}

async function main(){const args=process.argv.slice(2),value=(name,fallback)=>{const index=args.indexOf(name);return index>=0?args[index+1]:fallback;},input=value("--input",null),output=value("--output","out/gapck-pastor-review-updates.json"),batchDir=value("--batch-dir","out/pastor-source-review-batches");if(!input)throw new Error("--input is required");const reviews=JSON.parse(await readFile(input,"utf8")),files=(await readdir(batchDir)).filter((file)=>/^batch-\d+\.json$/.test(file)),tasks=(await Promise.all(files.map(async(file)=>(JSON.parse(await readFile(path.join(batchDir,file),"utf8"))).tasks??[]))).flat(),byId=new Map(tasks.map((task)=>[task.subject_id,task])),updates=reviews.map((review)=>buildGapckPastorReviewUpdate(byId.get(review.subject_id),review));await writeFile(output,`${JSON.stringify(updates,null,2)}\n`);console.log(JSON.stringify({updates:updates.length,output}));}
if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(new URL(import.meta.url).pathname))main().catch((error)=>{console.error(error.message);process.exitCode=1;});
