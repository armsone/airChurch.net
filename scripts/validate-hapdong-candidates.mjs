#!/usr/bin/env node

/**
 * 교단 명부 기반 YouTube 수집 결과를 하나로 합치고 자동 검증 규칙을 적용합니다.
 * 채널 고유성·채널명 정확 일치·담임목사 근거·최근 설교 업로드가 모두 확인된
 * 경우에 한해, 최근 영상 제목에 교회명이 반복 등장하거나(repeatedRecentChurchName)
 * sourceEvidence.directorySourceUrl로 공식 교단 디렉터리 대비 교차 검증이 된
 * 경우(directoryCrossVerified) 중 하나를 추가로 만족해야 verified로 승격합니다.
 * 채널 중복, 담임목사 근거 부재, 최근 설교 부재는 여전히 review/hold로 둡니다.
 */

import { readFile, writeFile, rename } from "node:fs/promises";

function parseArgs(argv) {
  const args={inputs:[],output:"out/pck-hapdong-validated.json",reviewOutput:"out/pck-hapdong-review-needed.json"};
  for(let i=0;i<argv.length;i+=1){
    const token=argv[i];
    if(token==="--input") args.inputs.push(argv[++i]);
    else if(token==="--output") args.output=argv[++i];
    else if(token==="--review-output") args.reviewOutput=argv[++i];
    else if(token==="--help"||token==="-h") {
      console.log("node scripts/validate-hapdong-candidates.mjs [--input result.json ...] [--output validated.json] [--review-output review.json]");
      process.exit(0);
    } else throw new Error(`알 수 없는 옵션: ${token}`);
  }
  if(!args.inputs.length) args.inputs=[1,2,3,4].map((n)=>`out/pck-hapdong-quarter-${n}-result.json`);
  return args;
}

async function atomicJson(path,value){
  const tmp=`${path}.tmp-${process.pid}`;
  await writeFile(tmp,`${JSON.stringify(value,null,2)}\n`,"utf8");
  await rename(tmp,path);
}

function has(record,signal){ return Array.isArray(record.signals)&&record.signals.includes(signal); }

async function main(){
  const args=parseArgs(process.argv.slice(2));
  const rows=[];
  for(const path of args.inputs){
    const value=JSON.parse(await readFile(path,"utf8"));
    rows.push(...(Array.isArray(value)?value:value.results||[]));
  }
  const candidates=rows.filter((row)=>row.status==="candidate");
  const channelUse=new Map();
  for(const row of candidates){
    if(!row.channelId) continue;
    const list=channelUse.get(row.channelId)||[];
    list.push(row.recordKey); channelUse.set(row.channelId,list);
  }
  const verified=[]; const review=[];
  for(const row of candidates){
    const conflicts=channelUse.get(row.channelId)||[];
    const checks={
      uniqueChannel:conflicts.length===1,
      exactChannelName:has(row,"channel_title_exact_match"),
      pastorSupported:has(row,"pastor_name_supporting"),
      repeatedRecentChurchName:has(row,"multiple_recent_titles_exact_name"),
      directoryCrossVerified:Boolean(row.sourceEvidence?.directorySourceUrl),
      recentSermons:Array.isArray(row.evidenceVideos)&&row.evidenceVideos.length>=2&&row.evidenceVideos.some((video)=>Number(video.estimatedAgeDays)<=180),
    };
    // 신원 근거(uniqueChannel/exactChannelName/pastorSupported/recentSermons)는
    // 모두 필수다. 반복 영상 제목(repeatedRecentChurchName) 대신, 공식 교단
    // 디렉터리 URL(directoryCrossVerified)로도 대체 교차 검증을 인정한다.
    const passed=
      checks.uniqueChannel&&
      checks.exactChannelName&&
      checks.pastorSupported&&
      checks.recentSermons&&
      (checks.repeatedRecentChurchName||checks.directoryCrossVerified);
    const result={...row,status:passed?"verified":"review",decision:passed?"approved":"needs_review",validation:{checks,channelConflicts:conflicts.length>1?conflicts:[],ruleVersion:"hapdong-generalized-v2"}};
    (passed?verified:review).push(result);
  }
  const metadata={generatedAt:new Date().toISOString(),sourceRecords:rows.length,candidates:candidates.length,verified:verified.length,reviewNeeded:review.length,heldAtCollection:rows.filter((row)=>row.status==="hold").length,errors:rows.filter((row)=>row.status==="error").length};
  await atomicJson(args.output,{metadata,results:verified});
  await atomicJson(args.reviewOutput,{metadata,results:review});
  console.log(JSON.stringify(metadata,null,2));
}

main().catch((error)=>{ console.error(error.message); process.exitCode=1; });
