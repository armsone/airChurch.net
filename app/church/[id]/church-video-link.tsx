"use client";

import type { MouseEventHandler, ReactNode } from "react";

type DailyStep="sermon"|"praise";

function recordDailyStep(step:DailyStep) {
  const today=new Date(Date.now()+9*60*60*1000).toISOString().slice(0,10);
  const key=`airchurch:daily:${today}`;
  try {
    const stored=JSON.parse(localStorage.getItem(key)||"[]") as unknown;
    const current=Array.isArray(stored)?stored.filter((item):item is string=>typeof item==="string"):[];
    if(!current.includes(step))localStorage.setItem(key,JSON.stringify([...current,step]));
  } catch {
    // 저장이 제한되거나 기존 값이 손상돼도 원본 영상 이동은 계속합니다.
  }
}

export default function ChurchVideoLink({href,step,className,children}:{href:string;step:DailyStep;className:string;children:ReactNode}) {
  const handleClick:MouseEventHandler<HTMLAnchorElement>=()=>recordDailyStep(step);
  return <a className={className} href={href} target="_blank" rel="noopener noreferrer" onClick={handleClick}>{children}</a>;
}
