#!/usr/bin/env node

import {mkdir,readFile,rename,writeFile} from "node:fs/promises";
import path from "node:path";

const baselineFile=process.argv[2]??"out/pastor-history/pastor-people-import-plan.json",additionalFile=process.argv[3]??"out/pastor-history/collected-pastor-import-plan.json",output=process.argv[4]??"out/pastor-history/combined-pastor-import-plan.json";
const [baseline,additional]=await Promise.all([readFile(baselineFile,"utf8").then(JSON.parse),readFile(additionalFile,"utf8").then(JSON.parse)]);
for(const plan of [baseline,additional])if(plan.metadata?.automaticApproval!==false||Number(plan.metadata?.databaseWrites)!==0||plan.metadata?.privateDataIncluded!==false)throw new Error("Refusing a pastor plan that is not private-data-free and pending review");
const people=[...new Map([...baseline.people,...additional.people].map((item)=>[item.directoryId,item])).values()];
const roles=[...new Map([...baseline.roles,...additional.roles].map((item)=>[[item.personDirectoryId,item.existingChurchId??item.directoryChurchId??item.churchName,item.roleTitle,item.roleStatus,item.startDate??"",item.endDate??""].join("|"),item])).values()];
const identityLinks=[...new Map([...(baseline.identityLinks??[]),...(additional.identityLinks??[])].map((item)=>[[item.leftPersonDirectoryId,item.rightPersonDirectoryId,item.evidenceType,item.evidenceValue].join("|"),item])).values()];
const metadata={generatedAt:new Date().toISOString(),sourceFiles:[baselineFile,additionalFile],published:false,databaseWrites:0,automaticApproval:false,privateDataIncluded:false,people:people.length,roles:roles.length,identityLinks:identityLinks.length,photosPrepared:Number(baseline.metadata?.photosPrepared??0)+Number(additional.metadata?.photosPrepared??0),photosAutomaticallyPublishable:0,homonymRecordsExcluded:Number(baseline.metadata?.homonymRecordsExcluded??0)+Number(additional.metadata?.homonymRecordsExcluded??0),identityLinksAutomaticallyMerged:0,copyrightMode:"structured-facts-only; photo-rights-approval-required"};
await mkdir(path.dirname(output),{recursive:true});const temporary=`${output}.${process.pid}.tmp`;await writeFile(temporary,`${JSON.stringify({metadata,people,roles,identityLinks},null,2)}\n`);await rename(temporary,output);console.log(JSON.stringify({...metadata,output}));
