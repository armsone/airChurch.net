#!/usr/bin/env node

import {mkdir,readFile,rename,writeFile} from "node:fs/promises";
import path from "node:path";
import {createHash} from "node:crypto";

const args=process.argv.slice(2),outputIndex=args.indexOf("--output");
const output=outputIndex>=0?args[outputIndex+1]:"out/pastor-history/nationwide-directory.json";
const inputs=args.filter((value,index)=>!value.startsWith("--")&&index!==outputIndex+1);
if(!inputs.length)throw new Error("directory_inputs_required");
const text=(value)=>String(value??"").normalize("NFKC").replace(/\s+/g," ").trim();
const key=(...values)=>values.map((value)=>text(value).toLowerCase().replace(/[^0-9a-z가-힣]/g,"")).join("|");
const id=(value)=>createHash("sha256").update(value).digest("hex").slice(0,20);
const person=(value)=>text(value).replace(/^(?:담임|위임|대표)?\s*목사(?:님)?\s*/u,"").replace(/\s*목사(?:님)?$/u,"").trim();
const missing=/^(?:|미상|없음|공석|청빙중|담임목사 확인 필요)$/u;

const churches=new Map(),ministers=new Map();
for(const file of inputs){
  const bundle=JSON.parse(await readFile(file,"utf8"));
  for(const record of bundle.records??[]){
    const churchName=text(record.name??record.churchName),denomination=text(record.denomination),region=text(record.region),presbytery=text(record.presbytery);
    if(!churchName||!denomination)continue;
    const churchKey=key(churchName,denomination,region);
    const homepage=text(record.homepage??record.homepageUrl),homepageUrl=/^https?:\/\//i.test(homepage)?homepage:null;
    if(!churches.has(churchKey))churches.set(churchKey,{directoryChurchId:`church-${id(churchKey)}`,name:churchName,denomination,region,presbytery,homepageUrl,officialSourceUrl:text(record.officialSourceUrl??record.evidence?.directorySourceUrl??record.evidence?.sourceApiUrl)||null});
    else if(!churches.get(churchKey).homepageUrl&&homepageUrl)churches.get(churchKey).homepageUrl=homepageUrl;
    const church=churches.get(churchKey),name=person(record.pastor??record.pastorName);
    if(!missing.test(name)){
      const ministerKey=key(name,churchName,denomination,region,"담임목사");
      if(!ministers.has(ministerKey))ministers.set(ministerKey,{directoryMinisterId:`minister-${id(ministerKey)}`,name,roleTitle:"담임목사",roleCategory:"current_primary",roleStatus:"current",directoryChurchId:church.directoryChurchId,churchName,denomination,region,presbytery,officialSourceUrl:church.officialSourceUrl,history:[],videos:[],privateData:null});
    }
  }
}
const result={metadata:{generatedAt:new Date().toISOString(),published:false,churches:churches.size,ministers:ministers.size,videoRequired:false,homepageRequired:false,privateDataIncluded:false},churches:[...churches.values()],ministers:[...ministers.values()]};
await mkdir(path.dirname(output),{recursive:true});const temp=`${output}.${process.pid}.tmp`;await writeFile(temp,`${JSON.stringify(result,null,2)}\n`);await rename(temp,output);
console.log(JSON.stringify({...result.metadata,output}));
