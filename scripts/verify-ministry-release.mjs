#!/usr/bin/env node
import {createHash} from "node:crypto";
import {readFile} from "node:fs/promises";

const read=async(path)=>JSON.parse(await readFile(path,"utf8"));
const text=async(path)=>readFile(path,"utf8");
const [roster,policy,worship,report,churchPage,pastorPage,suggestionRoute,importRoute]=await Promise.all([
  read("data/pastor-history/nationwide-roster-report.json"),read("data/pastor-history/selection-policy.json"),read("data/worship-schedules/pilot-approved-import-plan.json"),read("data/worship-schedules/all-report.json"),text("app/church/[id]/page.tsx"),text("app/pastors/[id]/page.tsx"),text("app/api/ministry-suggestions/route.ts"),text("app/api/admin/church-details/import/route.ts"),
]);
const checks={
  population_complete:roster.input_approved_churches===1782&&report.registered_churches===1782&&report.attempted_churches===1782,
  equal_priority:roster.equal_priority_verified===true&&report.fairness?.equal_priority===true&&report.fairness?.all_included===true,
  missing_homepage_not_excluded:roster.candidates_without_homepage>1000&&report.fairness?.missing_information_penalty===false&&report.fairness?.coverage_states?.information_tip_pending===1152,
  official_source_policy:policy.minimumOfficialIdentitySources===1&&suggestionRoute.includes("개인 SNS 대신 교회·교단·노회의 공식 공개 페이지"),
  ambiguity_requires_second_source:(await text("scripts/pastor-history-core.mjs")).includes("ambiguous?Math.max(2"),
  no_auto_publish:roster.automatic_publication===false&&worship.metadata?.requires_separate_apply_authorization===true,
  approval_digest_verified:worship.metadata?.approvalVerified===true&&createHash("sha256").update(JSON.stringify(worship.operations)).digest("hex")===worship.metadata?.sha256,
  privacy_passed:roster.public_contact_fields===0&&roster.sensitive_findings===0&&worship.metadata?.privacyScan?.status==="passed",
  copyright_excerpt_only:worship.operations.every((item)=>!item.values?.source_text||item.values.source_text.length<=1000)&&!JSON.stringify(worship).includes("raw_html"),
  duplicate_free:new Set(worship.operations.map((item)=>item.key)).size===worship.operations.length,
  approved_only_queries:churchPage.includes("church_ministry_profiles WHERE church_id=? AND review_status='approved'")&&pastorPage.includes("church_ministry_profiles WHERE id=? AND church_id=? AND review_status='approved'"),
  bounded_low_load:importRoute.includes("operations.length>100")&&importRoute.includes("offset+=50")&&churchPage.includes("LIMIT 80"),
  operating_db_writes_before_authorization:roster.operating_database_writes===0,
};
const failed=Object.entries(checks).filter(([,passed])=>!passed).map(([name])=>name);
console.log(JSON.stringify({ok:failed.length===0,checks,failed,summary:{approved_churches:roster.input_approved_churches,pastor_candidates:roster.pastor_candidates,worship_operations:worship.operations.length,http_warnings:roster.http_source_warnings}},null,2));
if(failed.length)process.exitCode=1;
