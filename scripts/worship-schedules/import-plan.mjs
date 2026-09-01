#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const arg = (name) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : null; };
const inputPath = arg("--input"), outputPath = arg("--output");
if (!inputPath || !outputPath) throw new Error("--input과 --output이 필요합니다.");
if (process.argv.includes("--apply")) throw new Error("이 도구는 운영 DB에 쓰지 않습니다. 검토된 import plan만 생성합니다.");
const input = JSON.parse(await readFile(inputPath, "utf8"));
if (input.errors?.length || input.profile_errors?.length) throw new Error("검증 오류가 남아 있어 import plan을 만들 수 없습니다.");
const rows = (input.approved || []).filter((row) => row.review_status === "approved");
const operations = rows.map((row) => ({
  action: "upsert_reviewed_worship_schedule", key: row.record_id,
  values: { ...row, day_of_week: JSON.stringify(row.day_of_week), flags: JSON.stringify(row.flags || []) },
}));
for (const profile of (input.approved_profiles || []).filter((row) => row.review_status === "approved")) {
  operations.push({ action: "upsert_reviewed_church_profile", key: profile.profile_id, values: profile });
}
const payload = JSON.stringify(operations);
const output = { metadata: { generated_at: new Date().toISOString(), dry_run: true, operation_count: operations.length, source_collection_hold_count: input.collection_held?.length || 0, source_collection_error_count: input.collection_errors?.length || 0, sha256: createHash("sha256").update(payload).digest("hex"), requires_separate_apply_authorization: true }, operations };
await mkdir(dirname(outputPath), { recursive: true }); const temp = `${outputPath}.tmp`;
await writeFile(temp, `${JSON.stringify(output, null, 2)}\n`, "utf8"); await rename(temp, outputPath);
console.log(JSON.stringify(output.metadata));
