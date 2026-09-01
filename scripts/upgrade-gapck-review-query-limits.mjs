#!/usr/bin/env node
import {readFile,readdir,rename,writeFile} from "node:fs/promises";
import path from "node:path";

export function upgradeGapckReviewQueryLimits(batch){let changed=0;for(const task of batch.tasks??[]){if(task.decision!=="ready")continue;for(const source of task.official_sources??[]){const url=new URL(source.url);if(url.hostname!=="gapck.org"||!url.pathname.startsWith("/api/v1/"))continue;if(url.searchParams.get("limit")!=="10")continue;url.searchParams.set("limit","100");source.url=url.toString();changed++;}}return changed;}
async function atomicJson(file,value){const temp=`${file}.${process.pid}.tmp`;await writeFile(temp,`${JSON.stringify(value,null,2)}\n`);await rename(temp,file);}
async function main(){const args=process.argv.slice(2),index=args.indexOf("--input-dir"),inputDir=index>=0?args[index+1]:"out/pastor-source-review-batches";let changedSources=0,changedBatches=0;for(const name of (await readdir(inputDir)).filter((item)=>/^batch-\d+\.json$/.test(item)).sort()){const file=path.join(inputDir,name),batch=JSON.parse(await readFile(file,"utf8")),changed=upgradeGapckReviewQueryLimits(batch);if(changed){await atomicJson(file,batch);changedSources+=changed;changedBatches++;}}console.log(JSON.stringify({changed_batches:changedBatches,changed_sources:changedSources,database_writes:0,published:false}));}
if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(new URL(import.meta.url).pathname))main().catch((error)=>{console.error(error.message);process.exitCode=1;});
