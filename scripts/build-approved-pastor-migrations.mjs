#!/usr/bin/env node

import {mkdir,readFile,writeFile} from "node:fs/promises";
import path from "node:path";

const approvalFlag="--owner-approved";
if(!process.argv.includes(approvalFlag))throw new Error(`Refusing publication without ${approvalFlag}`);

const input=process.argv[2]??"out/pastor-history/identity-resolved-pastor-import-plan.json";
const outputDir=process.argv[3]??"drizzle";
const firstMigration=Math.max(0,Number(process.argv[4]??20));
const batchSize=Math.max(50,Math.min(200,Number(process.argv[5]??100)));
const plan=JSON.parse(await readFile(input,"utf8"));
if(plan.metadata?.automaticApproval!==false||plan.metadata?.privateDataIncluded!==false)throw new Error("Refusing an unsafe pastor import plan");

const people=Array.isArray(plan.people)?plan.people:[];
const roles=Array.isArray(plan.roles)?plan.roles:[];
if(!people.length||!roles.length)throw new Error("Pastor import plan is empty");
const roleGroups=new Map();
for(const role of roles){const group=roleGroups.get(role.personDirectoryId)??[];group.push(role);roleGroups.set(role.personDirectoryId,group);}

const sql=(value)=>value==null?"NULL":`'${String(value).replaceAll("'","''")}'`;
const integerOrNull=(value)=>Number.isInteger(Number(value))&&Number(value)>0?String(Number(value)):"NULL";
await mkdir(outputDir,{recursive:true});

const files=[];
for(let offset=0;offset<people.length;offset+=batchSize){
  const selected=people.slice(offset,offset+batchSize),lines=["-- Owner-approved nationwide pastor publication. Photos remain rights-review pending."];
  for(const person of selected){
    lines.push(`INSERT INTO pastor_people (directory_id,name,public_summary,photo_url,photo_source_url,photo_sha256,photo_review_status,review_status) VALUES (${sql(person.directoryId)},${sql(person.name)},NULL,${sql(person.photoUrl)},${sql(person.photoSourceUrl)},${sql(person.photoSha256)},'pending','approved') ON CONFLICT(directory_id) DO UPDATE SET name=excluded.name,photo_url=COALESCE(excluded.photo_url,pastor_people.photo_url),photo_source_url=COALESCE(excluded.photo_source_url,pastor_people.photo_source_url),photo_sha256=COALESCE(excluded.photo_sha256,pastor_people.photo_sha256),review_status='approved',updated_at=CURRENT_TIMESTAMP;`);
    for(const role of roleGroups.get(person.directoryId)??[])lines.push(`INSERT OR IGNORE INTO pastor_church_roles (pastor_id,church_id,church_name,denomination,region,role_title,role_category,role_status,start_date,end_date,source_url,review_status) SELECT id,${integerOrNull(role.existingChurchId)},${sql(role.churchName)},${sql(role.denomination)},${sql(role.region)},${sql(role.roleTitle)},${sql(role.roleCategory)},${sql(role.roleStatus)},${sql(role.startDate)},${sql(role.endDate)},${sql(role.sourceUrl)},'approved' FROM pastor_people WHERE directory_id=${sql(person.directoryId)};`);
  }
  const sequence=firstMigration+files.length;
  const batch=String(files.length+1).padStart(3,"0");
  const filename=`${String(sequence).padStart(4,"0")}_publish_national_pastors_${batch}.sql`;
  await writeFile(path.join(outputDir,filename),`${lines.join("\n")}\n`);
  files.push(filename);
}

console.log(JSON.stringify({input,outputDir,people:people.length,roles:roles.length,batchSize,files:files.length,first:files[0],last:files.at(-1)}));
