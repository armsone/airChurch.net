"use client";

import { useEffect, useState } from "react";
import { readSavedItems, SavedItem } from "./saved-items";
import SkipLink from "./skip-link";

function churchSeason(date:Date){
  const month=date.getMonth()+1;
  if(month===12)return {name:"대림절과 성탄절",copy:"기다림과 기쁨 속에서 우리 가운데 오신 예수님을 바라봅니다."};
  if(month>=3&&month<=4)return {name:"사순절과 부활절",copy:"십자가를 돌아보고 부활의 소망을 일상에서 살아냅니다."};
  return {name:"성령강림 후",copy:"말씀을 삶과 이웃 사랑으로 이어가는 성장의 시간을 걷습니다."};
}

export default function LightHome(){
  const [savedItems,setSavedItems]=useState<SavedItem[]>([]);
  const [season,setSeason]=useState({name:"오늘의 교회력",copy:"오늘의 절기와 말씀을 함께 살펴봅니다."});

  useEffect(()=>{
    const refresh=()=>setSavedItems(readSavedItems());
    refresh();
    setSeason(churchSeason(new Date()));
    window.addEventListener("focus",refresh);
    window.addEventListener("storage",refresh);
    window.addEventListener("airchurch:saved-change",refresh);
    return()=>{
      window.removeEventListener("focus",refresh);
      window.removeEventListener("storage",refresh);
      window.removeEventListener("airchurch:saved-change",refresh);
    };
  },[]);

  return <main className="light-home simple-home" id="top">
    <SkipLink/>
    <header className="light-header simple-home-header">
      <a className="brand" href="/" aria-label="airChurch 첫 화면"><span className="brand-mark" aria-hidden="true"/><span>airchurch</span></a>
      <a className="simple-home-open" href="/portal">포털 열기 →</a>
    </header>

    <section className="simple-home-intro" id="primary-content" tabIndex={-1}>
      <p>빠르고 조용한 첫 화면</p>
      <h1>오늘 필요한 곳으로<br/>가볍게 이어집니다</h1>
      <form className="simple-home-search" action="/portal" method="get" role="search">
        <label htmlFor="home-portal-search">교회·목사님·말씀 찾기</label>
        <div className="simple-home-search-row">
          <input id="home-portal-search" type="search" name="q" placeholder="예) 우리동네 교회, 김민석 목사, 요한복음"/>
          <button type="submit">검색</button>
        </div>
      </form>
    </section>

    <section className="simple-home-grid" aria-label="airChurch 첫 화면 안내">
      <a className="simple-home-card bible" href="/portal#sermons"><span>성경</span><h2>말씀으로 하루를 시작해요</h2><p>오늘의 말씀과 설교를 포털에서 천천히 살펴보세요.</p><b>말씀 보기 →</b></a>
      <a className="simple-home-card saved" href="/portal#saved"><span>나의 모음</span><h2>{savedItems.length?`${savedItems.length}개를 모아 두었어요`:"마음에 남은 것을 모아 두세요"}</h2><p>{savedItems.length?savedItems.slice(0,2).map((item)=>item.title).join(" · "):"로그인 없이 이 브라우저에만 보관합니다."}</p><b>포털에서 보기 →</b></a>
      <a className="simple-home-card season" href="/portal#sermons"><span>교회력으로 걷는 오늘</span><h2>{season.name}</h2><p>{season.copy}</p><b>오늘의 말씀 보기 →</b></a>
      <a className="simple-home-card search" href="/portal#site-search"><span>마음에서 시작하는 검색</span><h2>이름보다 마음을 먼저 떠올려도 괜찮아요</h2><p>말씀, 교회, 목사님을 한 포털 안에서 찾습니다.</p><b>검색 시작하기 →</b></a>
      <a className="simple-home-card statement" href="/portal#about"><span>airChurch가 지키는 한 문장</span><h2>말씀과 교회를 정직하게 연결합니다</h2><p>발견은 airChurch에서, 소속과 돌봄은 건강한 지역교회와 함께합니다.</p><b>소개 보기 →</b></a>
      <a className="simple-home-card safety" href="/portal#about"><span>건강한 신앙 생태계</span><h2>열린 문에는 분명한 기준이 필요합니다</h2><p>공식 출처를 확인하고, 문제가 제기되면 다시 살핍니다.</p><b>운영 기준 보기 →</b></a>
      <a className="simple-home-card community" href="/portal#community"><span>서로를 지키는 익명 광장</span><h2>이름을 숨겨도 말의 책임은 남도록</h2><p>신앙과 삶의 이야기를 안전한 원칙 안에서 나눕니다.</p><b>광장으로 가기 →</b></a>
      <a className="simple-home-card goodshare" href="/portal#goodshare"><span>goodshare · 착한나눔</span><h2>평범한 능력이 누군가에겐 선물입니다</h2><p>시간, 경험, 공간, 기술과 마음을 필요한 곳에 잇습니다.</p><b>나눔 보기 →</b></a>
    </section>

    <footer className="simple-home-footer" id="page-bottom"><a href="/about">운영 안내</a><a href="/contact">문의</a><a href="/privacy">개인정보</a><a href="/terms">이용약관</a></footer>
  </main>;
}
