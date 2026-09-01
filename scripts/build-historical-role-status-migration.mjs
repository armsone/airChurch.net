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
const sql = `-- Official history pages previously misclassified as current ministry rosters.
-- People remain published; only their matching church-role relationship becomes former.
${uniqueTargets.map((target) => `DELETE FROM pastor_church_roles AS current_role
WHERE current_role.role_status='current'
  AND current_role.church_name=${quote(target.churchName)}
  AND current_role.role_title=${quote(target.roleTitle)}
  AND current_role.source_url=${quote(target.sourceUrl)}
  AND EXISTS (SELECT 1 FROM pastor_people AS person WHERE person.id=current_role.pastor_id AND person.name=${quote(target.name)})
  AND EXISTS (SELECT 1 FROM pastor_church_roles AS former_role WHERE former_role.pastor_id=current_role.pastor_id AND COALESCE(former_role.church_id,-1)=COALESCE(current_role.church_id,-1) AND former_role.church_name=current_role.church_name AND former_role.role_title=current_role.role_title AND former_role.role_status='former' AND COALESCE(former_role.start_date,'')=COALESCE(current_role.start_date,'') AND COALESCE(former_role.end_date,'')=COALESCE(current_role.end_date,''));
UPDATE pastor_church_roles AS role
SET role_status='former',updated_at=CURRENT_TIMESTAMP
WHERE role.role_status='current'
  AND role.church_name=${quote(target.churchName)}
  AND role.role_title=${quote(target.roleTitle)}
  AND role.source_url=${quote(target.sourceUrl)}
  AND EXISTS (SELECT 1 FROM pastor_people AS person WHERE person.id=role.pastor_id AND person.name=${quote(target.name)});`).join("\n")}
`;

await writeFile(outputPath, sql, "utf8");
console.log(JSON.stringify({ outputPath, correctedRelationships: uniqueTargets.length }));
