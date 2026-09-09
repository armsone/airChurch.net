"use client";

import { useEffect, useRef, useState } from "react";
type MediaItem={youtubeId:string;title:string;thumbnailUrl:string;publishedAt:string;church:string;pastor:string;region:string;denomination:string};
type MediaPayload={items:MediaItem[];nextOffset:number|null};

export default function MediaBrowser({kind}:{kind:"sermon"|"short"}){
  const label=kind==="sermon"?"말씀":"쇼츠";
  const [input,setInput]=useState(""),[query,setQuery]=useState(""),[ready,setReady]=useState(false),[revision,setRevision]=useState(0);
  const [items,setItems]=useState<MediaItem[]>([]),[nextOffset,setNextOffset]=useState<number|null>(null),[loading,setLoading]=useState(true),[failed,setFailed]=useState(false),[moreBusy,setMoreBusy]=useState(false);
  const [playing,setPlaying]=useState<string|null>(null),activeQuery=useRef(""),moreController=useRef<AbortController|null>(null);
  activeQuery.current=query;
  useEffect(()=>{const sync=()=>{const value=(new URLSearchParams(window.location.search).get("q")||"").slice(0,80);setInput(value);setQuery(value);setReady(true);};sync();window.addEventListener("popstate",sync);return()=>window.removeEventListener("popstate",sync);},[]);
  useEffect(()=>{
    if(!ready)return;
    const controller=new AbortController();moreController.current?.abort();setMoreBusy(false);setLoading(true);setFailed(false);setItems([]);setPlaying(null);
    (async()=>{for(let attempt=0;attempt<2;attempt++)try{
      const response=await fetch(`/api/media?${new URLSearchParams({kind,q:query})}`,{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(8000)])});
      if(!response.ok)throw Error();const data=await response.json() as MediaPayload;if(controller.signal.aborted)return;
      setItems(data.items);setNextOffset(data.nextOffset);setLoading(false);return;
    }catch{if(controller.signal.aborted)return;}setFailed(true);setLoading(false);})();
    return()=>{controller.abort();moreController.current?.abort();};
  },[kind,query,ready,revision]);
  const search=(value:string)=>{const term=value.trim();setInput(term);const url=new URL(window.location.href);if(term)url.searchParams.set("q",term);else url.searchParams.delete("q");window.history.pushState(null,"",url.pathname+url.search);setQuery(term);if(term===query)setRevision(value=>value+1);};
  const more=async()=>{
    if(nextOffset===null||moreBusy)return;const selectedQuery=query,controller=new AbortController();moreController.current=controller;setMoreBusy(true);setFailed(false);
    try{const response=await fetch(`/api/media?${new URLSearchParams({kind,q:query,offset:String(nextOffset)})}`,{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(8000)])});if(!response.ok)throw Error();const data=await response.json() as MediaPayload;if(controller.signal.aborted||activeQuery.current!==selectedQuery)return;setItems(current=>[...current,...data.items.filter(item=>!current.some(old=>old.youtubeId===item.youtubeId))]);setNextOffset(data.nextOffset);}catch{if(!controller.signal.aborted)setFailed(true);}finally{if(!controller.signal.aborted)setMoreBusy(false);}
  };
  return <>
    <form className="media-search" role="search" onSubmit={event=>{event.preventDefault();search(input);}}><label htmlFor="media-search-input">{label} 검색</label><div><input id="media-search-input" type="search" value={input} maxLength={80} onChange={event=>setInput(event.target.value)} placeholder="제목·교회·목회자·지역으로 검색" enterKeyHint="search"/><button type="submit">검색</button>{query&&<button type="button" className="media-search-reset" onClick={()=>search("")}>초기화</button>}</div></form>
    <p className="media-results" aria-live="polite">{loading?`${label}을 불러오는 중…`:query?`‘${query}’ 검색 · ${items.length}개 표시${nextOffset!==null?" · 더 불러올 수 있어요":""}`:`최신순 · ${items.length}개 표시`}</p>
    {!loading&&failed&&<p className="media-message" role="alert">영상을 불러오지 못했습니다. <button type="button" onClick={()=>items.length?void more():setRevision(value=>value+1)}>다시 시도</button></p>}
    <div className={`media-page-grid${kind==="short"?" is-shorts shorts-grid":""}`} aria-busy={loading}>
      {items.map(item=><article className="media-page-card" key={item.youtubeId}><div className="media-thumbnail">{playing===item.youtubeId?<iframe src={`https://www.youtube-nocookie.com/embed/${item.youtubeId}?autoplay=1&rel=0&playsinline=1`} title={`${item.church} ${item.title}`} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin"/>:<button type="button" onClick={()=>setPlaying(item.youtubeId)} aria-label={`${item.title} 재생`}><img src={item.thumbnailUrl} alt="" loading="lazy"/><span aria-hidden="true">▶</span></button>}</div><div className="media-card-copy"><small>{item.church} · {new Date(item.publishedAt).toLocaleDateString("ko-KR",{timeZone:"Asia/Seoul"})}</small><h2>{item.title}</h2><p>{[item.pastor,item.region].filter(Boolean).join(" · ")}</p><a href={kind==="short"?`https://www.youtube.com/shorts/${item.youtubeId}`:`https://www.youtube.com/watch?v=${item.youtubeId}`} target="_blank" rel="noopener noreferrer">YouTube에서 보기 ↗</a></div></article>)}
    </div>
    {!loading&&!failed&&!items.length&&<p className="media-message">{query?"검색 결과가 없습니다. 제목이나 이름을 짧게 바꿔 보세요.":"아직 연결된 영상이 없습니다."}</p>}
    {!loading&&nextOffset!==null&&<button className="media-more unified-other-button" type="button" disabled={moreBusy} onClick={()=>void more()}>{moreBusy?"불러오는 중…":`${label} 더 보기`}</button>}
  </>;
}
