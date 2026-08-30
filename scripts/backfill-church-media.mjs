#!/usr/bin/env node

const baseUrl=(process.argv.find((value)=>value.startsWith("--base-url="))?.split("=")[1]||"https://airchurch.net").replace(/\/$/,"");
const concurrency=Math.max(1,Math.min(3,Number(process.argv.find((value)=>value.startsWith("--concurrency="))?.split("=")[1]||3)));
const batchSize=20;

async function requestJson(url,options) {
  const response=await fetch(url,options);
  if(!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return response.json();
}

const directory=await requestJson(`${baseUrl}/api/churches?global=`);
const total=Number(directory.total||0);
const starts=Array.from({length:Math.ceil(total/batchSize)},(_,index)=>index*batchSize);
let cursor=0;
let completed=0;
let failures=0;

async function worker() {
  while(cursor<starts.length) {
    const start=starts[cursor++];
    try {
      await requestJson(`${baseUrl}/api/sermons/sync?scope=database&start=${start}&limit=${batchSize}`,{method:"POST"});
    } catch(error) {
      failures++;
      console.error(`[실패] ${start+1}~${Math.min(start+batchSize,total)}: ${error instanceof Error?error.message:String(error)}`);
    }
    completed++;
    console.log(`[진행] ${Math.min(completed*batchSize,total).toLocaleString("ko-KR")} / ${total.toLocaleString("ko-KR")} 교회`);
  }
}

await Promise.all(Array.from({length:concurrency},worker));
const [sermons,shorts,praises]=await Promise.all([
  requestJson(`${baseUrl}/api/sermons?backfill=${Date.now()}`),
  requestJson(`${baseUrl}/api/shorts?backfill=${Date.now()}`),
  requestJson(`${baseUrl}/api/praises?backfill=${Date.now()}`),
]);
console.log(`[완료] 말씀 ${sermons.items?.length||0}개 · 쇼츠 ${shorts.items?.length||0}개 · 찬양 ${praises.items?.length||0}개 · 실패 묶음 ${failures}개`);
if(failures) process.exitCode=1;
