"use client";
import {useEffect,useState} from "react";
import {dailyScripture,koreanDateKey,KST_OFFSET} from "./daily-scripture";

export default function SeasonalScripture(){
  const [reading,setReading]=useState<ReturnType<typeof dailyScripture>|null>(null);
  useEffect(()=>{
    let timer:ReturnType<typeof setTimeout>;
    let lastKey="";
    function update(){
      const now=Date.now(),key=koreanDateKey(now);
      if(key!==lastKey){lastKey=key;setReading(dailyScripture(key));}
      clearTimeout(timer);
      timer=setTimeout(update,86_400_000-((now+KST_OFFSET)%86_400_000)+100);
    }
    update();
    window.addEventListener("focus",update);
    document.addEventListener("visibilitychange",update);
    return()=>{clearTimeout(timer);window.removeEventListener("focus",update);document.removeEventListener("visibilitychange",update);};
  },[]);
  if(!reading)return <section className="season-scripture" aria-label="오늘의 성경 말씀" aria-busy="true"><div className="scripture-context"><h2>오늘의 성경 말씀</h2></div><div className="scripture-reading">오늘의 말씀을 준비하고 있습니다.</div></section>;
  return <section className="season-scripture" aria-label="교회력과 성경 말씀">
    <div className="scripture-context"><time dateTime={reading.dateKey}>{new Date(`${reading.dateKey}T00:00:00Z`).toLocaleDateString("ko-KR",{timeZone:"UTC",year:"numeric",month:"long",day:"numeric",weekday:"long"})}</time><h2>{reading.name}</h2><span className="scripture-season">{reading.accent}</span><a href={reading.sourceUrl} target="_blank" rel="noopener noreferrer"><strong>{reading.reference}</strong><span>성경에서 읽기 ↗</span></a></div>
    <div className="scripture-reading"><blockquote>{reading.text}</blockquote><small><a href={reading.sourceUrl} target="_blank" rel="noopener noreferrer">성경전서 개역한글판 ↗</a> · 대한성서공회</small></div>
  </section>;
}
