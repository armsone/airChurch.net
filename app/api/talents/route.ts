import { clean, database, ensureCommunityTables, fingerprint } from "../_shared";
export async function GET() {
  const db=database(); await ensureCommunityTables(db);
  const result=await db.prepare("SELECT id,title,region,description,created_at AS createdAt FROM talent_offers WHERE status='approved' ORDER BY created_at DESC LIMIT 12").all();
  return Response.json({items:result.results},{headers:{"cache-control":"public, max-age=120"}});
}
export async function POST(request: Request) {
  const data=await request.json().catch(()=>({})) as Record<string,unknown>; if(clean(data.company,20)) return Response.json({ok:true});
  const title=clean(data.title,100),region=clean(data.region,60),description=clean(data.description,800); if(title.length<3||region.length<2||description.length<10) return Response.json({error:"입력 내용을 확인해 주세요."},{status:400});
  const db=database(); await ensureCommunityTables(db); const fp=await fingerprint(request); const recent=await db.prepare("SELECT COUNT(*) AS count FROM talent_offers WHERE fingerprint = ? AND created_at > datetime('now', '-10 minutes')").bind(fp).first<{count:number}>(); if((recent?.count||0)>=2) return Response.json({error:"잠시 후 다시 시도해 주세요."},{status:429});
  await db.prepare("INSERT INTO talent_offers (title, region, description, fingerprint) VALUES (?, ?, ?, ?)").bind(title,region,description,fp).run(); return Response.json({ok:true,status:"pending"},{status:201});
}
