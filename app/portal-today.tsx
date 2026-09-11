"use client";

import { useMemo, useState, type ReactNode } from "react";
import { safeHttpUrl } from "./safe-url";
import type { SavedItem } from "./saved-items";

type Sermon = { youtubeId?:string; title:string; church:string; pastor:string; publishedAt?:string; thumbnailUrl?:string };
type News = { title:string; url:string; source:string; publishedAt:string };
type Props = {
  children?:ReactNode;
  news:News[]; sermons:Sermon[]; saved:SavedItem[]; now:string;
  newsLoading:boolean; sermonLoading:boolean;
  refresh:{sermons:string;news:string;sermonError:boolean;newsError:boolean};
};
const jumps = [["오늘의 5분","#daily-journey-title"],["말씀","#sermons"],["쇼츠","#shorts"],["찬양","#praises"],["교회","#church-directory"],["목회자","#pastor-directory"],["행사","#events"],["교계소식","#church-news"],["공동체","#community"],["착한나눔","#goodshare"],["달란트","#talent"],["소개·원칙","#vision"]];
const normalize=(text:string)=>text.replace(/\s/g,"").toLocaleLowerCase("ko-KR");
const stamp=(value?:string)=>{const time=Date.parse(value||"");return Number.isFinite(time)?time:0;};
function dateLabel(value:string){return stamp(value)?new Date(value).toLocaleDateString("ko-KR",{timeZone:"Asia/Seoul",month:"long",day:"numeric"}):"날짜 확인 필요";}
function freshness(value:string,now:string){if(!value)return "최근 확인 기록 없음";return `${dateLabel(value)} 확인${stamp(now)-stamp(value)>86400000?" · 갱신 지연":""}`;}

export default function PortalToday({news,sermons,saved,now,newsLoading,sermonLoading,refresh,children}:Props){
  const [tab,setTab]=useState<"recent"|"saved">("recent"),[playing,setPlaying]=useState<string|null>(null);
  const followed=saved.filter(item=>item.kind==="church"||item.kind==="pastor");
  const recent=useMemo(()=>[...new Map(sermons.filter(item=>/^[\w-]{11}$/.test(item.youtubeId||"")&&stamp(item.publishedAt)>0&&(!now||stamp(item.publishedAt)<=stamp(now))).map(item=>[item.youtubeId,item])).values()].sort((a,b)=>stamp(b.publishedAt)-stamp(a.publishedAt)),[sermons,now]);
  const matches=(sermon:Sermon)=>followed.some(item=>item.kind==="church"?normalize(item.title)===normalize(sermon.church):normalize(item.pastorName||item.title.replace(/\s*목사(?:님)?$/u,""))===normalize(sermon.pastor.replace(/\s*목사(?:님)?$/u,""))&&(!item.churchNames?.length||item.churchNames.some(name=>normalize(name)===normalize(sermon.church))));
  const shown=(tab==="saved"?recent.filter(matches):recent).slice(0,3);
  const headlines=useMemo(()=>[...new Map(news.filter(item=>safeHttpUrl(item.url)&&stamp(item.publishedAt)>0&&(!now||stamp(item.publishedAt)<=stamp(now))).map(item=>[normalize(item.title),item])).values()].sort((a,b)=>stamp(b.publishedAt)-stamp(a.publishedAt)).slice(0,4),[news,now]);
  return <section className="portal-today" aria-labelledby="portal-today-title">
    <nav className="portal-jumps" aria-label="첫 화면의 모든 서비스">{jumps.map(([label,href])=><a href={href} key={href}>{label}</a>)}</nav>
    <div className="portal-heading"><div><span className="section-kicker">{now?new Date(now).toLocaleDateString("ko-KR",{timeZone:"Asia/Seoul",month:"long",day:"numeric",weekday:"long"}):"오늘"}</span><h2 id="portal-today-title">오늘의 에어처치</h2></div><a href="#continue-title">♡ 나의 이어보기</a></div>
    <div className="portal-overview">
      <article className="portal-panel portal-headlines"><div className="portal-panel-heading"><h3>교회의 오늘</h3><a href="#church-news">소식 더 보기 →</a></div>
        <p className="portal-caption">공개된 교계 소식 · 최근 게시순</p>
        {newsLoading?<p className="portal-empty" role="status">새 소식을 불러오는 중입니다.</p>:headlines.length?<ol>{headlines.map((item,index)=><li key={item.url}><span aria-hidden="true">{String(index+1).padStart(2,"0")}</span><a href={safeHttpUrl(item.url)!} target="_blank" rel="noopener noreferrer"><strong>{item.title}</strong><small>{item.source} · {dateLabel(item.publishedAt)} ↗</small></a></li>)}</ol>:<p className="portal-empty">소식을 아직 불러오지 못했습니다. 아래 교계소식에서 출처를 확인할 수 있습니다.</p>}
        <p className="portal-health">{refresh.newsError?"연결 지연 · 마지막으로 받은 소식을 표시합니다":freshness(refresh.news,now)}</p>
      </article>
      <article className="portal-panel portal-sermons"><div className="portal-panel-heading"><h3>말씀 이어 듣기</h3><a href="#sermons">말씀 더 보기 →</a></div>
        <div className="portal-switch" aria-label="말씀 표시 조건"><button type="button" aria-pressed={tab==="recent"} onClick={()=>setTab("recent")}>최근 말씀</button><button type="button" aria-pressed={tab==="saved"} onClick={()=>setTab("saved")}>관심 교회·목회자</button></div>
        {sermonLoading?<p className="portal-empty" role="status">공식 채널의 말씀을 불러오는 중입니다.</p>:shown.length?<div className="portal-video-list">{shown.map(item=><div className="portal-video" key={item.youtubeId}>{playing===item.youtubeId?<div className="portal-player"><iframe src={`https://www.youtube-nocookie.com/embed/${item.youtubeId}?autoplay=1&rel=0`} title={item.title} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen/><button type="button" onClick={()=>setPlaying(null)} aria-label="말씀 재생 닫기">×</button></div>:<button className="portal-video-play" type="button" onClick={()=>setPlaying(item.youtubeId!)} aria-label={`${item.title} 재생`}><img src={`https://i.ytimg.com/vi/${item.youtubeId}/mqdefault.jpg`} width={160} height={90} alt="" loading="lazy"/><span aria-hidden="true">▶</span></button>}<div><strong>{item.title}</strong><small>{item.church} · {dateLabel(item.publishedAt!)}</small></div></div>)}</div>:<p className="portal-empty">{tab==="saved"?followed.length?"최근 수집된 말씀 중 관심 교회·목회자와 일치하는 항목이 없습니다.":"아래 교회·목회자에서 ♡를 누르면 이곳에 최근 말씀이 모입니다.":"최근 말씀을 아직 불러오지 못했습니다."}</p>}
        <p className="portal-health">{refresh.sermonError?"연결 지연 · 마지막으로 받은 말씀을 표시합니다":"화면이 열려 있는 동안 새 말씀을 주기적으로 확인합니다"}</p>
      </article>
    </div>
    {children}
  </section>;
}
