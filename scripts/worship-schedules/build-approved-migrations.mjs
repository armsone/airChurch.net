#!/usr/bin/env node

import {createHash} from "node:crypto";
import {mkdir,readFile,writeFile} from "node:fs/promises";
import path from "node:path";

if(!process.argv.includes("--owner-approved"))throw new Error("Refusing publication without --owner-approved");
const input=process.argv[2]??"data/worship-schedules/all-unambiguous-import-plan.json";
const outputDir=process.argv[3]??"drizzle";
const firstMigration=Math.max(0,Number(process.argv[4]??74));
const batchSize=Math.max(25,Math.min(100,Number(process.argv[5]??100)));
const plan=JSON.parse(await readFile(input,"utf8"));
const operations=plan.operations??[];
const digest=createHash("sha256").update(JSON.stringify(operations)).digest("hex");
if(!operations.length||plan.metadata?.reviewComplete!==true||plan.metadata?.approvalVerified!==true||plan.metadata?.sha256!==digest)throw new Error("Approved worship plan is incomplete or changed");
const sql=(value)=>value==null?"NULL":`'${String(value).replaceAll("'","''")}'`;
await mkdir(outputDir,{recursive:true});const files=[];
for(let offset=0;offset<operations.length;offset+=batchSize){
  const lines=["-- Approved, unambiguous official worship schedules."];
  for(const operation of operations.slice(offset,offset+batchSize)){
    if(operation.action!=="upsert_reviewed_worship_schedule")throw new Error("Unsupported worship operation");
    const value=operation.values;
    lines.push(`INSERT INTO worship_schedules (record_id,church_id,service_type,day_of_week,start_time,venue_audience,source_text,source_url,collected_at,confidence,review_status,reviewed_at) VALUES (${sql(value.record_id)},${Number(value.church_id)},${sql(value.service_type)},${sql(value.day_of_week)},${sql(value.start_time)},${sql(value.venue_audience)},${sql(value.source_text)},${sql(value.source_url)},${sql(value.collected_at)},${sql(value.confidence)},'approved',${sql(value.reviewed_at)}) ON CONFLICT(record_id) DO UPDATE SET church_id=excluded.church_id,service_type=excluded.service_type,day_of_week=excluded.day_of_week,start_time=excluded.start_time,venue_audience=excluded.venue_audience,source_text=excluded.source_text,source_url=excluded.source_url,collected_at=excluded.collected_at,confidence=excluded.confidence,review_status='approved',reviewed_at=excluded.reviewed_at,updated_at=CURRENT_TIMESTAMP;`);
  }
  const sequence=firstMigration+files.length,filename=`${String(sequence).padStart(4,"0")}_publish_worship_schedules_${String(files.length+1).padStart(3,"0")}.sql`;
  await writeFile(path.join(outputDir,filename),`${lines.join("\n")}\n`);files.push(filename);
}
console.log(JSON.stringify({input,operations:operations.length,batchSize,files:files.length,first:files[0],last:files.at(-1)}));
