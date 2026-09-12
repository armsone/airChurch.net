"use client";

import { useEffect, useState, type ReactNode } from "react";
import CtsDiscovery from "./cts-discovery";
import EventsBrowser from "./events/events-browser";
import { safeHttpUrl } from "./safe-url";
import type { SavedItem } from "./saved-items";

type Video={youtubeId?:string;title:string;church:string;pastor?:string;publishedAt?:string};
type News={title:string;url:string;source:string;publishedAt:string};
type Rank={id:number;publicId:number;name:string;churchName?:string|null;uniqueVisitors:number;source?:string};
type Post={href?:string;id:number;category:string;nickname:string;content:string};
type Props={news:News[];sermons:Video[];saved:SavedItem[];now:string;newsLoading:boolean;sermonLoading:boolean;refresh:{sermons:string;news:string;sermonError:boolean;newsError:boolean};rankings:{churches:Rank[];pastors:Rank[]};posts:Post[];region:string;onRankingMore:(kind:"churches"|"pastors")=>void};
const jumps=[["오늘의 성경","#daily-scripture"],["쇼츠","#shorts"],["교회 찾기","#church-directory"],["목회자 찾기","#pastor-directory"],["글 쓰기","#talent"],["소개·원칙","#vision"]];
const normalize=(value:string)=>value.replace(/\s/g,"").replace(/목사(?:님)?$/u,"").toLocaleLowerCase("ko-KR");
const panelThemes:Record<string,{icon:string;tone:string}>={"말씀":{icon:"📖",tone:"word"},"찬양":{icon:"🎵",tone:"praise"},"뉴스":{icon:"📰",tone:"news"},"교회":{icon:"⛪",tone:"church"},"목회자":{icon:"👤",tone:"pastor"},"교계행사":{icon:"📅",tone:"event"},"선한 영향력":{icon:"💬",tone:"community"}};
function Panel({title,href,children,onMore}:{title:string;href:string;children:ReactNode;onMore?:()=>void}){const theme=panelThemes[title];return <article className={`portal-panel portal-tone-${theme.tone}`}><div className="portal-panel-heading"><h3><a href={href} onClick={onMore}><span className="portal-title-icon" aria-hidden="true">{theme.icon}</span>{title}</a></h3><a href={href} onClick={onMore} aria-label={`${title} 더 보기`}>더 보기 →</a></div>{children}</article>;}

function VideoList({items}:{items:Video[]}){
 const [playing,setPlaying]=useState<string|null>(null);
 return <div className="portal-video-list">{items.map(item=><div className="portal-video" key={item.youtubeId}>{playing===item.youtubeId?<div className="portal-player"><iframe src={`https://www.youtube-nocookie.com/embed/${item.youtubeId}?autoplay=1&rel=0`} title={item.title} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen/><button type="button" onClick={()=>setPlaying(null)} aria-label="재생 닫기">×</button></div>:<button className="portal-video-play" type="button" onClick={()=>setPlaying(item.youtubeId!)} aria-label={`${item.title} 재생`}><img src={`https://i.ytimg.com/vi/${item.youtubeId}/mqdefault.jpg`} width={160} height={90} alt="" loading="lazy"/><span aria-hidden="true">▶</span></button>}<div><strong>{item.title}</strong><small>{item.church}</small></div></div>)}</div>;
}
export default function PortalToday({news,sermons,saved,now,newsLoading,sermonLoading,refresh,rankings,posts,region,onRankingMore}:Props){
 const [savedOnly,setSavedOnly]=useState(false),[praises,setPraises]=useState<Video[]>([]),[praiseState,setPraiseState]=useState("loading"),[retry,setRetry]=useState(0);
 useEffect(()=>{const controller=new AbortController();setPraiseState("loading");fetch("/api/ccm",{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(15000)])}).then(async response=>{if(!response.ok)throw Error();const data=await response.json();if(!controller.signal.aborted){setPraises((data.items||[]).filter((item:{id:string})=>/^[\w-]{11}$/.test(item.id)).slice(0,4).map((item:{id:string;title:string;channel:string})=>({youtubeId:item.id,title:item.title,church:item.channel})));setPraiseState("ready");}}).catch(()=>{if(!controller.signal.aborted)setPraiseState("failed");});return()=>controller.abort();},[retry]);
 const followed=saved.filter(item=>item.kind==="church"||item.kind==="pastor");
 const shown=[...new Map(sermons.filter(item=>/^[\w-]{11}$/.test(item.youtubeId||"")&&Number.isFinite(Date.parse(item.publishedAt||""))&&(!now||Date.parse(item.publishedAt!)<=Date.parse(now))).map(item=>[item.youtubeId,item])).values()].sort((a,b)=>Date.parse(b.publishedAt!)-Date.parse(a.publishedAt!)).filter(item=>!savedOnly||followed.some(savedItem=>savedItem.kind==="church"?normalize(savedItem.title)===normalize(item.church):normalize(savedItem.pastorName||savedItem.title)===normalize(item.pastor||"")&&(!savedItem.churchNames?.length||savedItem.churchNames.some(name=>normalize(name)===normalize(item.church))))).slice(0,4);
 const sortedNews=[...new Map(news.filter(item=>safeHttpUrl(item.url)&&Number.isFinite(Date.parse(item.publishedAt))&&(!now||Date.parse(item.publishedAt)<=Date.parse(now))).map(item=>[item.title,item])).values()].sort((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt));
 const diverse=sortedNews.filter((item,index,all)=>all.findIndex(other=>other.source===item.source)===index);
 const headlines=diverse.slice(0,4);
 return <section className="portal-today" aria-labelledby="portal-today-title">
  <div className="portal-heading"><h2 id="portal-today-title">투데이</h2><a href="/saved">♡ 나의 모음</a></div>
  <div className="portal-overview portal-eight">
   <Panel title="말씀" href="#sermons"><div className="portal-switch"><button type="button" aria-pressed={!savedOnly} onClick={()=>setSavedOnly(false)}>최근 말씀</button><button type="button" aria-pressed={savedOnly} onClick={()=>setSavedOnly(true)}>관심 교회·목회자</button></div>{sermonLoading?<p className="portal-empty">말씀을 불러오는 중입니다.</p>:shown.length?<VideoList items={shown}/>:<p className="portal-empty">{savedOnly?"관심 교회·목회자에 해당하는 최근 말씀이 없습니다.":"말씀을 아직 불러오지 못했습니다."}</p>}{refresh.sermonError&&<p className="portal-health">새 말씀 확인 지연 · 이전 목록 표시</p>}</Panel>
   <Panel title="뉴스" href="#church-news"><p className="portal-caption">여러 매체에서 고른 최근 소식</p><ul className="portal-picks">{headlines.map(item=><li key={item.url}><a href={item.url} target="_blank" rel="noopener noreferrer"><strong>{item.title}</strong><small>{item.source} · {new Date(item.publishedAt).toLocaleDateString("ko-KR",{month:"numeric",day:"numeric",timeZone:"Asia/Seoul"})}</small></a></li>)}</ul>{!headlines.length&&<p className="portal-empty">{newsLoading?"소식을 불러오는 중입니다.":"소식을 아직 불러오지 못했습니다."}</p>}{refresh.newsError&&<p className="portal-health">새 소식 확인 지연 · 이전 목록 표시</p>}</Panel>
   <Panel title="찬양" href="#praises"><p className="portal-caption">오늘 함께 듣는 CCM</p>{praises.length?<VideoList items={praises}/>:<p className="portal-empty">{praiseState==="loading"?"찬양을 불러오는 중입니다.":"찬양을 아직 불러오지 못했습니다."}{praiseState==="failed"&&<button type="button" onClick={()=>setRetry(value=>value+1)}>다시 시도</button>}</p>}</Panel>
   <Panel title="선한 영향력" href="#community"><p className="portal-caption">이야기 · 기도 · 달란트 나눔</p><ul className="portal-picks">{posts.slice(0,4).map(post=><li key={post.id}><a href={post.href||`#community-post-${post.id}`}><strong>{post.content.slice(0,75)}{post.content.length>75?"…":""}</strong><small>{post.nickname}</small></a></li>)}</ul>{!posts.length&&<p className="portal-empty">아직 공개된 이야기가 없습니다. 광장에서 첫 마음을 나눠보세요.</p>}</Panel>
   <CtsDiscovery compact/>
   <Panel title="교계행사" href="#events"><EventsBrowser compact preview portalRegion={region}/></Panel>
   {(["churches","pastors"] as const).map(kind=><Panel key={kind} title={kind==="churches"?"교회":"목회자"} href={kind==="churches"?"#ranking-churches":"#ranking-pastors"} onMore={()=>onRankingMore(kind)}><p className="portal-caption">이번 주 많이 찾은 {kind==="churches"?"교회":"목회자"}</p><ol className="portal-picks portal-rank-picks">{rankings[kind].slice(0,4).map((item,index)=><li key={item.id}><b>{index+1}</b><a href={`/${kind==="churches"?"church":"pastors"}/${item.publicId}`}><strong>{item.name}</strong><small>{item.source==="sermon"?"새로 소개하는 교회":`${item.uniqueVisitors.toLocaleString("ko-KR")}명 방문`}{item.churchName?` · ${item.churchName}`:""}</small></a></li>)}</ol>{!rankings[kind].length&&<p className="portal-empty">아직 집계된 방문 기록이 없습니다.</p>}</Panel>)}
  </div>
  <nav className="portal-jumps portal-extras" aria-label="함께 이용하는 서비스">{jumps.map(([label,href])=><a href={href} key={href}>{label}</a>)}</nav>
 </section>;
}
