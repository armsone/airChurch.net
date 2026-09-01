"use client";
import {useEffect,useState} from "react";
import {markSavedItemSeen,readSavedItems,writeSavedItems} from "./saved-items";

type LegacyProps={churchId:number;ministerId?:number;personId?:never;name:string;roleTitle:string;churchName:string};
type PersonProps={personId:number;churchId?:never;ministerId?:never;name:string;roleTitle:string;churchName?:string|null};
export default function PastorSaveButton(props:LegacyProps|PersonProps){
  const personMode="personId" in props&&typeof props.personId==="number",savedId=personMode?`pastor:person:${props.personId}`:`pastor:${props.churchId}:${props.ministerId??"primary"}`,[saved,setSaved]=useState(false);
  useEffect(()=>{const exists=readSavedItems().some((item)=>item.id===savedId);setSaved(exists);if(exists)markSavedItemSeen(savedId);},[savedId]);
  const toggle=()=>{const items=readSavedItems(),exists=items.some((item)=>item.id===savedId),url=personMode?`/pastors/p/${props.personId}`:`/pastors/${props.churchId}${props.ministerId?`?minister=${props.ministerId}`:""}`,churchName=props.churchName?.trim()||"목회자";const next=exists?items.filter((item)=>item.id!==savedId):[{id:savedId,kind:"pastor" as const,title:`${props.name} ${props.roleTitle}`,subtitle:churchName,url,savedAt:new Date().toISOString(),pastorName:props.name,churchNames:churchName==="목회자"?[]:[churchName]},...items];writeSavedItems(next);setSaved(!exists);};
  return <button className={`pastor-save${saved?" is-saved":""}`} type="button" onClick={toggle} aria-pressed={saved}>{saved?"♥ 찜한 목사님":"♡ 이 목사님 찜하기"}</button>;
}
