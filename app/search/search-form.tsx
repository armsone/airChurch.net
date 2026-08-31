"use client";

import { useEffect, useState } from "react";

type Suggestion={value:string;label:string};

export default function SearchForm({q,region,denomination,regions,denominations}:{q:string;region:string;denomination:string;regions:string[];denominations:string[]}){
  const [query,setQuery]=useState(q),[suggestions,setSuggestions]=useState<Suggestion[]>([]),[recent,setRecent]=useState<string[]>([]);
  useEffect(()=>{try{const saved=JSON.parse(localStorage.getItem("airchurch:recent-searches")||"[]");if(Array.isArray(saved))setRecent(saved.filter((item):item is string=>typeof item==="string").slice(0,5));}catch{/* 손상된 로컬 기록은 무시합니다. */}},[]);
  useEffect(()=>{const term=query.trim();if(term.replace(/\s/g,"").length<2){setSuggestions([]);return;}const controller=new AbortController(),timer=window.setTimeout(()=>{fetch(`/api/search-suggestions?q=${encodeURIComponent(term)}`,{signal:controller.signal}).then((response)=>response.ok?response.json():null).then((result)=>setSuggestions(Array.isArray(result?.items)?result.items:[])).catch((error)=>{if(error?.name!=="AbortError")setSuggestions([]);});},180);return()=>{window.clearTimeout(timer);controller.abort();};},[query]);
  const remember=()=>{const term=query.trim();if(!term)return;const next=[term,...recent.filter((item)=>item!==term)].slice(0,5);setRecent(next);localStorage.setItem("airchurch:recent-searches",JSON.stringify(next));};
  return <><form action="/search" method="get" onSubmit={remember}><label><span aria-hidden="true">⌕</span><input name="q" list="result-search-suggestions" autoComplete="off" value={query} onChange={(event)=>setQuery(event.target.value)} placeholder="교회, 목사, 지역, 교단 또는 말씀·찬양 제목" autoFocus/></label><datalist id="result-search-suggestions">{suggestions.map((item)=><option value={item.value} key={`${item.value}-${item.label}`}>{item.label}</option>)}</datalist><select name="region" defaultValue={region||"전체"} aria-label="지역">{regions.map((item)=><option key={item}>{item}</option>)}</select><select name="denomination" defaultValue={denomination||"전체 교단"} aria-label="교단">{denominations.map((item)=><option key={item}>{item}</option>)}</select><button type="submit">통합 검색</button></form>{recent.length>0&&<div className="search-recent"><span>최근 검색</span>{recent.map((item)=><a href={`/search?q=${encodeURIComponent(item)}`} key={item}>{item}</a>)}<button type="button" onClick={()=>{setRecent([]);localStorage.removeItem("airchurch:recent-searches");}}>지우기</button></div>}</>;
}
