#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";
import { isIP } from "node:net";

const PRIVATE_HOST=/^(?:localhost|0\.0\.0\.0|127(?:\.\d{1,3}){3}|10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|169\.254(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2}|\[?::1\]?)$/i;
const SECRET_TEXT=/(?:[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|(?:헌금|후원|입금)\s*계좌|계좌\s*[:：]?\s*(?:[가-힣A-Za-z]+은행\s*)?[\d-]{8,}|(?:휴대폰|핸드폰|담임목사)\s*[:：]?\s*01[016789][\d-]{7,})/i;
const FORBIDDEN_KEYS=/^(?:email|e_mail|mobile|cellphone|account_number|bank_account|spouse|children|family|birth_date|health|medical|resident_id)$/i;
const RAW_CONTENT_KEYS=/^(?:html|raw_html|rawHtml|page_text|pageText|response_body|responseBody)$/;
const PUBLIC_STATUS=/^(?:approved|published|public|human_approved)$/i;
const URL_KEY=/(?:^|_)(?:url|urls)$/i;
const ID_KEY=/(?:^|_)(?:record|event|profile)_?id$/i;

function collect(value,location="root",state={errors:[],warnings:[],ids:new Map(),rawContacts:[],counts:{urls:0,records:0}}){
  if(Array.isArray(value)){value.forEach((item,index)=>collect(item,`${location}[${index}]`,state));return state;}
  if(!value||typeof value!=="object")return state;
  state.counts.records+=1;
  const contactKeys=["official_contact_email","officialContactEmail","official_contact_phone","officialContactPhone","official_contact_account","officialContactAccount"].filter((key)=>typeof value[key]==="string"&&value[key]);
  if(contactKeys.length){
    const scope=value.scope??value.contact_scope??value.contactScope;
    const visibility=value.visibility;
    const reveal=value.reveal_policy??value.revealPolicy;
    if(!["organization","official_role"].includes(scope))state.errors.push({code:"official_contact_scope_required",location});
    if(visibility!=="admin_only")state.errors.push({code:"contact_admin_only_required",location});
    if(reveal!=="masked_audited")state.errors.push({code:"protected_reveal_policy_required",location});
    if(!String(value.source_url??value.sourceUrl??"").startsWith("http"))state.errors.push({code:"official_contact_source_required",location});
    if(!["pending","hold"].includes(value.review_status??value.reviewStatus))state.errors.push({code:"official_contact_review_required",location});
    state.rawContacts.push(...contactKeys.map((key)=>`${location}.${key}`));
  }
  for(const [key,item] of Object.entries(value)){
    const here=`${location}.${key}`;
    if(FORBIDDEN_KEYS.test(key)&&!/\.metadata\.privacy_(?:scan|Scan)\.detected\./.test(here))state.errors.push({code:"forbidden_personal_field",location:here});
    if(RAW_CONTENT_KEYS.test(key))state.errors.push({code:"raw_copyright_content_forbidden",location:here});
    if(ID_KEY.test(key)&&typeof item==="string"&&item){const earlier=state.ids.get(item);if(earlier&&earlier!==here)state.errors.push({code:"duplicate_record_id",location:here,other:earlier,value:item});else state.ids.set(item,here);}
    if(URL_KEY.test(key)){
      const urls=Array.isArray(item)?item:[item];
      for(const raw of urls){if(typeof raw!=="string"||!raw)continue;state.counts.urls+=1;try{const url=new URL(raw);if(!["http:","https:"].includes(url.protocol))state.errors.push({code:"web_protocol_required",location:here,value:raw});else if(url.protocol==="http:")state.warnings.push({code:"unencrypted_transport",location:here,value:raw});if(url.username||url.password)state.errors.push({code:"url_credentials_forbidden",location:here});if(isIP(url.hostname.replace(/^\[|\]$/g,""))||PRIVATE_HOST.test(url.hostname)||url.hostname.endsWith(".local"))state.errors.push({code:"private_host_forbidden",location:here,value:raw});}catch{state.errors.push({code:"invalid_url",location:here,value:raw});}}
    }
    if(typeof item==="string"){
      if(!/^official_?contact_?(?:email|phone|account)$/i.test(key)&&SECRET_TEXT.test(item))state.errors.push({code:"sensitive_text",location:here});
      if((key==="source_text"||key==="sourceText")&&item.length>1000)state.errors.push({code:"source_excerpt_too_long",location:here,length:item.length});
      if((key==="review_status"||key==="reviewStatus"||key==="status")&&PUBLIC_STATUS.test(item))state.warnings.push({code:"preapproved_record",location:here,value:item});
    }
    collect(item,here,state);
  }
  return state;
}

const passed=(value)=>value===true||value?.passed===true||value?.ok===true||value?.status==="passed";

export function validatePublicDataArtifact(value,{release=false}={}){
  const state=collect(value);
  const approvalVerified=value?.metadata?.approvalVerified===true;
  if(!approvalVerified&&state.warnings.some((warning)=>warning.code==="preapproved_record"))state.errors.push({code:"approval_required",location:"root.metadata.approvalVerified"});
  if(release){
    const privacy=value?.metadata?.privacyScan??value?.metadata?.privacy_scan;
    const transport=value?.metadata?.transportReview??value?.metadata?.transport_review;
    if(!approvalVerified)state.errors.push({code:"verified_approval_required",location:"root.metadata.approvalVerified"});
    if(!passed(privacy))state.errors.push({code:"privacy_scan_required",location:"root.metadata.privacyScan"});
    if(state.warnings.some((warning)=>warning.code==="unencrypted_transport")){
      if(!passed(transport))state.errors.push({code:"http_transport_review_required",location:"root.metadata.transportReview"});
      if(transport?.doesNotAffectEligibility!==true&&transport?.eligibilityImpact!=="none")state.errors.push({code:"transport_fairness_confirmation_required",location:"root.metadata.transportReview.doesNotAffectEligibility"});
    }
    if(state.rawContacts.length)state.errors.push({code:"raw_contact_requires_encryption",location:state.rawContacts[0],count:state.rawContacts.length});
  }
  return {ok:state.errors.length===0,errors:state.errors,warnings:state.warnings,summary:{urlsChecked:state.counts.urls,objectsChecked:state.counts.records,uniqueRecordIds:state.ids.size,approvalVerified}};
}

async function main(){
  const files=process.argv.slice(2).filter((arg)=>!arg.startsWith("--"));
  const release=process.argv.includes("--release");
  if(!files.length)throw new Error("usage: node scripts/validate-public-data-import.mjs FILE.json [...]");
  let failed=false;
  for(const file of files){const value=JSON.parse(await readFile(file,"utf8"));const result=validatePublicDataArtifact(value,{release});failed ||= !result.ok;console.log(JSON.stringify({file:path.resolve(file),mode:release?"release":"audit",...result}));}
  if(failed)process.exitCode=1;
}

if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(new URL(import.meta.url).pathname))main().catch((error)=>{console.error(error.message);process.exitCode=1;});
