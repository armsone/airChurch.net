import type { ChurchEvent, EventSource } from "./types";
import { dateLabel } from "./types";
import SourceDirectory from "../source-directory";
import EventSaveButton from "./event-save-button";

export function EventCard({ item, compact=false }: { item: ChurchEvent; compact?:boolean }) {
  const weekday = new Date(`${item.startDate}T00:00:00Z`).getUTCDay();
  const weekendClass = weekday === 6 ? " event-card-saturday" : weekday === 0 ? " event-card-sunday" : "";
  return <article className={`event-card${weekendClass}${compact?" event-card-compact church-news-card":""}`}>
    <time className="event-date" dateTime={item.startDate}>{compact?<><span>{Number(item.startDate.slice(5,7))}월</span><strong>{Number(item.startDate.slice(8))}</strong><span>{new Date(`${item.startDate}T00:00:00+09:00`).toLocaleDateString("ko-KR",{timeZone:"Asia/Seoul",weekday:"long"})}</span>{item.endDate!==item.startDate&&<span className="event-date-end">~ {Number(item.endDate.slice(5,7))}.{Number(item.endDate.slice(8))}<br/>행사 기간</span>}</>:<>{item.endDate!==item.startDate&&<span>안내된 행사 기간</span>}{dateLabel(item.startDate)}{item.endDate!==item.startDate&&` ~ ${dateLabel(item.endDate)}`}<span>{item.startTime||"시간은 원문 확인"}</span></>}</time>
    <div className="event-card-copy">{compact&&<small className="event-source-label">{item.sourceName}</small>}<div className="event-tags"><span>{item.category}</span>{item.attendance !== "현장" && <span>{item.attendance}</span>}{item.status === "cancelled" && <strong>취소된 행사</strong>}</div>
      <h3><a href={`/events/${item.id}`}>{item.title}</a></h3><p className="event-venue">{item.venue}{compact&&item.startTime&&` · ${item.startTime}`}</p>
      <div className="event-actions"><a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">{compact?"원문 ↗":`${item.sourceName} ↗`}</a><a href={`/events/${item.id}`}>자세히 →</a><EventSaveButton item={item}/></div>
    </div>
  </article>;
}

export function EventSources({ sources }: { sources: EventSource[] }) {
  const entry=(source:EventSource)=>({name:source.name,homepage:source.homepage,url:source.url,linkLabel:source.kind==="rss"?"매체 안내":"공식 공지",checkedLabel:source.lastSuccessAt?`최근 수집 ${new Date(source.lastSuccessAt.endsWith("Z")?source.lastSuccessAt:`${source.lastSuccessAt}Z`).toLocaleString("ko-KR",{timeZone:"Asia/Seoul"})}`:"첫 수집 준비 중",statusLabel:source.status==="stale"?"최근 수집 지연 · 원문 확인 필요":source.status==="ok"?source.kind==="rss"?"수집 정상 · 행사 발견용":`수집 정상 · 공개 행사 ${source.eventCount}건`:source.status==="empty"?"목록 확인 · 수집 가능한 공지 없음":source.status==="failed"?"연결 지연 · 자동 재시도 예정":source.status==="blocked"?"수집 제한 · 원문에서 확인":source.status==="running"?"자료 확인 중":"수집 대기"});
  const candidates=sources.filter(source=>source.kind==="candidate");
  return <SourceDirectory title="일정 출처" countLabel={`수집 대상 ${sources.length-candidates.length}곳`} note={`운영 목표 150곳 · 최근 수집 정상 ${sources.filter(s=>s.status==="ok").length}곳${candidates.length?` · 별도 탐색 후보 ${candidates.length}곳 (수집 대상 수에서 제외)`:""}. 날짜·장소가 확인된 공지만 싣고, 뉴스는 행사 발견에 활용합니다.`} groups={[{label:"공식 행사 안내",sources:sources.filter(source=>source.kind==="official").map(entry)},{label:"교계 매체 · 행사 발견",sources:sources.filter(source=>source.kind==="rss").map(entry)},{label:"추가 탐색 · 아직 자동 수집하지 않는 곳",sources:candidates.map(source=>({name:source.name,homepage:source.homepage,url:source.url,linkLabel:"사이트 보기",statusLabel:source.reason||"수집 방식 확인 필요"}))}]}/>;
}
