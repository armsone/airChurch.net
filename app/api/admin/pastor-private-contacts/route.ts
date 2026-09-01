import {accessSession} from "../../../admin-access";
import {clean,database,ensureAdminTables,readLimitedJson,requestOriginIsInvalid} from "../../_shared";
import {digestPrivateContact,encryptPrivateContact} from "../../../private-contact-vault";

export async function POST(request:Request){
  if(requestOriginIsInvalid(request))return Response.json({error:"요청을 확인할 수 없습니다."},{status:403});
  const session=await accessSession(request);if(session?.role!=="admin")return Response.json({error:"관리자 권한이 필요합니다."},{status:403});
  const body=await readLimitedJson(request,4096);if(body.tooLarge)return Response.json({error:"입력 내용이 너무 큽니다."},{status:413});
  const data=body.data,pastorId=Number(data.pastorId),type=clean(data.type,20),value=clean(data.value,200),scope=clean(data.scope,40)||"pastoral_support",sourceUrl=clean(data.sourceUrl,500);
  if(!Number.isInteger(pastorId)||pastorId<1||!["email","phone","account"].includes(type)||value.length<3)return Response.json({error:"목회자와 연락 정보 형식을 확인해 주세요."},{status:400});
  const db=database();await ensureAdminTables(db);
  if(!await db.prepare("SELECT id FROM pastor_people WHERE id=? LIMIT 1").bind(pastorId).first())return Response.json({error:"목회자를 찾을 수 없습니다."},{status:404});
  const [encrypted,digest]=await Promise.all([encryptPrivateContact(value),digestPrivateContact(value)]);
  await db.prepare("INSERT INTO pastor_private_contact_values (pastor_id,contact_type,encrypted_value,value_digest,scope,source_url,review_status) VALUES (?,?,?,?,?,?,'approved') ON CONFLICT(pastor_id,contact_type,value_digest) DO UPDATE SET encrypted_value=excluded.encrypted_value,scope=excluded.scope,source_url=excluded.source_url,review_status='approved',updated_at=CURRENT_TIMESTAMP").bind(pastorId,type,encrypted,digest,scope,sourceUrl||null).run();
  return Response.json({ok:true},{status:201,headers:{"cache-control":"no-store"}});
}
