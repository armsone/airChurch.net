#!/usr/bin/env node
import {createHash} from "node:crypto";
import {execFileSync} from "node:child_process";
import {readFile} from "node:fs/promises";

const read=async(path)=>JSON.parse(await readFile(path,"utf8"));
const text=async(path)=>readFile(path,"utf8");
const [roster,policy,worship,report,churchPage,pastorPage,attribution,suggestionRoute,importRoute,dryRunImporter,searchPage,syncRoute,coverageReport,manageRoute,signupRoute,...mediaRoutes]=await Promise.all([
  read("data/pastor-history/nationwide-roster-report.json"),read("data/pastor-history/selection-policy.json"),read("data/worship-schedules/pilot-approved-import-plan.json"),read("data/worship-schedules/all-report.json"),text("app/church/[id]/page.tsx"),text("app/pastors/[id]/page.tsx"),text("app/pastor-sermon-attribution.ts"),text("app/api/ministry-suggestions/route.ts"),text("app/api/admin/church-details/import/route.ts"),text("scripts/dry-run-pastor-history-import.mjs"),text("app/search/page.tsx"),text("app/api/sermons/sync/route.ts"),text("scripts/report-pastor-media-coverage.mjs"),text("app/api/admin/manage/route.ts"),text("app/api/reviewer-signup/route.ts"),text("app/api/sermons/route.ts"),text("app/api/praises/route.ts"),text("app/api/shorts/route.ts"),
]);
const publicOperations=JSON.stringify(worship.operations);
const privateContactArtifact="data/worship-schedules/all-contact-candidates.review.json";
const privateContactArtifactIgnored=(()=>{try{return execFileSync("git",["check-ignore",privateContactArtifact],{encoding:"utf8"}).trim()===privateContactArtifact;}catch{return false;}})();
const publicSensitiveValueFindings=[
  ...(publicOperations.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)??[]),
  ...(publicOperations.match(/(?<!\d)01[016789][- .]?\d{3,4}[- .]?\d{4}(?!\d)/g)??[]),
  ...(publicOperations.match(/(?<!\d)\d{2,6}[- ]\d{2,6}[- ]\d{2,6}[- ]\d{1,6}(?!\d)/g)??[]),
];
const checks={
  population_complete:roster.input_approved_churches===1782&&report.registered_churches===1782&&report.attempted_churches===1782,
  equal_priority:roster.equal_priority_verified===true&&report.fairness?.equal_priority===true&&report.fairness?.all_included===true,
  missing_homepage_not_excluded:roster.candidates_without_homepage>1000&&report.fairness?.missing_information_penalty===false&&report.fairness?.coverage_states?.information_tip_pending===1152,
  official_source_policy:policy.minimumOfficialIdentitySources===1&&suggestionRoute.includes("개인 SNS 대신 교회·교단·노회의 공식 공개 페이지"),
  ambiguity_requires_second_source:(await text("scripts/pastor-history-core.mjs")).includes("ambiguous?Math.max(2"),
  no_auto_publish:roster.automatic_publication===false&&worship.metadata?.requires_separate_apply_authorization===true,
  approval_digest_verified:worship.metadata?.approvalVerified===true&&createHash("sha256").update(JSON.stringify(worship.operations)).digest("hex")===worship.metadata?.sha256,
  privacy_passed:roster.public_contact_fields===0&&roster.sensitive_findings===0&&worship.metadata?.privacyScan?.status==="passed",
  public_artifacts_have_no_contact_values:publicSensitiveValueFindings.length===0,
  private_contact_artifact_is_git_ignored:privateContactArtifactIgnored,
  copyright_excerpt_only:worship.operations.every((item)=>!item.values?.source_text||item.values.source_text.length<=1000)&&!JSON.stringify(worship).includes("raw_html"),
  source_attribution_complete:worship.operations.every((item)=>/^https?:\/\//i.test(item.values?.source_url??"")),
  duplicate_free:new Set(worship.operations.map((item)=>item.key)).size===worship.operations.length,
  approved_only_queries:churchPage.includes("church_ministry_profiles WHERE church_id=? AND review_status='approved'")&&pastorPage.includes("church_ministry_profiles WHERE id=? AND church_id=? AND review_status='approved'")&&pastorPage.includes("FROM ministry_appearances WHERE church_id=? AND minister_name=? AND review_status='approved'"),
  guarded_sermon_attribution:pastorPage.includes("isSermonAttributedTo(sermon.title,displayName,!minister)")&&attribution.includes("isPrimary&&named.length===0")&&attribution.includes("named.includes(subject)"),
  reviewed_pastor_import_is_guarded:dryRunImporter.includes('action:"upsert_reviewed_ministry_profile"')&&dryRunImporter.includes('action:"upsert_reviewed_ministry_appearance"')&&dryRunImporter.includes("requires_separate_apply_authorization: true")&&importRoute.includes("calculated=await digest(operations)")&&importRoute.includes("declared!==calculated"),
  approved_person_search_only:searchPage.includes("p.review_status='approved'")&&searchPage.includes('id="pastor-results"'),
  media_gap_does_not_hold_church:syncRoute.includes("missing or quiet YouTube channel is a collection gap")&&!syncRoute.includes("UPDATE churches SET review_status='removed'"),
  expanded_archive_is_batched:syncRoute.includes("recentSermons.slice(0,18)")&&syncRoute.includes("recentShorts.slice(0,12)")&&syncRoute.includes("recentPraises.slice(0,12)")&&syncRoute.includes("await db.batch(mediaStatements)"),
  collection_lease_released_on_failure:syncRoute.includes("finally {")&&syncRoute.includes('DELETE FROM sync_state WHERE key=?')&&syncRoute.includes(".catch(()=>undefined)"),
  edge_cache_keeps_stale_content:mediaRoutes.every((route)=>route.includes("cdn-cache-control")&&route.includes("stale-while-revalidate=3600")&&!route.includes("s-maxage")),
  offline_person_coverage_report:coverageReport.includes('mode:"offline_read_only"')&&coverageReport.includes("network_requests:0")&&coverageReport.includes("database_writes:0")&&coverageReport.includes("isSermonAttributedTo"),
  pastor_change_requests_bound_to_affiliation:signupRoute.includes("fingerprint,church_id")&&manageRoute.includes("a.church_id=c.id WHERE c.id=?"),
  bounded_low_load:importRoute.includes("operations.length>100")&&importRoute.includes("offset+=50")&&churchPage.includes("LIMIT 80"),
  operating_db_writes_before_authorization:roster.operating_database_writes===0,
};
const failed=Object.entries(checks).filter(([,passed])=>!passed).map(([name])=>name);
console.log(JSON.stringify({ok:failed.length===0,checks,failed,summary:{approved_churches:roster.input_approved_churches,pastor_candidates:roster.pastor_candidates,worship_operations:worship.operations.length,http_warnings:roster.http_source_warnings}},null,2));
if(failed.length)process.exitCode=1;
