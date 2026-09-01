#!/usr/bin/env node

import {createHash} from "node:crypto";
import {mkdir,readFile,rename,writeFile} from "node:fs/promises";
import path from "node:path";

const input=process.argv[2]??"out/pastor-history/pastor-people-import-plan.json";
const outputDir=process.argv[3]??"out/pastor-history/d1-import";
const batchSize=Math.max(50,Math.min(500,Number(process.argv[4]??200)));
const plan=JSON.parse(await readFile(input,"utf8"));
if(plan.metadata?.automaticApproval!==false)throw new Error("Refusing input without automaticApproval:false");
const people=Array.isArray(plan.people)?plan.people:[],roles=Array.isArray(plan.roles)?plan.roles:[];
const roleGroups=new Map();
for(const role of roles){const group=roleGroups.get(role.personDirectoryId)??[];group.push(role);roleGroups.set(role.personDirectoryId,group);}
const sql=(value)=>value==null?"NULL":`'${String(value).replaceAll("'","''")}'`;
const integerOrNull=(value)=>Number.isInteger(Number(value))&&Number(value)>0?String(Number(value)):"NULL";
const atomicWrite=async(file,content)=>{const temp=`${file}.${process.pid}.tmp`;await writeFile(temp,content);await rename(temp,file);};
const chunks=[];
await mkdir(outputDir,{recursive:true});
for(let offset=0;offset<people.length;offset+=batchSize){
  const selected=people.slice(offset,offset+batchSize),lines=["BEGIN TRANSACTION;"];
  for(const person of selected){
    lines.push(`INSERT INTO pastor_people (directory_id,name,public_summary,photo_url,photo_source_url,photo_sha256,photo_usage_basis,photo_review_status,review_status) VALUES (${sql(person.directoryId)},${sql(person.name)},NULL,${sql(person.photoUrl)},${sql(person.photoSourceUrl)},${sql(person.photoSha256)},${sql(person.photoUsageBasis)},${sql(person.photoReviewStatus??"pending")},'pending') ON CONFLICT(directory_id) DO UPDATE SET name=excluded.name,photo_url=COALESCE(excluded.photo_url,pastor_people.photo_url),photo_source_url=COALESCE(excluded.photo_source_url,pastor_people.photo_source_url),photo_sha256=COALESCE(excluded.photo_sha256,pastor_people.photo_sha256),photo_usage_basis=COALESCE(excluded.photo_usage_basis,pastor_people.photo_usage_basis),photo_review_status=CASE WHEN excluded.photo_url IS NOT NULL THEN excluded.photo_review_status ELSE pastor_people.photo_review_status END,updated_at=CURRENT_TIMESTAMP;`);
    for(const role of roleGroups.get(person.directoryId)??[])lines.push(`INSERT OR IGNORE INTO pastor_church_roles (pastor_id,church_id,church_name,denomination,region,role_title,role_category,role_status,start_date,end_date,source_url,review_status) SELECT id,${integerOrNull(role.existingChurchId)},${sql(role.churchName)},${sql(role.denomination)},${sql(role.region)},${sql(role.roleTitle)},${sql(role.roleCategory)},${sql(role.roleStatus)},${sql(role.startDate)},${sql(role.endDate)},${sql(role.sourceUrl)},'pending' FROM pastor_people WHERE directory_id=${sql(person.directoryId)};`);
  }
  lines.push("COMMIT;","");
  const content=lines.join("\n"),name=`pastor-import-${String(chunks.length+1).padStart(4,"0")}.sql`,file=path.join(outputDir,name);
  await atomicWrite(file,content);
  chunks.push({file:name,type:"people_and_roles",people:selected.length,roles:selected.reduce((sum,person)=>sum+(roleGroups.get(person.directoryId)?.length??0),0),identityLinks:0,bytes:Buffer.byteLength(content),sha256:createHash("sha256").update(content).digest("hex")});
}
const identityLinks=Array.isArray(plan.identityLinks)?plan.identityLinks:[];
for(let offset=0;offset<identityLinks.length;offset+=batchSize){const selected=identityLinks.slice(offset,offset+batchSize),lines=["BEGIN TRANSACTION;"];for(const link of selected)lines.push(`INSERT OR IGNORE INTO pastor_identity_candidates (left_pastor_id,right_pastor_id,evidence_type,evidence_value,status) SELECT CASE WHEN l.id<r.id THEN l.id ELSE r.id END,CASE WHEN l.id<r.id THEN r.id ELSE l.id END,${sql(link.evidenceType)},${sql(link.evidenceValue)},'pending' FROM pastor_people l,pastor_people r WHERE l.directory_id=${sql(link.leftPersonDirectoryId)} AND r.directory_id=${sql(link.rightPersonDirectoryId)} AND l.id<>r.id;`);lines.push("COMMIT;","");const content=lines.join("\n"),name=`pastor-import-${String(chunks.length+1).padStart(4,"0")}-identity.sql`,file=path.join(outputDir,name);await atomicWrite(file,content);chunks.push({file:name,type:"identity_links",people:0,roles:0,identityLinks:selected.length,bytes:Buffer.byteLength(content),sha256:createHash("sha256").update(content).digest("hex")});}
const manifest={generatedAt:new Date().toISOString(),sourceFile:input,automaticApproval:false,writeStatus:"pending",batchSize,people:people.length,roles:roles.length,identityLinks:identityLinks.length,chunks};
await atomicWrite(path.join(outputDir,"manifest.json"),`${JSON.stringify(manifest,null,2)}\n`);
console.log(JSON.stringify({outputDir,batchSize,people:people.length,roles:roles.length,identityLinks:identityLinks.length,chunks:chunks.length,totalBytes:chunks.reduce((sum,chunk)=>sum+chunk.bytes,0)}));
