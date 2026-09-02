"use client";

import { useState } from "react";

export default function ChurchRequestResolution({id}:{id:number}) {
  const [note,setNote]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState("");
  async function decide(resolution:"approved"|"rejected"|"deferred") {
    if((resolution==="rejected"||resolution==="deferred")&&note.trim().length<3){setError("목회자가 볼 답변을 3자 이상 적어 주세요.");return;}
    const label=resolution==="approved"?"요청을 그대로 승인":resolution==="rejected"?"요청을 반려":"일단 보류";
    if(!window.confirm(`${label}할까요?`))return;
    setBusy(true);setError("");
    const response=await fetch("/api/admin/manage",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({kind:"church-change-request-resolution",id,resolution,adminNote:note.trim()})}).catch(()=>null);
    const result=await response?.json().catch(()=>({})) as {error?:string}|undefined;
    if(!response?.ok){setError(result?.error||"결정을 저장하지 못했습니다.");setBusy(false);return;}
    window.location.reload();
  }
  return <div className="church-request-resolution"><label className="admin-note-field"><span>목회자에게 남길 답변 <small>· 반려·보류 시 필수</small></span><textarea value={note} onChange={(event)=>setNote(event.target.value)} maxLength={500} rows={3} placeholder="결정 이유나 다시 확인할 내용을 적어 주세요."/></label><div className="admin-action-row"><button type="button" className="restore" disabled={busy} onClick={()=>void decide("approved")}>그대로 승인</button><button type="button" className="danger" disabled={busy} onClick={()=>void decide("rejected")}>반려</button><button type="button" disabled={busy} onClick={()=>void decide("deferred")}>일단 보류</button></div>{error&&<p className="admin-error">{error}</p>}</div>;
}
