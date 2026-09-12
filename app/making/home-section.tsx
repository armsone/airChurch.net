"use client";
import { useEffect, useRef, useState } from "react";
type Item={slug:string;title:string;date:string;category:string};
export default function MakingHomeSection(){
  const ref=useRef<HTMLElement>(null),[items,setItems]=useState<Item[]>([]),[message,setMessage]=useState("최근 글을 불러오는 중입니다.");
  useEffect(()=>{let active=true;const observer=new IntersectionObserver(entries=>{if(!entries.some(entry=>entry.isIntersecting))return;observer.disconnect();fetch("/api/making").then(async response=>{if(!response.ok)throw new Error();return response.json();}).then(data=>{if(active){setItems(data.items.slice(0,3));setMessage(data.items.length?"":"아직 공개된 글이 없습니다.");}}).catch(()=>{if(active)setMessage("최근 글을 불러오지 못했습니다. 전체 글에서 다시 확인해 주세요.");});},{rootMargin:"300px"});if(ref.current)observer.observe(ref.current);return()=>{active=false;observer.disconnect();};},[]);
  return <section id="making" ref={ref} className="making-home" aria-labelledby="making-home-title"><div className="making-home-intro"><span className="making-kicker">함께 쌓는 제작 기록</span><h2 id="making-home-title">에어처치 만들기</h2><p>사이트를 만들며 조사하고 고민한 내용을 한 편씩 남깁니다.</p><a href="/making">전체 글 보기 →</a></div><div className="making-home-posts">{items.length?items.map(item=><a key={item.slug} href={`/making/${item.slug}`}><span>{item.category} · <time dateTime={item.date}>{item.date.replaceAll("-", ".")}</time></span><h3>{item.title}</h3></a>):<p role="status">{message}</p>}<nav aria-label="제작 기록 더 보기"><a href="/tech">테크</a><a href="/history">히스토리</a></nav></div></section>;
}
