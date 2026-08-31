import { clean, consumeSubmissionLimit, database, ensureCommunityTables, fingerprint, readLimitedJson, requestOriginIsInvalid } from "../_shared";
export async function GET() {
  const db=database();
  const result=await db.prepare("SELECT id,title,region,description,created_at AS createdAt FROM talent_offers WHERE status='approved' ORDER BY created_at DESC LIMIT 12").all();
  return Response.json({items:result.results},{headers:{"cache-control":"public, max-age=120, s-maxage=120, stale-while-revalidate=600"}});
}
export async function POST(request: Request) {
  if(requestOriginIsInvalid(request))return Response.json({error:"요청을 확인할 수 없습니다."},{status:403});
  const body=await readLimitedJson(request);if(body.tooLarge)return Response.json({error:"요청 내용이 너무 큽니다."},{status:413});const data=body.data; if(clean(data.company,20)) return Response.json({ok:true});
  const title=clean(data.title,100),region=clean(data.region,60),description=clean(data.description,800); if(title.length<3||region.length<2||description.length<10) return Response.json({error:"입력 내용을 확인해 주세요."},{status:400});
  const db=database(); await ensureCommunityTables(db); const fp=await fingerprint(request,"talent-offer"); if(!await consumeSubmissionLimit(db,"talent-offer",fp,2,10)) return Response.json({error:"잠시 후 다시 시도해 주세요."},{status:429,headers:{"cache-control":"no-store","retry-after":"600"}});
  await db.prepare("INSERT INTO talent_offers (title, region, description, fingerprint) VALUES (?, ?, ?, ?)").bind(title,region,description,"").run(); return Response.json({ok:true,status:"pending"},{status:201,headers:{"cache-control":"no-store"}});
}
