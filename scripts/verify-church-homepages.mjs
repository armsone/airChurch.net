#!/usr/bin/env node

import { readFile, writeFile, rename } from "node:fs/promises";

const CONCURRENCY = 8;
const TIMEOUT_MS = 10_000;
const USER_AGENT = "Mozilla/5.0 (compatible; AirChurchDirectoryVerifier/1.0)";

function parseArgs(argv) {
  const value = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : null; };
  return { input: value("--input"), output: value("--output"), resume: argv.includes("--resume") };
}

function compact(value) {
  return String(value || "").normalize("NFKC").toLowerCase().replace(/교회/g, "").replace(/[^0-9a-z가-힣]/g, "");
}

function churchNeedle(name) {
  const value = compact(name);
  return value.length >= 2 ? value : compact(`${name}교회`);
}

function youtubeLinks(html, baseUrl) {
  const found = new Set();
  const regex = /(?:href|src)\s*=\s*["']([^"']*(?:youtube\.com|youtu\.be)[^"']*)["']/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    try {
      const url = new URL(match[1].replace(/&amp;/g, "&"), baseUrl);
      url.searchParams.delete("feature");
      found.add(url.toString());
    } catch {}
  }
  return [...found];
}

async function fetchPage(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml" },
    });
    const type = response.headers.get("content-type") || "";
    const html = type.includes("text/html") || type.includes("xhtml") ? await response.text() : "";
    return { response, html };
  } finally {
    clearTimeout(timer);
  }
}

async function atomicWrite(path, value) {
  const temp = `${path}.tmp`;
  await writeFile(temp, JSON.stringify(value, null, 2), "utf8");
  await rename(temp, path);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.input || !args.output) throw new Error("--input과 --output이 필요합니다.");
  const pilot = JSON.parse(await readFile(args.input, "utf8"));
  const targets = pilot.records.filter((record) => record.homepage);
  let results = [];
  if (args.resume) {
    try {
      const saved = JSON.parse(await readFile(args.output, "utf8")).results || [];
      results = saved.filter((result) => result.status !== "error");
    } catch {}
  }
  const completed = new Set(results.map((r) => r.recordKey));
  const queue = targets.filter((r) => !completed.has(`${r.name}|${r.address || ""}`));
  let cursor = 0;

  async function verify(record) {
    const recordKey = `${record.name}|${record.address || ""}`;
    try {
      const { response, html } = await fetchPage(record.homepage);
      const finalUrl = response.url || record.homepage;
      const pageCompact = compact(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " "));
      const nameMatched = html && pageCompact.includes(churchNeedle(record.name));
      return {
        recordKey, name: record.name, pastor: record.pastor, presbytery: record.presbytery,
        region: record.region, address: record.address, homepage: record.homepage, finalUrl,
        httpStatus: response.status, nameMatched, youtubeUrls: youtubeLinks(html, finalUrl),
        status: response.ok && nameMatched ? "candidate" : "hold",
        holdReason: response.ok ? (nameMatched ? null : "homepage_identity_mismatch") : "homepage_unavailable",
        error: null,
      };
    } catch (error) {
      return {
        recordKey, name: record.name, pastor: record.pastor, presbytery: record.presbytery,
        region: record.region, address: record.address, homepage: record.homepage, finalUrl: null,
        httpStatus: null, nameMatched: false, youtubeUrls: [], status: "error",
        holdReason: null, error: error?.name === "AbortError" ? "timeout" : String(error?.message || error),
      };
    }
  }

  async function worker() {
    while (cursor < queue.length) {
      const index = cursor++;
      const result = await verify(queue[index]);
      results.push(result);
      if (results.length % 20 === 0) {
        await atomicWrite(args.output, { metadata: { input: args.input, total: targets.length, processed: results.length }, results });
        console.error(`[${results.length}/${targets.length}] ${result.name}: ${result.status}`);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length || 1) }, worker));
  const metadata = {
    input: args.input, total: targets.length, processed: results.length,
    candidate: results.filter((r) => r.status === "candidate").length,
    hold: results.filter((r) => r.status === "hold").length,
    error: results.filter((r) => r.status === "error").length,
    withYoutubeEvidence: results.filter((r) => r.youtubeUrls.length).length,
    generatedAt: new Date().toISOString(),
  };
  await atomicWrite(args.output, { metadata, results });
  console.log(JSON.stringify(metadata));
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
