"use client";

import { useEffect, useRef, useState } from "react";
import { loadYouTubeApi, type YouTubePlayer } from "./youtube-api";

export type Track={id:string;title:string;channel:string;duration:number};
type CuratedCollection={items:Track[];title:string;intro:string;sourceUrl:string;sourceLabel:string};
const ppabangUrl="https://ppabang.net/?category=ccm";
const duration=(seconds:number)=>seconds?`${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2,"0")}`:"";

export default function CcmPlayer({visible,interrupted,onPlay,church,curated}:{visible:boolean;interrupted:boolean;onPlay:()=>void;church?:{items:Track[];loading:boolean;total:number;query:string;onQuery:(value:string)=>void;hasMore:boolean;moreLoading:boolean;onMore:()=>Promise<void>;error:string;onRetry:()=>void;isSaved:(id:string)=>boolean;onSave:(track:Track)=>void};curated?:CuratedCollection}) {
  const isChurch=Boolean(church);
  const label=isChurch?"교회 찬양":curated?.title||"CCM 듣기";
  const searchId=isChurch?"church-praise-find":curated?"bible-music-find":"ccm-find";
  const [items,setItems]=useState<Track[]>([]);
  const [selected,setSelected]=useState("");
  const [playing,setPlaying]=useState(false);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [retry,setRetry]=useState(0);
  const [query,setQuery]=useState("");
  const [scrollTop,setScrollTop]=useState(0);
  const [listHeight,setListHeight]=useState(600);
  const listRef=useRef<HTMLDivElement>(null);
  const nextAfterRef=useRef<string|null>(null);
  const churchRef=useRef(church);churchRef.current=church;
  const frame=useRef<HTMLDivElement>(null);
  const onPlayRef=useRef(onPlay);
  onPlayRef.current=onPlay;
  const index=items.findIndex(item=>item.id===selected);
  const current=items[index];
  const itemsRef=useRef(items);itemsRef.current=items;

  useEffect(()=>{
    if(isChurch||curated)return;
    const controller=new AbortController();
    setLoading(true);setError("");
    const timer=setTimeout(()=>controller.abort(),16000);
    fetch("/api/ccm",{signal:controller.signal}).then(async response=>{
      if(!response.ok)throw new Error();
      const data=await response.json() as {items:Track[]};
      if(!data.items?.length)throw new Error();
      if(controller.signal.aborted)return;
      setItems(data.items);
      const shared=new URLSearchParams(window.location.search).get("ccm");
      const match=data.items.find(item=>item.id===shared);
      setSelected(match?.id||data.items[0].id);
      if(shared&&!match)setNotice("공유된 곡은 현재 목록에 없습니다. 다른 찬양을 골라 주세요.");
    }).catch(()=>{if(!controller.signal.aborted||!disposed)setError("찬양 목록을 불러오지 못했어요. 다시 시도해 주세요.");})
      .finally(()=>{clearTimeout(timer);if(!disposed)setLoading(false);});
    let disposed=false;
    return()=>{disposed=true;controller.abort();clearTimeout(timer);};
  },[retry,isChurch]);

  useEffect(()=>{
    if(!curated)return;
    setItems(curated.items);setLoading(false);setError("");
    setSelected(previous=>curated.items.some(item=>item.id===previous)?previous:curated.items[0]?.id||"");
    setPlaying(false);
  },[curated]);

  useEffect(()=>{
    if(!church)return;
    setItems(church.items);setLoading(church.loading);
    setSelected(previous=>church.items.some(item=>item.id===previous)?previous:church.items[0]?.id||"");
    if(church.loading){nextAfterRef.current=null;setScrollTop(0);if(listRef.current)listRef.current.scrollTop=0;}
    const nextIndex=nextAfterRef.current?church.items.findIndex(item=>item.id===nextAfterRef.current)+1:0;
    if(nextAfterRef.current&&nextIndex>0&&church.items[nextIndex]){setSelected(church.items[nextIndex].id);setPlaying(true);nextAfterRef.current=null;}
    if(church.loading||!church.items.some(item=>item.id===selected))setPlaying(false);
  },[church?.items,church?.loading]);

  useEffect(()=>{if(!visible||interrupted){setPlaying(false);nextAfterRef.current=null;}},[visible,interrupted]);
  useEffect(()=>{
    const node=listRef.current;if(!node)return;
    const observer=new ResizeObserver(()=>setListHeight(node.clientHeight));observer.observe(node);
    return()=>observer.disconnect();
  },[loading,visible]);

  useEffect(()=>{
    if(!playing||loading||!selected||!frame.current)return;
    let cancelled=false;
    let player:YouTubePlayer|undefined;
    const host=frame.current;
    const element=document.createElement("iframe");
    element.src=`https://www.youtube.com/embed/${selected}?enablejsapi=1&autoplay=1&playsinline=1&rel=0&origin=${encodeURIComponent(window.location.origin)}`;
    element.title=itemsRef.current.find(item=>item.id===selected)?.title||"CCM 듣기";
    element.referrerPolicy="strict-origin-when-cross-origin";
    element.allow="autoplay; encrypted-media; picture-in-picture; fullscreen";
    element.allowFullscreen=true;
    host.appendChild(element);
    const timeout=setTimeout(()=>{if(!cancelled)setNotice("재생이 시작되지 않으면 영상의 재생 버튼을 눌러 주세요.");},12000);
    void loadYouTubeApi().then(api=>{
      if(cancelled)return;
      player=new api.Player(element,{events:{
        onReady:event=>{clearTimeout(timeout);if(!cancelled)event.target.playVideo();},
        onStateChange:event=>{
          if(cancelled)return;
          if(event.data===1){setNotice("");onPlayRef.current();}
          if(event.data===0){
            const list=itemsRef.current;
            const position=list.findIndex(item=>item.id===selected);
            if(position>=0&&position<list.length-1)setSelected(list[position+1].id);
            else if(churchRef.current?.hasMore){nextAfterRef.current=selected;void churchRef.current.onMore();}
            else {setPlaying(false);setNotice("준비된 찬양을 모두 들었어요. 다시 듣거나 다른 곡을 골라 보세요.");}
          }
        },
        onError:()=>{if(!cancelled)setNotice("이 영상은 여기서 재생할 수 없어요. 다음 곡을 선택하거나 YouTube에서 들어 주세요.");},
      }});
    });
    return()=>{cancelled=true;clearTimeout(timeout);player?.destroy();host.replaceChildren();};
  },[playing,selected,loading]);

  function choose(id:string) {nextAfterRef.current=null;setSelected(id);setPlaying(true);setNotice("");onPlayRef.current();}
  function move(offset:number){const item=items[index+offset];if(item)choose(item.id);else if(offset>0&&church?.hasMore){nextAfterRef.current=selected;void church.onMore();}}
  async function share(song:boolean) {
    const url=new URL(isChurch&&song&&current?`https://www.youtube.com/watch?v=${current.id}`:"/",window.location.origin);
    if(isChurch){if(!song){url.searchParams.set("praise","church");url.hash="praises";}}
    else {if(song&&current)url.searchParams.set("ccm",current.id);url.hash="praises";}
    try {
      if(navigator.share)await navigator.share({title:song&&current?current.title:`에어처치 · ${label}`,url:url.href});
      else {await navigator.clipboard.writeText(url.href);setNotice(song?"이 찬양의 링크를 복사했어요.":`${label} 링크를 복사했어요.`);}
    } catch(error) {
      if((error as Error).name==="AbortError")return;
      try {await navigator.clipboard.writeText(url.href);setNotice("링크를 복사했어요.");}
      catch {setNotice("링크를 복사해서 나눠 주세요.");setShareFallback(url.href);}
    }
  }
  const [shareFallback,setShareFallback]=useState("");
  const shown=isChurch?items:items.filter(item=>`${item.title} ${item.channel}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));

  const firstRow=isChurch?Math.max(0,Math.floor(scrollTop/86)-4):0;
  const lastRow=isChurch?Math.min(shown.length,firstRow+Math.ceil(listHeight/86)+9):shown.length;
  const rendered=shown.slice(firstRow,lastRow);
  return <div className="ccm-listener" hidden={!visible}>
    <div className="ccm-intro"><p>{isChurch?"함께 부르는 믿음의 고백.":curated?.intro||"오늘의 마음에, 찬양 한 곡."}</p>{curated?<a href={curated.sourceUrl} target="_blank" rel="noopener noreferrer" onClick={()=>setPlaying(false)}>{curated.sourceLabel} ↗</a>:!isChurch&&<a href={ppabangUrl} target="_blank" rel="noopener noreferrer" onClick={()=>setPlaying(false)}>빠방에서 더 듣기 ↗</a>}</div>
    <div className="ccm-layout">
      <div className="ccm-main">{current?<>
        <div className="ccm-screen">
          {playing?<div className="ccm-player-host" ref={frame}/>:<button className="ccm-cover" type="button" onClick={()=>choose(current.id)} aria-label={`${current.title} 듣기`}><img src={`https://i.ytimg.com/vi/${current.id}/hqdefault.jpg`} alt="" width={480} height={360}/><span className="ccm-start"><b aria-hidden="true">▶</b>찬양 듣기</span></button>}
        </div>
        <div className="ccm-now"><span className="ccm-eyebrow">{isChurch?"✓ 검증 교회 · 공식 채널":playing?"지금 듣는 찬양":"오늘 함께 들을 찬양"}</span><h3>{current.title}</h3><p>{current.channel}</p>
          <div className="ccm-controls"><button type="button" onClick={()=>move(-1)} disabled={index<=0} aria-label="이전 곡">‹ 이전</button><button type="button" className="ccm-primary" onClick={()=>playing?setPlaying(false):choose(current.id)}>{playing?"■ 듣기 멈추기":"▶ 찬양 듣기"}</button><button type="button" onClick={()=>move(1)} disabled={index>=items.length-1&&!church?.hasMore} aria-label="다음 곡">다음 ›</button></div>
          <div className="ccm-actions"><button type="button" onClick={()=>void share(true)}>↗ 이 찬양 나누기</button>{church&&<button type="button" aria-pressed={church.isSaved(current.id)} onClick={()=>church.onSave(current)}>{church.isSaved(current.id)?"♥ 찜됨":"♡ 찜"}</button>}<a href={`https://www.youtube.com/watch?v=${current.id}`} target="_blank" rel="noopener noreferrer" onClick={()=>setPlaying(false)}>YouTube에서 듣기 ↗</a></div>
        </div>
      </>:<div className="ccm-loading" role="status">{loading?"♫ 찬양을 준비하고 있어요…":error||church?.error||"조건에 맞는 찬양이 없습니다. 검색어나 지역·교단 조건을 바꿔 주세요."}{(error||church?.error)&&<button type="button" onClick={()=>church?church.onRetry():setRetry(value=>value+1)}>다시 불러오기</button>}</div>}</div>
      <div className="ccm-queue"><div className="ccm-queue-heading"><h3>{isChurch?"함께 듣는 교회 찬양":curated?"바이블뮤직 선곡":"함께 듣는 CCM"} <span>{church?church.total:items.length}</span></h3><button type="button" onClick={()=>void share(false)} aria-label={`${label} 공유`}>↗ 나누기</button></div><label className="sr-only" htmlFor={searchId}>{isChurch?"찬양과 교회 찾기":curated?"바이블뮤직 영상 찾기":"CCM 곡과 찬양팀 찾기"}</label><input id={searchId} className="ccm-find" type="search" value={church?church.query:query} onChange={event=>church?church.onQuery(event.target.value):setQuery(event.target.value)} placeholder={isChurch?"찬양 제목 · 교회 · 지역 찾기":curated?"시편 또는 Holy Verse 찾기":"곡 제목 · 찬양팀 찾기"}/><div className="ccm-tracks" aria-busy={loading||church?.moreLoading} ref={listRef} onScroll={event=>{if(!church)return;const node=event.currentTarget;setScrollTop(node.scrollTop);if(node.scrollHeight-node.scrollTop-node.clientHeight<240&&church.hasMore&&!church.moreLoading&&!church.error)void church.onMore();}} role="group" aria-label={`${label} 재생목록`}>{firstRow>0&&<div aria-hidden="true" style={{height:firstRow*86}}/>}{rendered.map(item=><button type="button" key={item.id} style={isChurch?{height:86}:undefined} className={`ccm-track${item.id===selected?" is-current":""}`} onClick={()=>choose(item.id)} aria-pressed={item.id===selected}><img src={`https://i.ytimg.com/vi/${item.id}/mqdefault.jpg`} alt="" width={96} height={54} loading="lazy"/><span><strong>{item.title}</strong><small>{item.channel}</small></span><em>{item.id===selected?"♪":duration(item.duration)}</em></button>)}{lastRow<shown.length&&<div aria-hidden="true" style={{height:(shown.length-lastRow)*86}}/>}{church?.hasMore&&<button className="ccm-load-more" type="button" disabled={church.moreLoading} onClick={()=>void church.onMore()}>{church.moreLoading?"찬양 불러오는 중…":"찬양 50개 더 보기"}</button>}{!loading&&!shown.length&&<p className="ccm-no-results">{isChurch?"찾는 찬양이 없어요. 다른 제목이나 교회를 입력해 보세요.":curated?"찾는 영상이 없어요. 시편 또는 Holy Verse로 찾아 보세요.":"찾는 곡이 없어요. 다른 제목이나 찬양팀을 입력해 보세요."}</p>}</div><p className="ccm-source">{isChurch?"교회 공식 채널의 찬양":curated?"BibleMusic.co.kr_바이블뮤직 공식 채널의 선별 영상":"빠방 CCM에서 함께 고른 찬양"} · 한 곡이 끝나면 다음 곡으로</p></div>
    </div>
    <p className="ccm-notice" role="status">{church?.error||notice}</p>{shareFallback&&<input className="ccm-share-url" aria-label="공유할 링크" value={shareFallback} readOnly onFocus={event=>event.target.select()}/>}
  </div>;
}
