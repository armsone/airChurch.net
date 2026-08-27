"use client";

import { useEffect, useState } from "react";

type AdminListSearchProps = {
  targetId: string;
  total: number;
  label: string;
  placeholder: string;
  initialLimit?: number;
};

export default function AdminListSearch({ targetId, total, label, placeholder, initialLimit }: AdminListSearchProps) {
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(initialLimit ? Math.min(initialLimit,total) : total);
  const [remainingTotal,setRemainingTotal]=useState(total);

  useEffect(()=>{function afterRemoval(event:Event){const detail=(event as CustomEvent<{targetId:string}>).detail;if(detail?.targetId!==targetId)return;const list=document.getElementById(targetId),items=Array.from(list?.querySelectorAll<HTMLElement>("[data-admin-search]")??[]);if(!query&&initialLimit){const visible=items.filter((item)=>!item.hidden);const pool=items.filter((item)=>item.hidden);while(visible.length<initialLimit&&pool.length){const index=Math.floor(Math.random()*pool.length),item=pool.splice(index,1)[0];item.dataset.adminPreview="true";item.hidden=false;visible.push(item);}}setRemainingTotal(items.length);setVisibleCount(items.filter((item)=>!item.hidden).length);}window.addEventListener("admin-church-removed",afterRemoval);return()=>window.removeEventListener("admin-church-removed",afterRemoval);},[initialLimit,query,targetId]);

  function filterList(value: string) {
    setQuery(value);
    const needle = value.trim().toLocaleLowerCase("ko-KR");
    const list = document.getElementById(targetId);
    let matches = 0;

    list?.querySelectorAll<HTMLElement>("[data-admin-search]").forEach((item) => {
      const searchableText = item.dataset.adminSearch?.toLocaleLowerCase("ko-KR") ?? "";
      const isVisible = needle ? searchableText.includes(needle) : initialLimit ? item.dataset.adminPreview === "true" : true;
      item.hidden = !isVisible;
      if (isVisible) matches += 1;
    });

    setVisibleCount(list ? matches : total);
  }

  function showAnotherSet(){if(!initialLimit)return;const list=document.getElementById(targetId),items=Array.from(list?.querySelectorAll<HTMLElement>("[data-admin-search]")??[]),pool=items.filter((item)=>item.dataset.adminPreview!=="true");for(let index=pool.length-1;index>0;index--){const swap=Math.floor(Math.random()*(index+1));[pool[index],pool[swap]]=[pool[swap],pool[index]];}const chosen=new Set((pool.length>=initialLimit?pool:items).slice(0,initialLimit));items.forEach((item)=>{const visible=chosen.has(item);item.dataset.adminPreview=visible?"true":"false";item.hidden=!visible;});setVisibleCount(chosen.size);}

  return <div className="admin-list-search" role="search">
    <label>
      <span className="sr-only">{label}</span>
      <input
        type="search"
        value={query}
        onChange={(event) => filterList(event.target.value)}
        placeholder={placeholder}
        aria-controls={targetId}
      />
    </label>
    <span className="admin-search-count" aria-live="polite">{visibleCount}/{remainingTotal}</span>
    {!query&&initialLimit&&remainingTotal>initialLimit&&<button className="admin-random-refresh" type="button" onClick={showAnotherSet}>↻ 다른 {initialLimit}곳 보기</button>}
  </div>;
}
