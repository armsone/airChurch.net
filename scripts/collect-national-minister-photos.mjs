#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const USER_AGENT = "airChurch-public-directory/1.0 (+https://airchurch.net)";
const DEFAULT_INPUT = "out/pastor-history/national-collection-v3/candidates.json";
const DEFAULT_DIR = "out/pastor-history/national-collection-v3/photos-official";
const ROLE = /(?:담임|위임|대표|개척|부|교육|행정|목양|협동|원로|은퇴)?목사|강도사|(?:전임|교육)?전도사/u;
const IMAGE_ATTR = /(?:src|data-src|data-original|data-lazy-src|data-lazy|data-echo|data-image|data-bg|srcset|data-srcset)\s*=\s*["']([^"']+)["']/i;
const IMAGE_TAG = /<img\b[^>]*>/gi;
const BACKGROUND = /background(?:-image)?\s*:\s*url\(["']?([^"')]+)["']?\)/gi;
const BAD_IMAGE = /(?:logo|icon|sub[_-]?top|header|title[_-]?bg|sprite|loading|spinner|blank|spacer|default|placeholder|avatar-default|favicon|button|btn_|arrow|bullet|pixel|qr|map)/i;
const DISCOVERY_VERSION = 4;
const PAGE_HINT = /프로필|약력|인사말|대표|소개|교역자|목회자|사역자|섬기는|원로|은퇴|담임|부목사|설교|말씀|영상|profile|bio(?:graphy)?|staff|pastor|minister|servant|leadership|clergy|sermon|preach|video/i;

function parseArgs(argv) {
  const value = (name, fallback) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : fallback; };
  return {
    input: value("--input", DEFAULT_INPUT),
    outputDir: value("--output-dir", DEFAULT_DIR),
    concurrency: Math.max(1, Number(value("--concurrency", 12))),
    timeoutMs: Math.max(2_000, Number(value("--timeout-ms", 8_000))),
    delayMs: Math.max(750, Number(value("--delay-ms", 900))),
    discoverRelatedPages: argv.includes("--discover-related-pages"),
  };
}

const clean = (value) => String(value ?? "").normalize("NFKC").replace(/\s+/g, " ").trim();
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const iso = () => new Date().toISOString();

async function readJson(file, fallback = null) {
  try { return JSON.parse(await readFile(file, "utf8")); }
  catch (error) { if (error?.code === "ENOENT") return fallback; throw error; }
}

async function atomicJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporary, file);
}

function decodeEntities(value) {
  return value.replace(/&(?:amp|#38);/gi, "&").replace(/&(?:quot|#34);/gi, "\"").replace(/&(?:apos|#39);/gi, "'").replace(/&(?:nbsp|#160);/gi, " ");
}

function resolveImageUrl(raw, pageUrl) {
  try {
    const firstSource = raw.split(",")[0].trim().split(/\s+/)[0];
    const url = new URL(decodeEntities(firstSource), pageUrl);
    if (!new Set(["http:", "https:"]).has(url.protocol) || BAD_IMAGE.test(url.pathname)) return null;
    url.hash = "";
    return url.toString();
  } catch { return null; }
}

function tagImageUrls(fragment, pageUrl) {
  const images = [];
  for (const match of fragment.matchAll(IMAGE_TAG)) {
    const tag = match[0];
    const attr = tag.match(IMAGE_ATTR);
    if (!attr) continue;
    const imageUrl = resolveImageUrl(attr[1], pageUrl);
    if (!imageUrl) continue;
    const alt = clean(tag.match(/(?:alt|title)\s*=\s*["']([^"']*)["']/i)?.[1]);
    images.push({ imageUrl, alt, tagIndex: match.index ?? 0 });
  }
  for (const match of fragment.matchAll(BACKGROUND)) {
    const imageUrl = resolveImageUrl(match[1], pageUrl);
    if (imageUrl) images.push({ imageUrl, alt: "", tagIndex: match.index ?? 0 });
  }
  return [...new Map(images.map((image) => [image.imageUrl, image])).values()];
}

function officialSiteFamily(hostname) {
  const parts = hostname.toLowerCase().split(".").filter(Boolean);
  const countrySecondLevels = new Set(["co", "or", "go", "ac", "ne", "re", "pe"]);
  const size = parts.length >= 3 && parts.at(-1)?.length === 2 && countrySecondLevels.has(parts.at(-2)) ? 3 : 2;
  return parts.slice(-size).join(".");
}

function relatedPageUrls(html, baseUrl, people = []) {
  const urls = [];
  const base = new URL(baseUrl);
  for (const match of html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    try {
      const label = clean(match[2].replace(/<[^>]+>/g, " "));
      const url = new URL(decodeEntities(match[1]), baseUrl);
      const exactPerson = people.find((person) => person?.name && label.includes(person.name));
      const sameHost = url.hostname === base.hostname;
      const sameOfficialFamily = officialSiteFamily(url.hostname) === officialSiteFamily(base.hostname);
      if ((!sameHost && !(exactPerson && sameOfficialFamily)) || (!exactPerson && !PAGE_HINT.test(`${label} ${decodeURIComponent(url.pathname)}`))) continue;
      url.hash = "";
      urls.push(url.toString());
    } catch {}
  }
  for (const match of html.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)) {
    try {
      const url = new URL(decodeEntities(match[1]), baseUrl);
      if (url.hostname === new URL(baseUrl).hostname && PAGE_HINT.test(url.pathname)) urls.push(url.toString());
    } catch {}
  }
  return [...new Set(urls)];
}

function labeledPhoto(html, person, pageUrl, pagePeople) {
  const occurrences = [];
  let position = html.indexOf(person.name);
  while (position >= 0 && occurrences.length < 20) { occurrences.push(position); position = html.indexOf(person.name, position + person.name.length); }
  const scored = [];
  for (const at of occurrences) {
    const start = Math.max(0, at - 6_000);
    const end = Math.min(html.length, at + 6_000);
    const fragment = html.slice(start, end);
    const nameAt = at - start;
    const roleSeen = ROLE.test(clean(fragment.replace(/<[^>]+>/g, " ")));
    for (const image of tagImageUrls(fragment, pageUrl)) {
      const distance = Math.abs(image.tagIndex - nameAt);
      let score = 0;
      let matchMethod = null;
      const absoluteImageAt = start + image.tagIndex;
      const local = clean(html.slice(Math.max(0, absoluteImageAt - 700), Math.min(html.length, absoluteImageAt + 700)).replace(/<[^>]+>/g, " "));
      const nearbyPeople = new Set(pagePeople.filter((candidate) => local.includes(candidate.name)).map((candidate) => candidate.directoryPersonId));
      const oneNamedPerson = nearbyPeople.size === 1 && nearbyPeople.has(person.directoryPersonId);
      if (image.alt.includes(person.name) && oneNamedPerson) { score += 150; matchMethod = "name_in_image_label"; }
      if (image.alt && ROLE.test(image.alt)) score += 30;
      if (!matchMethod && roleSeen && distance <= 1_200 && nearbyPeople.size === 1 && nearbyPeople.has(person.directoryPersonId)) {
        score += 100;
        matchMethod = "single_named_person_card";
      }
      const pageHeading = clean((html.match(/<(?:title|h1)\b[^>]*>([\s\S]*?)<\/(?:title|h1)>/i)?.[1] ?? "").replace(/<[^>]+>/g, " "));
      if (!matchMethod && pageHeading.includes(person.name) && PAGE_HINT.test(`${pageHeading} ${decodeURIComponent(new URL(pageUrl).pathname)}`) && distance <= 2_500) {
        score += 120;
        matchMethod = "dedicated_official_profile";
      }
      if (new URL(image.imageUrl).hostname === new URL(pageUrl).hostname) score += 10;
      scored.push({ ...image, score, distance, matchMethod });
    }
  }
  return scored.sort((a, b) => b.score - a.score || a.distance - b.distance).find((image) => image.matchMethod && image.score >= 100) ?? null;
}

async function fetchLimited(url, timeoutMs, maximum, accept) {
  const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), redirect: "follow", headers: { "user-agent": USER_AGENT, accept } });
  if (!response.ok) throw new Error(`http_${response.status}`);
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maximum) throw new Error("source_too_large");
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > maximum) throw new Error("source_too_large");
  return { response, bytes };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const input = await readJson(options.input);
  const people = input?.people ?? [];
  const relationships = input?.ministryRelationships ?? [];
  if (!people.length || !relationships.length) throw new Error("invalid_people_and_relationships_input");
  const personMap = new Map(people.map((person) => [person.directoryPersonId, person]));
  const sourceGroups = new Map();
  for (const relationship of relationships) {
    if (!sourceGroups.has(relationship.sourceUrl)) sourceGroups.set(relationship.sourceUrl, []);
    sourceGroups.get(relationship.sourceUrl).push({ ...personMap.get(relationship.directoryPersonId), ...relationship });
  }
  const checkpointPath = path.join(options.outputDir, "checkpoint.json");
  const checkpoint = await readJson(checkpointPath, { version: 1, discoveryVersion: DISCOVERY_VERSION, startedAt: iso(), sources: {}, images: {}, discovery: {} });
  if (checkpoint.discoveryVersion !== DISCOVERY_VERSION) {
    checkpoint.discoveryVersion = DISCOVERY_VERSION;
    checkpoint.discovery = {};
  }
  checkpoint.discovery ??= {};
  const hostPeople = new Map();
  for (const [sourceUrl, sourcePeople] of sourceGroups) {
    const host = new URL(sourceUrl).hostname;
    if (!hostPeople.has(host)) hostPeople.set(host, new Map());
    for (const person of sourcePeople) hostPeople.get(host).set(person.directoryPersonId, person);
  }
  const discoveryHosts = options.discoverRelatedPages ? [...hostPeople.keys()].filter((host) => !checkpoint.discovery[host]) : [];
  let discoveryCursor = 0;
  const discoveryWorkers = Array.from({ length: Math.min(options.concurrency, Math.max(1, discoveryHosts.length)) }, async () => {
    while (discoveryCursor < discoveryHosts.length) {
      const host = discoveryHosts[discoveryCursor++];
      const found = [];
      for (const url of [`https://${host}/`, `http://${host}/`, `https://${host}/sitemap.xml`, `http://${host}/sitemap.xml`]) {
        try {
          const { response, bytes } = await fetchLimited(url, options.timeoutMs, 1_500_000, "text/html,application/xml,text/xml");
          found.push(...relatedPageUrls(new TextDecoder().decode(bytes), response.url, [...hostPeople.get(host).values()]));
          if (found.length >= 20) break;
        } catch {}
      }
      checkpoint.discovery[host] = { checkedAt: iso(), urls: [...new Set(found)].slice(0, 20) };
    }
  });
  await Promise.all(discoveryWorkers);
  for (const [host, discovery] of Object.entries(checkpoint.discovery)) {
    const peopleForHost = [...(hostPeople.get(host)?.values() ?? [])];
    for (const url of discovery.urls ?? []) if (!sourceGroups.has(url)) sourceGroups.set(url, peopleForHost);
  }
  const jobs = [...sourceGroups.entries()].filter(([sourceUrl]) => !checkpoint.sources[sourceUrl]);
  const hostReadyAt = new Map();
  let cursor = 0;
  async function paced(url) {
    const host = new URL(url).hostname;
    const wait = Math.max(0, (hostReadyAt.get(host) ?? 0) - Date.now());
    if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
    hostReadyAt.set(host, Date.now() + options.delayMs);
  }
  const workers = Array.from({ length: Math.min(options.concurrency, Math.max(1, jobs.length)) }, async () => {
    while (cursor < jobs.length) {
      const [sourceUrl, sourcePeople] = jobs[cursor++];
      const checkedAt = iso();
      try {
        await paced(sourceUrl);
        const { response, bytes } = await fetchLimited(sourceUrl, options.timeoutMs, 1_500_000, "text/html,application/xhtml+xml");
        const type = response.headers.get("content-type") ?? "";
        if (!/html|xhtml/i.test(type)) throw new Error("unsupported_content_type");
        const html = new TextDecoder().decode(bytes);
        const matches = [];
        for (const person of sourcePeople) {
          const candidate = labeledPhoto(html, person, response.url, sourcePeople);
          if (candidate) matches.push({ directoryPersonId: person.directoryPersonId, sourceUrl, imageUrl: candidate.imageUrl, checkedAt, labelEvidence: candidate.alt || `${person.name} ${person.roleTitle}`, matchScore: candidate.score, matchMethod: candidate.matchMethod });
        }
        checkpoint.sources[sourceUrl] = { checkedAt, finalUrl: response.url, contentSha256: sha256(bytes), status: matches.length ? "photo_candidates_found" : "no_labeled_photo", matches };
      } catch (error) {
        checkpoint.sources[sourceUrl] = { checkedAt, status: "failed", failureType: error?.cause?.code ?? error.message, matches: [] };
      }
      if (Object.keys(checkpoint.sources).length % 25 === 0) await atomicJson(checkpointPath, checkpoint);
      process.stderr.write(`[${Object.keys(checkpoint.sources).length}] ${sourceUrl} ${checkpoint.sources[sourceUrl].status}\n`);
    }
  });
  await Promise.all(workers);

  const rawMatches = Object.values(checkpoint.sources).flatMap((source) => source.matches ?? []);
  const bestByPerson = new Map();
  for (const match of rawMatches) if (!bestByPerson.has(match.directoryPersonId) || match.matchScore > bestByPerson.get(match.directoryPersonId).matchScore) bestByPerson.set(match.directoryPersonId, match);
  const imageJobs = [...new Set([...bestByPerson.values()].map((match) => match.imageUrl))].filter((url) => !checkpoint.images[url]);
  cursor = 0;
  const imageWorkers = Array.from({ length: Math.min(options.concurrency, Math.max(1, imageJobs.length)) }, async () => {
    while (cursor < imageJobs.length) {
      const imageUrl = imageJobs[cursor++];
      try {
        await paced(imageUrl);
        const { response, bytes } = await fetchLimited(imageUrl, options.timeoutMs, 4_000_000, "image/*");
        const type = response.headers.get("content-type") ?? "";
        if (!type.startsWith("image/")) throw new Error("not_an_image");
        const metadata = await sharp(bytes, { animated: false }).metadata();
        const width = Number(metadata.width), height = Number(metadata.height), aspectRatio = width / height;
        const evidence = [...bestByPerson.values()].find((match) => match.imageUrl === imageUrl);
        const wideOfficialProfile = evidence?.matchMethod === "dedicated_official_profile" && aspectRatio <= 3;
        if (!Number.isFinite(width) || !Number.isFinite(height) || width < 120 || height < 140 || aspectRatio < 0.42 || (aspectRatio > 1.25 && !wideOfficialProfile)) throw new Error("not_single_person_portrait_shape");
        checkpoint.images[imageUrl] = { status: "verified", checkedAt: iso(), finalUrl: response.url, contentType: type.split(";")[0], byteLength: bytes.byteLength, width, height, aspectRatio: Number(aspectRatio.toFixed(4)), sha256: sha256(bytes) };
      } catch (error) { checkpoint.images[imageUrl] = { status: "failed", checkedAt: iso(), failureType: error?.cause?.code ?? error.message }; }
    }
  });
  await Promise.all(imageWorkers);
  checkpoint.completedAt = iso();
  await atomicJson(checkpointPath, checkpoint);

  const photos = [];
  for (const [personId, match] of bestByPerson) {
    const image = checkpoint.images[match.imageUrl];
    if (image?.status !== "verified") continue;
    photos.push({ directoryPersonId: personId, imageUrl: image.finalUrl, sourcePageUrl: match.sourceUrl, checkedAt: match.checkedAt, labelEvidence: match.labelEvidence, matchMethod: match.matchMethod, contentType: image.contentType, byteLength: image.byteLength, width: image.width, height: image.height, imageSha256: image.sha256, identityUse: "official_labeled_photo_evidence", usageBasis: "official_public_clergy_profile", publicationPolicy: "publish_then_notice_and_takedown", thirdPartyImagePolicy: "single_person_profile_only" });
  }
  const assignmentsByHash = new Map();
  for (const photo of photos) {
    if (!assignmentsByHash.has(photo.imageSha256)) assignmentsByHash.set(photo.imageSha256, []);
    assignmentsByHash.get(photo.imageSha256).push(photo);
  }
  const ambiguousHashes = new Set([...assignmentsByHash.entries()].filter(([, assigned]) => new Set(assigned.map((photo) => photo.directoryPersonId)).size > 1 && assigned.some((photo) => photo.matchMethod !== "name_in_image_label")).map(([hash]) => hash));
  const strictPhotos = photos.filter((photo) => !ambiguousHashes.has(photo.imageSha256));
  const photoPeople = new Set(strictPhotos.map((photo) => photo.directoryPersonId));
  const missing = people.filter((person) => !photoPeople.has(person.directoryPersonId)).map((person) => ({ directoryPersonId: person.directoryPersonId, name: person.name, denomination: person.denomination, region: person.region, reason: "no_verified_labeled_official_photo" }));
  const failureCounts = {};
  for (const source of Object.values(checkpoint.sources)) if (source.failureType) failureCounts[source.failureType] = (failureCounts[source.failureType] ?? 0) + 1;
  const report = { generatedAt: iso(), totalPeople: people.length, officialLabeledPhotos: strictPhotos.length, missingPhotos: missing.length, coveragePercent: Number((strictPhotos.length / people.length * 100).toFixed(2)), ambiguousRepeatedPhotoAssignmentsRejected: photos.length - strictPhotos.length, officialSourcePagesAttempted: Object.keys(checkpoint.sources).length, failureCounts };
  await atomicJson(path.join(options.outputDir, "photos.json"), { metadata: report, photos: strictPhotos });
  await atomicJson(path.join(options.outputDir, "missing.json"), { metadata: report, people: missing });
  await atomicJson(path.join(options.outputDir, "report.json"), report);
  console.log(JSON.stringify({ ...report, outputDir: options.outputDir }));
}

await main();
