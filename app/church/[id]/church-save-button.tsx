"use client";

import { useEffect, useState } from "react";
import { markSavedItemSeen, readSavedItems, writeSavedItems } from "../../saved-items";

export default function ChurchSaveButton({id,name,pastor,region,compact=false}:{id:number;name:string;pastor:string;region:string;compact?:boolean}) {
  const savedId=`church:${id}`;
  const [saved,setSaved]=useState(false);
  useEffect(()=>{
    const exists=readSavedItems().some((item)=>item.id===savedId);setSaved(exists);if(exists)markSavedItemSeen(savedId);
  },[savedId]);
  function toggle(){
    const items=readSavedItems();
    const exists=items.some((item)=>item.id===savedId);
    const next=exists?items.filter((item)=>item.id!==savedId):[{id:savedId,kind:"church" as const,title:name,subtitle:`${pastor} · ${region}`,url:`/church/${id}`,savedAt:new Date().toISOString()},...items].slice(0,30);
    writeSavedItems(next);setSaved(!exists);
  }
  return <button className={`${compact?"church-save":"church-detail-save"}${saved?" is-saved":""}`} type="button" onClick={toggle} aria-label={`${name} ${saved?"찜에서 빼기":"찜하기"}`}>{compact?(saved?"♥":"♡"):(saved?"♥ 내 이어보기에 저장됨":"♡ 이 교회 찜하기")}</button>;
}
