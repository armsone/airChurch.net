#!/usr/bin/env node

import {createHash} from "node:crypto";
import {mkdir,readFile,rename,writeFile} from "node:fs/promises";
import {dirname} from "node:path";

const input=process.argv[2]??"data/worship-schedules/all-output.json";
const output=process.argv[3]??"out/worship-reviews.unambiguous.json";
const bundle=JSON.parse(await readFile(input,"utf8"));
const unsafeFlags=new Set(["privacy_redacted","possibly_stale","ambiguous_schedule_mapping"]);
const reviewedAt=new Date().toISOString();
const candidates=[...(bundle.candidates??[]).map((item)=>({...item,candidateType:"worship_schedule",recordId:item.record_id})),...(bundle.profiles??[]).map((item)=>({...item,candidateType:"church_profile",recordId:item.profile_id}))];
const reviews=candidates.map((item)=>{
  const flags=item.flags??[];
  const clearSchedule=item.candidateType==="worship_schedule"&&Array.isArray(item.day_of_week)&&item.day_of_week.length===1&&/^\d{2}:\d{2}$/.test(item.start_time??"")&&Boolean(String(item.service_type??"").trim())&&/^https?:\/\//.test(item.source_url??"")&&!flags.some((flag)=>unsafeFlags.has(flag));
  return {record_id:item.recordId,decision:clearSchedule?"approve":"reject",reviewed_at:reviewedAt,note:clearSchedule?"공식 출처의 교회·예배명·요일·시각이 한 항목으로 명확함":"자동 공개 기준 밖이므로 자료는 보존하고 공개만 보류"};
});
const approvedCount=reviews.filter((item)=>item.decision==="approve").length;
const payload={metadata:{schema_version:1,source:input,review_count:reviews.length,approved_count:approvedCount,rejected_count:reviews.length-approvedCount,pending_count:0,complete:true,automatic_publication:false,rule:"official_source_and_unambiguous_single_day_time",sha256:createHash("sha256").update(JSON.stringify(reviews)).digest("hex")},reviews};
await mkdir(dirname(output),{recursive:true});const temporary=`${output}.${process.pid}.tmp`;await writeFile(temporary,`${JSON.stringify(payload,null,2)}\n`);await rename(temporary,output);
console.log(JSON.stringify({...payload.metadata,output}));
