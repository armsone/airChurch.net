#!/usr/bin/env node

import {createHash} from "node:crypto";
import {readFile} from "node:fs/promises";

const args=process.argv.slice(2);
const argument=(name,fallback)=>{const index=args.indexOf(name);return index>=0?args[index+1]:fallback;};
const readJson=async(file)=>JSON.parse(await readFile(file,"utf8"));
const sha256=(value)=>createHash("sha256").update(value).digest("hex");
const isHttp=(value)=>{try{return ["http:","https:"].includes(new URL(String(value)).protocol);}catch{return false;}};
const sensitivePattern=/(?:[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|(?<!\d)01[016789][- .]?\d{3,4}[- .]?\d{4}(?!\d)|(?:계좌|account)\s*[:：]?\s*\d{6,})/gi;
const privateKeys=new Set(["email","mail","phone","mobile","telephone","account","accountNumber","bankAccount","contact"]);
const findPrivateKeys=(value,path="$",found=[])=>{if(Array.isArray(value)){value.forEach((item,index)=>findPrivateKeys(item,`${path}[${index}]`,found));return found;}if(!value||typeof value!=="object")return found;for(const [key,item] of Object.entries(value)){if(privateKeys.has(key))found.push(`${path}.${key}`);findPrivateKeys(item,`${path}.${key}`,found);}return found;};
const collectNonUrlText=(value,found=[])=>{if(typeof value==="string"){if(!isHttp(value))found.push(value);return found;}if(Array.isArray(value)){value.forEach((item)=>collectNonUrlText(item,found));return found;}if(value&&typeof value==="object")Object.values(value).forEach((item)=>collectNonUrlText(item,found));return found;};

const collectionFile=argument("--pastors","out/pastor-history/national-collection-v2/candidates.json");
const photoFile=argument("--photos","out/pastor-history/national-collection-v2/photos-strict/photos.json");
const importPlanFile=argument("--import-plan","out/pastor-history/collected-pastor-import-plan.json");
const manifestFile=argument("--manifest","out/pastor-history/d1-import-collected/manifest.json");
const worshipReportFile=argument("--worship-report","data/worship-schedules/all-report.json");
const worshipReviewSummaryFile=argument("--worship-review-summary","out/worship-review-batches/summary.json");
const worshipReviewsFile=argument("--worship-reviews","out/worship-reviews.merged.json");

const [collection,photoBundle,importPlan,manifest,worshipReport,worshipReviewSummary,worshipReviews]=await Promise.all([
  readJson(collectionFile),readJson(photoFile),readJson(importPlanFile),readJson(manifestFile),readJson(worshipReportFile),readJson(worshipReviewSummaryFile),readJson(worshipReviewsFile),
]);
const people=collection.people??[],roles=collection.ministryRelationships??[];
const peopleIds=new Set(people.map((person)=>person.directoryPersonId));
const suppliedPhotos=photoBundle.photos??[],photos=suppliedPhotos.filter((photo)=>peopleIds.has(photo.directoryPersonId));
const roleKeys=roles.map((role)=>[role.directoryPersonId,role.directoryChurchId,role.roleTitle,role.roleStatus,role.sourceUrl].join("|"));
const photoIds=photos.map((photo)=>photo.directoryPersonId);
const importPeople=importPlan.people??[],importRoles=importPlan.roles??[];
const worshipReviewRows=worshipReviews.reviews??[],worshipReviewIds=worshipReviewRows.map((item)=>item.record_id);
const serializedPublicText=collectNonUrlText({people,roles,photos,importPeople,importRoles}).join("\n");
const chunkDir=manifestFile.slice(0,manifestFile.lastIndexOf("/"));
const chunkChecks=await Promise.all((manifest.chunks??[]).map(async(chunk)=>{
  const content=await readFile(`${chunkDir}/${chunk.file}`,"utf8");
  return {file:chunk.file,hashMatches:sha256(content)===chunk.sha256,withinBatch:Number(chunk.people??chunk.identityLinks??0)<=Number(manifest.batchSize??100),bytes:Buffer.byteLength(content)};
}));

const checks={
  worship_collection_complete:worshipReport.complete===true&&worshipReport.registered_churches===worshipReport.attempted_churches&&Number(worshipReport.collection_errors??0)===0,
  worship_review_queue_complete:Number(worshipReviewSummary.candidate_records??-1)===Number(worshipReport.schedule_candidates_pending_review??0)+Number(worshipReport.profile_candidates_pending_review??0)&&worshipReviewRows.length===Number(worshipReviewSummary.candidate_records??-1),
  worship_review_queue_duplicate_free:new Set(worshipReviewIds).size===worshipReviewIds.length&&Number(worshipReviewSummary.duplicate_candidates??-1)===0,
  worship_review_is_manual_and_batched:worshipReviewSummary.automatic_approval===false&&worshipReviews.metadata?.automatic_publication===false&&Number(worshipReviewSummary.batch_count??0)>0&&Number(worshipReviewSummary.batch_count)<=20,
  people_preserved:people.length>0,
  every_role_has_person:roles.every((role)=>peopleIds.has(role.directoryPersonId)),
  official_role_sources_present:roles.every((role)=>isHttp(role.sourceUrl)),
  exact_role_duplicates_absent:new Set(roleKeys).size===roleKeys.length,
  private_fields_absent:findPrivateKeys({people,roles,photos}).length===0,
  sensitive_values_absent:(serializedPublicText.match(sensitivePattern)??[]).length===0,
  photos_are_optional:photos.length<=people.length&&Number(photoBundle.metadata?.missingPhotos??0)>=0,
  photo_people_are_known:photoIds.every((id)=>peopleIds.has(id)),
  photo_duplicates_absent:new Set(photoIds).size===photoIds.length,
  photo_sources_and_hashes_complete:photos.every((photo)=>isHttp(photo.imageUrl)&&isHttp(photo.sourcePageUrl)&&/^[a-f0-9]{64}$/.test(photo.imageSha256??"")&&photo.identityUse==="official_labeled_photo_evidence"),
  no_name_based_linkage:!("identityLinks" in importPlan)&&Number(importPlan.metadata?.nameBasedExclusions??-1)===0,
  photos_not_auto_publishable:Number(importPlan.metadata?.photosAutomaticallyPublishable??0)===0,
  import_plan_matches_collection:importPeople.length===people.length&&importRoles.length===roles.length,
  people_and_roles_pending:importPeople.every((person)=>person.reviewStatus==="pending")&&importRoles.every((role)=>role.reviewStatus==="pending"),
  no_automatic_approval:importPlan.metadata?.automaticApproval===false&&manifest.automaticApproval===false,
  no_operating_writes:Number(importPlan.metadata?.databaseWrites??-1)===0&&manifest.writeStatus==="pending",
  low_load_chunks:Number(manifest.batchSize??0)>0&&Number(manifest.batchSize)<=200&&(manifest.chunks??[]).length>0&&chunkChecks.every((chunk)=>chunk.hashMatches&&chunk.withinBatch),
};
const failed=Object.entries(checks).filter(([,passed])=>!passed).map(([name])=>name);
console.log(JSON.stringify({ok:failed.length===0,checks,failed,summary:{people:people.length,roles:roles.length,photos:photos.length,ignoredStalePhotos:suppliedPhotos.length-photos.length,missingPhotos:people.length-photos.length,nameBasedLinks:0,worshipChurches:Number(worshipReport.registered_churches??0),worshipReviewCandidates:worshipReviewRows.length,worshipReviewBatches:Number(worshipReviewSummary.batch_count??0),chunks:chunkChecks.length,maxChunkBytes:Math.max(0,...chunkChecks.map((chunk)=>chunk.bytes))},artifacts:{collectionFile,photoFile,importPlanFile,manifestFile,worshipReportFile,worshipReviewSummaryFile,worshipReviewsFile}},null,2));
if(failed.length)process.exitCode=1;
