"use client";

import { FormEvent, useMemo, useState } from "react";

type Church={id:number;name:string;pastor:string;region:string;denomination:string;review_status:string};
type RequestItem={id:number;church_name:string;request_type:string;reason:string;status:string;admin_note:string|null;created_at:string;proposed_name:string|null;proposed_pastor:string|null;proposed_region:string|null;proposed_denomination:string|null};

const actionLabels={edit:"정보 수정",hold:"보류",delete:"삭제"} as const;
const statusLabels={pending:"관리자 확인 대기",approved:"승인",rejected:"반려",deferred:"일단 보류"} as const;

export default function ChurchRequestManager({churches,requests}:{churches:Church[];requests:RequestItem[]}) {
  const [query,setQuery]=useState(""),[selected,setSelected]=useState<Church|null>(null),[action,setAction]=useState<keyof typeof actionLabels>("edit"),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
  const results=useMemo(()=>{const needle=query.trim().toLocaleLowerCase("ko-KR");if(!needle)return [];return churches.filter((church)=>`${church.name} ${church.pastor} ${church.region} ${church.denomination}`.toLocaleLowerCase("ko-KR").includes(needle));},[churches,query]);

  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();if(!selected||busy)return;setBusy(true);setMessage("");
    const values=Object.fromEntries(new FormData(event.currentTarget));
    const response=await fetch("/api/admin/manage",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({kind:"church-change-request",id:selected.id,requestType:action,...values})}).catch(()=>null);
    const result=await response?.json().catch(()=>({})) as {error?:string}|undefined;
    if(!response?.ok){setMessage(result?.error||"요청을 보내지 못했습니다.");setBusy(false);return;}
    setMessage(`${selected.name} ${actionLabels[action]} 요청을 보냈습니다.`);setSelected(null);setQuery("");window.setTimeout(()=>window.location.reload(),500);
  }

  return <>
    <section className="admin-panel pastor-request-panel"><div className="admin-panel-title"><div><small>교회 요청</small><h2>교회를 검색해 요청하세요</h2><p>수정·보류·삭제 중 하나를 고르고 이유만 남기면 됩니다.</p></div><span>{churches.length}곳</span></div>
      <label className="pastor-church-search"><span>교회 검색</span><input type="search" value={query} onChange={(event)=>{setQuery(event.target.value);setSelected(null);}} placeholder="교회명, 목사님, 지역, 교단 검색"/></label>
      {query.trim()&&<div className="pastor-search-results">{results.length?results.map((church)=><button type="button" key={church.id} onClick={()=>setSelected(church)}><strong>{church.name}</strong><span>{church.pastor} · {church.region} · {church.denomination}</span></button>):<p className="admin-empty">검색 결과가 없습니다.</p>}</div>}
      {selected&&<form className="pastor-request-form" onSubmit={submit}><div className="pastor-request-selected"><strong>{selected.name}</strong><span>{selected.pastor} · {selected.region} · {selected.denomination}</span></div><fieldset><legend>요청할 내용</legend><div className="pastor-request-actions">{(Object.keys(actionLabels) as Array<keyof typeof actionLabels>).map((value)=><label key={value} className={action===value?"is-selected":""}><input type="radio" name="requestType" value={value} checked={action===value} onChange={()=>setAction(value)}/><span>{actionLabels[value]}</span></label>)}</div></fieldset>{action==="edit"&&<div className="pastor-edit-fields"><label>교회명<input name="name" defaultValue={selected.name} required maxLength={100}/></label><label>담임목사<input name="pastor" defaultValue={selected.pastor} required maxLength={80}/></label><label>지역<input name="region" defaultValue={selected.region} required maxLength={80}/></label><label>교단<input name="denomination" defaultValue={selected.denomination} required maxLength={120}/></label></div>}<label className="admin-note-field"><span>요청 이유</span><textarea name="reason" required minLength={3} maxLength={500} rows={4} placeholder="왜 수정·보류·삭제가 필요한지 적어 주세요."/></label><div className="admin-action-row"><button type="submit" disabled={busy}>{busy?"요청 중…":"관리자에게 요청"}</button><button type="button" disabled={busy} onClick={()=>setSelected(null)}>취소</button></div></form>}
      {message&&<p className="admin-success" role="status">{message}</p>}
    </section>
    <section className="admin-panel pastor-request-history"><div className="admin-panel-title"><div><small>내 요청</small><h2>처리 결과</h2><p>관리자가 승인·반려·보류한 내용을 여기서 다시 볼 수 있습니다.</p></div><span>{requests.length}건</span></div><div className="review-list">{requests.length?requests.map((request)=><article key={request.id}><div><span>{actionLabels[request.request_type as keyof typeof actionLabels]??request.request_type} · {statusLabels[request.status as keyof typeof statusLabels]??request.status}</span><time>{new Date(`${request.created_at}Z`).toLocaleString("ko-KR",{timeZone:"Asia/Seoul"})}</time></div><strong>{request.church_name}</strong><p>{request.reason}</p>{request.request_type==="edit"&&<p>{request.proposed_name} · {request.proposed_pastor} · {request.proposed_region} · {request.proposed_denomination}</p>}{request.admin_note&&<p className="admin-reviewer-note">관리자 답변 · {request.admin_note}</p>}</article>):<p className="admin-empty">아직 보낸 요청이 없습니다.</p>}</div></section>
  </>;
}
