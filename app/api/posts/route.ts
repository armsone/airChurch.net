import { clean, database, ensureCommunityTables, fingerprint, requestBodyTooLarge, requestOriginIsInvalid } from "../_shared";
export async function GET() {
  const db=database();
  const result=await db.prepare("SELECT id,category,nickname,content,created_at AS createdAt FROM community_posts WHERE status='approved' ORDER BY created_at DESC LIMIT 12").all();
  return Response.json({items:result.results},{headers:{"cache-control":"public, max-age=120, s-maxage=120, stale-while-revalidate=600"}});
}
export async function POST(request: Request) {
  if(requestBodyTooLarge(request))return Response.json({error:"요청 내용이 너무 큽니다."},{status:413});
  if(requestOriginIsInvalid(request))return Response.json({error:"요청을 확인할 수 없습니다."},{status:403});
  const data=await request.json().catch(()=>({})) as Record<string,unknown>; if(clean(data.company,20)) return Response.json({ok:true});
  const category=clean(data.category,30),nickname=clean(data.nickname,16),content=clean(data.content,1000); if(!category||nickname.length<2||content.length<20) return Response.json({error:"입력 내용을 확인해 주세요."},{status:400});
  const db=database(); await ensureCommunityTables(db); const fp=await fingerprint(request); const recent=await db.prepare("SELECT COUNT(*) AS count FROM community_posts WHERE fingerprint = ? AND created_at > datetime('now', '-10 minutes')").bind(fp).first<{count:number}>(); if((recent?.count||0)>=2) return Response.json({error:"잠시 후 다시 시도해 주세요."},{status:429});
  await db.prepare("INSERT INTO community_posts (category, nickname, content, fingerprint) VALUES (?, ?, ?, ?)").bind(category,nickname,content,fp).run(); return Response.json({ok:true,status:"pending"},{status:201});
}
