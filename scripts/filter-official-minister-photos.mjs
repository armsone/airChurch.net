#!/usr/bin/env node

import {execFileSync} from "node:child_process";
import {mkdir,readFile,rename,writeFile} from "node:fs/promises";
import path from "node:path";

const input=process.argv[2]??"out/pastor-history/national-collection-v3/photos-official/photos.json";
const output=process.argv[3]??input;
const cacheDir=process.argv[4]??"out/pastor-history/national-collection-v3/photos-official/face-audit-cache";
const bundle=JSON.parse(await readFile(input,"utf8")),photos=bundle.photos??[];
await mkdir(cacheDir,{recursive:true});

const extension=(type)=>type==="image/png"?"png":type==="image/webp"?"webp":type==="image/gif"?"gif":"jpg";
const localByPhoto=new Map(),failures=[];
let cursor=0;
const workers=Array.from({length:4},async()=>{while(cursor<photos.length){const photo=photos[cursor++],file=path.join(cacheDir,`${photo.imageSha256}.${extension(photo.contentType)}`);try{const response=await fetch(photo.imageUrl,{signal:AbortSignal.timeout(10_000),headers:{"user-agent":"airChurch-public-directory/1.0 (+https://airchurch.net)",accept:"image/*"}});if(!response.ok)throw new Error(`http_${response.status}`);await writeFile(file,new Uint8Array(await response.arrayBuffer()));localByPhoto.set(photo,file);}catch(error){failures.push({directoryPersonId:photo.directoryPersonId,reason:error.message});}}});
await Promise.all(workers);

const detector=path.join(cacheDir,"detect-official-photo-subjects");
execFileSync("swiftc",["scripts/detect-official-photo-subjects.swift","-o",detector],{stdio:"inherit"});
const files=[...new Set(localByPhoto.values())],audits=new Map();
for(let offset=0;offset<files.length;offset+=100){const stdout=execFileSync(detector,files.slice(offset,offset+100),{encoding:"utf8",maxBuffer:10_000_000});for(const line of stdout.trim().split("\n").filter(Boolean)){const audit=JSON.parse(line);audits.set(audit.file,audit);}}

const approved=[],rejected=[];
for(const photo of photos){const file=localByPhoto.get(photo),audit=file?audits.get(file):null;const reason=!audit?"audit_unavailable":audit.error?"vision_audit_failed":audit.faces!==1?audit.faces===0?"no_face_detected":"multiple_people_detected":audit.largestFaceArea<0.012?"face_too_small_for_profile":audit.recognizedTextCharacters>32?"text_heavy_non_profile_image":null;if(reason){rejected.push({...photo,reason,audit});continue;}approved.push({...photo,subjectAudit:{faces:1,largestFaceArea:Number(audit.largestFaceArea.toFixed(6)),recognizedTextCharacters:audit.recognizedTextCharacters,method:"apple-vision"}});}
const metadata={...bundle.metadata,generatedAt:new Date().toISOString(),preFaceAuditPhotos:photos.length,officialLabeledPhotos:approved.length,missingPhotos:Number(bundle.metadata?.totalPeople??approved.length)-approved.length,coveragePercent:Number((approved.length/Number(bundle.metadata?.totalPeople??approved.length)*100).toFixed(2)),faceAuditRejected:rejected.length,faceAuditFailureCounts:{...failures.reduce((counts,item)=>(counts[item.reason]=(counts[item.reason]??0)+1,counts),{}),...rejected.reduce((counts,item)=>(counts[item.reason]=(counts[item.reason]??0)+1,counts),{})},publicationPolicy:"official-single-person-profile; publish-then-notice-and-takedown"};
const temporary=`${output}.${process.pid}.tmp`;await writeFile(temporary,`${JSON.stringify({metadata,photos:approved},null,2)}\n`);await rename(temporary,output);await writeFile(path.join(path.dirname(output),"face-audit-rejected.json"),`${JSON.stringify({metadata:{generatedAt:metadata.generatedAt,rejected:rejected.length},photos:rejected},null,2)}\n`);console.log(JSON.stringify({...metadata,output}));
