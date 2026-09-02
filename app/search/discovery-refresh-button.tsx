"use client";

import {useRouter,useSearchParams} from "next/navigation";

export default function DiscoveryRefreshButton({parameter,anchor,label}:Readonly<{parameter:string;anchor:string;label:string}>){
  const router=useRouter(),params=useSearchParams();
  return <button className="discovery-refresh-button" type="button" onClick={()=>{const next=new URLSearchParams(params.toString()),current=Number(next.get(parameter)??"0");let bucket=Math.floor(Math.random()*50);if(bucket===current)bucket=(bucket+1)%50;next.set(parameter,String(bucket));router.replace(`/search?${next.toString()}#${anchor}`,{scroll:false});}} aria-label={`${label} 40개 새로 보기`}>↻ 다른 {label} 보기</button>;
}
