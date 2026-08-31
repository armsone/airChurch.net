import { database, ensureSermonTables } from "../_shared";
import { expandSearchTerm as expand, normalizeSearchValue as normalize, sqlNormalized, sqlRelevance } from "../../search-domain";

type SuggestionRow={name:string;pastor:string;region:string;denomination:string;priorityWeight:number};
const score=(row:SuggestionRow,terms:string[])=>{const fields=[[row.name,40],[row.pastor,25],[row.region,15],[row.denomination,12]] as const;return terms.reduce((total,term)=>{const candidates=expand(term);return total+Math.max(0,...fields.flatMap(([field,weight])=>{const value=normalize(field);return candidates.map((candidate)=>value===candidate?weight+70:value.startsWith(candidate)?weight+28:value.includes(candidate)?weight:0);}));},0);};

export async function GET(request:Request){
  const query=new URL(request.url).searchParams.get("q")?.trim().slice(0,80)??"";
  const terms=query.split(/\s+/).map(normalize).filter(Boolean).slice(0,4);
  const headers={"cache-control":"public, max-age=180, s-maxage=180, stale-while-revalidate=900"};
  if(!terms.length||normalize(query).length<2)return Response.json({items:[]},{headers});
  const groups=terms.map(expand),haystack=sqlNormalized("name||pastor||region||denomination");
  const conditions=groups.map((group)=>`(${group.map(()=>`instr(${haystack},?)>0`).join(" OR ")})`).join(" AND ");
  const relevance=sqlRelevance([["name",40],["pastor",25],["region",15],["denomination",12]],groups);
  const db=database();await ensureSermonTables(db);
  const result=await db.prepare(`SELECT name,pastor,region,denomination,priority_weight AS priorityWeight FROM churches WHERE review_status='approved' AND ${conditions} ORDER BY (${relevance.sql}) DESC,priority_weight DESC,name LIMIT 60`).bind(...groups.flat(),...relevance.bindings).all<SuggestionRow>();
  const items=result.results.sort((a,b)=>score(b,terms)-score(a,terms)||b.priorityWeight-a.priorityWeight||a.name.localeCompare(b.name,"ko")).slice(0,6).map(({name,pastor,region,denomination})=>({value:name,label:`${pastor} · ${region} · ${denomination}`}));
  return Response.json({items},{headers});
}
