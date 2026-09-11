"use client";
import { useEffect, useRef, useState } from "react";
import { EventCard, EventSources } from "./event-card";
import { dateLabel, eventAudiences, eventCategories, eventRegions, koreaDate, type EventsPayload, type ChurchEvent } from "./types";

function bounds(month:string) { const [y,m]=month.split("-").map(Number); return { from:`${month}-01`,to:new Date(Date.UTC(y,m,0)).toISOString().slice(0,10) }; }
export default function EventsBrowser({ compact=false, churchId, portalRegion, onPortalRegionChange }: { compact?:boolean; churchId?:number; portalRegion?:string; onPortalRegionChange?:(value:string)=>void }) {
  const [homeRange,setHomeRange]=useState<"all"|"week">("all"),[clock,setClock]=useState("");
  const [month,setMonth]=useState(""),[region,setRegion]=useState(""),[online,setOnline]=useState(false),[category,setCategory]=useState(""),[audience,setAudience]=useState("");
  const [view,setView]=useState("list"),[day,setDay]=useState(""),[revision,setRevision]=useState(0),[data,setData]=useState<EventsPayload|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(false),[moreBusy,setMoreBusy]=useState(false);
  const lastLoadedQuery=useRef("");
  const [queryChurch,setQueryChurch]=useState<number|undefined>();const activeQuery=useRef("");const [ready,setReady]=useState(false);
  const container=useRef<HTMLDivElement>(null);const [visible,setVisible]=useState(!compact);
  useEffect(()=>{if(!compact||!container.current)return;const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){setVisible(true);observer.disconnect();}},{rootMargin:"350px"});observer.observe(container.current);return()=>observer.disconnect();},[compact]);
  useEffect(()=>{const id=Number(new URLSearchParams(window.location.search).get("church"));if(Number.isInteger(id)&&id>0)setQueryChurch(id);setReady(true);},[]);
  useEffect(()=>{if(portalRegion===undefined)return;const tick=()=>{setClock(new Date().toISOString());if(document.visibilityState==="visible")setRevision(value=>value+1);};setClock(new Date().toISOString());const timer=window.setInterval(tick,5*60000);return()=>clearInterval(timer);},[portalRegion]);
  const params = new URLSearchParams(compact ? {preview:"1",limit:"12"} : month ? {...bounds(month),limit:"100"} : {upcoming:"1",limit:"100"});
  const selectedChurch=churchId||queryChurch;
  if(selectedChurch)params.set("church",String(selectedChurch));
  const effectiveRegion=portalRegion!==undefined?(portalRegion==="전체"?"":portalRegion):region;
  if(effectiveRegion&&!selectedChurch)params.set("region",effectiveRegion);
  if(compact&&portalRegion!==undefined&&homeRange==="week"&&clock){params.set("from",koreaDate(new Date(clock)));params.set("to",koreaDate(new Date(Date.parse(clock)+6*86400000)));}
  if(online)params.set("online","1");if(category)params.set("category",category);if(audience)params.set("audience",audience);
  const query=params.toString();
  activeQuery.current=query;
  useEffect(()=>{
    if(!ready||!visible)return;
    const controller=new AbortController();setError(false);if(lastLoadedQuery.current!==query){setLoading(true);setData(null);}
    (async()=>{for(let attempt=0;attempt<2;attempt++) {try{
      const response=await fetch(`/api/events?${query}`,{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(8000)])});
      if(!response.ok)throw Error("unavailable");const result=await response.json() as EventsPayload;
      if(!controller.signal.aborted){lastLoadedQuery.current=query;setData(result);setLoading(false);}return;
    }catch{if(controller.signal.aborted)return;}}setError(true);setLoading(false);})();
    return()=>controller.abort();
  },[query,ready,revision,visible]);
  async function more(){if(!data?.nextCursor||moreBusy)return;const requested=query;setMoreBusy(true);setError(false);try{const response=await fetch(`/api/events?${query}&cursor=${encodeURIComponent(data.nextCursor)}`,{signal:AbortSignal.timeout(8000)});if(!response.ok)throw Error();const next=await response.json() as EventsPayload;if(activeQuery.current===requested)setData(current=>current?{...next,items:[...current.items,...next.items.filter(item=>!current.items.some(old=>old.id===item.id))]}:next);}catch{if(activeQuery.current===requested)setError(true);}finally{setMoreBusy(false);}}
  const today=koreaDate();
  const title=churchId?"이 교회의 예정 행사":"다가오는 기독교 행사";
  const shown=(data?.items||[]).filter(item=>item.endDate>=today).filter(item=>view==="calendar"?(item.startDate===item.endDate&&(!day||item.startDate===day)):true);
  const periods=view==="calendar"?(data?.items||[]).filter(item=>item.startDate!==item.endDate):[];
  const groups=new Map<string,ChurchEvent[]>();for(const item of shown){const key=view!=="calendar"&&item.startDate<today?"ongoing":item.startDate.slice(0,7);(groups.get(key)||groups.set(key,[]).get(key)!).push(item);}
  const orderedGroups=Array.from(groups).sort(([a],[b])=>a==="ongoing"?1:b==="ongoing"?-1:a.localeCompare(b));
  const calendar=month?bounds(month):null;
  return <div className="events-browser" ref={container}>
    {compact&&<div className="section-heading"><div><span className="section-kicker">함께하는 신앙</span><h2>{title}</h2><p>공식 공지에서 확인한 행사 일정입니다. 정확한 진행일과 참여 방법은 원문에서 확인해 주세요.</p></div><a className="church-news-shuffle unified-other-button" href={churchId?`/events?church=${churchId}`:"/events"}>전체 일정 보기 →</a></div>}
    {compact&&portalRegion!==undefined&&<div className="event-home-controls"><div className="portal-switch" aria-label="행사 기간"><button type="button" aria-pressed={homeRange==="all"} onClick={()=>setHomeRange("all")}>전체 예정</button><button type="button" aria-pressed={homeRange==="week"} onClick={()=>setHomeRange("week")}>오늘부터 7일</button></div><label>지역<select value={portalRegion} onChange={event=>onPortalRegionChange?.(event.target.value)}><option>전체</option>{eventRegions.map(value=><option key={value}>{value}</option>)}</select></label><label><input type="checkbox" checked={online} onChange={event=>setOnline(event.target.checked)}/>온라인 참여 가능</label><small>지역 선택은 위의 검색·교회 찾기와 함께 적용됩니다.</small></div>}
    {data&&<EventSources sources={data.sources}/>}
    {!compact&&<div className="event-filters"><label>기간<select value={month?"month":"upcoming"} onChange={e=>{setMonth(e.target.value==="month"?today.slice(0,7):"");setDay("");if(e.target.value!=="month")setView("list");}}><option value="upcoming">앞으로 1년</option><option value="month">월 선택</option></select></label>{month&&<label>행사 월<input type="month" value={month} onChange={e=>{if(e.target.value)setMonth(e.target.value);setDay("");}}/></label>}
      {!selectedChurch&&<label>지역<select value={region} onChange={e=>{setRegion(e.target.value);try{localStorage.setItem("airchurch:event-region",e.target.value);}catch{}}}><option value="">전국</option>{eventRegions.map(x=><option key={x}>{x}</option>)}</select></label>}
      <label>유형<select value={category} onChange={e=>setCategory(e.target.value)}><option value="">모든 유형</option>{eventCategories.map(x=><option key={x}>{x}</option>)}</select></label>
      <details className="event-extra-filters"><summary>상세 조건{(online||audience)?" · 적용 중":""}</summary><div><label className="event-online"><input type="checkbox" checked={online} onChange={e=>setOnline(e.target.checked)}/>온라인 참여 가능</label><label>참여 대상<select value={audience} onChange={e=>setAudience(e.target.value)}><option value="">모든 대상</option>{eventAudiences.map(x=><option key={x}>{x}</option>)}</select></label></div></details>
      {(month||region||online||category||audience||selectedChurch)&&<button type="button" onClick={()=>{setQueryChurch(undefined);window.history.replaceState(null,"","/events");setMonth("");setView("list");setRegion("");setOnline(false);setCategory("");setAudience("");setDay("");}}>초기화</button>}
    </div>}
    {!compact&&<div className="event-view-switch"><button type="button" aria-pressed={view==="list"} onClick={()=>{setView("list");setDay("");}}>날짜순</button><button type="button" aria-pressed={view==="calendar"} onClick={()=>{setView("calendar");if(!month)setMonth(today.slice(0,7));}}>달력</button><span>{loading?"확인 중…":`확인된 일정 ${data?.items.length||0}${data?.nextCursor?"+":""}건`}</span></div>}
    {!compact&&view==="calendar"&&<p className="event-range-note">날짜가 확정된 단일 행사만 달력에 표시합니다. 기간·정기 행사는 아래에서 확인하세요.</p>}
    {!compact&&view==="calendar"&&calendar&&<><div className="event-calendar" aria-label={`${month} 행사 달력`}>{["일","월","화","수","목","금","토"].map(x=><span className="event-weekday" key={x}>{x}</span>)}{Array.from({length:new Date(`${calendar.from}T00:00:00Z`).getUTCDay()},(_,i)=><span key={`empty-${i}`}/>)}{Array.from({length:Number(calendar.to.slice(-2))},(_,i)=>{const date=`${month}-${String(i+1).padStart(2,"0")}`,count=(data?.items||[]).filter(x=>x.startDate===date&&x.endDate===date).length;return <button key={date} type="button" aria-pressed={day===date} aria-label={`${dateLabel(date)}, 행사 ${count}건`} className={date===today?"is-today":""} onClick={()=>setDay(day===date?"":date)}><time dateTime={date}>{i+1}</time>{count>0&&<small>{count}건</small>}</button>;})}</div>{data?.nextCursor&&<p>아래 ‘더 불러오기’를 누르면 나머지 일정도 달력에 표시됩니다.</p>}</>}
    <div aria-live="polite" aria-busy={loading}>{loading?<p className="event-empty">공식 행사 일정을 불러오고 있습니다…</p>:<>
      {error&&<p className="event-empty" role="alert">일정을 불러오지 못했습니다. <button type="button" onClick={()=>data?.nextCursor?void more():setRevision(x=>x+1)}>다시 시도</button></p>}
      {compact?<div className="event-grid church-news-grid event-preview-grid">{shown.map(item=><EventCard key={item.id} item={item} compact/>)}</div>:orderedGroups.map(([date,items])=><section className="event-day-group" key={date}><h2>{date==="ongoing"?"진행 중인 행사":`${date.slice(0,4)}년 ${Number(date.slice(5))}월`}</h2><div className="event-agenda">{items.map(item=><EventCard key={item.id} item={item}/>)}</div></section>)}
      {!shown.length&&!error&&<p className="event-empty">{view==="calendar"?day?`${dateLabel(day)}에 확인된 단일 행사가 없습니다.`:"이달에 확인된 단일 행사가 없습니다.":"선택한 조건에 수집된 예정 행사가 없습니다."} {periods.length?"기간·정기 행사는 아래에서 확인해 주세요.":"공식 출처의 안내도 함께 확인해 주세요."}</p>}
      {!compact&&periods.length>0&&<section className="event-day-group"><h2>기간·정기 행사</h2><p className="event-range-note">아래 행사는 개별 회차를 확인해야 하므로 달력의 날짜별 건수에는 넣지 않았습니다.</p><div className="event-agenda">{periods.map(item=><EventCard key={item.id} item={item}/>)}</div></section>}
      {!compact&&data?.nextCursor&&<button className="event-more" type="button" disabled={moreBusy} onClick={()=>void more()}>{moreBusy?"불러오는 중…":"일정 더 불러오기"}</button>}
    </>}</div>
  </div>;
}
