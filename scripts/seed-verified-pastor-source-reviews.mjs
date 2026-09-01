#!/usr/bin/env node

import {mkdir,readFile,readdir,rename,writeFile} from "node:fs/promises";
import path from "node:path";

const allAxes=["pastor","church","denomination","region","role"];
const snakeAssertion=(item)=>({event_type:item.eventType,role:item.role,role_category:item.roleCategory,role_status:item.roleStatus,organization:item.organization,start_date:item.startDate??null,end_date:item.endDate??null,fact_summary:item.factSummary,evidence_all:item.evidenceAll,is_primary_role:item.isPrimaryRole===true});
export function verifiedPilotReviewUpdates(manifest,collected){
  if(manifest?.policy?.pilotOnly!==true||collected?.metadata?.selectionMode!=="official_sample_pilot"||collected?.metadata?.dryRun!==true||collected?.metadata?.published!==false)throw new Error("unsafe_verified_pilot_seed");
  const results=new Map((collected.subjects??[]).map((item)=>[item.subjectId,item])),sites=new Map((manifest.sites??[]).map((site)=>[site.host,site])),updates=[];
  for(const subject of manifest.subjects??[]){
    const result=results.get(subject.id);if(result?.identityStatus!=="verified"||(result.holds??[]).length)continue;
    const officialSources=(subject.sources??[]).map((source)=>{const url=new URL(source.url),site=sites.get(url.hostname);if(!site?.collectionAllowed)throw new Error("verified_seed_site_policy_missing");return {type:source.type,url:source.url,recrawl_days:source.recrawlDays??manifest.policy.defaultRecrawlDays??30,identity_contribution:source.identityContribution??allAxes,identity_evidence:source.identityEvidence,assertions:(source.assertions??[]).map(snakeAssertion),site_policy:{collection_allowed:true,allowed_path_prefixes:site.allowedPathPrefixes,minimum_delay_ms:site.minimumDelayMs,policy_reviewed_at:site.policyReviewedAt,policy_url:site.policyUrl,note:site.note}};});
    updates.push({match:{pastor_name:subject.identity.pastorName,church_name:subject.identity.churchName,denomination:subject.identity.denomination},confirmed_role_title:subject.role.title,confirmed_role_status:subject.role.status,decision:"ready",official_sources:officialSources,reviewed_at:collected.metadata.generatedAt,note:"공식 파일럿 수집에서 다섯 식별축과 출처 사실을 재검증함."});
  }
  return updates;
}

async function atomicJson(file,value){await mkdir(path.dirname(file),{recursive:true});const temp=`${file}.${process.pid}.tmp`;await writeFile(temp,`${JSON.stringify(value,null,2)}\n`);await rename(temp,file);}
async function main(){const args=process.argv.slice(2),arg=(name,fallback)=>{const index=args.indexOf(name);return index>=0?args[index+1]:fallback;};const manifest=JSON.parse(await readFile(arg("--manifest","data/pastor-history/sample-sources.json"),"utf8")),collected=JSON.parse(await readFile(arg("--collected","out/pastor-history/collected.json"),"utf8")),batchDir=arg("--batch-dir","out/pastor-source-review-batches"),updates=verifiedPilotReviewUpdates(manifest,collected),files=(await readdir(batchDir)).filter((file)=>/^batch-\d+\.json$/.test(file)).sort();let applied=0;
  for(const file of files){const location=path.join(batchDir,file),batch=JSON.parse(await readFile(location,"utf8"));let changed=false;for(const task of batch.tasks??[]){const update=updates.find((item)=>Object.entries(item.match).every(([key,value])=>task[key]===value));if(!update||task.decision!=="pending")continue;Object.assign(task,Object.fromEntries(Object.entries(update).filter(([key])=>key!=="match")));changed=true;applied++;}if(changed)await atomicJson(location,batch);}
  if(applied!==updates.length)throw new Error(`verified_seed_match_count:${applied}/${updates.length}`);console.log(JSON.stringify({verified_updates:updates.length,applied,batch_dir:batchDir}));}
if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(new URL(import.meta.url).pathname))main().catch((error)=>{console.error(error.message);process.exitCode=1;});
