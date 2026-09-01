#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";

const [oldPath, newPath, outputPath] = process.argv.slice(2);
if (!oldPath || !newPath || !outputPath) {
  throw new Error("usage: node scripts/build-historical-role-status-migration.mjs <old-candidates.json> <new-candidates.json> <output.sql>");
}

const oldData = JSON.parse(await readFile(oldPath, "utf8"));
const newData = JSON.parse(await readFile(newPath, "utf8"));
const key = (role) => [role.name, role.churchName, role.roleTitle, role.sourceUrl].join("\u001f");
const oldRoles = new Map(oldData.ministryRelationships.map((role) => [key(role), role]));
const targets = newData.ministryRelationships
  .filter((role) => oldRoles.get(key(role))?.roleStatus === "current" && role.roleStatus === "former")
  .map((role) => ({ name: role.name, churchName: role.churchName, roleTitle: role.roleTitle, sourceUrl: role.sourceUrl }));

const uniqueTargets = [...new Map(targets.map((target) => [JSON.stringify(target), target])).values()];
const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;
const values = uniqueTargets.map((target) => `  (${quote(target.name)}, ${quote(target.churchName)}, ${quote(target.roleTitle)}, ${quote(target.sourceUrl)})`).join(",\n");
const sql = `-- Official history pages previously misclassified as current ministry rosters.
-- People remain published; only their matching church-role relationship becomes former.
CREATE TEMP TABLE historical_role_status_targets (
  pastor_name TEXT NOT NULL,
  church_name TEXT NOT NULL,
  role_title TEXT NOT NULL,
  source_url TEXT NOT NULL
);

INSERT INTO historical_role_status_targets (pastor_name, church_name, role_title, source_url) VALUES
${values};

DELETE FROM pastor_church_roles AS current_role
WHERE current_role.role_status = 'current'
  AND EXISTS (
    SELECT 1
    FROM pastor_people AS person
    JOIN historical_role_status_targets AS target
      ON target.pastor_name = person.name
     AND target.church_name = current_role.church_name
     AND target.role_title = current_role.role_title
     AND target.source_url = current_role.source_url
    JOIN pastor_church_roles AS former_role
      ON former_role.pastor_id = current_role.pastor_id
     AND former_role.church_name = current_role.church_name
     AND former_role.role_title = current_role.role_title
     AND former_role.source_url = current_role.source_url
     AND former_role.role_status = 'former'
    WHERE person.id = current_role.pastor_id
  );

UPDATE pastor_church_roles AS role
SET role_status = 'former', updated_at = CURRENT_TIMESTAMP
WHERE role.role_status = 'current'
  AND EXISTS (
    SELECT 1
    FROM pastor_people AS person
    JOIN historical_role_status_targets AS target
      ON target.pastor_name = person.name
     AND target.church_name = role.church_name
     AND target.role_title = role.role_title
     AND target.source_url = role.source_url
    WHERE person.id = role.pastor_id
  );

DROP TABLE historical_role_status_targets;
`;

await writeFile(outputPath, sql, "utf8");
console.log(JSON.stringify({ outputPath, correctedRelationships: uniqueTargets.length }));
