"use client";
import {useEffect,useState} from "react";
import {markSavedItemSeen,readSavedItems,writeSavedItems} from "./saved-items";

type LegacyProps={churchId:number;ministerId?:number;personId?:never;name:string;roleTitle:string;churchName:string};
type PersonProps={personId:number;publicId:number;churchId?:never;ministerId?:never;name:string;roleTitle:string;churchName?:string|null};
export default function PastorSaveButton(props:LegacyProps|PersonProps){
  const personMode="personId" in props&&typeof props.personId==="number",personPublicId=personMode?props.publicId:null,savedId=personMode?`pastor:person:${props.personId}`:`pastor:${props.churchId}:${props.ministerId??"primary"}`,[saved,setSaved]=useState(false);
  useEffect(()=>{const items=readSavedItems(),index=items.findIndex((item)=>item.id===savedId),exists=index>=0;setSaved(exists);if(exists){if(personPublicId!==null&&items[index].url!==`/pastors/${personPublicId}`)writeSavedItems(items.map((item,itemIndex)=>itemIndex===index?{...item,url:`/pastors/${personPublicId}`}:item));markSavedItemSeen(savedId);}},[personPublicId,savedId]);
  const toggle=()=>{const items=readSavedItems(),exists=items.some((item)=>item.id===savedId),url=personMode?`/pastors/${props.publicId}`:`/pastors/${props.churchId}${props.ministerId?`?minister=${props.ministerId}`:""}`,churchName=props.churchName?.trim()||"목회자";if(!exists&&items.length>=30){window.alert("모음은 최대 30개입니다. 나의 모음에서 정리한 뒤 추가해 주세요.");return;}const next=exists?items.filter((item)=>item.id!==savedId):[{id:savedId,kind:"pastor" as const,title:`${props.name} ${props.roleTitle}`,subtitle:churchName,url,savedAt:new Date().toISOString(),pastorName:props.name,churchNames:churchName==="목회자"?[]:[churchName]},...items];writeSavedItems(next);setSaved(readSavedItems().some(item=>item.id===savedId));};
  return <button className={`pastor-save${saved?" is-saved":""}`} type="button" onClick={toggle} aria-pressed={saved}>{saved?"♥ 찜한 목회자":"♡ 이 목회자 찜하기"}</button>;
}
