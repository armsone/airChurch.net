"use client";

import { useState } from "react";

const collections = [
  {name:"간증·삶",note:"삶의 이야기 속에서 믿음을 만납니다.",items:[["내가 매일 기쁘게","다양한 삶의 자리에서 나누는 신앙 고백"],["We're Wonderful Woman","여성의 삶과 믿음 이야기"],["백설기","시니어의 신앙과 일상"],["영천교회","교회 공동체의 믿음 이야기"]]},
  {name:"청년·말씀",note:"지금의 고민을 말씀과 함께 살펴봅니다.",items:[["더 메시지","청년들에게 전하는 말씀"],["메신저스","시대를 향한 도전과 믿음"],["순종","결정 앞에서 찾는 믿음의 방향"],["하나님 나라","일상에서 살아가는 신앙"]]},
  {name:"성경 배우기",note:"성경의 흐름과 본문을 차근차근 찾아봅니다.",items:[["역사서","성경 역사 속 하나님의 계획"],["여호수아","약속의 땅과 믿음의 여정"],["사무엘","하나님의 부르심과 사람의 응답"],["열왕기","왕들의 이야기로 읽는 신앙"],["역대기","하나님의 백성이 걸어온 길"],["에베소서","교회와 그리스도인의 삶"]]},
  {name:"위로·선교",note:"삶을 돌보고 이웃에게 나아가는 신앙을 찾습니다.",items:[["위로","지친 마음 곁에 머무는 말씀"],["믿음","불확실한 날에도 하나님을 신뢰하기"],["선교","세상과 이웃을 향한 사명"],["찬양","노래로 드리는 신앙의 고백"]]},
];
const ctsSearch=(query:string)=>`https://ac.cts.tv/search?skeyword=${encodeURIComponent(query)}`;
export default function CtsDiscovery(){
  const [selected,setSelected]=useState(0);
  const current=collections[selected];
  return <section className="cts-discovery" aria-labelledby="cts-discovery-title">
    <div className="portal-panel-heading"><div><span className="section-kicker">CTS 공식 콘텐츠 연결</span><h3 id="cts-discovery-title">믿음의 이야기를 더 넓게</h3></div><a href="https://ac.cts.tv/" target="_blank" rel="noopener noreferrer">CTS 다시보기 ↗</a></div>
    <p className="portal-caption">프로그램과 주제를 고르면 CTS의 검색 결과와 공식 콘텐츠로 이어집니다.</p>
    <form className="cts-search" action="https://ac.cts.tv/search" method="get" target="_blank" rel="noopener noreferrer"><label htmlFor="cts-keyword">CTS에서 찾기</label><div><input id="cts-keyword" name="skeyword" type="search" required maxLength={100} placeholder="프로그램·목회자·교회·성경 본문"/><button type="submit">검색 ↗</button></div></form>
    <nav className="cts-direct" aria-label="CTS 콘텐츠 종류"><a href="https://ac.cts.tv/search/cate/CATNS" target="_blank" rel="noopener noreferrer">교계 뉴스 ↗</a><a href="https://ac.cts.tv/search/cate/CATSM" target="_blank" rel="noopener noreferrer">설교 ↗</a><a href="https://ac.cts.tv/search/cate/CATTV" target="_blank" rel="noopener noreferrer">TV 프로그램 ↗</a><a href="https://www.cts.tv/bible" target="_blank" rel="noopener noreferrer">성경 읽기 ↗</a><a href="https://www.cts.tv/hymn/hymn" target="_blank" rel="noopener noreferrer">찬송 듣기 ↗</a></nav>
    <div className="portal-switch cts-switch" aria-label="CTS 주제 선택">{collections.map((collection,index)=><button key={collection.name} type="button" aria-pressed={selected===index} onClick={()=>setSelected(index)}>{collection.name}</button>)}</div>
    <p className="portal-caption">{current.note}</p>
    <div className="cts-collections">{current.items.map(([title,note])=><a key={title} href={ctsSearch(title)} target="_blank" rel="noopener noreferrer"><strong>{title}<span aria-hidden="true">↗</span></strong><small>{note}</small></a>)}</div>
    <p className="portal-health">출처: CTS 다시보기 · 공식 분류·프로그램 참고 2026. 9. 11. · 재생과 최신 목록은 CTS에서 확인합니다.</p>
  </section>;
}
