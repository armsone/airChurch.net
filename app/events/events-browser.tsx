"use client";
import { useEffect, useRef, useState } from "react";
import { EventCard, EventSources } from "./event-card";
import { dateLabel, eventAudiences, eventCategories, eventRegions, koreaDate, type EventsPayload, type ChurchEvent } from "./types";

function bounds(month:string) { const [y,m]=month.split("-").map(Number); return { from:`${month}-01`,to:new Date(Date.UTC(y,m,0)).toISOString().slice(0,10) }; }
export default function EventsBrowser({ compact=false, churchId }: { compact?:boolean; churchId?:number }) {
  const [month,setMonth]=useState(""),[region,setRegion]=useState(""),[online,setOnline]=useState(false),[category,setCategory]=useState(""),[audience,setAudience]=useState("");
  const [view,setView]=useState("list"),[day,setDay]=useState(""),[revision,setRevision]=useState(0),[data,setData]=useState<EventsPayload|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(false),[moreBusy,setMoreBusy]=useState(false);
  const [queryChurch,setQueryChurch]=useState<number|undefined>();const activeQuery=useRef("");
  const container=useRef<HTMLDivElement>(null);const [visible,setVisible]=useState(!compact);
  useEffect(()=>{if(!compact||!container.current)return;const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){setVisible(true);observer.disconnect();}},{rootMargin:"350px"});observer.observe(container.current);return()=>observer.disconnect();},[compact]);
  useEffect(()=>{setMonth(koreaDate().slice(0,7));const id=Number(new URLSearchParams(window.location.search).get("church"));if(Number.isInteger(id)&&id>0)setQueryChurch(id);try{const saved=localStorage.getItem("airchurch:event-region")||"";if(eventRegions.includes(saved))setRegion(saved);}catch{}},[]);
  const params = new URLSearchParams(compact ? {upcoming:"1",limit:"6"} : month ? {...bounds(month),limit:"100"} : {});
  const selectedChurch=churchId||queryChurch;
  if(selectedChurch)params.set("church",String(selectedChurch));
  if(region&&!selectedChurch)params.set("region",region);
  if(online)params.set("online","1");if(category)params.set("category",category);if(audience)params.set("audience",audience);
  const query=params.toString();
  activeQuery.current=query;
  useEffect(()=>{
    if(!month||!visible)return;
    const controller=new AbortController();setLoading(true);setError(false);setData(null);
    (async()=>{for(let attempt=0;attempt<2;attempt++) {try{
      const response=await fetch(`/api/events?${query}`,{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(8000)])});
      if(!response.ok)throw Error("unavailable");const result=await response.json() as EventsPayload;
      if(!controller.signal.aborted){setData(result);setLoading(false);}return;
    }catch{if(controller.signal.aborted)return;}}setError(true);setLoading(false);})();
    return()=>controller.abort();
  },[query,month,revision,visible]);
  async function more(){if(!data?.nextCursor||moreBusy)return;const requested=query;setMoreBusy(true);setError(false);try{const response=await fetch(`/api/events?${query}&cursor=${encodeURIComponent(data.nextCursor)}`,{signal:AbortSignal.timeout(8000)});if(!response.ok)throw Error();const next=await response.json() as EventsPayload;if(activeQuery.current===requested)setData(current=>current?{...next,items:[...current.items,...next.items.filter(item=>!current.items.some(old=>old.id===item.id))]}:next);}catch{if(activeQuery.current===requested)setError(true);}finally{setMoreBusy(false);}}
  const today=koreaDate();
  const title=churchId?"이 교회의 예정 행사":"다가오는 기독교 행사";
  const shown=(data?.items||[]).filter(item=>!day||(item.startDate<=day&&item.endDate>=day));
  const groups=new Map<string,ChurchEvent[]>();for(const item of shown){const key=day||item.startDate;(groups.get(key)||groups.set(key,[]).get(key)!).push(item);}
  const calendar=month?bounds(month):null;
  return <div className="events-browser" ref={container}>
    {compact&&<div className="section-heading"><div><span className="section-kicker">함께하는 신앙</span><h2>{title}</h2><p>공식 공지에서 확인한 행사 일정입니다. 정확한 진행일과 참여 방법은 원문에서 확인해 주세요.</p></div><a className="church-news-shuffle unified-other-button" href={churchId?`/events?church=${churchId}`:"/events"}>전체 일정 보기 →</a></div>}
    {data&&<EventSources sources={data.sources}/>}
    <div className="event-filters">{!compact&&<label>행사 월<input type="month" value={month} onChange={e=>{if(e.target.value)setMonth(e.target.value);setDay("");}}/></label>}
      {!selectedChurch&&<label>지역<select value={region} onChange={e=>{setRegion(e.target.value);try{localStorage.setItem("airchurch:event-region",e.target.value);}catch{}}}><option value="">전국</option>{eventRegions.map(x=><option key={x}>{x}</option>)}</select></label>}
      <label className="event-online"><input type="checkbox" checked={online} onChange={e=>setOnline(e.target.checked)}/>온라인 포함 행사</label>
      {!compact&&<><label>유형<select value={category} onChange={e=>setCategory(e.target.value)}><option value="">모든 유형</option>{eventCategories.map(x=><option key={x}>{x}</option>)}</select></label><label>참여 대상<select value={audience} onChange={e=>setAudience(e.target.value)}><option value="">모든 대상</option>{eventAudiences.map(x=><option key={x}>{x}</option>)}</select></label><button type="button" onClick={()=>{setQueryChurch(undefined);window.history.replaceState(null,"","/events");setRegion("");setOnline(false);setCategory("");setAudience("");setDay("");try{localStorage.removeItem("airchurch:event-region");}catch{}}}>조건 초기화</button></>}
    </div>
    {!compact&&<div className="event-view-switch"><button type="button" aria-pressed={view==="list"} onClick={()=>{setView("list");setDay("");}}>날짜별 목록</button><button type="button" aria-pressed={view==="calendar"} onClick={()=>setView("calendar")}>월간 달력</button><span>{loading?"확인 중…":`수집된 행사 ${data?.items.length||0}${data?.nextCursor?"+":""}건`}</span></div>}
    {!compact&&<p>공식 공지에서 확인한 예정 일정입니다. 기간 행사는 달력에 시작~종료 범위로 표시되며, 실제 회차·진행일은 원문을 확인해 주세요.{selectedChurch&&" 현재 특정 교회의 행사만 보고 있습니다."}</p>}
    {!compact&&view==="calendar"&&calendar&&<><div className="event-calendar" aria-label={`${month} 행사 달력`}>{["일","월","화","수","목","금","토"].map(x=><span className="event-weekday" key={x}>{x}</span>)}{Array.from({length:new Date(`${calendar.from}T00:00:00Z`).getUTCDay()},(_,i)=><span key={`empty-${i}`}/>)}{Array.from({length:Number(calendar.to.slice(-2))},(_,i)=>{const date=`${month}-${String(i+1).padStart(2,"0")}`,count=(data?.items||[]).filter(x=>x.startDate<=date&&x.endDate>=date).length;return <button key={date} type="button" aria-pressed={day===date} aria-label={`${dateLabel(date)}, 행사 ${count}건`} className={date===today?"is-today":""} onClick={()=>setDay(day===date?"":date)}><time dateTime={date}>{i+1}</time>{count>0&&<small>{count}건</small>}</button>;})}</div>{data?.nextCursor&&<p>아래 ‘더 불러오기’를 누르면 나머지 일정도 달력에 표시됩니다.</p>}</>}
    <div aria-live="polite" aria-busy={loading}>{loading?<p className="event-empty">공식 행사 일정을 불러오고 있습니다…</p>:<>
      {error&&<p className="event-empty" role="alert">일정을 불러오지 못했습니다. <button type="button" onClick={()=>data?.nextCursor?void more():setRevision(x=>x+1)}>다시 시도</button></p>}
      {compact?<div className="event-grid church-news-grid">{shown.map(item=><EventCard key={item.id} item={item} compact/>)}</div>:Array.from(groups,([date,items])=><section className="event-day-group" key={date}><h2>{dateLabel(date)}</h2><div className="event-grid">{items.map(item=><EventCard key={item.id} item={item}/>)}</div></section>)}
      {!shown.length&&!error&&<p className="event-empty">{day?`${dateLabel(day)}에 수집된 행사가 없습니다.`:"선택한 조건에 수집된 예정 행사가 없습니다."} 공식 출처의 안내도 함께 확인해 주세요.</p>}
      {!compact&&data?.nextCursor&&<button className="event-more" type="button" disabled={moreBusy} onClick={()=>void more()}>{moreBusy?"불러오는 중…":"일정 더 불러오기"}</button>}
    </>}</div>
  </div>;
}
