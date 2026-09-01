"use client";

export default function EncouragementJumpLink(){
  return <a className="encouragement-jump-link" href="#encouragement-write" onClick={(event)=>{event.preventDefault();const panel=document.getElementById("encouragement-write") as HTMLDetailsElement|null;if(!panel)return;panel.open=true;panel.scrollIntoView({behavior:"smooth",block:"center"});requestAnimationFrame(()=>panel.querySelector<HTMLElement>("input")?.focus({preventScroll:true}));}}>응원글 쓰기 ↓</a>;
}
