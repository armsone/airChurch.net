"use client";

import {useEffect,useState} from "react";

type Kind="church"|"pastor";
const selected=new Map<string,{kind:Kind;id:number;label:string}>();
const announce=()=>window.dispatchEvent(new Event("airchurch:admin-selection"));

export function AdminBulkCheckbox({kind,id,label}:Readonly<{kind:Kind;id:number;label:string}>){
  const key=`${kind}:${id}`,[checked,setChecked]=useState(false);
  useEffect(()=>()=>{selected.delete(key);announce();},[key]);
  return <label className="admin-card-select shared-admin-card-select"><input type="checkbox" checked={checked} data-admin-bulk-kind={kind} onChange={(event)=>{setChecked(event.target.checked);if(event.target.checked)selected.set(key,{kind,id,label});else selected.delete(key);announce();}} aria-label={`${label} 선택`}/></label>;
}

export default function AdminBulkBar(){
  const [items,setItems]=useState<Array<{kind:Kind;id:number;label:string}>>([]),[busy,setBusy]=useState(false),[error,setError]=useState("");
  useEffect(()=>{const sync=()=>setItems([...selected.values()]);window.addEventListener("airchurch:admin-selection",sync);return()=>window.removeEventListener("airchurch:admin-selection",sync);},[]);
  if(!items.length)return null;
  async function act(status:"approved"|"removed"|"deleted"){const action=status==="approved"?"공개":status==="removed"?"보류":"삭제";if(!window.confirm(`선택한 ${items.length}개 기록을 ${action}할까요?`))return;setBusy(true);setError("");try{for(const kind of ["church","pastor"] as const){const ids=items.filter((item)=>item.kind===kind).map((item)=>item.id);if(!ids.length)continue;const response=await fetch("/api/admin/manage",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({kind:`${kind}-batch`,ids,status})}),result=await response.json().catch(()=>({})) as {error?:string};if(!response.ok)throw new Error(result.error||"일괄 처리하지 못했습니다.");}window.location.reload();}catch(reason){setError((reason as Error).message);setBusy(false);}}
  const selectVisible=()=>document.querySelectorAll<HTMLInputElement>("input[data-admin-bulk-kind]").forEach((input)=>{if(!input.checked)input.click();});
  const clear=()=>document.querySelectorAll<HTMLInputElement>("input[data-admin-bulk-kind]:checked").forEach((input)=>input.click());
  return <aside className="admin-batch-bar admin-batch-bar-global" aria-label="선택 항목 일괄 처리"><strong>{items.length}개 선택</strong><button disabled={busy} className="restore" type="button" onClick={()=>void act("approved")}>공개</button><button disabled={busy} type="button" onClick={()=>void act("removed")}>보류</button><button disabled={busy} className="danger" type="button" onClick={()=>void act("deleted")}>삭제</button><button disabled={busy} type="button" onClick={selectVisible}>화면 전체 선택</button><button disabled={busy} type="button" onClick={clear}>선택 해제</button>{error&&<span className="admin-error" role="alert">{error}</span>}</aside>;
}
