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

// home-client.tsx의 요일별 안내와 같은 값을 유지합니다(인덱스 = getDay()).
const dailyGuides=[
  { day:"주일", theme:"예배와 공동체", reference:"시편 122:1", question:"오늘 예배에서 마음에 오래 남은 한 문장은 무엇인가요?" },
  { day:"월요일", theme:"새로운 한 주", reference:"잠언 3:5-6", question:"이번 주 하나님께 맡기고 한 걸음 내디딜 일은 무엇인가요?" },
  { day:"화요일", theme:"일과 섬김", reference:"골로새서 3:23", question:"오늘 내가 맡은 일을 사랑으로 바꿀 수 있는 작은 행동은 무엇인가요?" },
  { day:"수요일", theme:"기도와 평안", reference:"빌립보서 4:6-7", question:"지금 염려 대신 기도로 올려드릴 한 가지는 무엇인가요?" },
  { day:"목요일", theme:"관계와 사랑", reference:"요한복음 13:34-35", question:"오늘 먼저 이해하고 품어야 할 사람은 누구인가요?" },
  { day:"금요일", theme:"쉼과 회복", reference:"마태복음 11:28", question:"한 주의 무게 가운데 내려놓아야 할 것은 무엇인가요?" },
  { day:"토요일", theme:"감사와 준비", reference:"데살로니가전서 5:16-18", question:"이번 주에 발견한 감사 세 가지를 떠올려 보세요." },
] as const;

const oneSentence="발견은 airChurch에서, 소속과 돌봄은 건강한 지역교회와 함께합니다.";

export default function LightHome(){
  const [savedItems,setSavedItems]=useState<SavedItem[]>([]);
  const [season,setSeason]=useState({name:"오늘의 교회력",copy:"오늘의 절기와 말씀을 함께 살펴봅니다."});
  const [guide,setGuide]=useState<(typeof dailyGuides)[number]>(dailyGuides[0]);

  useEffect(()=>{
    const refresh=()=>setSavedItems(readSavedItems());
    refresh();
    const now=new Date();
    setSeason(churchSeason(now));
    setGuide(dailyGuides[now.getDay()]);
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
          <input id="home-portal-search" type="search" name="q" placeholder="예) 우리 동네 교회, 위로 말씀, 목사님 이름"/>
          <button type="submit">검색</button>
        </div>
      </form>
    </section>

    <section className="simple-home-read" aria-labelledby="home-read-title">
      <div className="simple-home-section-head">
        <span className="simple-home-section-tag">오늘 읽기</span>
        <h2 id="home-read-title">오늘, 여기서 잠시 머물러요</h2>
        <p>클릭하지 않아도 지금 이 자리에서 읽을 수 있는 글입니다.</p>
      </div>
      <div className="simple-home-panels">
        <article className="simple-home-panel">
          <h3>오늘의 말씀 방향</h3>
          <p className="simple-home-panel-lead"><strong>{guide.day} · {guide.theme}</strong> — {guide.reference}</p>
          <p>{guide.question}</p>
          <a className="simple-home-panel-more" href="/portal#sermons">포털에서 이어보기 →</a>
        </article>
        <article className="simple-home-panel">
          <h3>교회력으로 걷는 오늘</h3>
          <p className="simple-home-panel-lead"><strong>{season.name}</strong></p>
          <p>{season.copy}</p>
          <a className="simple-home-panel-more" href="/portal#sermons">포털에서 이어보기 →</a>
        </article>
        <article className="simple-home-panel">
          <h3>airChurch가 지키는 한 문장</h3>
          <p className="simple-home-panel-lead"><strong>{oneSentence}</strong></p>
          <p>말씀과 교회를 정직하게 연결하는 약속입니다.</p>
          <a className="simple-home-panel-more" href="/portal#about">포털에서 이어보기 →</a>
        </article>
      </div>
    </section>

    <section className="simple-home-grid" aria-labelledby="home-links-title">
      <div className="simple-home-section-head">
        <span className="simple-home-section-tag">포털 링크</span>
        <h2 id="home-links-title">더 필요할 때, 포털로 이어집니다</h2>
        <p>아래 카드를 누르면 포털의 해당 자리로 이동합니다.</p>
      </div>
      <div className="simple-home-cards">
        <a className="simple-home-card bible" href="/portal#sermons"><span>성경</span><h3>말씀으로 하루를 시작해요</h3><b>말씀 보기 →</b></a>
        <a className="simple-home-card saved" href="/portal#saved"><span>나의 모음</span><h3>{savedItems.length?`${savedItems.length}개를 모아 두었어요`:"마음에 남은 것을 모아 두세요"}</h3><b>포털에서 보기 →</b></a>
        <a className="simple-home-card search" href="/portal#site-search"><span>마음에서 시작하는 검색</span><h3>이름보다 마음을 먼저 떠올려도 괜찮아요</h3><b>검색 시작하기 →</b></a>
        <a className="simple-home-card safety" href="/portal#about"><span>건강한 신앙 생태계</span><h3>열린 문에는 분명한 기준이 필요합니다</h3><b>운영 기준 보기 →</b></a>
        <a className="simple-home-card community" href="/portal#community"><span>서로를 지키는 익명 광장</span><h3>이름을 숨겨도 말의 책임은 남도록</h3><b>광장으로 가기 →</b></a>
        <a className="simple-home-card goodshare" href="/portal#goodshare"><span>goodshare · 착한나눔</span><h3>평범한 능력이 누군가에겐 선물입니다</h3><b>나눔 보기 →</b></a>
      </div>
    </section>

    <footer className="simple-home-footer" id="page-bottom"><a href="/about">운영 안내</a><a href="/contact">문의</a><a href="/privacy">개인정보</a><a href="/terms">이용약관</a></footer>
  </main>;
}
