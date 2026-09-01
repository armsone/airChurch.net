#!/usr/bin/env node

import {mkdir,readFile,rename,writeFile} from "node:fs/promises";
import path from "node:path";
import {isSermonAttributedTo} from "../app/pastor-sermon-attribution.ts";

const compact=(value)=>String(value??"").normalize("NFKC").replace(/\s+/g,"").replace(/목사(?:님)?$/u,"");
const approved=(row)=>!row.review_status||row.review_status==="approved";
const churchId=(row)=>Number(row.church_id??row.churchId??row.id);

export function buildPastorMediaCoverage(input){
  const churches=(input.churches??[]).filter(approved);
  const profiles=(input.ministryProfiles??input.ministry_profiles??[]).filter(approved);
  const sermons=(input.sermons??[]).filter((row)=>approved(row)&&(!row.status||row.status==="published"));
  const appearances=(input.ministryAppearances??input.ministry_appearances??[]).filter(approved);
  const churchById=new Map(churches.map((row)=>[churchId(row),row]));
  const people=new Map();
  for(const church of churches){
    const id=churchId(church),name=compact(church.pastor);
    if(id>0&&name)people.set(`${id}:${name}:primary`,{church_id:id,church_name:church.name,name,role_title:"담임목사",is_primary:true});
  }
  for(const profile of profiles){
    const id=churchId(profile),name=compact(profile.name),isPrimary=profile.role_category==="current_primary";
    if(!(id>0&&name&&churchById.has(id)))continue;
    const key=`${id}:${name}:${isPrimary?"primary":profile.id??profile.role_title??"ministry"}`;
    people.set(key,{church_id:id,church_name:churchById.get(id).name,name,role_title:profile.role_title??"목회자",is_primary:isPrimary});
  }
  const rows=[...people.values()].map((person)=>{
    const direct=sermons.filter((sermon)=>churchId(sermon)===person.church_id&&isSermonAttributedTo(String(sermon.title??""),person.name,person.is_primary));
    const external=appearances.filter((item)=>churchId(item)===person.church_id&&compact(item.minister_name??item.ministerName)===person.name&&Boolean(item.video_id??item.videoId));
    const ids=new Set([...direct.map((item)=>item.youtube_id??item.youtubeId),...external.map((item)=>item.video_id??item.videoId)].filter(Boolean));
    return {...person,verified_video_count:ids.size,coverage:ids.size?"covered":"missing"};
  }).sort((a,b)=>a.coverage.localeCompare(b.coverage)||a.name.localeCompare(b.name,"ko")||a.church_id-b.church_id);
  const covered=rows.filter((row)=>row.coverage==="covered").length,total=rows.length;
  return {version:1,metadata:{generated_at:new Date().toISOString(),mode:"offline_read_only",database_writes:0,network_requests:0},summary:{approved_ministers:total,with_verified_video:covered,without_verified_video:total-covered,coverage_percent:total?Number((covered*100/total).toFixed(1)):0},ministers:rows,missing_review_queue:rows.filter((row)=>row.coverage==="missing").map(({church_id,church_name,name,role_title})=>({church_id,church_name,name,role_title,reason:"verified_video_not_connected"}))};
}

async function atomicJson(file,value){await mkdir(path.dirname(file),{recursive:true});const temp=`${file}.${process.pid}.tmp`;await writeFile(temp,`${JSON.stringify(value,null,2)}\n`);await rename(temp,file);}
async function main(){const args=process.argv.slice(2),value=(name,fallback)=>{const index=args.indexOf(name);return index>=0?args[index+1]:fallback;};const input=value("--input",null);if(!input)throw new Error("--input is required");const output=value("--output","out/pastor-media-coverage.json");const report=buildPastorMediaCoverage(JSON.parse(await readFile(input,"utf8")));await atomicJson(output,report);console.log(JSON.stringify(report.summary));}
if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(new URL(import.meta.url).pathname))main().catch((error)=>{console.error(error.message);process.exitCode=1;});
