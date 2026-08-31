"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { AdminChurchList, type AdminChurchItem } from "./admin-controls";

type Props={variant:"public"|"held";initialItems:AdminChurchItem[];total:number};

export default function AdminChurchDirectory({variant,initialItems,total}:Props){
  const [items,setItems]=useState(initialItems),[query,setQuery]=useState(""),[appliedQuery,setAppliedQuery]=useState(""),[page,setPage]=useState(1),[pageSize,setPageSize]=useState(initialItems.length||1),[resultTotal,setResultTotal]=useState(total),[loading,setLoading]=useState(false),[error,setError]=useState("");
  const requestRef=useRef<AbortController|null>(null),status=variant==="held"?"removed":"approved";
  const pages=Math.max(1,Math.ceil(resultTotal/pageSize));

  async function load(nextQuery:string,nextPage:number){
    requestRef.current?.abort();const controller=new AbortController();requestRef.current=controller;setLoading(true);setError("");
    const params=new URLSearchParams({status,page:String(nextPage)});if(nextQuery.trim())params.set("q",nextQuery.trim());
    try{const response=await fetch(`/api/admin/churches?${params}`,{cache:"no-store",signal:controller.signal});const data=await response.json() as {items?:AdminChurchItem[];total?:number;page?:number;pageSize?:number;error?:string};if(!response.ok)throw new Error(data.error||"교회 목록을 불러오지 못했습니다.");setItems(data.items??[]);setResultTotal(data.total??0);setPageSize(data.pageSize??24);setPage(data.page??nextPage);setAppliedQuery(nextQuery.trim());}catch(reason){if((reason as {name?:string}).name!=="AbortError")setError((reason as Error).message);}finally{if(!controller.signal.aborted)setLoading(false);}
  }
  useEffect(()=>()=>requestRef.current?.abort(),[]);
  function submit(event:FormEvent){event.preventDefault();void load(query,1);}
  function reset(){requestRef.current?.abort();setQuery("");setAppliedQuery("");setItems(initialItems);setResultTotal(total);setPageSize(initialItems.length||1);setPage(1);setLoading(false);setError("");}

  return <>
    <form className="admin-list-search" role="search" onSubmit={submit}>
      <label><span className="sr-only">{variant==="held"?"보류 교회 검색":"공개 교회 검색"}</span><input type="search" value={query} onChange={(event)=>setQuery(event.target.value)} aria-controls={variant==="held"?"held-church-list":"public-church-list"} placeholder={variant==="held"?"교회, 목사, 지역, 교단, 보류 메모":"교회, 목사, 지역, 교단"}/></label>
      <span className="admin-search-count" aria-live="polite">{loading?"검색 중":`${items.length}/${resultTotal}`}</span>
      <button type="submit" disabled={loading}>검색</button>
      {(query||appliedQuery)&&<button type="button" onClick={reset}>초기화</button>}
      {!query&&!appliedQuery&&<button className="admin-random-refresh" type="button" disabled={loading} onClick={()=>void load("",1)}>↻ 다른 교회 보기</button>}
    </form>
    {error&&<p className="admin-error" role="alert">{error}</p>}
    <div className="admin-manage-list" id={variant==="held"?"held-church-list":"public-church-list"} aria-busy={loading}>{items.length?<AdminChurchList churches={items} previewIds={items.map((item)=>item.id)} variant={variant}/>:<p className="admin-empty">{loading?"교회를 찾고 있습니다.":"검색 결과가 없습니다."}</p>}</div>
    {appliedQuery&&pages>1&&<nav className="admin-directory-pagination" aria-label={`${variant==="held"?"보류":"공개"} 교회 검색 페이지`}><button type="button" disabled={loading||page<=1} onClick={()=>void load(appliedQuery,page-1)}>이전</button><span>{page}/{pages}</span><button type="button" disabled={loading||page>=pages} onClick={()=>void load(appliedQuery,page+1)}>다음</button></nav>}
  </>;
}
