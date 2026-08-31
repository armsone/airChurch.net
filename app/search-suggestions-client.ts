import { normalizeSearchValue } from "./search-domain";

export type SearchSuggestion={value:string;label:string};

const CACHE_TTL_MS=5*60*1000;
const CACHE_LIMIT=24;
const cache=new Map<string,{expiresAt:number;items:SearchSuggestion[]}>();

export async function fetchSearchSuggestions(term:string,signal:AbortSignal){
  const key=normalizeSearchValue(term);
  const cached=cache.get(key);
  if(cached&&cached.expiresAt>Date.now())return cached.items;
  if(cached)cache.delete(key);
  const response=await fetch(`/api/search-suggestions?q=${encodeURIComponent(term)}`,{signal});
  if(!response.ok)return [];
  const result=await response.json() as {items?:unknown};
  const items=Array.isArray(result.items)?result.items.filter((item):item is SearchSuggestion=>Boolean(item)&&typeof item.value==="string"&&typeof item.label==="string"):[];
  cache.set(key,{expiresAt:Date.now()+CACHE_TTL_MS,items});
  if(cache.size>CACHE_LIMIT)cache.delete(cache.keys().next().value as string);
  return items;
}
