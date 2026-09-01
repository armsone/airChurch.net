"use client";
import {useEffect,useState} from "react";
import {readSavedItems,writeSavedItems} from "../../saved-items";

export default function PastorSaveButton({churchId,ministerId,name,roleTitle,churchName}:{churchId:number;ministerId?:number;name:string;roleTitle:string;churchName:string}){
  const savedId=`pastor:${churchId}:${ministerId??"primary"}`,[saved,setSaved]=useState(false);
  useEffect(()=>setSaved(readSavedItems().some((item)=>item.id===savedId)),[savedId]);
  const toggle=()=>{const items=readSavedItems(),exists=items.some((item)=>item.id===savedId),url=`/pastors/${churchId}${ministerId?`?minister=${ministerId}`:""}`,next=exists?items.filter((item)=>item.id!==savedId):[{id:savedId,kind:"pastor" as const,title:`${name} ${roleTitle}`,subtitle:churchName,url,savedAt:new Date().toISOString()},...items];writeSavedItems(next);setSaved(!exists);};
  return <button className={`pastor-save${saved?" is-saved":""}`} type="button" onClick={toggle} aria-pressed={saved}>{saved?"♥ 찜한 목사님":"♡ 이 목사님 찜하기"}</button>;
}
