export const denominationAliases:Record<string,string[]>={
  감리:["감리","기감","기독교대한감리회"],감리교:["감리","기감","기독교대한감리회"],감리교회:["감리","기감","기독교대한감리회"],기감:["감리","기감","기독교대한감리회"],
  장로:["예수교장로회","장로회"],장로교:["예수교장로회","장로회"],예장:["예수교장로회","장로회"],
  통합:["통합","대한예수교장로회통합"],예장통합:["통합","대한예수교장로회통합"],합동:["합동","대한예수교장로회합동"],예장합동:["합동","대한예수교장로회합동"],고신:["고신","대한예수교장로회고신"],
  침례:["침례","기독교한국침례회"],침례교:["침례","기독교한국침례회"],침례교회:["침례","기독교한국침례회"],성결:["성결","기독교대한성결교회"],성결교:["성결","기독교대한성결교회"],성결교회:["성결","기독교대한성결교회"],
  합신:["합신","대한예수교장로회합신"],백석:["백석","대한예수교장로회백석"],순복음:["순복음","기독교대한하나님의성회"],기하성:["순복음","기독교대한하나님의성회"],기장:["한국기독교장로회"],
  독립:["독립교회","한국독립교회선교단체연합회"],카이캄:["한국독립교회선교단체연합회"]
};

export const normalizeSearchValue=(value:string)=>value.toLowerCase().replace(/[^\p{L}\p{N}]/gu,"").replace(/(?:담임)?목사(?:님)?$/,"");
export const expandSearchTerm=(term:string)=>denominationAliases[normalizeSearchValue(term)]??[normalizeSearchValue(term)];
export const matchesSearchTerms=(haystack:string,query:string)=>query.toLowerCase().split(/\s+/).map(normalizeSearchValue).filter(Boolean).every((term)=>expandSearchTerm(term).some((candidate)=>haystack.includes(candidate)));
export const sqlNormalized=(value:string)=>`replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(lower(${value}),' ',''),'-',''),'·',''),'.',''),'(',''),')',''),'&',''),'\/',''),',',''),':',''),'_',''),char(39),''),'[',''),']','')`;
