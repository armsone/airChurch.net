#!/usr/bin/env node

import {mkdir,readFile,rename,writeFile} from "node:fs/promises";
import path from "node:path";

const input=process.argv[2]??"out/pastor-history/nationwide-import-plan.json",output=process.argv[3]??"out/pastor-history/pastor-people-import-plan.json",plan=JSON.parse(await readFile(input,"utf8"));
const people=new Map(),roles=[];
for(const minister of plan.ministers??[]){
  const personId=minister.directoryMinisterId;
  if(!people.has(personId))people.set(personId,{directoryId:personId,name:minister.name,publicSummary:null,reviewStatus:"approved"});
  roles.push({directoryId:`role:${personId}:${minister.directoryChurchId}:${minister.roleTitle}:${minister.roleStatus}`,personDirectoryId:personId,existingChurchId:minister.existingChurchId??null,directoryChurchId:minister.directoryChurchId,churchName:minister.churchName,denomination:minister.denomination,region:minister.region,roleTitle:minister.roleTitle,roleCategory:minister.roleCategory,roleStatus:minister.roleStatus,startDate:null,endDate:null,sourceUrl:minister.officialSourceUrl??null,reviewStatus:"approved"});
}
const payload={metadata:{generatedAt:new Date().toISOString(),published:false,databaseWrites:0,people:people.size,roles:roles.length,peopleWithoutCurrentChurch:[...people.values()].filter((person)=>!roles.some((role)=>role.personDirectoryId===person.directoryId&&role.roleStatus==="current")).length,videoRequired:false,privateDataIncluded:false},people:[...people.values()],roles};
await mkdir(path.dirname(output),{recursive:true});const temp=`${output}.${process.pid}.tmp`;await writeFile(temp,`${JSON.stringify(payload,null,2)}\n`);await rename(temp,output);console.log(JSON.stringify({...payload.metadata,output}));
