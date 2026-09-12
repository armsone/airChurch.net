import { hasAdminAccess } from "../../../admin-access";
import { clean, database, readLimitedJson, requestOriginIsInvalid } from "../../_shared";
import { listMakingPosts } from "../../../making/store";
import { posts } from "../../../making/posts";
const headers={"cache-control":"no-store"};
export async function GET(request: Request) {
  if(!await hasAdminAccess(request))return Response.json({error:"관리자만 사용할 수 있습니다."},{status:403,headers});
  try {
    const items=await listMakingPosts(true);
    const url=new URL(request.url), requestedPage=Number(url.searchParams.get("page")||1), page=Number.isSafeInteger(requestedPage)&&requestedPage>0?requestedPage:1;
    const status=url.searchParams.get("status")||"all", filter=['pending','approved','hidden'].includes(status)?status:"all";
    const db=database();
    const comments=await db.prepare("SELECT id,post_slug AS postSlug,nickname,content,status,created_at AS createdAt FROM making_comments WHERE (?='all' OR status=?) ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END,id DESC LIMIT 50 OFFSET ?").bind(filter,filter,(page-1)*50).all();
    const count=await db.prepare("SELECT COUNT(*) AS total FROM making_comments WHERE (?='all' OR status=?)").bind(filter,filter).first<{total:number}>();
    return Response.json({items,comments:comments.results,total:count?.total||0,page},{headers});
  } catch(error) { console.error("Making administration unavailable",error);return Response.json({error:"관리 목록을 불러오지 못했습니다."},{status:503,headers}); }
}
export async function POST(request: Request) {
  if(requestOriginIsInvalid(request)||!await hasAdminAccess(request))return Response.json({error:"관리자만 사용할 수 있습니다."},{status:403,headers});
  const body=await readLimitedJson(request,100000);
  if(body.tooLarge)return Response.json({error:"글이 너무 깁니다."},{status:413,headers});
  const data=body.data;
  try {
    if(data.action==="comment-status") {
      const id=Number(data.id),status=data.status;
      if(!Number.isInteger(id)||id<1||!['pending','approved','hidden'].includes(String(status)))return Response.json({error:"댓글 상태를 확인해 주세요."},{status:400,headers});
      const result=await database().prepare("UPDATE making_comments SET status=? WHERE id=?").bind(status,id).run();
      if(!result.meta.changes)return Response.json({error:"댓글을 찾을 수 없습니다."},{status:404,headers});
      return Response.json({ok:true},{headers});
    }
    if(data.action!=="save-post")return Response.json({error:"작업을 확인해 주세요."},{status:400,headers});
    const slug=clean(data.slug,100), title=clean(data.title,150), summary=clean(data.summary,300),category=clean(data.category,30),status=String(data.status);
    if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)||!title||!summary||!category||!['published','draft'].includes(status)||!Array.isArray(data.sections)||data.sections.length<1||data.sections.length>30)return Response.json({error:"제목·소개·분류·본문을 확인해 주세요."},{status:400,headers});
    const sections=[];
    for(const value of data.sections) {
      if(!value||typeof value!=="object"||!Array.isArray(value.paragraphs)||value.paragraphs.length>50)return Response.json({error:"본문 형식을 확인해 주세요."},{status:400,headers});
      const title=clean(value.title,150), paragraphs=value.paragraphs.map((p:unknown)=>clean(p,10000)).filter(Boolean);
      if(!title||!paragraphs.length)return Response.json({error:"본문 제목과 내용을 적어 주세요."},{status:400,headers});
      sections.push({title,paragraphs});
    }
    if(!Array.isArray(data.sources)||data.sources.length>50)return Response.json({error:"출처를 확인해 주세요."},{status:400,headers});
    const sources=[];
    for(const source of data.sources) {
      if(!Array.isArray(source)||source.length!==2)return Response.json({error:"출처 형식을 확인해 주세요."},{status:400,headers});
      const label=clean(source[0],200),href=clean(source[1],2000);
      let valid=false;try { const url=new URL(href,"https://airchurch.net");valid=['https:','http:'].includes(url.protocol)&&!url.username&&!url.password&&(href.startsWith('https://')||href.startsWith('http://')||(/^\/(?!\/)/.test(href)&&!href.includes('\\'))); } catch { valid=false; }
      if(!label||!valid)return Response.json({error:"출처에는 웹 주소 또는 사이트 안의 경로를 적어 주세요."},{status:400,headers});
      sources.push([label,href]);
    }
    const original=posts.find(post=>post.slug===slug);
    const createdAt=original?.date||new Date().toISOString();
    await database().prepare("INSERT INTO making_posts (slug,title,summary,category,body,sources,status,created_at) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(slug) DO UPDATE SET title=excluded.title,summary=excluded.summary,category=excluded.category,body=excluded.body,sources=excluded.sources,status=excluded.status,updated_at=CURRENT_TIMESTAMP").bind(slug,title,summary,category,JSON.stringify(sections),JSON.stringify(sources),status,createdAt).run();
    return Response.json({ok:true,slug},{headers});
  } catch(error) { console.error("Making administration save failed",error);return Response.json({error:"저장하지 못했습니다. 내용을 유지하고 다시 시도해 주세요."},{status:503,headers}); }
}
