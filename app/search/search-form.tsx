"use client";

import { useEffect, useState } from "react";

type Suggestion={value:string;label:string};

export default function SearchForm({q,region,denomination,regions,denominations}:{q:string;region:string;denomination:string;regions:string[];denominations:string[]}){
  const [query,setQuery]=useState(q),[suggestions,setSuggestions]=useState<Suggestion[]>([]);
  useEffect(()=>{const term=query.trim();if(term.replace(/\s/g,"").length<2){setSuggestions([]);return;}const controller=new AbortController(),timer=window.setTimeout(()=>{fetch(`/api/search-suggestions?q=${encodeURIComponent(term)}`,{signal:controller.signal}).then((response)=>response.ok?response.json():null).then((result)=>setSuggestions(Array.isArray(result?.items)?result.items:[])).catch((error)=>{if(error?.name!=="AbortError")setSuggestions([]);});},180);return()=>{window.clearTimeout(timer);controller.abort();};},[query]);
  return <form action="/search" method="get"><label><span aria-hidden="true">⌕</span><input name="q" list="result-search-suggestions" autoComplete="off" value={query} onChange={(event)=>setQuery(event.target.value)} placeholder="교회, 목사, 지역, 교단 또는 말씀·찬양 제목" autoFocus/></label><datalist id="result-search-suggestions">{suggestions.map((item)=><option value={item.value} key={`${item.value}-${item.label}`}>{item.label}</option>)}</datalist><select name="region" defaultValue={region||"전체"} aria-label="지역">{regions.map((item)=><option key={item}>{item}</option>)}</select><select name="denomination" defaultValue={denomination||"전체 교단"} aria-label="교단">{denominations.map((item)=><option key={item}>{item}</option>)}</select><button type="submit">통합 검색</button></form>;
}
