"use client";
import {useEffect,useState} from "react";
import {markSavedItemSeen,readSavedItems,writeSavedItems} from "./saved-items";

type LegacyProps={churchId:number;ministerId?:number;personId?:never;name:string;roleTitle:string;churchName:string};
type PersonProps={personId:number;publicId:number;churchId?:never;ministerId?:never;name:string;roleTitle:string;churchName?:string|null};
export default function PastorSaveButton(props:LegacyProps|PersonProps){
  const personMode="personId" in props&&typeof props.personId==="number",personPublicId=personMode?props.publicId:null,savedId=personMode?`pastor:person:${props.personId}`:`pastor:${props.churchId}:${props.ministerId??"primary"}`,[saved,setSaved]=useState(false);
  useEffect(()=>{const items=readSavedItems(),index=items.findIndex((item)=>item.id===savedId),exists=index>=0;setSaved(exists);if(exists){if(personPublicId!==null&&items[index].url!==`/pastors/${personPublicId}`)writeSavedItems(items.map((item,itemIndex)=>itemIndex===index?{...item,url:`/pastors/${personPublicId}`}:item));markSavedItemSeen(savedId);}},[personPublicId,savedId]);
  const toggle=()=>{const items=readSavedItems(),exists=items.some((item)=>item.id===savedId),url=personMode?`/pastors/${props.publicId}`:`/pastors/${props.churchId}${props.ministerId?`?minister=${props.ministerId}`:""}`,churchName=props.churchName?.trim()||"목회자";const next=exists?items.filter((item)=>item.id!==savedId):[{id:savedId,kind:"pastor" as const,title:`${props.name} ${props.roleTitle}`,subtitle:churchName,url,savedAt:new Date().toISOString(),pastorName:props.name,churchNames:churchName==="목회자"?[]:[churchName]},...items];writeSavedItems(next);setSaved(!exists);};
  return <button className={`pastor-save${saved?" is-saved":""}`} type="button" onClick={toggle} aria-pressed={saved}>{saved?"♥ 찜한 목사님":"♡ 이 목사님 찜하기"}</button>;
}
