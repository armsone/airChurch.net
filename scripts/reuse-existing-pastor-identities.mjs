#!/usr/bin/env node

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

const [input, existingFile, output] = [
  process.argv[2],
  process.argv[3] ?? "out/pastor-history/combined-pastor-import-plan.json",
  process.argv[4],
];
const photoInput = process.argv[5], photoOutput = process.argv[6];
if (!input || !output) throw new Error("usage: input existing-plan output");
const [collection, existing] = await Promise.all([input, existingFile].map((file) => readFile(file, "utf8").then(JSON.parse)));
const normalize = (value) => String(value ?? "").normalize("NFKC").toLowerCase().replace(/[^0-9a-z가-힣]/g, "");
const existingPeople = new Map((existing.people ?? []).map((person) => [person.directoryId, person]));
const candidates = new Map();
for (const role of existing.roles ?? []) {
  const person = existingPeople.get(role.personDirectoryId);
  if (!person?.name || !role.churchName) continue;
  const key = `${normalize(person.name)}|${normalize(role.churchName)}`;
  const scores = candidates.get(key) ?? new Map();
  scores.set(role.personDirectoryId, (scores.get(role.personDirectoryId) ?? 0) + 1);
  candidates.set(key, scores);
}
const canonical = new Map();
for (const [key, scores] of candidates) {
  canonical.set(key, [...scores].toSorted((left, right) => right[1] - left[1] || Number(right[0].startsWith("person-")) - Number(left[0].startsWith("person-")) || left[0].localeCompare(right[0]))[0][0]);
}
const remap = new Map();
for (const role of collection.ministryRelationships ?? []) {
  const person = (collection.people ?? []).find((item) => item.directoryPersonId === role.directoryPersonId);
  const existingId = canonical.get(`${normalize(person?.name)}|${normalize(role.churchName)}`);
  if (existingId) remap.set(role.directoryPersonId, existingId);
}
const people = [...new Map((collection.people ?? []).map((person) => {
  const directoryPersonId = remap.get(person.directoryPersonId) ?? person.directoryPersonId;
  return [directoryPersonId, { ...person, directoryPersonId }];
})).values()];
const ministryRelationships = (collection.ministryRelationships ?? []).map((role) => ({ ...role, directoryPersonId: remap.get(role.directoryPersonId) ?? role.directoryPersonId }));
await mkdir(path.dirname(output), { recursive: true });
const temporary = `${output}.${process.pid}.tmp`;
await writeFile(temporary, `${JSON.stringify({ ...collection, people, ministryRelationships }, null, 2)}\n`);
await rename(temporary, output);
if (photoInput && photoOutput) {
  const bundle = JSON.parse(await readFile(photoInput, "utf8"));
  const photos = [...new Map((bundle.photos ?? []).map((photo) => {
    const directoryPersonId = remap.get(photo.directoryPersonId) ?? photo.directoryPersonId;
    return [directoryPersonId, { ...photo, directoryPersonId }];
  })).values()];
  await mkdir(path.dirname(photoOutput), { recursive: true });
  const photoTemporary = `${photoOutput}.${process.pid}.tmp`;
  await writeFile(photoTemporary, `${JSON.stringify({ ...bundle, photos }, null, 2)}\n`);
  await rename(photoTemporary, photoOutput);
}
console.log(JSON.stringify({ people: people.length, relationships: ministryRelationships.length, reusedExistingPeople: new Set(remap.values()).size, output }));
