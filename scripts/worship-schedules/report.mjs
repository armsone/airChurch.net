#!/usr/bin/env node
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const arg = (name, fallback) => { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : fallback; };
const inputPath = arg("--input", "data/worship-schedules/all-output.json");
const outputPath = arg("--output", "data/worship-schedules/all-report.json");
const contactsPath = arg("--contacts", "data/worship-schedules/all-contact-candidates.review.json");
const bundle = JSON.parse(await readFile(inputPath, "utf8"));
const contactsBundle = JSON.parse(await readFile(contactsPath, "utf8"));
const countBy = (values) => Object.fromEntries([...values.reduce((map, value) => map.set(value, (map.get(value) || 0) + 1), new Map())].sort((a, b) => b[1] - a[1]));
const attemptedIds = new Set((bundle.church_results || []).map((result) => result.church_id));
const candidateIds = new Set((bundle.candidates || []).map((record) => record.church_id));
const profileIds = new Set((bundle.profiles || []).map((profile) => profile.church_id));
const generalRecords = [...(bundle.candidates || []), ...(bundle.profiles || []), ...(bundle.held || [])];
const contactLeakPattern = /(?:[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|(?:헌금\s*)?계좌(?:번호)?\s*[:：]?\s*(?:[가-힣A-Za-z]+\s*)?\d[\d-]{7,}|(?:02|0[3-6][1-5]|01[016789])[-)\s]?\d{3,4}[-\s]?\d{4})/i;
const generalContactValueLeaks = generalRecords.filter((record) => [record.source_text, record.summary, record.address, record.phone, record.venue_audience].filter(Boolean).some((value) => contactLeakPattern.test(String(value))));
const contactSchemaErrors = (contactsBundle.contacts || []).filter((contact) => !contact.candidateId || !contact.churchId || !["email", "phone", "account"].includes(contact.type) || !contact.value || !["organization", "official_role"].includes(contact.scope) || !contact.sourceUrl || contact.reviewStatus !== "pending" || contact.visibility !== "admin_only" || contact.revealPolicy !== "masked_audited");
const contactIds = (contactsBundle.contacts || []).map((contact) => contact.candidateId);
const report = {
  generated_at: new Date().toISOString(),
  complete: bundle.metadata?.complete === true && attemptedIds.size === bundle.metadata?.registered_total,
  registered_churches: bundle.metadata?.registered_total || 0,
  attempted_churches: attemptedIds.size,
  church_statuses: countBy((bundle.church_results || []).map((result) => result.status || "unknown")),
  churches_with_schedule_candidates: candidateIds.size,
  schedule_candidates_pending_review: (bundle.candidates || []).length,
  churches_with_profile_candidates: profileIds.size,
  profile_candidates_pending_review: (bundle.profiles || []).length,
  collection_holds: (bundle.held || []).length,
  collection_errors: (bundle.errors || []).length,
  hold_reasons: countBy((bundle.held || []).map((record) => record.code || "ambiguous_extraction")),
  policy_results: countBy((bundle.church_results || []).map((result) => result.policy_evidence?.status || "not_applicable")),
  security: bundle.metadata?.privacy_scan || null,
  http_source_count: [...(bundle.candidates || []), ...(bundle.profiles || [])].filter((record) => String(record.source_url || "").startsWith("http://")).length,
  transport_review: bundle.metadata?.privacy_scan?.transport_review || null,
  admin_contact_candidates: countBy((contactsBundle.contacts || []).map((contact) => contact.type)),
  contact_visibility: contactsBundle.metadata?.visibility || null,
  general_contact_value_leaks: generalContactValueLeaks.length,
  contact_schema_errors: contactSchemaErrors.length,
  duplicate_contact_candidate_ids: contactIds.length - new Set(contactIds).size,
  automatic_publication: bundle.metadata?.automatic_publication === true,
};
if (!report.complete) throw new Error(`전체 처리 검증 실패: ${report.attempted_churches}/${report.registered_churches}`);
if (report.http_source_count !== (report.transport_review?.warning_count || 0)) throw new Error(`HTTP 전송 검토 건수 불일치: ${report.http_source_count}/${report.transport_review?.warning_count || 0}`);
if (report.contact_visibility !== "admin_only") throw new Error("연락정보 후보는 admin_only여야 합니다.");
if (report.general_contact_value_leaks || report.contact_schema_errors || report.duplicate_contact_candidate_ids) throw new Error(`연락정보 분리 검증 실패: leak=${report.general_contact_value_leaks}, schema=${report.contact_schema_errors}, duplicate=${report.duplicate_contact_candidate_ids}`);
await mkdir(dirname(outputPath), { recursive: true });
const temporaryPath = `${outputPath}.tmp`;
await writeFile(temporaryPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
await rename(temporaryPath, outputPath);
console.log(JSON.stringify(report));
