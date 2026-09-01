"use client";

import { useEffect, useState } from "react";
import { readSavedItems, writeSavedItems } from "../../saved-items";

export default function ChurchSaveButton({id,name,pastor,region}:{id:number;name:string;pastor:string;region:string}) {
  const savedId=`church:${id}`;
  const [saved,setSaved]=useState(false);
  useEffect(()=>{
    setSaved(readSavedItems().some((item)=>item.id===savedId));
  },[savedId]);
  function toggle(){
    const items=readSavedItems();
    const exists=items.some((item)=>item.id===savedId);
    const next=exists?items.filter((item)=>item.id!==savedId):[{id:savedId,kind:"church" as const,title:name,subtitle:`${pastor} · ${region}`,url:`/church/${id}`,savedAt:new Date().toISOString()},...items].slice(0,30);
    writeSavedItems(next);setSaved(!exists);
  }
  return <button className={`church-detail-save${saved?" is-saved":""}`} type="button" onClick={toggle}>{saved?"♥ 내 이어보기에 저장됨":"♡ 이 교회 찜하기"}</button>;
}
