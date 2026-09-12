import { clean, consumeSubmissionLimit, database, fingerprint, readLimitedJson, requestOriginIsInvalid } from "../../_shared";
import { getMakingPost } from "../../../making/store";
const headers = {"cache-control":"no-store"};
export async function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get("slug") || "";
  try {
    if (!await getMakingPost(slug)) return Response.json({error:"글을 찾을 수 없습니다."},{status:404,headers});
    const rows = await database().prepare("SELECT id,nickname,content,created_at AS createdAt FROM making_comments WHERE post_slug=? AND status='approved' ORDER BY id DESC LIMIT 100").bind(slug).all();
    return Response.json({items:rows.results}, {headers});
  } catch(error) { console.error("Making comments unavailable",error); return Response.json({error:"댓글을 불러오지 못했습니다."},{status:503,headers}); }
}
export async function POST(request: Request) {
  if (requestOriginIsInvalid(request)) return Response.json({error:"요청을 확인할 수 없습니다."},{status:403,headers});
  const body=await readLimitedJson(request,8192);
  if(body.tooLarge)return Response.json({error:"댓글이 너무 깁니다."},{status:413,headers});
  const {data}=body;
  if(clean(data.company,20))return Response.json({ok:true},{headers});
  const slug=clean(data.slug,100),nickname=clean(data.nickname,16),content=clean(data.content,1000);
  if(nickname.length<2||content.length<5)return Response.json({error:"별명은 2자, 댓글은 5자 이상 적어 주세요."},{status:400,headers});
  try {
    if(!await getMakingPost(slug))return Response.json({error:"현재 댓글을 남길 수 없는 글입니다."},{status:404,headers});
    const db=database(), fp=await fingerprint(request,"making-comment");
    if(!await consumeSubmissionLimit(db,"making-comment",fp,2,10))return Response.json({error:"댓글은 10분에 두 번 남길 수 있습니다. 잠시 후 다시 시도해 주세요."},{status:429,headers:{...headers,"retry-after":"600"}});
    await db.prepare("INSERT INTO making_comments (post_slug,nickname,content) VALUES (?,?,?)").bind(slug,nickname,content).run();
    return Response.json({ok:true},{status:201,headers});
  } catch(error) { console.error("Making comment save failed",error); return Response.json({error:"댓글을 저장하지 못했습니다. 작성한 내용을 유지하고 다시 시도해 주세요."},{status:503,headers}); }
}
