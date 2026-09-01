#!/usr/bin/env node
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const arg = (name, fallback) => { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : fallback; };
const registryPath = arg("--registry", "data/worship-schedules/all-registered-churches.json");
const outputPath = arg("--output", "data/worship-schedules/all-output.json");
const policyPath = arg("--policy", "data/worship-schedules/fairness-policy.json");
const [registry, output, policy] = await Promise.all([registryPath, outputPath, policyPath].map(async (path) => JSON.parse(await readFile(path, "utf8"))));

async function atomicJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporaryPath, path);
}

registry.metadata.fairness_policy = policyPath;
registry.churches = (registry.churches || []).map((church) => ({
  ...church,
  inclusion_status: "included",
  collection_priority: "equal",
  coverage_status: church.homepage_url ? "official_source_available" : "information_tip_pending",
  accepted_official_source_kinds: policy.accepted_official_source_kinds,
  supplement_channels: policy.supplement_channels,
}));

output.metadata.fairness_policy = {
  source: policyPath,
  population: policy.population,
  collection_priority: policy.collection_priority,
  missing_information_penalty: policy.missing_information_penalty,
  accepted_official_source_kinds: policy.accepted_official_source_kinds,
  single_source_rule: policy.single_source_rule,
  supplement_rule: policy.supplement_rule,
};
output.church_results = (output.church_results || []).map((result) => ({
  ...result,
  inclusion_status: "included",
  collection_priority: "equal",
  coverage_status: result.status === "collected" ? "review_candidate_available" : result.status === "no_homepage" ? "information_tip_pending" : "human_review_required",
  supplement_channels: policy.supplement_channels,
}));

await Promise.all([atomicJson(registryPath, registry), atomicJson(outputPath, output)]);
console.log(JSON.stringify({ registered: registry.churches.length, results: output.church_results.length, equal_priority: output.church_results.every((result) => result.collection_priority === "equal"), all_included: output.church_results.every((result) => result.inclusion_status === "included") }));
