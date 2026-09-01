#!/usr/bin/env node

import {createHash} from "node:crypto";
import {mkdir,readFile,rename,writeFile} from "node:fs/promises";
import path from "node:path";

const sensitivePattern=/(?:[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|(?<!\d)01[016789][- .]?\d{3,4}[- .]?\d{4}(?!\d)|(?:계좌|account)\s*[:：]?\s*\d[\d -]{7,})/gi;
const safeText=(value,max)=>String(value??"").trim().slice(0,max);
const digest=(value)=>createHash("sha256").update(JSON.stringify(value)).digest("hex");
export const worshipReviewLane=(record)=>{const flags=new Set(record.flags??[]);if(flags.has("privacy_redacted")||flags.has("possibly_stale")||flags.has("ambiguous_schedule_mapping"))return "careful";if(record.candidate_type==="worship_schedule"&&Array.isArray(record.day_of_week)&&record.day_of_week.length===1&&/^\d{2}:\d{2}$/.test(record.start_time??"")&&record.service_type)return "quick";return record.confidence==="high"?"quick":"standard";};
export const immutableWorshipReviewRecord=(review)=>({record_id:review.record_id,candidate_type:review.candidate_type,church_id:review.church_id,church_name:review.church_name,service_type:review.service_type,day_of_week:review.day_of_week,start_time:review.start_time,venue_audience:review.venue_audience,slogan:review.slogan,vision:review.vision,summary:review.summary,source_url:review.source_url,confidence:review.confidence,flags:review.flags,review_lane:review.review_lane});
export const worshipReviewCandidateDigest=(reviews)=>digest(reviews.map(immutableWorshipReviewRecord));

export function buildWorshipReviewBatches(bundle,batchChurchLimit=25){
  if(bundle?.metadata?.complete!==true||bundle?.metadata?.automatic_publication!==false)throw new Error("unsafe_collection_bundle");
  const records=[...(bundle.candidates??[]).map((item)=>({...item,candidate_type:"worship_schedule",candidate_id:item.record_id})),...(bundle.profiles??[]).map((item)=>({...item,candidate_type:"church_profile",candidate_id:item.profile_id}))];
  const scheduleTimes=new Map();
  for(const record of records){
    if(record.candidate_type!=="worship_schedule"||!Array.isArray(record.day_of_week)||record.day_of_week.length<2)continue;
    const key=JSON.stringify([record.church_id,record.service_type,record.day_of_week,record.source_url]);
    const times=scheduleTimes.get(key)??new Set();times.add(record.start_time);scheduleTimes.set(key,times);
  }
  const ambiguousScheduleKeys=new Set([...scheduleTimes].filter(([,times])=>times.size>1).map(([key])=>key));
  const ids=new Set(),groups=new Map();
  for(const record of records){
    const id=safeText(record.candidate_id,80),churchId=Number(record.church_id),sourceUrl=safeText(record.source_url,500);
    if(!id||ids.has(id)||!Number.isInteger(churchId)||churchId<1)throw new Error("invalid_or_duplicate_candidate");
    if(!/^https?:\/\//i.test(sourceUrl))throw new Error("official_source_url_required");
    const publicText=JSON.stringify([record.church_name,record.service_type,record.day_of_week,record.start_time,record.venue_audience,record.slogan,record.vision,record.summary]);
    if(sensitivePattern.test(publicText))throw new Error("sensitive_value_in_review_packet");
    sensitivePattern.lastIndex=0;ids.add(id);
    const group=groups.get(churchId)??{church_id:churchId,church_name:safeText(record.church_name,100),records:[]};
    const flags=Array.isArray(record.flags)?record.flags.slice(0,20):[];
    const scheduleKey=JSON.stringify([record.church_id,record.service_type,record.day_of_week,record.source_url]);
    if(ambiguousScheduleKeys.has(scheduleKey)&&!flags.includes("ambiguous_schedule_mapping"))flags.push("ambiguous_schedule_mapping");
    const note=flags.includes("ambiguous_schedule_mapping")?"교회와 목사 정보는 유지하고, 실제 요일-시간 대응을 확정할 수 없는 이 예배시간 항목만 보류":"";
    const review={record_id:id,decision:"pending",candidate_type:record.candidate_type,church_id:churchId,church_name:safeText(record.church_name,100),service_type:safeText(record.service_type,80)||null,day_of_week:record.day_of_week??null,start_time:safeText(record.start_time,8)||null,venue_audience:safeText(record.venue_audience,180)||null,slogan:safeText(record.slogan,180)||null,vision:safeText(record.vision,300)||null,summary:safeText(record.summary,500)||null,source_url:sourceUrl,confidence:safeText(record.confidence,20)||"unknown",flags,reviewed_at:"",note};
    review.review_lane=worshipReviewLane(review);group.records.push(review);
    groups.set(churchId,group);
  }
  const churches=[...groups.values()].sort((a,b)=>a.church_name.localeCompare(b.church_name,"ko")||a.church_id-b.church_id);
  const batches=[];
  for(let offset=0;offset<churches.length;offset+=batchChurchLimit){
    const selected=churches.slice(offset,offset+batchChurchLimit),reviews=selected.flatMap((item)=>item.records);
    const review_lane_counts=Object.fromEntries(["quick","standard","careful"].map((lane)=>[lane,reviews.filter((item)=>item.review_lane===lane).length]));
    batches.push({metadata:{schema_version:1,mode:"human_review_only",automatic_approval:false,church_count:selected.length,review_count:reviews.length,review_lane_counts,http_source_count:reviews.filter((item)=>item.source_url.startsWith("http://")).length,candidate_sha256:worshipReviewCandidateDigest(reviews),privacy_scan:{status:"passed",sensitive_findings:0,raw_html_stored:false}},reviews});
  }
  const laneCounts=Object.fromEntries(["quick","standard","careful"].map((lane)=>[lane,batches.reduce((sum,batch)=>sum+batch.metadata.review_lane_counts[lane],0)]));
  return {summary:{candidate_records:records.length,candidate_churches:churches.length,batch_count:batches.length,duplicate_candidates:0,review_lane_counts:laneCounts,automatic_approval:false},batches};
}

async function atomicJson(file,value){await mkdir(path.dirname(file),{recursive:true});const temp=`${file}.${process.pid}.tmp`;await writeFile(temp,`${JSON.stringify(value,null,2)}\n`);await rename(temp,file);}
async function main(){const args=process.argv.slice(2),arg=(name,fallback)=>{const index=args.indexOf(name);return index>=0?args[index+1]:fallback;};const input=arg("--input","data/worship-schedules/all-output.json"),outputDir=arg("--output-dir","out/worship-review-batches"),limit=Math.max(1,Math.min(50,Number(arg("--churches-per-batch","25"))||25)),result=buildWorshipReviewBatches(JSON.parse(await readFile(input,"utf8")),limit);await mkdir(outputDir,{recursive:true});for(let index=0;index<result.batches.length;index++)await atomicJson(path.join(outputDir,`batch-${String(index+1).padStart(2,"0")}.json`),result.batches[index]);await atomicJson(path.join(outputDir,"summary.json"),result.summary);console.log(JSON.stringify({...result.summary,output_dir:outputDir}));}
if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(new URL(import.meta.url).pathname))main().catch((error)=>{console.error(error.message);process.exitCode=1;});
