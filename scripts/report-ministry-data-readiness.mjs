#!/usr/bin/env node

import {createHash} from "node:crypto";
import {readFile} from "node:fs/promises";
import path from "node:path";

const official=(value)=>{try{return ["http:","https:"].includes(new URL(String(value)).protocol);}catch{return false;}};
const digest=(operations)=>createHash("sha256").update(JSON.stringify(operations)).digest("hex");
const uniqueChurches=(operations,action)=>new Set(operations.filter((item)=>item.action===action).map((item)=>Number(item.values?.church_id)).filter((id)=>id>0)).size;
const sensitive=JSON.stringify;

export function buildMinistryDataReadiness({worshipReport,worshipCollection,approvedWorshipPlan,pastorRoster,pastorCollected=null,approvedPastorPlan=null}){
  const worshipOps=approvedWorshipPlan?.operations??[],pastorOps=approvedPastorPlan?.operations??[];
  const publicPayload=sensitive([...worshipOps,...pastorOps]);
  const sensitiveFindings=[...(publicPayload.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)??[]),...(publicPayload.match(/(?<!\d)01[016789][- .]?\d{3,4}[- .]?\d{4}(?!\d)/g)??[])];
  const sourceOps=[...worshipOps,...pastorOps].filter((item)=>item.values?.source_url);
  const worshipAttemptComplete=worshipReport?.complete===true&&worshipReport.attempted_churches===worshipReport.registered_churches;
  const pastorCandidates=pastorRoster?.candidates?.length??0,roleQueue=pastorRoster?.roleDiscoveryQueue?.length??0;
  const collectionIsDry=Boolean(pastorCollected?.metadata?.dryRun===true&&pastorCollected?.metadata?.published===false);
  const collectionMode=pastorCollected?.metadata?.selectionMode??null;
  const pastorCollectionPresent=collectionIsDry&&collectionMode==="approved_church_roster";
  const collectedSubjects=Array.isArray(pastorCollected?.subjects)?pastorCollected.subjects:[];
  const allPastorEvents=Array.isArray(pastorCollected?.events)?pastorCollected.events.length:Array.isArray(pastorCollected?.records)?pastorCollected.records.length:collectedSubjects.reduce((total,subject)=>total+(subject.events?.length??0),0);
  const pilotVerifiedPastors=collectionIsDry&&collectionMode==="official_sample_pilot"?collectedSubjects.filter((subject)=>subject.identityStatus==="verified").length:0;
  const pastorEvents=pastorCollectionPresent?allPastorEvents:0;
  const checks={
    nationwide_worship_attempt_complete:worshipAttemptComplete,
    worship_collection_has_no_errors:(worshipReport?.collection_errors??-1)===0,
    roster_is_dry_run:pastorRoster?.metadata?.dryRun===true&&pastorRoster?.metadata?.published===false,
    pastor_candidates_prepared:pastorCandidates>0&&roleQueue>0,
    pastor_official_collection_received:pastorCollectionPresent,
    public_plans_have_no_sensitive_values:sensitiveFindings.length===0,
    operation_sources_are_official_http:sourceOps.every((item)=>official(item.values.source_url)),
    operation_digests_match:[approvedWorshipPlan,approvedPastorPlan].filter(Boolean).every((plan)=>digest(plan.operations??[])===plan.metadata?.sha256),
    separate_apply_authorization:[approvedWorshipPlan,approvedPastorPlan].filter(Boolean).every((plan)=>plan.metadata?.requires_separate_apply_authorization===true),
    no_automatic_publication:worshipReport?.automatic_publication===false&&pastorRoster?.metadata?.published===false,
  };
  const blocking=[];
  if(!worshipAttemptComplete)blocking.push("nationwide_worship_collection_incomplete");
  if(!pastorCollectionPresent)blocking.push("pastor_official_collection_not_received");
  if(pastorCollectionPresent&&!approvedPastorPlan)blocking.push("pastor_human_approval_plan_missing");
  if(Object.entries(checks).some(([name,passed])=>!passed&&name!=="pastor_official_collection_received"))blocking.push("safety_or_integrity_check_failed");
  const scheduleOps=worshipOps.filter((item)=>item.action==="upsert_reviewed_worship_schedule").length;
  return {
    version:1,
    status:blocking.length?"in_progress":"release_ready",
    checks,
    coverage:{registered_churches:worshipReport?.registered_churches??0,worship_collection_attempted:worshipReport?.attempted_churches??0,worship_candidate_churches:worshipReport?.churches_with_schedule_candidates??0,approved_worship_operations:scheduleOps,approved_worship_churches:uniqueChurches(worshipOps,"upsert_reviewed_worship_schedule"),pastor_candidates:pastorCandidates,pastor_role_discovery_tasks:roleQueue,pilot_verified_pastors:pilotVerifiedPastors,pilot_verified_events:pilotVerifiedPastors?allPastorEvents:0,verified_pastor_events:pastorEvents,approved_pastor_profiles:pastorOps.filter((item)=>item.action==="upsert_reviewed_ministry_profile").length,approved_ministry_appearances:pastorOps.filter((item)=>item.action==="upsert_reviewed_ministry_appearance").length},
    holds:{worship_collection_holds:worshipReport?.collection_holds??0,worship_missing_homepage:worshipReport?.hold_reasons?.missing_homepage??0,pastor_roster_holds:pastorRoster?.holds?.length??0},
    blocking,
  };
}

async function optionalJson(file){try{return JSON.parse(await readFile(file,"utf8"));}catch(error){if(error?.code==="ENOENT")return null;throw error;}}
async function main(){
  const args=process.argv.slice(2),arg=(name,fallback)=>{const index=args.indexOf(name);return index>=0?args[index+1]:fallback;};
  const report=buildMinistryDataReadiness({
    worshipReport:await optionalJson(arg("--worship-report","data/worship-schedules/all-report.json")),
    worshipCollection:await optionalJson(arg("--worship-collection","data/worship-schedules/all-output.json")),
    approvedWorshipPlan:await optionalJson(arg("--approved-worship-plan","data/worship-schedules/pilot-approved-import-plan.json")),
    pastorRoster:await optionalJson(arg("--pastor-roster","out/pastor-history/roster.json")),
    pastorCollected:await optionalJson(arg("--pastor-collected","out/pastor-history/collected.json")),
    approvedPastorPlan:await optionalJson(arg("--approved-pastor-plan","out/pastor-history/import-plan.json")),
  });
  console.log(JSON.stringify(report,null,2));
  if(args.includes("--require-release-ready")&&report.status!=="release_ready")process.exitCode=2;
}
if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(new URL(import.meta.url).pathname))main().catch((error)=>{console.error(error.message);process.exitCode=1;});
