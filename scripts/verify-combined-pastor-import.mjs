#!/usr/bin/env node

import {createHash} from "node:crypto";
import {readFile} from "node:fs/promises";

const read=async(file)=>JSON.parse(await readFile(file,"utf8")),hash=(value)=>createHash("sha256").update(value).digest("hex");
const baselineFile="out/pastor-history/pastor-people-import-plan.json",additionalFile="out/pastor-history/collected-pastor-import-plan.json",curatedFile="data/pastor-history/curated-pastor-people.json",combinedFile="out/pastor-history/combined-pastor-import-plan.json",manifestFile="out/pastor-history/d1-import-combined/manifest.json";
const [baseline,additional,curated,combined,manifest]=await Promise.all([read(baselineFile),read(additionalFile),read(curatedFile),read(combinedFile),read(manifestFile)]),sources=[baseline,additional,curated],people=combined.people??[],roles=combined.roles??[],ids=new Set(people.map((item)=>item.directoryId));
const roleKeys=roles.map((item)=>[item.personDirectoryId,item.existingChurchId??item.directoryChurchId??item.churchName,item.roleTitle,item.roleStatus,item.startDate??"",item.endDate??""].join("|")),manifestDir=manifestFile.slice(0,manifestFile.lastIndexOf("/"));
const chunks=await Promise.all((manifest.chunks??[]).map(async(item)=>{const content=await readFile(`${manifestDir}/${item.file}`);return {hashMatches:hash(content)===item.sha256,withinBatch:Number(item.people??item.identityLinks??0)<=100};}));
const checks={
  source_plans_are_pending:sources.every((plan)=>plan.metadata?.automaticApproval===false&&Number(plan.metadata?.databaseWrites)===0&&plan.metadata?.privateDataIncluded===false),
  combined_counts_match_sources:people.length===sources.reduce((sum,plan)=>sum+Number(plan.metadata?.people??0),0)&&roles.length===sources.reduce((sum,plan)=>sum+Number(plan.metadata?.roles??0),0),
  people_are_unique:new Set(people.map((item)=>item.directoryId)).size===people.length,
  roles_are_unique:new Set(roleKeys).size===roleKeys.length,
  every_role_has_person:roles.every((item)=>ids.has(item.personDirectoryId)),
  everything_remains_pending:people.every((item)=>item.reviewStatus==="pending"&&item.photoReviewStatus==="pending")&&roles.every((item)=>item.reviewStatus==="pending"),
  no_private_fields:combined.metadata?.privateDataIncluded===false&&!JSON.stringify(combined).match(/"(?:email|phone|mobile|account|bankAccount|contact)"\s*:/i),
  photos_not_public:combined.metadata?.photosAutomaticallyPublishable===0,
  no_name_based_exclusions:combined.metadata?.nameBasedExclusions===0,
  no_name_based_linkage:!("identityLinks" in combined)&&Number(manifest.identityLinks??0)===0,
  low_load_manifest:manifest.batchSize===100&&manifest.people===people.length&&manifest.roles===roles.length&&chunks.length>0&&chunks.every((item)=>item.hashMatches&&item.withinBatch),
};
const failed=Object.entries(checks).filter(([,value])=>!value).map(([key])=>key);console.log(JSON.stringify({ok:failed.length===0,checks,failed,summary:{people:people.length,roles:roles.length,nameBasedLinks:0,photos:combined.metadata?.photosPrepared??0,chunks:chunks.length}},null,2));if(failed.length)process.exitCode=1;
