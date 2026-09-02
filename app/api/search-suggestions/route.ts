import { database, ensureSermonTables } from "../_shared";
import { expandSearchTerm as expand, normalizeSearchValue as normalize, tokenizeSearchQuery } from "../../search-domain";

type SuggestionRow={name:string;pastor:string;region:string;denomination:string};

export async function GET(request:Request){
  const query=new URL(request.url).searchParams.get("q")?.trim().slice(0,80)??"";
  const terms=tokenizeSearchQuery(query).slice(0,4);
  const headers={"cache-control":"public, max-age=180, s-maxage=180, stale-while-revalidate=900"};
  if(!terms.length||normalize(query).length<2)return Response.json({items:[]},{headers});
  const groups=terms.map(expand),haystack="replace(lower(COALESCE(name,'')||COALESCE(pastor,'')||COALESCE(region,'')||COALESCE(denomination,'')), ' ', '')";
  const conditions=groups.map((group)=>`(${group.map(()=>`instr(${haystack},?)>0`).join(" OR ")})`).join(" AND ");
  const db=database();await ensureSermonTables(db);
  const result=await db.prepare(`SELECT name,pastor,region,denomination FROM churches WHERE review_status='approved' AND ${conditions} ORDER BY priority_weight DESC,name LIMIT 6`).bind(...groups.flat()).all<SuggestionRow>();
  const items=result.results.map(({name,pastor,region,denomination})=>({value:name,label:`${pastor} · ${region} · ${denomination}`}));
  return Response.json({items},{headers});
}
