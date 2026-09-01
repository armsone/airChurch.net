#!/usr/bin/env node

import {readFile,writeFile,mkdir,rename} from "node:fs/promises";
import path from "node:path";

const axes=["pastor","church","denomination","region","role"];
const camelSource=(source)=>({type:source.type,url:source.url,recrawlDays:Number(source.recrawl_days??30),identityContribution:source.identity_contribution,identityEvidence:source.identity_evidence,assertions:(source.assertions??[]).map((item)=>({eventType:item.event_type,role:item.role,roleCategory:item.role_category,roleStatus:item.role_status,organization:item.organization,startDate:item.start_date??null,endDate:item.end_date??null,factSummary:item.fact_summary,evidenceAll:item.evidence_all,isPrimaryRole:item.is_primary_role===true}))});
export function buildPastorSourceManifest(review,roster){
  if(review?.metadata?.mode!=="official_source_curation_review"||review?.metadata?.automatic_publication!==false||roster?.metadata?.dryRun!==true||roster?.metadata?.published!==false)throw new Error("unsafe_source_manifest_input");
  const candidates=new Map((roster.candidates??[]).map((candidate)=>[candidate.subjectId,candidate])),sites=new Map(),subjects=[];
  for(const task of review.tasks??[]){
    if(task.decision!=="ready")continue;
    const candidate=candidates.get(task.subject_id);if(!candidate||candidate.churchId!==task.church_id||candidate.identity?.pastorName!==task.pastor_name||candidate.identity?.churchName!==task.church_name||candidate.identity?.denomination!==task.denomination||candidate.identity?.region!==task.region||candidate.roleCategory!==task.role_category||!candidate.eligibleRoleTitles?.includes(task.confirmed_role_title))throw new Error("pastor_review_roster_mismatch");
    const covered=new Set();
    for(const source of task.official_sources??[]){
      source.identity_contribution.forEach((axis)=>covered.add(axis));
      if((source.assertions?.length??0)>0&&!["pastor","church","role"].every((axis)=>source.identity_contribution.includes(axis)))throw new Error("assertion_source_missing_core_identity");
      const url=new URL(source.url),policy=source.site_policy,site={host:url.hostname,collectionAllowed:true,sourceTypes:[source.type],allowedPathPrefixes:policy.allowed_path_prefixes,minimumDelayMs:Math.max(1500,Number(policy.minimum_delay_ms??2500)),policyReviewedAt:policy.policy_reviewed_at,policyUrl:policy.policy_url,note:String(policy.note??"공식 공개 페이지의 사실 확인 범위만 순차 수집한다.").slice(0,200)};
      const existing=sites.get(url.hostname);if(existing){existing.sourceTypes=[...new Set([...existing.sourceTypes,...site.sourceTypes])].sort();existing.allowedPathPrefixes=[...new Set([...existing.allowedPathPrefixes,...site.allowedPathPrefixes])].sort();if(existing.policyReviewedAt!==site.policyReviewedAt||existing.policyUrl!==site.policyUrl)throw new Error("conflicting_site_policy");}else sites.set(url.hostname,site);
    }
    if(axes.some((axis)=>!covered.has(axis)))throw new Error("incomplete_five_axis_identity");
    const complementary=!task.official_sources.some((source)=>axes.every((axis)=>source.identity_contribution.includes(axis)));
    subjects.push({id:task.subject_id,churchId:task.church_id,identity:{pastorName:task.pastor_name,churchName:task.church_name,denomination:task.denomination,region:task.region},role:{category:task.role_category,title:task.confirmed_role_title,status:task.confirmed_role_status},...(complementary?{identityEvidenceMode:"complementary"}:{}),minimumIdentitySources:complementary?Math.max(2,task.official_sources.length):1,sources:task.official_sources.map(camelSource)});
  }
  return {version:1,policy:{pilotOnly:false,selectionPolicyId:roster.metadata.selectionPolicyId,minimumDelayMs:2500,defaultRecrawlDays:30},reviewMetadata:{complete:review.metadata.complete,reviewSha256:review.metadata.review_sha256,readySubjects:subjects.length,automaticPublication:false},sites:[...sites.values()].sort((a,b)=>a.host.localeCompare(b.host)),subjects:subjects.sort((a,b)=>a.id.localeCompare(b.id))};
}

async function atomicJson(file,value){await mkdir(path.dirname(file),{recursive:true});const temp=`${file}.${process.pid}.tmp`;await writeFile(temp,`${JSON.stringify(value,null,2)}\n`);await rename(temp,file);}
async function main(){const args=process.argv.slice(2),arg=(name,fallback)=>{const index=args.indexOf(name);return index>=0?args[index+1]:fallback;};const review=JSON.parse(await readFile(arg("--review","out/pastor-history/source-review.json"),"utf8")),roster=JSON.parse(await readFile(arg("--roster","out/pastor-history/roster.json"),"utf8")),output=arg("--output","out/pastor-history/curated-sources.json"),manifest=buildPastorSourceManifest(review,roster);if(!review.metadata.complete&&!args.includes("--allow-partial"))throw new Error("pastor_source_review_incomplete");await atomicJson(output,manifest);console.log(JSON.stringify({subjects:manifest.subjects.length,sites:manifest.sites.length,complete:review.metadata.complete,output}));}
if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(new URL(import.meta.url).pathname))main().catch((error)=>{console.error(error.message);process.exitCode=1;});
