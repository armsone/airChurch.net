"use client";

import { useEffect, useState } from "react";
import { readSavedItems, SAVED_ITEMS_KEY } from "./saved-items";

export default function SavedNavLink(){
  const [count,setCount]=useState(0);
  useEffect(()=>{
    const refresh=()=>setCount(readSavedItems().length);
    const storage=(event:StorageEvent)=>{if(event.key===SAVED_ITEMS_KEY)refresh();};
    refresh();window.addEventListener("storage",storage);window.addEventListener("airchurch:saved-change",refresh);
    return()=>{window.removeEventListener("storage",storage);window.removeEventListener("airchurch:saved-change",refresh);};
  },[]);
  return <a className="saved-nav-link" href="/saved">나의 모음{count>0&&<b aria-label={`${count}개 저장됨`}>{count}</b>}</a>;
}
