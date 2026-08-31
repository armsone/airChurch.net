"use client";

import { useEffect, useState } from "react";

type SavedItem={id:string;kind:"church";title:string;subtitle:string;url:string};

export default function ChurchSaveButton({id,name,pastor,region}:{id:number;name:string;pastor:string;region:string}) {
  const savedId=`church:${id}`;
  const [saved,setSaved]=useState(false);
  useEffect(()=>{
    try { const items=JSON.parse(localStorage.getItem("airchurch:saved")||"[]") as SavedItem[];setSaved(items.some((item)=>item.id===savedId)); } catch { setSaved(false); }
  },[savedId]);
  function toggle(){
    let items:SavedItem[]=[];
    try { items=JSON.parse(localStorage.getItem("airchurch:saved")||"[]") as SavedItem[]; } catch { /* 빈 목록 */ }
    const exists=items.some((item)=>item.id===savedId);
    const next=exists?items.filter((item)=>item.id!==savedId):[{id:savedId,kind:"church" as const,title:name,subtitle:`${pastor} · ${region}`,url:`/church/${id}`},...items].slice(0,30);
    localStorage.setItem("airchurch:saved",JSON.stringify(next));setSaved(!exists);
  }
  return <button className={`church-detail-save${saved?" is-saved":""}`} type="button" onClick={toggle}>{saved?"♥ 내 이어보기에 저장됨":"♡ 이 교회 찜하기"}</button>;
}
