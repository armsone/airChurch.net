#!/usr/bin/env node

const baseUrl=(process.argv.find((value)=>value.startsWith("--base-url="))?.split("=")[1]||"https://airchurch.net").replace(/\/$/,"");
const maintenanceToken=process.env.AIRCHURCH_MAINTENANCE_TOKEN||"";
if(maintenanceToken.length<32)throw new Error("AIRCHURCH_MAINTENANCE_TOKEN must contain at least 32 characters");

let start=0;
let imported=0;
let checked=0;
do {
  const response=await fetch(`${baseUrl}/api/sermons/sync?scope=photo_pastors&start=${start}&limit=3`,{method:"POST",headers:{authorization:`Bearer ${maintenanceToken}`}});
  if(!response.ok)throw new Error(`${response.status} ${response.statusText}`);
  const result=await response.json();
  imported+=Number(result.imported||0);
  checked+=Number(result.checked||0);
  console.log(`[진행] 사진 목사님 연결 교회 ${checked}곳 확인 · 말씀 ${imported}편 반영`);
  start=Number(result.nextStart||0);
} while(start>0);

console.log(`[완료] 공식 채널 ${checked}곳 · 사진 목사님 말씀 ${imported}편 반영`);
