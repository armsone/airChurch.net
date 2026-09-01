#!/usr/bin/env node

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

function value(argv, flag, fallback) { const index = argv.indexOf(flag); return index >= 0 ? argv[index + 1] : fallback; }
function recordsFrom(json) { return Array.isArray(json?.results) ? json.results : []; }
function compact(value) { return String(value || "").normalize("NFKC").toLowerCase().replace(/\s+/g, "").replace(/[()·・.,'"_-]/g, ""); }
function compactRegion(value) { return compact(value).replace(/(특별시|광역시|특별자치도|도|시|군|구)/g, ""); }
function cleanPastor(value) {
  const text = String(value || "").trim();
  return /^([가-힣])\s+([가-힣]{1,3})\s+목사$/.test(text) ? text.replace(/^([가-힣])\s+([가-힣]{1,3})/, "$1$2") : text;
}
async function json(file) { return JSON.parse(await readFile(file, "utf8")); }
async function atomic(file, payload) { await mkdir(path.dirname(file), { recursive: true }); const temp = `${file}.tmp-${process.pid}`; await writeFile(temp, `${JSON.stringify(payload, null, 2)}\n`); await rename(temp, file); }

async function main() {
  const argv = process.argv.slice(2);
  const direct = value(argv, "--direct", "out/smartchurch/verified-direct.json");
  const searched = value(argv, "--searched", "out/smartchurch/verified-search.json");
  const output = value(argv, "--output", "out/smartchurch/verified-final.json");
  const duplicateOutput = value(argv, "--duplicates", "out/smartchurch/duplicates.json");
  const merged = [...recordsFrom(await json(direct)), ...recordsFrom(await json(searched))].map((record) => ({
    ...record, pastor: cleanPastor(record.pastor), homepage: record.homepage || record.sourceEvidence?.homepage || "",
    status: "verified", decision: "approved",
  }));
  const unique = []; const localDuplicates = []; const channels = new Set(); const identities = new Set();
  for (const record of merged) {
    const identity = `${compact(record.name)}|${compactRegion(record.region)}`;
    if (channels.has(record.channelId) || identities.has(identity)) { localDuplicates.push({ name: record.name, reason: "duplicate_in_batch" }); continue; }
    channels.add(record.channelId); identities.add(identity); unique.push(record);
  }
  let completed = 0; const fresh = []; const duplicates = [...localDuplicates];
  async function check(record) {
    const url = new URL("https://airchurch.net/api/churches"); url.searchParams.set("q", record.name); url.searchParams.set("smartchurchCheck", String(Date.now()));
    const response = await fetch(url); if (!response.ok) throw new Error(`AirChurch 조회 HTTP ${response.status}`);
    const payload = await response.json();
    const duplicate = (payload.items || []).find((item) => item.youtubeChannelId === record.channelId ||
      (compact(item.name) === compact(record.name) && compactRegion(item.region) === compactRegion(record.region)));
    (duplicate ? duplicates : fresh).push(duplicate ? { name: record.name, reason: duplicate.youtubeChannelId === record.channelId ? "channel_exists" : "identity_exists", existing: duplicate.name } : record);
    completed++;
    if (completed % 4 === 0 || completed === unique.length) console.error(`PROGRESS|dedupe|${completed}|${unique.length}|기존 DB 확인`);
  }
  let cursor = 0;
  async function worker() { while (cursor < unique.length) await check(unique[cursor++]); }
  await Promise.all(Array.from({ length: Math.min(6, unique.length || 1) }, worker));
  fresh.sort((a, b) => a.name.localeCompare(b.name, "ko"));
  const metadata = { generatedAt: new Date().toISOString(), verifiedInput: merged.length, uniqueInput: unique.length, existingDuplicates: duplicates.length, readyToRegister: fresh.length };
  await atomic(output, { metadata, results: fresh }); await atomic(duplicateOutput, { metadata, results: duplicates });
  console.log(JSON.stringify(metadata));
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
