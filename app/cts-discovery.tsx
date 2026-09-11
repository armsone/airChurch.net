"use client";

import { useRef, useState } from "react";
import catalog from "../data/faith-discovery-videos.json";

type Video = typeof catalog.items[number];
const categories=["추천","청년·말씀","성경 배우기","간증·삶"];
function playerUrl(video:Video){
  // Use the provider's own player with its branding, advertisements and controls intact.
  const params=new URLSearchParams({type:"cts",id:video.id,pid:video.programId,skin:"catvod",auto:"Y",fullscreenAllowFullscreen:"Y",toggleBtn:"Y",fullscreenBtn:"Y",disableSeekable:"Y",thumbnail:"Y",currentTimeText:"Y",durationText:"Y",continuityPlay:"Y",volume:"Y",progress:"Y",ad:"Y",adCate:"CATTV",quality:"Y",rateUse:"Y",playlist:"Y"});
  return `https://ac.cts.tv/videoplayer/zoneplayer?${params}`;
}
export default function CtsDiscovery(){
  const [category,setCategory]=useState("추천"),[playing,setPlaying]=useState<Video|null>(null);
  const player=useRef<HTMLDivElement>(null);
  const play=(video:Video)=>{setPlaying(video);requestAnimationFrame(()=>player.current?.scrollIntoView({block:"nearest",behavior:"auto"}));};
  return <section className="cts-discovery" aria-labelledby="cts-discovery-title">
    <div className="portal-panel-heading"><div><span className="section-kicker">에어처치가 모은 신앙 이야기</span><h3 id="cts-discovery-title">오늘을 위한 신앙 발견</h3></div></div>
    <p className="portal-caption">삶의 고백, 청년의 질문, 성경 속 이야기. 마음에 닿는 영상부터 만나보세요.</p>
    <div className="portal-switch cts-switch" aria-label="신앙 영상 주제">{categories.map(name=><button key={name} type="button" aria-pressed={category===name} onClick={()=>{setCategory(name);setPlaying(null);}}>{name}</button>)}</div>
    {playing&&<div className="faith-player" ref={player}><div className="faith-player-heading"><strong>{playing.title}</strong><button type="button" onClick={()=>setPlaying(null)}>재생 닫기 ×</button></div><div className="faith-player-frame"><iframe key={playing.id} src={playerUrl(playing)} title={playing.title} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin"/></div><p><small>영상 제공: CTS</small><a href={playing.url} target="_blank" rel="noopener noreferrer">재생이 안 되면 원문에서 보기 ↗</a></p></div>}
    <div className="faith-video-grid">{catalog.items.filter(video=>video.category===category).map(video=><article className="faith-video-card" key={video.id}><button type="button" className="faith-video-play" onClick={()=>play(video)} aria-label={`${video.title} 재생`}><img src={video.thumbnail} alt="" width={320} height={180} loading="lazy"/><span aria-hidden="true">▶</span></button><button type="button" className="faith-video-title" onClick={()=>play(video)}>{video.title}</button><div className="faith-video-source"><small>CTS · {video.category}</small><a href={video.url} target="_blank" rel="noopener noreferrer" aria-label={`${video.title} 공식 출처`}>출처 ↗</a></div></article>)}</div>
    <p className="portal-health">공개 영상 모음 · 출처 확인 2026. 9. 11.</p>
  </section>;
}
