"use client";

import { useEffect, useState } from "react";
import { readSavedItems, writeSavedItems, SAVED_ITEMS_KEY, SAVED_ITEMS_LIMIT } from "../saved-items";
import { dateLabel, type ChurchEvent } from "./types";

export default function EventSaveButton({ item }: { item:Pick<ChurchEvent,"id"|"title"|"startDate"|"endDate"|"startTime"|"venue"|"detailUrl"> }) {
  const id=`event:${item.id}`;
  const [saved,setSaved]=useState(false),[ready,setReady]=useState(false),[notice,setNotice]=useState("");
  useEffect(()=>{
    const refresh=()=>{setSaved(readSavedItems().some(value=>value.id===id));setReady(true);};
    const storage=(event:StorageEvent)=>{if(event.key===SAVED_ITEMS_KEY||event.key===null)refresh();};
    refresh();window.addEventListener("airchurch:saved-change",refresh);window.addEventListener("storage",storage);
    return()=>{window.removeEventListener("airchurch:saved-change",refresh);window.removeEventListener("storage",storage);};
  },[id]);
  const toggle=()=>{
    const current=readSavedItems(),exists=current.some(value=>value.id===id);
    if(!exists&&current.length>=SAVED_ITEMS_LIMIT){setNotice(`모음은 최대 ${SAVED_ITEMS_LIMIT}개입니다. 나의 모음에서 정리한 뒤 추가해 주세요.`);return;}
    const subtitle=`${item.startDate.slice(0,4)}년 ${dateLabel(item.startDate)}${item.endDate!==item.startDate?` ~ ${item.endDate.slice(0,4)}년 ${dateLabel(item.endDate)}`:""}${item.startTime?` · ${item.startTime}`:""} · ${item.venue}`;
    writeSavedItems(exists?current.filter(value=>value.id!==id):[{id,kind:"event",title:item.title.slice(0,300),subtitle:subtitle.slice(0,500),url:item.detailUrl||`/events/${item.id}`,savedAt:new Date().toISOString()},...current]);
    const stored=readSavedItems().some(value=>value.id===id);
    setSaved(stored);
    setNotice(stored===!exists?(stored?"나의 모음에 저장했습니다.":"찜을 해제했습니다."):"브라우저 저장 공간을 사용할 수 없습니다. 저장 설정을 확인해 주세요.");
  };
  return <span className="event-save-control"><button className={`event-save-button${saved?" is-saved":""}`} type="button" disabled={!ready} aria-pressed={saved} aria-label={`${item.title} ${saved?"행사 찜 해제":"행사 찜하기"}`} onClick={toggle}><span aria-hidden="true">{saved?"♥":"♡"}</span>{saved?"찜됨":"찜"}</button>{notice&&<small className="event-save-notice" role="status">{notice}</small>}</span>;
}
