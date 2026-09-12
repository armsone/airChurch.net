import { listMakingPosts } from "../../making/store";
export async function GET() {
  try { const items = (await listMakingPosts()).map(({slug,title,summary,category,date}) => ({slug,title,summary,category,date})); return Response.json({items}, {headers:{"cache-control":"no-store"}}); }
  catch(error) { console.error("Making posts unavailable",error); return Response.json({error:"글을 불러오지 못했습니다. 잠시 후 다시 열어 주세요."},{status:503}); }
}
