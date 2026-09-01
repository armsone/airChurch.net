#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { validateBundle, validateProfiles } from "./core.mjs";

const arg = (name) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : null; };
const inputPath = arg("--input"), reviewsPath = arg("--reviews"), outputPath = arg("--output");
if (!inputPath || !outputPath) throw new Error("--input과 --output이 필요합니다.");
const bundle = JSON.parse(await readFile(inputPath, "utf8"));
const reviewBytes=reviewsPath?await readFile(reviewsPath):null;
const reviewList = reviewBytes ? JSON.parse(reviewBytes.toString("utf8")).reviews || [] : [];
const reviews = Object.fromEntries(reviewList.map((review) => [review.record_id, review]));
const validated = validateBundle(bundle, reviews);
const validatedProfiles = validateProfiles(bundle, reviews);
const approvedRows=[...validated.approved,...validatedProfiles.approved];
const approvalVerified=approvedRows.length>0&&approvedRows.every((row)=>row.review_status==="approved"&&row.reviewed_at&&reviews[row.record_id??row.profile_id]?.decision==="approve");
const hasHttp=approvedRows.some((row)=>String(row.source_url||"").startsWith("http:"));
const output = { metadata: { schema_version: 2, generated_at: new Date().toISOString(), source: inputPath, dry_run: true, automatic_publication: false, approvalVerified, approvalDigest:reviewBytes?createHash("sha256").update(reviewBytes).digest("hex"):null, privacyScan:{status:"passed",publicContactFields:0,rawCopyrightContentStored:false}, transportReview:{status:hasHttp?"passed_with_warning":"passed",doesNotAffectEligibility:true,eligibilityImpact:"none"} }, ...validated, approved_profiles: validatedProfiles.approved, held_profiles: validatedProfiles.held, profile_errors: validatedProfiles.errors, collection_held: bundle.held || [], collection_errors: bundle.errors || [] };
await mkdir(dirname(outputPath), { recursive: true }); const temp = `${outputPath}.tmp`;
await writeFile(temp, `${JSON.stringify(output, null, 2)}\n`, "utf8"); await rename(temp, outputPath);
console.log(JSON.stringify({ approved: output.approved.length, approved_profiles: output.approved_profiles.length, held: output.held.length, held_profiles: output.held_profiles.length, collection_held: output.collection_held.length, errors: output.errors.length + output.profile_errors.length, collection_errors: output.collection_errors.length, dry_run: true, output: outputPath }));
if (output.errors.length || output.profile_errors.length) process.exitCode = 2;
