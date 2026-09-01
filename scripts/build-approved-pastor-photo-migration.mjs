#!/usr/bin/env node

import {readFile,writeFile} from "node:fs/promises";

const input=process.argv[2]??"out/pastor-history/national-collection-v3/photos-official/photos.json";
const output=process.argv[3]??"drizzle/0482_publish_official_pastor_photos.sql";
const bundle=JSON.parse(await readFile(input,"utf8")),photos=bundle.photos??[];
if(!photos.length)throw new Error("No approved official pastor photos found");
const sql=(value)=>`'${String(value).replaceAll("'","''")}'`;
const lines=["-- Official public clergy profile photos. Publish first; promptly hide and review on a concrete notice."];
for(const photo of photos){
  if(photo.identityUse!=="official_labeled_photo_evidence"||photo.usageBasis!=="official_public_clergy_profile"||photo.publicationPolicy!=="publish_then_notice_and_takedown"||photo.thirdPartyImagePolicy!=="single_person_profile_only"||photo.subjectAudit?.faces!==1)throw new Error(`Unsafe photo evidence: ${photo.directoryPersonId}`);
  lines.push(`UPDATE pastor_people SET photo_url=${sql(photo.imageUrl)},photo_source_url=${sql(photo.sourcePageUrl)},photo_sha256=${sql(photo.imageSha256)},photo_usage_basis='official_public_clergy_profile',photo_review_status='approved',updated_at=CURRENT_TIMESTAMP WHERE directory_id=${sql(photo.directoryPersonId)};`);
}
await writeFile(output,`${lines.join("\n")}\n`);
console.log(JSON.stringify({input,output,photos:photos.length,bytes:Buffer.byteLength(lines.join("\n"))}));
