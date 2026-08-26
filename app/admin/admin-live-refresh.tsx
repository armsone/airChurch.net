"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdminLiveRefresh() {
  const router=useRouter();
  useEffect(()=>{
    const interval=window.setInterval(()=>{
      if(document.visibilityState!=="visible") return;
      const active=document.activeElement;
      if(active instanceof HTMLInputElement||active instanceof HTMLTextAreaElement||active instanceof HTMLSelectElement) return;
      if(document.querySelector(".reviewer-resolution-form,.admin-edit-form:focus-within")) return;
      router.refresh();
    },60_000);
    return()=>window.clearInterval(interval);
  },[router]);
  return null;
}
