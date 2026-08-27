#!/usr/bin/env node

/**
 * AI 검증이 끝난 교회 JSON을 교단 소스에 안전하게 반영하고, 배포 후 운영 DB
 * 동기화를 작은 묶음으로 끝까지 실행하는 CLI입니다. 후보(status=candidate)는
 * 절대 등록하지 않고 status=verified/approved 또는 decision=approved만 받습니다.
 */

import { readFile, writeFile, rename } from "node:fs/promises";

const DEFAULT_SOURCES_BY_SCOPE = {
  hapdong: "app/api/sermons/hapdong-sources.ts",
  kosin: "app/api/sermons/kosin-sources.ts",
};
const DEFAULT_SCOPE = "hapdong";
const DEFAULT_SITE = "https://airchurch.net";
const CHANNEL_ID = /^UC[\w-]{20,}$/;

function help() {
  console.log(`register-verified-churches.mjs

1) 검증 결과를 소스에 준비 (기본은 미리보기):
   node scripts/register-verified-churches.mjs --input verified.json --prepare
   node scripts/register-verified-churches.mjs --input verified.json --prepare --apply
   node scripts/register-verified-churches.mjs --scope kosin --input verified.json --prepare --apply

2) 배포 후 새 구간을 운영 DB에 등록:
   node scripts/register-verified-churches.mjs --sync --start <기존 합동 수> --count <추가 수>
   node scripts/register-verified-churches.mjs --scope kosin --sync --start <기존 고신 수> --count <추가 수>

옵션:
  --scope <hapdong|kosin>  대상 교단 (기본: ${DEFAULT_SCOPE})
  --input <file>     검증 결과 JSON
  --sources <file>   교단 소스 파일 (기본: scope별 기본 소스 파일)
  --prepare          승인 항목을 소스에 병합
  --apply            실제 소스 수정 (없으면 미리보기)
  --sync             운영 DB 동기화 실행
  --start <n>        소스 시작 인덱스
  --count <n>        등록할 항목 수
  --site <url>       사이트 주소 (기본: ${DEFAULT_SITE})
  --batch-size <n>   요청당 교회 수 (기본/최대: 20)
  --report <file>    실행 보고서 경로
`);
}

function parseArgs(argv) {
  const args={scope:DEFAULT_SCOPE,input:null,sources:null,site:DEFAULT_SITE,prepare:false,apply:false,sync:false,start:null,count:null,batchSize:20,report:null,help:false};
  for(let i=0;i<argv.length;i+=1){
    const token=argv[i];
    if(token==="--scope") args.scope=argv[++i];
    else if(token==="--input") args.input=argv[++i];
    else if(token==="--sources") args.sources=argv[++i];
    else if(token==="--site") args.site=argv[++i];
    else if(token==="--prepare") args.prepare=true;
    else if(token==="--apply") args.apply=true;
    else if(token==="--sync") args.sync=true;
    else if(token==="--start") args.start=Number.parseInt(argv[++i],10);
    else if(token==="--count") args.count=Number.parseInt(argv[++i],10);
    else if(token==="--batch-size") args.batchSize=Math.min(20,Math.max(1,Number.parseInt(argv[++i],10)||20));
    else if(token==="--report") args.report=argv[++i];
    else if(token==="--help"||token==="-h") args.help=true;
    else throw new Error(`알 수 없는 옵션: ${token}`);
  }
  if(!args.help&&!Object.prototype.hasOwnProperty.call(DEFAULT_SOURCES_BY_SCOPE,args.scope)) throw new Error(`알 수 없는 --scope: ${args.scope}`);
  if(!args.sources) args.sources=DEFAULT_SOURCES_BY_SCOPE[args.scope];
  return args;
}

function recordsFrom(value) {
  if(Array.isArray(value)) return value;
  for(const key of ["results","records","churches","candidates","approved"]){ if(Array.isArray(value?.[key])) return value[key]; }
  return [];
}

function isApproved(record) {
  return record?.status==="verified"||record?.status==="approved"||record?.decision==="approved";
}

function clean(record) {
  const item={
    name:String(record.name||"").trim(), pastor:String(record.pastor||"").trim(),
    region:String(record.region||"").trim(), denomination:String(record.denomination||"").trim(),
    channelId:String(record.channelId||"").trim(), homepage:String(record.homepage||record.sourceEvidence?.homepage||"").trim(),
  };
  if(!item.name||!item.pastor||!item.region||!item.denomination) throw new Error(`필수 정보 누락: ${record.name||"이름 없음"}`);
  if(!CHANNEL_ID.test(item.channelId)) throw new Error(`YouTube 채널 ID 오류: ${item.name}`);
  return item;
}

function sourceLine(item) {
  const homepage=item.homepage?`,homepage:${JSON.stringify(item.homepage)}`:"";
  return `  {name:${JSON.stringify(item.name)},pastor:${JSON.stringify(item.pastor)},region:${JSON.stringify(item.region)},denomination:${JSON.stringify(item.denomination)},channelId:${JSON.stringify(item.channelId)}${homepage}},`;
}

async function atomicWrite(path, text) {
  const tmp=`${path}.tmp-${process.pid}`;
  await writeFile(tmp,text,"utf8");
  await rename(tmp,path);
}

async function prepare(args) {
  if(!args.input) throw new Error("--prepare에는 --input이 필요합니다.");
  const input=JSON.parse(await readFile(args.input,"utf8"));
  const approved=recordsFrom(input).filter(isApproved).map(clean);
  const source=await readFile(args.sources,"utf8");
  const existingChannels=new Set([...source.matchAll(/channelId:"([^"]+)"/g)].map((m)=>m[1]));
  const existingKeys=new Set([...source.matchAll(/\{name:"([^"]+)"[^\n]*region:"([^"]+)"/g)].map((m)=>`${m[1]}|${m[2]}`));
  const unique=[]; const seenChannels=new Set(); const skipped=[];
  for(const item of approved){
    const key=`${item.name}|${item.region}`;
    if(existingChannels.has(item.channelId)||existingKeys.has(key)||seenChannels.has(item.channelId)){ skipped.push(item.name); continue; }
    seenChannels.add(item.channelId); unique.push(item);
  }
  const marker="] as const;";
  if(!source.includes(marker)) throw new Error(`소스 종료 표식을 찾지 못했습니다: ${args.sources}`);
  const next=source.replace(marker,`${unique.map(sourceLine).join("\n")}${unique.length?"\n":""}${marker}`);
  if(args.apply&&unique.length) await atomicWrite(args.sources,next);
  return {mode:args.apply?"applied":"preview",existingCount:existingChannels.size,approvedInput:approved.length,added:unique.length,skipped:skipped.length,skippedNames:skipped};
}

async function fetchJsonWithRetry(url, attempts=4) {
  let last;
  for(let attempt=1;attempt<=attempts;attempt+=1){
    try{
      const response=await fetch(url,{method:"POST",headers:{"user-agent":"airchurch-registration-cli/1.0"}});
      const body=await response.json().catch(()=>({}));
      if(response.ok&&body.ok) return body;
      last=new Error(`HTTP ${response.status}: ${JSON.stringify(body)}`);
    }catch(error){ last=error; }
    if(attempt<attempts) await new Promise((resolve)=>setTimeout(resolve,1000*2**(attempt-1)));
  }
  throw last;
}

async function sync(args) {
  if(!Number.isInteger(args.start)||args.start<0||!Number.isInteger(args.count)||args.count<1) throw new Error("--sync에는 올바른 --start와 --count가 필요합니다.");
  const batches=[]; let cursor=args.start; const end=args.start+args.count;
  while(cursor<end){
    const limit=Math.min(args.batchSize,end-cursor);
    const url=new URL("/api/sermons/sync",args.site);
    url.searchParams.set("scope",args.scope); url.searchParams.set("start",String(cursor)); url.searchParams.set("limit",String(limit));
    const result=await fetchJsonWithRetry(url);
    batches.push({start:cursor,limit,...result});
    cursor+=limit;
    console.error(`[register] ${cursor-args.start}/${args.count} 처리, 누적 공개 교회 ${result.approved}`);
  }
  return {scope:args.scope,site:args.site,start:args.start,count:args.count,batches,verified:batches.reduce((n,b)=>n+(b.verified||0),0),sermons:batches.reduce((n,b)=>n+(b.imported||0),0)};
}

async function main(){
  const args=parseArgs(process.argv.slice(2));
  if(args.help||(!args.prepare&&!args.sync)){ help(); return; }
  const result={createdAt:new Date().toISOString()};
  if(args.prepare) result.prepare=await prepare(args);
  if(args.sync) result.sync=await sync(args);
  const output=JSON.stringify(result,null,2);
  if(args.report) await atomicWrite(args.report,`${output}\n`);
  console.log(output);
}

main().catch((error)=>{ console.error(`[register] ${error.message}`); process.exitCode=1; });
