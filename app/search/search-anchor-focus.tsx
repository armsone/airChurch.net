"use client";

import { useEffect } from "react";

export default function SearchAnchorFocus(){
  useEffect(()=>{
    const id=decodeURIComponent(window.location.hash.slice(1));
    if(!/^(church|sermon|praise)-result-\d+$/.test(id))return;
    document.getElementById(id)?.focus({preventScroll:true});
  },[]);
  return null;
}
