"use client";

import { useEffect, useRef, useState } from "react";

export default function ChurchShareButton({name}:{name:string}){
  const [label,setLabel]=useState("↗ 이 교회 공유하기");
  const resetTimer=useRef<ReturnType<typeof window.setTimeout>|null>(null);
  useEffect(()=>()=>{if(resetTimer.current)window.clearTimeout(resetTimer.current);},[]);
  async function share(){
    const data={title:`${name} | airChurch`,text:`${name} 공식 정보와 최근 말씀을 airChurch에서 확인하세요.`,url:location.href};
    try{
      if(navigator.share){await navigator.share(data);setLabel("공유했습니다 ✓");}
      else{await navigator.clipboard.writeText(location.href);setLabel("주소를 복사했습니다 ✓");}
    }catch(error){if((error as {name?:string}).name!=="AbortError")setLabel("주소 복사에 실패했습니다");}
    if(resetTimer.current)window.clearTimeout(resetTimer.current);
    resetTimer.current=window.setTimeout(()=>setLabel("↗ 이 교회 공유하기"),2200);
  }
  return <button className="church-detail-save" type="button" aria-live="polite" onClick={()=>void share()}>{label}</button>;
}
