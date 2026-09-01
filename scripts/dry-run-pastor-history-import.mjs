#!/usr/bin/env node

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { canonicalImportRecords, importArtifactDigest, validateNoSensitiveData } from "./pastor-history-core.mjs";

function parseArgs(argv) {
  if (argv.includes("--apply") || argv.includes("--publish") || argv.includes("--write-db")) throw new Error("write_mode_is_not_supported");
  const value = (name, fallback = null) => { const index = argv.indexOf(name); return index >= 0 ? argv[index + 1] : fallback; };
  return {
    input: value("--input", "out/pastor-history/collected.json"),
    output: value("--output", "out/pastor-history/import-plan.json"),
    approval: value("--approval"),
    approvalTemplate: value("--approval-template"),
  };
}

async function readJson(file) { return JSON.parse(await readFile(file, "utf8")); }
async function atomicJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temp, file);
}

export function buildImportPlan(collected, approval = null) {
  if (collected?.metadata?.dryRun !== true || collected?.metadata?.published !== false) throw new Error("unsafe_collection_artifact");
  const records = canonicalImportRecords(collected);
  const artifactSha256 = importArtifactDigest(records);
  const httpSourceCount = new Set(records.flatMap((record) => record.sourceUrls ?? [record.sourceUrl]).filter((url) => {
    try { return new URL(url).protocol === "http:"; } catch { return false; }
  })).size;
  let approvalVerified = false;
  let approvalReason = "explicit_human_approval_required";
  if (approval) {
    const approvedAt = Date.parse(approval.approvedAt);
    const collectedAt = Date.parse(collected.metadata.generatedAt);
    const approvedIds = [...new Set(approval.approvedEventIds ?? [])].sort();
    const candidateIds = records.map((record) => record.eventId).sort();
    if (approval.decision !== "approved") approvalReason = "approval_decision_not_approved";
    else if (!String(approval.approvedBy ?? "").trim()) approvalReason = "approver_identity_missing";
    else if (!Number.isFinite(approvedAt) || !Number.isFinite(collectedAt) || approvedAt < collectedAt || approvedAt > Date.now() + 5 * 60 * 1000) approvalReason = "approval_time_invalid";
    else if (approval.artifactSha256 !== artifactSha256) approvalReason = "approval_digest_mismatch";
    else if (JSON.stringify(approvedIds) !== JSON.stringify(candidateIds)) approvalReason = "approved_event_set_mismatch";
    else { approvalVerified = true; approvalReason = null; }
  }
  const reviewedAt=approvalVerified?new Date(approval.approvedAt).toISOString():collected.metadata.generatedAt;
  const profileMap=new Map(),appearanceMap=new Map();
  for(const record of records){
    if(!Number.isInteger(record.churchId)||record.churchId<1)continue;
    const profileKey=[record.churchId,record.pastorName,record.role,record.roleStatus].join("|");
    if(!profileMap.has(profileKey))profileMap.set(profileKey,{action:"upsert_reviewed_ministry_profile",key:`ministry-profile:${record.eventId}`,values:{church_id:record.churchId,name:record.pastorName,role_title:record.role,role_category:record.roleCategory,role_status:record.roleStatus,source_url:record.sourceUrl,source_checked_at:record.checkedAt,review_status:approvalVerified?"approved":"pending",reviewed_at:reviewedAt}});
    if(["guest_sermon","guest_preaching","special_service","seminar","ministry_appearance"].includes(record.eventType)){
      const occurredAt=/^\d{4}-\d{2}-\d{2}$/.test(record.startDate??"")?record.startDate:record.checkedAt.slice(0,10),appearanceKey=[record.sourceUrl,record.pastorName,record.factSummary].join("|");
      if(!appearanceMap.has(appearanceKey))appearanceMap.set(appearanceKey,{action:"upsert_reviewed_ministry_appearance",key:`ministry-appearance:${record.eventId}`,values:{church_id:record.churchId,minister_name:record.pastorName,role_title:record.role,host_church_name:record.organization,event_title:record.factSummary,source_url:record.sourceUrl,video_id:record.videoId??null,occurred_at:occurredAt,source_checked_at:record.checkedAt,review_status:approvalVerified?"approved":"pending",reviewed_at:reviewedAt}});
    }
  }
  const operations=[...profileMap.values(),...appearanceMap.values()].sort((a,b)=>a.key.localeCompare(b.key));
  if(approvalVerified&&operations.length===0&&records.length)throw new Error("church_id_required_for_release");
  const operationSha256=importArtifactDigest(operations);
  const plan = {
    version: 1,
    metadata: {
      generatedAt: new Date().toISOString(),
      mode: "dry-run",
      databaseWrites: 0,
      published: false,
      artifactSha256,
      reviewComplete: approvalVerified,
      approvalVerified,
      approvalReason,
      requires_separate_apply_authorization: true,
      sha256: operationSha256,
      operation_count: operations.length,
      candidateCount: records.length,
      adminContactArtifactIncluded: false,
      httpSourceCount,
      transportReview: {
        status: httpSourceCount ? "required" : "passed",
        rule: "public_read_only_no_forms_or_credentials"
      },
      privacyScan: {
        status: "passed",
        sourceTextStored: false,
        factSummariesScanned: records.length,
        sensitiveFindings: 0,
        copiedContactFields: 0,
        adminContactArtifactIncluded: false,
        publicContactFields: 0
      },
    },
    operations,
    actions: records.map((record) => ({
      action: "preview_staged_upsert",
      publicationEligible: approvalVerified,
      record: { ...record, reviewStatus: approvalVerified ? "human_approved" : "pending" },
    })),
  };
  validateNoSensitiveData(plan);
  return plan;
}

export function buildApprovalTemplate(plan) {
  return {
    decision: "pending",
    approvedBy: "",
    approvedAt: "",
    artifactSha256: plan.metadata.artifactSha256,
    approvedEventIds: plan.actions.map((action) => action.record.eventId).sort(),
    note: "사람이 공식 출처와 각 사실을 확인한 뒤 decision을 approved로 바꾸고 승인자와 승인 시각을 기록합니다.",
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const collected = await readJson(args.input);
  const approval = args.approval ? await readJson(args.approval) : null;
  const plan = buildImportPlan(collected, approval);
  await atomicJson(args.output, plan);
  if (args.approvalTemplate) await atomicJson(args.approvalTemplate, buildApprovalTemplate(plan));
  console.log(JSON.stringify(plan.metadata));
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
