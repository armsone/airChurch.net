"use client";

import { useEffect, useState } from "react";
import HomeReloadLink from "../home-reload-link";

type SavedItem={id:string;kind:"sermon"|"praise"|"church";title:string;subtitle:string;url:string};
const groups=[{kind:"church" as const,label:"교회",empty:"아직 찜한 교회가 없습니다."},{kind:"sermon" as const,label:"말씀",empty:"아직 찜한 말씀이 없습니다."},{kind:"praise" as const,label:"찬양",empty:"아직 찜한 찬양이 없습니다."}];

export default function SavedClient(){
  const [items,setItems]=useState<SavedItem[]>([]),[ready,setReady]=useState(false);
  useEffect(()=>{try{const saved=JSON.parse(localStorage.getItem("airchurch:saved")||"[]");setItems(Array.isArray(saved)?saved.filter((item)=>item&&typeof item.id==="string").slice(0,30):[]);}catch{/* 손상된 로컬 기록은 무시합니다. */}setReady(true);},[]);
  const remove=(id:string)=>{const next=items.filter((item)=>item.id!==id);setItems(next);localStorage.setItem("airchurch:saved",JSON.stringify(next));};
  return <main className="saved-shell"><header className="saved-header"><HomeReloadLink className="brand"><span className="brand-mark" aria-hidden="true"/><span>airchurch</span></HomeReloadLink><nav><a href="/search">통합 검색</a><a href="/#church-directory">교회 찾기</a><a href="/">홈으로</a></nav></header><section className="saved-hero"><span>LOCAL COLLECTION</span><h1>나의 모음</h1><p>로그인 없이 이 브라우저에만 보관한 교회와 말씀, 찬양입니다.<br/>다른 기기나 브라우저에는 전송되지 않습니다.</p><b>{ready?`${items.length}개 저장됨`:"불러오는 중"}</b></section><div className="saved-content">{groups.map((group)=>{const grouped=items.filter((item)=>item.kind===group.kind);return <section className="saved-group" key={group.kind}><div className="saved-group-heading"><h2>{group.label}</h2><span>{grouped.length}개</span></div>{ready&&grouped.length>0?<div className="saved-grid">{grouped.map((item)=><article key={item.id}><span>{group.label}</span><a href={item.url} target={item.url.startsWith("http")?"_blank":undefined} rel={item.url.startsWith("http")?"noopener noreferrer":undefined}><strong>{item.title}</strong><small>{item.subtitle}</small><em>이어보기 →</em></a><button type="button" onClick={()=>remove(item.id)} aria-label={`${item.title} 나의 모음에서 삭제`}>×</button></article>)}</div>:ready?<p className="saved-empty">{group.empty} <a href={group.kind==="church"?"/#church-directory":group.kind==="sermon"?"/#sermons":"/#praises"}>둘러보기 →</a></p>:null}</section>})}</div><footer className="church-detail-footer"><a href="/">airChurch 홈</a><span>저장 정보는 현재 브라우저에만 남습니다.</span></footer></main>;
}
