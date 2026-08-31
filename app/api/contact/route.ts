import { clean, database, ensureContactTables, fingerprint, readLimitedJson, requestOriginIsInvalid } from "../_shared";

const categories = new Set(["정보 수정 요청", "저작권·비공개 요청", "개인정보 요청", "운영 문의"]);

export async function POST(request:Request) {
  if(requestOriginIsInvalid(request))return Response.json({error:"요청을 확인할 수 없습니다."},{status:403});
  const body=await readLimitedJson(request);if(body.tooLarge)return Response.json({error:"요청 내용이 너무 큽니다."},{status:413});const data=body.data;
  if(clean(data.company,20)) return Response.json({ok:true});
  const category=clean(data.category,40),name=clean(data.name,80),contact=clean(data.contact,160),message=clean(data.message,1500);
  if(!categories.has(category)||name.length<2||contact.length<5||message.length<20) return Response.json({error:"문의 내용을 다시 확인해 주세요."},{status:400});
  const db=database();await ensureContactTables(db);const fp=await fingerprint(request);
  const recent=await db.prepare("SELECT COUNT(*) AS count FROM contact_requests WHERE fingerprint=? AND created_at>datetime('now','-1 day')").bind(fp).first<{count:number}>();
  if((recent?.count??0)>=3) return Response.json({error:"오늘 보낼 수 있는 문의 수를 초과했습니다. 내일 다시 시도해 주세요."},{status:429});
  await db.prepare("INSERT INTO contact_requests (category,name,contact,message,fingerprint) VALUES (?,?,?,?,?)").bind(category,name,contact,message,fp).run();
  return Response.json({ok:true,status:"pending"},{status:201,headers:{"cache-control":"no-store"}});
}
