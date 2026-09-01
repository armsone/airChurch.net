#!/usr/bin/env node

import {mkdir,readFile,rename,writeFile} from "node:fs/promises";
import path from "node:path";

const input=process.argv[2]??"out/pastor-history/nationwide-import-plan.json";
const output=process.argv[3]??"out/pastor-history/pastor-people-import-plan.json";
const reviewOutput=process.argv[4]??"out/pastor-history/pastor-people-review-queue.json";
const plan=JSON.parse(await readFile(input,"utf8"));
const allowedCategories=new Set(["current_primary","associate","education","cooperating","emeritus","retired","founding","other"]),allowedStatuses=new Set(["current","former"]),privateKeys=/email|phone|mobile|account|bank|contact|address|birth|family|resident|password|token|secret/i;
const normalize=(value)=>String(value??"").normalize("NFKC").replace(/\s+/g," ").trim();
const validSource=(value)=>{try{const url=new URL(value);return (url.protocol==="https:"||url.protocol==="http:")&&Boolean(url.hostname);}catch{return false;}};
const safeDirectoryId=(value,prefix)=>new RegExp(`^${prefix}-[a-zA-Z0-9_-]{8,80}$`).test(String(value??""));
const writeJson=async(file,value)=>{await mkdir(path.dirname(file),{recursive:true});const temp=`${file}.${process.pid}.tmp`;await writeFile(temp,`${JSON.stringify(value,null,2)}\n`);await rename(temp,file);};

const identityNames=new Map(),people=new Map(),roles=[],review=[],seenRoles=new Set();
let duplicates=0,privateFieldsRemoved=0;
for(const [index,minister] of (plan.ministers??[]).entries()){
  const personId=normalize(minister.directoryMinisterId),name=normalize(minister.name),churchId=normalize(minister.directoryChurchId),churchName=normalize(minister.churchName),roleTitle=normalize(minister.roleTitle),roleCategory=normalize(minister.roleCategory),roleStatus=normalize(minister.roleStatus),sourceUrl=normalize(minister.officialSourceUrl),issues=[];
  if(!safeDirectoryId(personId,"minister"))issues.push("invalid_person_id");
  if(name.length<2||name.length>40)issues.push("invalid_name");
  if(!safeDirectoryId(churchId,"church"))issues.push("invalid_church_id");
  if(!churchName)issues.push("missing_church_name");
  if(!roleTitle)issues.push("missing_role_title");
  if(!allowedCategories.has(roleCategory))issues.push("unknown_role_category");
  if(!allowedStatuses.has(roleStatus))issues.push("unknown_role_status");
  if(!validSource(sourceUrl))issues.push("invalid_official_source");
  const priorName=identityNames.get(personId);if(priorName&&priorName!==name)issues.push("person_id_name_conflict");else if(personId)identityNames.set(personId,name);
  if(minister.privateData!=null){privateFieldsRemoved++;issues.push("private_data_removed");}
  const copiedSensitiveKeys=Object.keys(minister).filter((key)=>privateKeys.test(key)&&key!=="privateData");if(copiedSensitiveKeys.length){privateFieldsRemoved+=copiedSensitiveKeys.length;issues.push("sensitive_fields_removed");}
  const roleKey=[personId,minister.existingChurchId??churchId,roleTitle,roleStatus,normalize(minister.startDate),normalize(minister.endDate)].join("|");
  if(seenRoles.has(roleKey)){duplicates++;continue;}seenRoles.add(roleKey);
  const candidate={directoryId:`role:${personId}:${churchId}:${roleTitle}:${roleStatus}`,personDirectoryId:personId,existingChurchId:Number.isInteger(Number(minister.existingChurchId))?Number(minister.existingChurchId):null,directoryChurchId:churchId,churchName,denomination:normalize(minister.denomination),region:normalize(minister.region),roleTitle,roleCategory,roleStatus,startDate:normalize(minister.startDate)||null,endDate:normalize(minister.endDate)||null,sourceUrl:validSource(sourceUrl)?sourceUrl:null,reviewStatus:"pending"};
  const blocking=issues.filter((issue)=>!["private_data_removed","sensitive_fields_removed"].includes(issue));
  if(blocking.length){review.push({inputIndex:index,personDirectoryId:personId,name,issues,candidate});continue;}
  if(!people.has(personId))people.set(personId,{directoryId:personId,name,publicSummary:null,reviewStatus:"pending"});
  roles.push(candidate);
}

const approvedPeople=new Set(roles.map((role)=>role.personDirectoryId)),importPeople=[...people.values()].filter((person)=>approvedPeople.has(person.directoryId));
const metadata={generatedAt:new Date().toISOString(),sourceFile:input,published:false,databaseWrites:0,automaticApproval:false,people:importPeople.length,roles:roles.length,reviewQueue:review.length,exactDuplicatesRemoved:duplicates,privateFieldsRemoved,copyrightMode:"structured-facts-only",identityPolicy:"directory-id-and-source; names-never-merged",videoRequired:false};
await Promise.all([writeJson(output,{metadata,people:importPeople,roles}),writeJson(reviewOutput,{metadata:{generatedAt:metadata.generatedAt,sourceFile:input,items:review.length},items:review})]);
console.log(JSON.stringify({...metadata,output,reviewOutput}));
