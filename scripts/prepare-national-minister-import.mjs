#!/usr/bin/env node

import {mkdir,readFile,rename,writeFile} from "node:fs/promises";
import path from "node:path";

const directoryPath=process.argv[2]??"out/pastor-history/nationwide-directory.json",registeredPath=process.argv[3]??"data/worship-schedules/all-registered-churches.json",output=process.argv[4]??"out/pastor-history/nationwide-import-plan.json";
const clean=(value)=>String(value??"").normalize("NFKC").toLowerCase().replace(/[^0-9a-z가-힣]/g,"");
const churchKey=(item)=>[item.name??item.churchName??item.church_name,item.denomination,item.region].map(clean).join("|");
const directory=JSON.parse(await readFile(directoryPath,"utf8")),registered=JSON.parse(await readFile(registeredPath,"utf8")),registeredRows=registered.items??registered.records??registered.churches??[];
const existing=new Map(registeredRows.map((church)=>[churchKey(church),church]));
const churches=directory.churches.map((church)=>{const match=existing.get(churchKey(church));return {...church,existingChurchId:Number(match?.id??match?.churchId??match?.church_id)||null};});
const churchMap=new Map(churches.map((church)=>[church.directoryChurchId,church]));
const ministers=directory.ministers.map((minister)=>{const church=churchMap.get(minister.directoryChurchId);return {...minister,existingChurchId:church?.existingChurchId??null};});
const payload={metadata:{generatedAt:new Date().toISOString(),published:false,databaseWrites:0,churches:churches.length,matchedExistingChurches:churches.filter((church)=>church.existingChurchId).length,newChurches:churches.filter((church)=>!church.existingChurchId).length,ministers:ministers.length,matchedExistingMinisters:ministers.filter((minister)=>minister.existingChurchId).length,newChurchMinisters:ministers.filter((minister)=>!minister.existingChurchId).length},churches,ministers};
await mkdir(path.dirname(output),{recursive:true});const temp=`${output}.${process.pid}.tmp`;await writeFile(temp,`${JSON.stringify(payload,null,2)}\n`);await rename(temp,output);console.log(JSON.stringify({...payload.metadata,output}));
