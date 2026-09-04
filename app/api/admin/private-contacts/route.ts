import { accessSession } from "../../../admin-access";
import { clean,database,ensurePrivateContactTables,ensureSermonTables,readLimitedJson,requestOriginIsInvalid,resolveChurchId } from "../../_shared";
import { digestPrivateContact,encryptPrivateContact } from "../../../private-contact-vault";

export async function POST(request:Request){
  if(requestOriginIsInvalid(request))return Response.json({error:"허용되지 않은 요청입니다."},{status:403});
  const session=await accessSession(request);
  if(session?.role!=="admin")return Response.json({error:"관리자 권한이 필요합니다."},{status:403,headers:{"cache-control":"no-store"}});
  const body=await readLimitedJson(request,8192);if(body.tooLarge)return Response.json({error:"요청 내용이 너무 큽니다."},{status:413});
  const data=body.data,churchId=Number(data.churchId),type=clean(data.type,20),value=clean(data.value,200),scope=clean(data.scope,30)||"organization",sourceUrl=clean(data.sourceUrl,500);
  if(!Number.isInteger(churchId)||churchId<1||!["email","phone","account"].includes(type)||!value||!["organization","official_role"].includes(scope))return Response.json({error:"저장할 정보를 확인해 주세요."},{status:400});
  let source:URL;try{source=new URL(sourceUrl);}catch{return Response.json({error:"공식 출처 주소를 확인해 주세요."},{status:400});}
  if(!["http:","https:"].includes(source.protocol)||source.username||source.password)return Response.json({error:"공식 HTTP 또는 HTTPS 출처만 사용할 수 있습니다."},{status:400});
  const db=database();await Promise.all([ensureSermonTables(db),ensurePrivateContactTables(db)]);
  const internalChurchId=await resolveChurchId(db,churchId);if(!internalChurchId)return Response.json({error:"교회를 찾을 수 없습니다."},{status:404});
  const [encrypted,digest]=await Promise.all([encryptPrivateContact(value),digestPrivateContact(value)]);
  await db.prepare("INSERT INTO private_church_contacts (church_id,contact_type,encrypted_value,value_digest,scope,source_url,review_status) VALUES (?,?,?,?,?,?,'approved') ON CONFLICT(church_id,contact_type,value_digest) DO UPDATE SET encrypted_value=excluded.encrypted_value,scope=excluded.scope,source_url=excluded.source_url,review_status='approved',updated_at=CURRENT_TIMESTAMP").bind(internalChurchId,type,encrypted,digest,scope,source.toString()).run();
  return Response.json({ok:true},{headers:{"cache-control":"no-store"}});
}
