#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

const inputPath = process.argv[2] ?? "out/pastor-history/national-collection-v2/import-ready.json";
const photoPath = process.argv[3] ?? "out/pastor-history/national-collection-v2/photos-strict/photos.json";
const linksPath = process.argv[4] ?? "out/pastor-history/national-collection-v2/photos-strict/identity-links.json";
const outputPath = process.argv[5] ?? "out/pastor-history/national-collection-v2/identity-resolved-import-ready.json";
const input = JSON.parse(await readFile(inputPath, "utf8"));
const photoBundle = JSON.parse(await readFile(photoPath, "utf8"));
const linkBundle = JSON.parse(await readFile(linksPath, "utf8"));
const peopleById = new Map(input.people.map((person) => [person.directoryPersonId, person]));
const parent = new Map(input.people.map((person) => [person.directoryPersonId, person.directoryPersonId]));
const find = (id) => { let root = id; while (parent.get(root) !== root) root = parent.get(root); while (parent.get(id) !== id) { const next = parent.get(id); parent.set(id, root); id = next; } return root; };
const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent.set(rb, ra < rb ? ra : rb), parent.set(ra, ra < rb ? ra : rb); };
for (const link of linkBundle.links ?? []) {
  const ids = link.directoryPersonIds.filter((id) => peopleById.has(id));
  for (let i = 1; i < ids.length; i += 1) union(ids[0], ids[i]);
}
const groups = new Map();
for (const person of input.people) {
  const root = find(person.directoryPersonId);
  if (!groups.has(root)) groups.set(root, []);
  groups.get(root).push(person);
}
const canonicalByOriginal = new Map();
const people = [];
for (const members of groups.values()) {
  const name = members[0].name;
  const canonicalId = members.length === 1 ? members[0].directoryPersonId : `person-${createHash("sha256").update(members.map((p) => p.directoryPersonId).sort().join("|")).digest("hex").slice(0, 20)}`;
  for (const member of members) canonicalByOriginal.set(member.directoryPersonId, canonicalId);
  people.push({
    directoryPersonId: canonicalId,
    name,
    identityResolution: members.length > 1 ? "same_name_and_exact_official_photo" : "distinct_church_scoped_official_identity",
    sourcePersonIds: members.map((member) => member.directoryPersonId),
    denomination: members.length === 1 ? members[0].denomination : null,
    region: members.length === 1 ? members[0].region : null,
    reviewStatus: "identity_resolved",
  });
}
const relationships = input.ministryRelationships.map((relationship) => ({ ...relationship, directoryPersonId: canonicalByOriginal.get(relationship.directoryPersonId), reviewStatus: "identity_resolved" }));
const photos = (photoBundle.photos ?? []).map((photo) => ({ ...photo, directoryPersonId: canonicalByOriginal.get(photo.directoryPersonId) }));
const mergedGroups = [...groups.values()].filter((members) => members.length > 1);
const report = {
  generatedAt: new Date().toISOString(),
  inputPeople: input.people.length,
  resolvedPeople: people.length,
  exactOfficialPhotoMergeGroups: mergedGroups.length,
  peopleCombinedByExactPhoto: mergedGroups.reduce((sum, members) => sum + members.length, 0),
  preservedDistinctPeople: [...groups.values()].filter((members) => members.length === 1).length,
  excludedBecauseOfSameName: 0,
  ministryRelationships: relationships.length,
  verifiedOfficialPhotos: new Set(photos.map((photo) => photo.directoryPersonId)).size,
  missingOfficialPhotos: people.length - new Set(photos.map((photo) => photo.directoryPersonId)).size,
};
const output = { metadata: report, people, ministryRelationships: relationships, photos };
await mkdir(path.dirname(outputPath), { recursive: true });
const temporary = `${outputPath}.${process.pid}.tmp`;
await writeFile(temporary, `${JSON.stringify(output, null, 2)}\n`);
await rename(temporary, outputPath);
console.log(JSON.stringify({ ...report, output: outputPath }));
