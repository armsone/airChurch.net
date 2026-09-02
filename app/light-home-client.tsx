"use client";

import { FormEvent, useEffect, useState } from "react";
import { readRecentSearches, writeRecentSearches } from "./recent-searches";
import { readSavedItems, SavedItem } from "./saved-items";
import SkipLink from "./skip-link";

const regions=["전체","서울","부산","대구","인천","광주","대전","울산","세종","경기","강원","충북","충남","전북","전남","경북","경남","제주"];
const denominations=["전체 교단","대한예수교장로회 통합","대한예수교장로회 합동","기독교대한감리회","대한예수교장로회 고신","기독교한국침례회","기독교대한성결교회","대한예수교장로회 합신","대한예수교장로회 백석","기독교대한하나님의성회","한국기독교장로회","독립교회"];
const dailyGuides=[
  {day:"주일",theme:"예배와 공동체",reference:"시편 122:1",question:"오늘 예배에서 마음에 오래 남은 한 문장은 무엇인가요?"},
  {day:"월요일",theme:"새로운 한 주",reference:"잠언 3:5-6",question:"이번 주 하나님께 맡기고 한 걸음 내디딜 일은 무엇인가요?"},
  {day:"화요일",theme:"일과 섬김",reference:"골로새서 3:23",question:"오늘 맡은 일을 사랑으로 바꿀 작은 행동은 무엇인가요?"},
  {day:"수요일",theme:"기도와 평안",reference:"빌립보서 4:6-7",question:"지금 염려 대신 기도로 올려드릴 한 가지는 무엇인가요?"},
  {day:"목요일",theme:"관계와 사랑",reference:"요한복음 13:34-35",question:"오늘 먼저 이해하고 품어야 할 사람은 누구인가요?"},
  {day:"금요일",theme:"쉼과 회복",reference:"마태복음 11:28",question:"한 주의 무게 가운데 내려놓아야 할 것은 무엇인가요?"},
  {day:"토요일",theme:"감사와 준비",reference:"데살로니가전서 5:16-18",question:"이번 주에 발견한 감사 세 가지를 떠올려 보세요."},
] as const;

export default function LightHome(){
  const [savedItems,setSavedItems]=useState<SavedItem[]>([]);
  const [recentSearches,setRecentSearches]=useState<string[]>([]);
  const [today,setToday]=useState<number|null>(null);

  useEffect(()=>{
    const refresh=()=>{setSavedItems(readSavedItems());setRecentSearches(readRecentSearches());};
    refresh();
    const now=new Date(Date.now()+9*60*60*1000);
    setToday(now.getUTCDay());
    window.addEventListener("focus",refresh);
    window.addEventListener("storage",refresh);
    window.addEventListener("airchurch:saved-change",refresh);
    return()=>{window.removeEventListener("focus",refresh);window.removeEventListener("storage",refresh);window.removeEventListener("airchurch:saved-change",refresh);};
  },[]);

  const guide=dailyGuides[today??0];
  function rememberSearch(event:FormEvent<HTMLFormElement>){
    const form=new FormData(event.currentTarget),query=String(form.get("q")||"").trim();
    if(!query)return;
    const next=[query,...recentSearches.filter((item)=>item.toLocaleLowerCase("ko-KR")!==query.toLocaleLowerCase("ko-KR"))].slice(0,5);
    setRecentSearches(next);
    try{writeRecentSearches(next);}catch{/* 저장이 제한돼도 검색은 계속합니다. */}
  }

  return <main className="light-home" id="top">
    <SkipLink/>
    <header className="light-header">
      <a className="brand" href="/" aria-label="에어처치 첫 화면"><span className="brand-mark" aria-hidden="true"/><span>airchurch</span></a>
      <nav aria-label="빠른 메뉴"><a href="/search">통합 검색</a><a href="/saved">나의 모음</a><a href="/portal">전체 포털</a></nav>
    </header>

    <section className="light-hero" id="primary-content" tabIndex={-1}>
      <div className="light-mode-label"><span aria-hidden="true">✓</span> 저부하 첫 화면 · 영상과 사진은 선택할 때만</div>
      <h1>말씀을 발견하고<br/>교회와 이어지는 곳</h1>
      <p>찾고 싶은 것부터 바로 시작하세요. 첫 화면은 빠르게 열리고, 필요한 콘텐츠만 이어서 불러옵니다.</p>
      <form className="light-search" action="/search" method="get" role="search" onSubmit={rememberSearch}>
        <label htmlFor="light-search-query">교회, 목사, 지역, 교단 검색</label>
        <div><span aria-hidden="true">⌕</span><input id="light-search-query" name="q" type="search" inputMode="search" enterKeyHint="search" placeholder="교회나 목사님 이름을 입력하세요"/></div>
        <div className="light-search-filters"><select name="region" aria-label="지역 선택">{regions.map((item)=><option value={item==="전체"?"":item} key={item}>{item}</option>)}</select><select name="denomination" aria-label="교단 선택">{denominations.map((item)=><option value={item==="전체 교단"?"":item} key={item}>{item}</option>)}</select><button type="submit">찾기</button></div>
      </form>
      {recentSearches.length>0&&<div className="light-recent" aria-label="최근 검색"><span>최근 검색</span>{recentSearches.slice(0,3).map((item)=><a href={`/search?q=${encodeURIComponent(item)}`} key={item}>{item}</a>)}</div>}
      <div className="light-trust"><span>공개 자료만</span><span>공식 원문 연결</span><span>문제 제보 시 보류 검토</span></div>
    </section>

    <section className="light-core" aria-label="오늘과 나의 이어보기">
      <article className="light-today">
        <div><span className="section-kicker">{today===null?"오늘의 5분":`${guide.day} · 오늘의 5분`}</span><h2>{today===null?"말씀으로 잠시 멈추기":guide.theme}</h2></div>
        <blockquote>{guide.question}</blockquote>
        <div className="light-actions"><a className="primary" href={`https://www.bible.com/ko/search/bible?q=${encodeURIComponent(guide.reference).replace(/%20/g,"+")}`} target="_blank" rel="noopener noreferrer">{guide.reference} 읽기 ↗</a><a href="/portal#sermons">오늘의 말씀 보기</a></div>
      </article>
      <article className="light-continue">
        <div><span className="section-kicker">이 브라우저에만 저장</span><h2>나의 이어보기</h2></div>
        {savedItems.length?<div className="light-saved-list">{savedItems.slice(0,3).map((item)=><a href={item.url} key={item.id}><span>{item.kind==="sermon"?"말씀":item.kind==="praise"?"찬양":item.kind==="pastor"?"목회자":"교회"}</span><strong>{item.title}</strong><small>{item.subtitle}</small></a>)}</div>:<p>관심 있는 말씀·찬양·교회·목회자를 찜하면 여기에 바로 나타납니다.</p>}
        <a className="light-all-link" href={savedItems.length?"/saved":"/portal#sermons"}>{savedItems.length?`전체 모음 ${savedItems.length}개 보기 →`:"둘러보고 첫 항목 찜하기 →"}</a>
      </article>
    </section>

    <div className="light-legacy-anchors" aria-hidden="true"><span id="sermons"/><span id="shorts"/><span id="praises"/><span id="church-directory"/><span id="pastor-directory"/><span id="church-news"/><span id="community"/><span id="goodshare"/><span id="talent"/></div>
    <section className="light-paths" aria-labelledby="light-paths-title">
      <div><span className="section-kicker">필요한 곳만 열기</span><h2 id="light-paths-title">오늘 무엇을 찾으시나요?</h2><p>각 화면을 선택할 때 필요한 데이터와 미디어만 불러옵니다.</p></div>
      <div className="light-path-grid">
        <a href="/portal#sermons"><span aria-hidden="true">말씀</span><strong>말씀과 찬양</strong><small>오늘의 설교·쇼츠·찬양 보기</small><b>열기 →</b></a>
        <a href="/portal#church-directory"><span aria-hidden="true">교회</span><strong>교회와 목회자</strong><small>지역·교단·이름으로 둘러보기</small><b>열기 →</b></a>
        <a href="/portal#church-news"><span aria-hidden="true">소식</span><strong>교계소식</strong><small>공식 RSS에서 모은 새 소식</small><b>열기 →</b></a>
        <a href="/portal#community"><span aria-hidden="true">나눔</span><strong>공동체와 착한나눔</strong><small>마음과 달란트를 안전하게 잇기</small><b>열기 →</b></a>
      </div>
    </section>

    <footer className="light-footer"><a className="brand" href="/"><span className="brand-mark" aria-hidden="true"/><span>airchurch</span></a><p>발견은 가볍게 · 연결은 정직하게</p><nav aria-label="운영 안내"><a href="/about">운영 안내</a><a href="/privacy">개인정보</a><a href="/contact">문의</a></nav></footer>
  </main>;
}
