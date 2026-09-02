export const denominationAliases:Record<string,string[]>={
  감리:["감리","기감","기독교대한감리회"],감리교:["감리","기감","기독교대한감리회"],감리교회:["감리","기감","기독교대한감리회"],기감:["감리","기감","기독교대한감리회"],
  장로:["예수교장로회","장로회"],장로교:["예수교장로회","장로회"],예장:["예수교장로회","장로회"],
  통합:["통합","대한예수교장로회통합"],예장통합:["통합","대한예수교장로회통합"],합동:["합동","대한예수교장로회합동"],예장합동:["합동","대한예수교장로회합동"],고신:["고신","대한예수교장로회고신"],
  침례:["침례","기독교한국침례회"],침례교:["침례","기독교한국침례회"],침례교회:["침례","기독교한국침례회"],성결:["성결","기독교대한성결교회"],성결교:["성결","기독교대한성결교회"],성결교회:["성결","기독교대한성결교회"],
  합신:["합신","대한예수교장로회합신"],백석:["백석","대한예수교장로회백석"],순복음:["순복음","기독교대한하나님의성회"],기하성:["순복음","기독교대한하나님의성회"],기장:["한국기독교장로회"],
  독립:["독립교회","한국독립교회선교단체연합회"],카이캄:["한국독립교회선교단체연합회"]
};

const regionPrefixes=["서울","부산","대구","인천","광주","대전","울산","세종","경기","강원","충북","충남","전북","전남","경북","경남","제주"];
export const MAX_SEARCH_TERMS=8;
const conversationalSearchWords=new Set(["교회","목사","목사님","설교","말씀","영상","찾아줘","찾아주세요","알려줘","알려주세요","보여줘","보여주세요","있는","근처","주변","추천","추천해줘","추천해주세요","해줘","해주세요","주세요"]);

export const normalizeSearchValue=(value:string)=>value.toLowerCase().replace(/[^\p{L}\p{N}]/gu,"").replace(/(?:담임)?목사(?:님)?$/,"");
export const expandSearchTerm=(term:string)=>denominationAliases[normalizeSearchValue(term)]??[normalizeSearchValue(term)];
const naturalSearchTerm=(value:string)=>{const normalized=normalizeSearchValue(value).replace(/(?:에서|에)?있는/gu,"");if(conversationalSearchWords.has(normalized))return "";const stripped=normalized.replace(/(?:에서|으로|에는|에게|한테|에|로|의|을|를|이|가|은|는)$/u,"");if(conversationalSearchWords.has(stripped))return "";return stripped.length>=2?stripped:normalized;};
const searchablePrefixes=[...regionPrefixes,...Object.keys(denominationAliases).sort((a,b)=>b.length-a.length)];
const splitJoinedSearchTerm=(term:string):string[]=>{if(term.length<5)return [term];const prefix=searchablePrefixes.find((candidate)=>term.startsWith(candidate)&&term.slice(candidate.length).length>=2);if(!prefix)return [term];const remainder=naturalSearchTerm(term.slice(prefix.length));return [prefix,...(remainder?splitJoinedSearchTerm(remainder):[])];};
const preparedSearchTerms=(query:string)=>query.toLowerCase()
  .replace(/(?:목사님?(?:의)?|설교|말씀|영상|찾아주세요|찾아줘|알려주세요|알려줘|보여주세요|보여줘)/gu," ")
  .split(/[^\p{L}\p{N}]+/u).map(naturalSearchTerm).filter(Boolean).flatMap(splitJoinedSearchTerm);
export const searchTermCount=(query:string)=>preparedSearchTerms(query).length;
export const tokenizeSearchQuery=(query:string)=>preparedSearchTerms(query).slice(0,MAX_SEARCH_TERMS);
export const matchesSearchTerms=(haystack:string,query:string)=>tokenizeSearchQuery(query).every((term)=>expandSearchTerm(term).some((candidate)=>haystack.includes(candidate)));
const sqlSearchPunctuation=[" ","-","–","—","―","·","ㆍ",".","…","(",")","（","）","&","/","／","|","｜","+","=",",",":",";","_","’","‘","“","”","[","]","【","】"];
export const sqlNormalized=(value:string)=>`replace(${sqlSearchPunctuation.reduce((sql,character)=>`replace(${sql},'${character}','')`,`lower(${value})`)},char(39),'')`;
export const metadataSearchValue=(name:string,pastor:string,region:string,denomination:string,extra="")=>normalizeSearchValue(`${name}${pastor}${region}${denomination}${region}${name}${denomination}${name}${pastor}${name}${extra}${region}${extra}${name}`);
export const sqlMetadataSearchValue=(name:string,pastor:string,region:string,denomination:string,extra="''")=>sqlNormalized(`${name}||${pastor}||${region}||${denomination}||${region}||${name}||${denomination}||${name}||${pastor}||${name}||${extra}||${region}||${extra}||${name}`);
export function sqlRelevance(fields:ReadonlyArray<readonly [string,number]>,groups:string[][]){
  const bindings:string[]=[];
  const sql=groups.length?groups.map((group)=>`max(${group.flatMap((candidate)=>fields.map(([field,weight])=>{const normalized=sqlNormalized(field);bindings.push(candidate,candidate,candidate);return `CASE WHEN ${normalized}=? THEN ${weight+70} WHEN instr(${normalized},?)=1 THEN ${weight+28} WHEN instr(${normalized},?)>0 THEN ${weight} ELSE 0 END`;})).join(",")})`).join("+"):"0.0";
  return {sql,bindings};
}
