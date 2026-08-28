#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { CATALOG, CATALOG_BY_ID, EXECUTABLE_IDS, buildCatalogPayload } from "./airchurch-denomination-catalog.mjs";

const ROOT=process.cwd();
const WORK=path.join(ROOT,"out","desktop-registration");
const DIRECTORY=path.join(WORK,"directory.json");
const VALIDATED=path.join(WORK,"validated.json");
const REVIEW=path.join(WORK,"review.json");
const IDS=new Set(EXECUTABLE_IDS);
const DENOMINATIONS=Object.fromEntries(CATALOG.map((item)=>[item.id,item.name]));

function progress(stage,current,total,message){console.log(`PROGRESS|${stage}|${current}|${total}|${message}`);}
async function exists(file){try{await stat(file);return true;}catch{return false;}}
async function json(file,fallback=null){try{return JSON.parse(await readFile(file,"utf8"));}catch{return fallback;}}
function run(command,args,{quiet=false}={}){return new Promise((resolve,reject)=>{const child=spawn(command,args,{cwd:ROOT,stdio:["ignore",quiet?"ignore":"inherit",quiet?"ignore":"inherit"]});child.on("error",reject);child.on("exit",(code)=>code===0?resolve():reject(new Error(`${command} 종료 코드 ${code}`)));});}
function selected(raw){const ids=String(raw||EXECUTABLE_IDS.join(",")).split(",").map((v)=>v.trim()).filter((v)=>IDS.has(v));if(!ids.length)throw new Error("교단을 하나 이상 선택하세요.");return ids;}

async function reset(){
  if(await exists(WORK)){const target=path.join(ROOT,"out",`desktop-registration-${new Date().toISOString().replaceAll(":","-")}`);await rename(WORK,target);console.log(`이전 작업 보관: ${target}`);}
  await mkdir(WORK,{recursive:true});progress("reset",1,1,"새 작업을 시작할 준비가 됐습니다.");
}

const GROUP_RUNNERS={
  remaining: (ids,tmpOut)=>run("node",["scripts/batch-register-remaining-denominations.mjs","--only",ids.join(","),"--output",tmpOut,"--checkpoint",`${tmpOut}.checkpoint.json`,"--report",`${tmpOut}.report.json`,"--resume"]),
  five: (ids,tmpOut)=>run("node",["scripts/collect-five-denomination-directories.mjs","--only",ids.join(","),"--output",tmpOut]),
  hapdong: (_ids,tmpOut)=>run("node",["scripts/discover-pck-hapdong.mjs","--output",tmpOut]),
  public: (ids,tmpOut)=>run("node",["scripts/collect-public-remaining-denominations.mjs","--only",ids.join(","),"--output",tmpOut]),
};

function recordMergeKey(record){return `${record.denomination}::${record.name}::${record.address||record.region||""}`;}

function mergeRecords(existing,incoming){
  const map=new Map();
  for(const record of existing) map.set(recordMergeKey(record),record);
  for(const record of incoming) map.set(recordMergeKey(record),record);
  return [...map.values()];
}

async function collect(ids){
  await mkdir(WORK,{recursive:true});progress("collect",0,1,"공식 공개 명부 수집을 시작합니다.");
  const groups=new Map();
  for(const id of ids){
    const group=CATALOG_BY_ID[id]?.collectGroup;
    if(!group) throw new Error(`${DENOMINATIONS[id]||id}는 자동 수집을 지원하지 않습니다.`);
    if(!groups.has(group)) groups.set(group,[]);
    groups.get(group).push(id);
  }
  let merged=(await json(DIRECTORY,{records:[]})).records||[];
  for(const [group,groupIds] of groups){
    const tmpOut=path.join(WORK,`collect-${group}.json`);
    await GROUP_RUNNERS[group](groupIds,tmpOut);
    const incoming=(await json(tmpOut,{records:[]})).records||[];
    merged=mergeRecords(merged,incoming);
  }
  await writeFile(DIRECTORY,JSON.stringify({records:merged},null,2)+"\n");
  progress("collect",merged.length,merged.length||1,`공개 명부 ${merged.length}곳을 수집했습니다.`);
}

async function registeredKeys(ids){
  const keys=new Set();
  for(const id of ids){
    const url=new URL("https://airchurch.net/api/churches");url.searchParams.set("denomination",DENOMINATIONS[id]);url.searchParams.set("registrationApp",String(Date.now()));
    const response=await fetch(url);if(!response.ok)continue;const data=await response.json();
    for(const church of data.items||[]){if(church.youtubeChannelId)keys.add(`channel:${church.youtubeChannelId}`);keys.add(`name:${church.name}|${church.region}`);}
  }
  return keys;
}

async function discover(ids){
  const data=await json(DIRECTORY);if(!data?.records?.length)throw new Error("먼저 공개 자료를 수집하세요.");
  const wanted=new Set(ids.map((id)=>DENOMINATIONS[id]));const existing=await registeredKeys(ids);
  const records=data.records.filter((record)=>wanted.has(record.denomination)&&!existing.has(`name:${record.name}|${record.region}`));
  const chunks=Array.from({length:8},()=>[]);records.forEach((record,index)=>chunks[index%chunks.length].push(record));
  await Promise.all(chunks.map((chunk,index)=>writeFile(path.join(WORK,`input-${index}.json`),JSON.stringify({metadata:{source:DIRECTORY},records:chunk},null,2)+"\n")));
  progress("discover",0,records.length,`기등록 교회를 제외한 ${records.length}곳의 YouTube 검증을 시작합니다.`);
  const children=chunks.map((chunk,index)=>chunk.length?spawn("node",["scripts/discover-youtube-only.mjs","--input",path.join(WORK,`input-${index}.json`),"--output",path.join(WORK,`result-${index}.json`),"--sources","none","--checkpoint",path.join(WORK,`result-${index}.checkpoint.json`),"--resume"],{cwd:ROOT,stdio:["ignore","ignore","ignore"]}):null);
  const done=Promise.all(children.map((child)=>child?new Promise((resolve,reject)=>{child.on("error",reject);child.on("exit",(code)=>code===0?resolve():reject(new Error(`YouTube 조사 종료 코드 ${code}`)));}):Promise.resolve()));
  let finished=false;done.then(()=>{finished=true;},()=>{finished=true;});let last=-1;
  while(!finished){let count=0;for(let i=0;i<8;i++){const cp=await json(path.join(WORK,`result-${i}.checkpoint.json`),{});count+=(cp.results||[]).length||cp.processed||cp.processedCount||0;}if(count!==last){progress("discover",count,records.length,`${count}/${records.length}곳 확인 중`);last=count;}await new Promise((resolve)=>setTimeout(resolve,2000));}
  await done;progress("discover",records.length,records.length,"YouTube 후보 확인을 마쳤습니다.");
}

async function validate(){
  const inputs=[];for(let i=0;i<8;i++){const file=path.join(WORK,`result-${i}.json`);if(await exists(file))inputs.push("--input",file);}
  if(!inputs.length)throw new Error("먼저 YouTube 검증을 실행하세요.");
  progress("validate",0,1,"엄격 기준으로 최종 검증합니다.");
  await run("node",["scripts/validate-hapdong-candidates.mjs",...inputs,"--output",VALIDATED,"--review-output",REVIEW]);
  const data=await json(VALIDATED,{results:[]}),review=await json(REVIEW,{results:[]});
  progress("validate",1,1,`자동 통과 ${data.results?.length||0}곳 · 재검토 ${review.results?.length||0}곳`);
}

async function readCredentials(){let body="";for await(const chunk of process.stdin)body+=chunk;const value=JSON.parse(body||"{}");if(!value.username||!value.password)throw new Error("관리자 아이디와 비밀번호가 필요합니다.");return value;}
async function register(){
  const data=await json(VALIDATED);const records=(data?.results||[]).filter((record)=>record.status==="verified"||record.decision==="approved");if(!records.length)throw new Error("등록할 검증 통과 교회가 없습니다.");
  const credentials=await readCredentials();const login=await fetch("https://airchurch.net/api/admin/unlock",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(credentials)});if(!login.ok)throw new Error("관리자 로그인을 확인해 주세요.");const cookie=login.headers.get("set-cookie")?.split(";")[0];if(!cookie)throw new Error("관리자 세션을 만들지 못했습니다.");
  progress("register",0,records.length,`${records.length}곳 등록을 시작합니다.`);let verified=0,skipped=0,approved=0;
  for(let start=0;start<records.length;start+=20){const batch=records.slice(start,start+20);const response=await fetch("https://airchurch.net/api/admin/churches/import",{method:"POST",headers:{"content-type":"application/json","cookie":cookie},body:JSON.stringify({records:batch})});const result=await response.json();if(!response.ok)throw new Error(result.error||`등록 실패 HTTP ${response.status}`);verified+=result.verified||0;skipped+=(result.skipped||[]).length;approved=result.approved||approved;progress("register",Math.min(start+batch.length,records.length),records.length,`신규·갱신 ${verified}곳 · 제외 ${skipped}곳 · 전체 공개 ${approved}곳`);}
  await writeFile(path.join(WORK,"registration-report.json"),JSON.stringify({completedAt:new Date().toISOString(),processed:records.length,verified,skipped,approved},null,2)+"\n");
}

async function status(){const directory=await json(DIRECTORY,{records:[]}),validated=await json(VALIDATED,{results:[]}),review=await json(REVIEW,{results:[]}),report=await json(path.join(WORK,"registration-report.json"),{});console.log(JSON.stringify({directory:directory.records?.length||0,verified:validated.results?.length||0,review:review.results?.length||0,registered:report.verified||0,approved:report.approved||0}));}

async function list(){const payload=await buildCatalogPayload();console.log(JSON.stringify(payload));}

async function main(){const [command,...rest]=process.argv.slice(2);if(command==="list")return list();if(command==="status")return status();const only=rest.find((_,index)=>rest[index-1]==="--only");const ids=selected(only);if(command==="reset")return reset();if(command==="collect")return collect(ids);if(command==="discover")return discover(ids);if(command==="validate")return validate();if(command==="register")return register();throw new Error("사용법: airchurch-registration-pipeline.mjs <list|reset|collect|discover|validate|register|status> [--only <교단id,...>]");}
main().catch((error)=>{console.error(`ERROR|${error.message}`);process.exitCode=1;});
