import { database, ensureSermonTables } from "../_shared";

type SuggestionRow={name:string;pastor:string;region:string;denomination:string;priorityWeight:number};
const aliases:Record<string,string[]>={감리:["감리","기감"],감리교:["감리","기감"],기감:["감리","기감"],통합:["통합","대한예수교장로회통합"],예장통합:["통합","대한예수교장로회통합"],합동:["합동","대한예수교장로회합동"],예장합동:["합동","대한예수교장로회합동"],고신:["고신"],침례:["침례"],침례교:["침례"],성결:["성결"],성결교:["성결"],합신:["합신"],백석:["백석"],순복음:["순복음","기독교대한하나님의성회"],기하성:["순복음","기독교대한하나님의성회"],기장:["한국기독교장로회"]};
const normalize=(value:string)=>value.toLowerCase().replace(/\s/g,"").replace(/목사(?:님)?$/,""),expand=(term:string)=>aliases[normalize(term)]??[normalize(term)];

export async function GET(request:Request){
  const query=new URL(request.url).searchParams.get("q")?.trim().slice(0,80)??"";
  const terms=query.split(/\s+/).map(normalize).filter(Boolean).slice(0,4);
  if(!terms.length||normalize(query).length<2)return Response.json({items:[]});
  const groups=terms.map(expand),haystack="replace(lower(name||pastor||region||denomination),' ','')";
  const conditions=groups.map((group)=>`(${group.map(()=>`instr(${haystack},?)>0`).join(" OR ")})`).join(" AND ");
  const db=database();await ensureSermonTables(db);
  const result=await db.prepare(`SELECT name,pastor,region,denomination,priority_weight AS priorityWeight FROM churches WHERE review_status='approved' AND ${conditions} ORDER BY priority_weight DESC,name LIMIT 6`).bind(...groups.flat()).all<SuggestionRow>();
  return Response.json({items:result.results.map(({name,pastor,region,denomination})=>({value:name,label:`${pastor} · ${region} · ${denomination}`}))},{headers:{"cache-control":"public, max-age=180, s-maxage=180, stale-while-revalidate=900"}});
}
