"use client";

import { useEffect, useRef, useState } from "react";
import { clearRecentSearches, readRecentSearches, writeRecentSearches } from "../recent-searches";
import { normalizeSearchValue } from "../search-domain";
import { fetchSearchSuggestions, SearchSuggestion } from "../search-suggestions-client";

export default function SearchForm({q,region,denomination,regions,denominations}:{q:string;region:string;denomination:string;regions:string[];denominations:string[]}){
  const formRef=useRef<HTMLFormElement>(null);
  const [query,setQuery]=useState(q),[suggestions,setSuggestions]=useState<SearchSuggestion[]>([]),[recent,setRecent]=useState<string[]>([]);
  useEffect(()=>{try{setRecent(readRecentSearches());}catch{/* 손상된 로컬 기록은 무시합니다. */}},[]);
  useEffect(()=>{const term=query.trim();if(term.replace(/\s/g,"").length<2){setSuggestions([]);return;}const controller=new AbortController(),timer=window.setTimeout(()=>{fetchSearchSuggestions(term,controller.signal).then(setSuggestions).catch((error)=>{if(error?.name!=="AbortError")setSuggestions([]);});},180);return()=>{window.clearTimeout(timer);controller.abort();};},[query]);
  const remember=()=>{const term=query.trim(),normalized=normalizeSearchValue(term);if(!normalized)return;const next=[term,...recent.filter((item)=>normalizeSearchValue(item)!==normalized)].slice(0,5);setRecent(next);try{writeRecentSearches(next);}catch{/* 저장이 제한된 브라우저에서도 검색은 계속합니다. */}};
  return <>
    <form ref={formRef} action="/search" method="get" onSubmit={remember}>
      <label htmlFor="result-search-query"><span aria-hidden="true">⌕</span><span className="sr-only">교회, 목사, 지역, 교단 또는 말씀·찬양 검색</span><input id="result-search-query" name="q" list="result-search-suggestions" type="search" inputMode="search" enterKeyHint="search" aria-describedby="result-search-status" autoComplete="off" autoCapitalize="none" spellCheck={false} value={query} onChange={(event)=>setQuery(event.target.value)} placeholder="교회, 목사, 지역, 교단 또는 말씀·찬양 제목"/></label>
      <datalist id="result-search-suggestions">{suggestions.map((item)=><option value={item.value} key={`${item.value}-${item.label}`}>{item.label}</option>)}</datalist>
      <span className="sr-only" id="result-search-status" role="status" aria-live="polite">{suggestions.length?`자동완성 ${suggestions.length}개가 있습니다.`:"교회, 목사, 지역, 교단을 함께 검색할 수 있습니다."}</span>
      <select name="region" defaultValue={region||"전체"} aria-label="지역" onChange={()=>formRef.current?.requestSubmit()}>{regions.map((item)=><option key={item}>{item}</option>)}</select>
      <select name="denomination" defaultValue={denomination||"전체 교단"} aria-label="교단" onChange={()=>formRef.current?.requestSubmit()}>{denominations.map((item)=><option key={item}>{item}</option>)}</select>
      <button type="submit">통합 검색</button>
    </form>
    {recent.length>0&&<div className="search-recent"><span>최근 검색</span>{recent.map((item)=><a href={`/search?q=${encodeURIComponent(item)}`} key={item}>{item}</a>)}<button type="button" onClick={()=>{setRecent([]);try{clearRecentSearches();}catch{/* 화면에서는 즉시 지웁니다. */}}}>지우기</button></div>}
  </>;
}
