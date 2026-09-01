#!/usr/bin/env node

import {mkdir,readFile,rename,writeFile} from "node:fs/promises";
import path from "node:path";

const baselineFile=process.argv[2]??"out/pastor-history/pastor-people-import-plan.json",additionalFile=process.argv[3]??"out/pastor-history/collected-pastor-import-plan.json",curatedFile=process.argv[4]??"data/pastor-history/curated-pastor-people.json",output=process.argv[5]??"out/pastor-history/combined-pastor-import-plan.json";
const plans=await Promise.all([baselineFile,additionalFile,curatedFile].map((file)=>readFile(file,"utf8").then(JSON.parse)));for(const plan of plans)if(plan.metadata?.automaticApproval!==false||Number(plan.metadata?.databaseWrites)!==0||plan.metadata?.privateDataIncluded!==false)throw new Error("Refusing a pastor plan that is not private-data-free and pending review");
const people=[...new Map(plans.flatMap((plan)=>plan.people??[]).map((item)=>[item.directoryId,item])).values()];
const roles=[...new Map(plans.flatMap((plan)=>plan.roles??[]).map((item)=>[[item.personDirectoryId,item.existingChurchId??item.directoryChurchId??item.churchName,item.roleTitle,item.roleStatus,item.startDate??"",item.endDate??""].join("|"),item])).values()];
const metadata={generatedAt:new Date().toISOString(),sourceFiles:[baselineFile,additionalFile,curatedFile],published:false,databaseWrites:0,automaticApproval:false,privateDataIncluded:false,people:people.length,roles:roles.length,nameBasedExclusions:0,photosPrepared:plans.reduce((sum,plan)=>sum+Number(plan.metadata?.photosPrepared??0),0),photosAutomaticallyPublishable:0,copyrightMode:"structured-facts-only; photo-rights-approval-required"};
await mkdir(path.dirname(output),{recursive:true});const temporary=`${output}.${process.pid}.tmp`;await writeFile(temporary,`${JSON.stringify({metadata,people,roles},null,2)}\n`);await rename(temporary,output);console.log(JSON.stringify({...metadata,output}));
