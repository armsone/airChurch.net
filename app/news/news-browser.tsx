"use client";

import { useEffect, useMemo, useState } from "react";
import SourceDirectory from "../source-directory";
import NewsCard, { type NewsItem, type NewsSource } from "./news-card";

export default function NewsBrowser() {
  const [items,setItems]=useState<NewsItem[]>([]),[sources,setSources]=useState<NewsSource[]>([]);
  const [loading,setLoading]=useState(true),[failed,setFailed]=useState(false),[revision,setRevision]=useState(0);
  const [source,setSource]=useState(""),[limit,setLimit]=useState(24);
  useEffect(()=>{
    const controller=new AbortController();
    setLoading(true);setFailed(false);
    (async()=>{
      for(let attempt=0;attempt<2;attempt++){
        try{
          const response=await fetch("/api/church-news",{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(8000)])});
          if(!response.ok)throw Error("unavailable");
          const data=await response.json() as {items:NewsItem[];sources:NewsSource[]};
          if(controller.signal.aborted)return;
          setItems([...new Map(data.items.map(item=>[item.url,item])).values()].sort((a,b)=>(Date.parse(b.publishedAt)||0)-(Date.parse(a.publishedAt)||0)));
          setSources(data.sources||[]);setLoading(false);return;
        }catch{if(controller.signal.aborted)return;}
      }
      setFailed(true);setLoading(false);
    })();
    return()=>controller.abort();
  },[revision]);
  const availableSources=useMemo(()=>[...new Set(items.map(item=>item.source))].sort((a,b)=>a.localeCompare(b,"ko-KR")),[items]);
  const filtered=source?items.filter(item=>item.source===source):items;
  return <>
    {sources.length>0&&<SourceDirectory title="교계소식 출처" note="공식 RSS에서 제공한 제목과 짧은 소개를 모읍니다. 전체 기사는 원문에서 읽을 수 있습니다." groups={[{label:"교계 매체",sources:sources.map(item=>({name:item.name,homepage:item.homepage,url:item.rssUrl,linkLabel:"RSS"}))}]}/>}
    <div className="news-list-toolbar"><label>출처<select value={source} onChange={event=>{setSource(event.target.value);setLimit(24);}} disabled={loading}><option value="">전체 출처</option>{availableSources.map(name=><option key={name}>{name}</option>)}</select></label><p aria-live="polite">{loading?"소식을 불러오는 중…":`최신순 · ${filtered.length}건`}</p></div>
    <div aria-live="polite" aria-busy={loading}>
      {loading?<p className="news-list-message">교계소식을 불러오고 있습니다…</p>:failed?<p className="news-list-message" role="alert">소식을 불러오지 못했습니다. <button type="button" onClick={()=>setRevision(value=>value+1)}>다시 시도</button></p>:<>
        <div className="church-news-grid news-page-grid">{filtered.slice(0,limit).map(item=><NewsCard key={item.url} item={item}/>)}</div>
        {!filtered.length&&<p className="news-list-message">표시할 소식이 없습니다.</p>}
        {filtered.length>limit&&<button className="news-list-more unified-other-button" type="button" onClick={()=>setLimit(value=>value+24)}>소식 더 보기 · {filtered.length-limit}건 남음</button>}
      </>}
    </div>
  </>;
}
