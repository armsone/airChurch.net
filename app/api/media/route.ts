import { database } from "../_shared";
import { sermonRequiredWords, sermonExcludedWords } from "../sermons/_selection";

type MediaRow={youtubeId:string;title:string;publishedAt:string;church:string;pastor:string;region:string;denomination:string};
export async function GET(request:Request){
  const params=new URL(request.url).searchParams,kind=params.get("kind");
  if(kind!=="sermon"&&kind!=="short")return Response.json({error:"지원하지 않는 영상 종류입니다."},{status:400});
  const query=(params.get("q")||"").trim().slice(0,80),rawOffset=Number(params.get("offset")||0),offset=Number.isSafeInteger(rawOffset)?Math.min(100000,Math.max(0,rawOffset)):0;
  const terms=query.split(/\s+/).filter(Boolean).slice(0,6),bindings:(string|number)[]=[],conditions=["c.review_status='approved'","s.status='published'"];
  if(kind==="sermon"){
    conditions.push(`(${sermonRequiredWords.map(()=>"s.title LIKE ?").join(" OR ")})`);
    bindings.push(...sermonRequiredWords.map(word=>`%${word}%`));
    conditions.push(...sermonExcludedWords.map(()=>"s.title NOT LIKE ?"));
    bindings.push(...sermonExcludedWords.map(word=>`%${word}%`));
  }
  for(const term of terms){
    conditions.push("(s.title || ' ' || c.name || ' ' || COALESCE(c.pastor,'') || ' ' || COALESCE(c.region,'') || ' ' || COALESCE(c.denomination,'')) LIKE ? ESCAPE '\\'");
    bindings.push(`%${term.replace(/[\\%_]/g,"\\$&")}%`);
  }
  const table=kind==="sermon"?"sermons":"church_shorts",limit=24;
  try{
    const rows=await database().prepare(`SELECT s.youtube_id AS youtubeId,s.title,s.published_at AS publishedAt,c.name AS church,c.pastor,c.region,c.denomination FROM ${table} s JOIN churches c ON c.id=s.church_id WHERE ${conditions.join(" AND ")} ORDER BY s.published_at DESC,s.youtube_id DESC LIMIT ? OFFSET ?`).bind(...bindings,limit+1,offset).all<MediaRow>();
    const items=rows.results.slice(0,limit).map(item=>({...item,thumbnailUrl:`https://i.ytimg.com/vi/${item.youtubeId}/mqdefault.jpg`}));
    return Response.json({items,nextOffset:rows.results.length>limit?offset+limit:null},{headers:{"cache-control":"public, max-age=60, s-maxage=300, stale-while-revalidate=3600"}});
  }catch{return Response.json({error:"영상을 불러오지 못했습니다."},{status:503,headers:{"cache-control":"no-store"}});}
}
