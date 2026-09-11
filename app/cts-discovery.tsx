"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import catalog from "../data/faith-discovery-videos.json";

import { mixFaithVideos, type FaithVideo as Video, type FaithPayload } from "./faith-videos";
const categories=["추천","청년·말씀","성경 배우기","간증·삶"];
function playerUrl(video:Video){
  if(video.youtubeId)return `https://www.youtube-nocookie.com/embed/${video.youtubeId}?autoplay=1&rel=0&playsinline=1`;
  // Use the provider's own player with its branding, advertisements and controls intact.
  const params=new URLSearchParams({type:"cts",id:video.id,pid:video.programId||"",skin:"catvod",auto:"Y",fullscreenAllowFullscreen:"Y",toggleBtn:"Y",fullscreenBtn:"Y",disableSeekable:"Y",thumbnail:"Y",currentTimeText:"Y",durationText:"Y",continuityPlay:"Y",volume:"Y",progress:"Y",ad:"Y",adCate:"CATTV",quality:"Y",rateUse:"Y",playlist:"Y"});
  return `https://ac.cts.tv/videoplayer/zoneplayer?${params}`;
}
export default function CtsDiscovery({compact=false,dedicated=false}:{compact?:boolean;dedicated?:boolean}){
  const [category,setCategory]=useState("추천"),[playing,setPlaying]=useState<Video|null>(null);
  const [items,setItems]=useState<Video[]>(catalog.items as Video[]),[feedDelayed,setFeedDelayed]=useState(false);
  const [videoOffset,setVideoOffset]=useState(0),[query,setQuery]=useState(""),[limit,setLimit]=useState(12);
  const [refreshing,setRefreshing]=useState(false),[checkedAt,setCheckedAt]=useState("");
  const request=useRef<AbortController|null>(null);
  const refresh=useCallback(async(manual=false)=>{
    if(request.current)return;
    const controller=new AbortController();request.current=controller;setRefreshing(true);
    try{
      const response=await fetch("/api/faith-videos",{method:manual?"POST":"GET",cache:manual?"no-store":"default",signal:AbortSignal.any([controller.signal,AbortSignal.timeout(12000)])});
      if(!response.ok)throw Error("unavailable");
      const data=await response.json() as FaithPayload;
      if(!Array.isArray(data.items)||!data.items.length)throw Error("empty");
      if(!controller.signal.aborted){setItems(data.items);setFeedDelayed(data.failedSources.length>0);setCheckedAt(data.checkedAt);}
    }catch{if(!controller.signal.aborted)setFeedDelayed(true);}
    finally{if(request.current===controller){request.current=null;if(!controller.signal.aborted)setRefreshing(false);}}
  },[]);
  useEffect(()=>{void refresh();const interval=setInterval(()=>void refresh(),15*60000);return()=>{request.current?.abort();request.current=null;clearInterval(interval);};},[refresh]);
  const filtered=mixFaithVideos(category==="추천"?items:items.filter(video=>video.category===category)).filter(video=>!query.trim()||`${video.title} ${video.source}`.toLocaleLowerCase("ko-KR").includes(query.trim().toLocaleLowerCase("ko-KR")));
  const start=filtered.length?videoOffset%filtered.length:0;
  const visible=[...filtered.slice(start),...filtered.slice(0,start)].slice(0,compact?4:dedicated?limit:8);

  const player=useRef<HTMLDivElement>(null);
  const play=(video:Video)=>{setPlaying(video);requestAnimationFrame(()=>player.current?.scrollIntoView({block:"nearest",behavior:"auto"}));};
  return <section className={compact?"portal-panel faith-preview portal-tone-story":"cts-discovery"} id={compact?undefined:"faith-stories"} aria-labelledby={compact?"faith-preview-title":"cts-discovery-title"}>
    <div className="portal-panel-heading"><div><h3 id={compact?"faith-preview-title":"cts-discovery-title"}>{compact?<a href="#faith-stories"><span className="portal-title-icon" aria-hidden="true">🌿</span>신앙이야기</a>:"신앙이야기"}</h3></div>{compact?<a href="#faith-stories">더 보기 →</a>:dedicated?<button className="faith-refresh" type="button" disabled={refreshing} onClick={()=>void refresh(true)}>{refreshing?"확인 중…":"새 영상 확인"}</button>:<div className="news-home-actions"><button className="unified-other-button" type="button" disabled={filtered.length<=8} onClick={()=>setVideoOffset(value=>value+8)}>다른 이야기 보기</button><a className="unified-other-button" href="/faith-stories">전체 이야기 보기 →</a></div>}</div>
    <p className="portal-caption">{compact?"간증과 삶 · 청년의 질문 · 성경 이야기":"삶의 고백, 청년의 질문, 성경 속 이야기. 마음에 닿는 영상부터 만나보세요."}</p>
    {!compact&&<div className="portal-switch cts-switch" aria-label="신앙 영상 주제">{categories.map(name=><button key={name} type="button" aria-pressed={category===name} onClick={()=>{setCategory(name);setPlaying(null);setLimit(12);setVideoOffset(0);}}>{name}</button>)}</div>}
    {dedicated&&<div className="cts-search"><label htmlFor="faith-query">이야기 검색</label><div><input id="faith-query" type="search" value={query} onChange={event=>{setQuery(event.target.value);setLimit(12);}} placeholder="제목이나 영상 제공 채널로 검색하세요"/></div></div>}
    {playing&&<div className="faith-player" ref={player}><div className="faith-player-heading"><strong>{playing.title}</strong><button type="button" onClick={()=>setPlaying(null)}>재생 닫기 ×</button></div><div className="faith-player-frame"><iframe key={playing.id} src={playerUrl(playing)} title={playing.title} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin"/></div><p><small>영상 제공: {playing.source}</small><a href={playing.url} target="_blank" rel="noopener noreferrer">재생이 안 되면 원문에서 보기 ↗</a></p></div>}
    <div className={compact?"portal-video-list":"faith-video-grid"}>{visible.map(video=>compact?<div className="portal-video" key={`${video.source}-${video.id}`}><button type="button" className="portal-video-play" onClick={()=>play(video)} aria-label={`${video.title} 재생`}><img src={video.thumbnail} alt="" width={160} height={90} loading="lazy"/><span aria-hidden="true">▶</span></button><div><button type="button" className="portal-story-title" onClick={()=>play(video)}><strong>{video.title}</strong></button><small>{video.source} · {video.category}</small></div></div>:<article className="faith-video-card" key={`${video.source}-${video.id}`}><button type="button" className="faith-video-play" onClick={()=>play(video)} aria-label={`${video.title} 재생`}><img src={video.thumbnail} alt="" width={320} height={180} loading="lazy"/><span aria-hidden="true">▶</span></button><button type="button" className="faith-video-title" onClick={()=>play(video)}>{video.title}</button><div className="faith-video-source"><small>{video.source} · {video.category}</small><a href={video.url} target="_blank" rel="noopener noreferrer" aria-label={`${video.title} 공식 출처`}>출처 ↗</a></div></article>)}</div>
    {dedicated&&filtered.length>limit&&<button className="faith-more" type="button" onClick={()=>setLimit(value=>value+12)}>이야기 더 보기 ({Math.min(limit,filtered.length)}/{filtered.length})</button>}
    {dedicated&&!filtered.length&&<p className="portal-empty">검색에 맞는 이야기가 없습니다. 다른 검색어나 주제를 선택해 주세요.</p>}
    {dedicated&&<p className="portal-health" role="status">{refreshing?"새 영상을 확인하고 있습니다. ":checkedAt?`마지막 확인 ${new Date(checkedAt).toLocaleString("ko-KR",{timeZone:"Asia/Seoul",month:"long",day:"numeric",hour:"2-digit",minute:"2-digit"})} · `:""}{feedDelayed?"새 영상 확인이 지연되어 확보된 영상을 표시합니다.":"CBS·CGN·바이블프로젝트 공식 채널의 새 영상을 주기적으로 확인합니다."} CTS는 2026. 9. 11. 확인한 영상 모음입니다.</p>}
  </section>;
}
