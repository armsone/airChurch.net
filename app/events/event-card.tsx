import type { ChurchEvent, EventSource } from "./types";
import { dateLabel } from "./types";

export function EventCard({ item }: { item: ChurchEvent }) {
  return <article className="event-card">
    <time className="event-date" dateTime={item.startDate}>{item.endDate!==item.startDate&&<span>안내된 행사 기간</span>}{dateLabel(item.startDate)}{item.endDate !== item.startDate && ` ~ ${dateLabel(item.endDate)}`}<span>{item.startTime || "시간은 원문 확인"}</span></time>
    <div className="event-card-copy"><div className="event-tags"><span>{item.category}</span>{item.attendance !== "현장" && <span>{item.attendance}</span>}{item.status === "cancelled" && <strong>취소된 행사</strong>}</div>
      <h3><a href={`/events/${item.id}`}>{item.title}</a></h3><p>{item.venue}</p><p>주최 · {item.organizer}</p>
      <div className="event-actions"><a href={`/events/${item.id}`}>행사 안내 →</a><a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">공식 원문 ↗</a>{item.registrationUrl && item.status === "published" && <a href={item.registrationUrl} target="_blank" rel="noopener noreferrer">신청 안내 ↗</a>}</div>
      <small>{item.sourceName} · 확인 {new Date(item.checkedAt).toLocaleString("ko-KR",{timeZone:"Asia/Seoul"})}</small>
    </div>
  </article>;
}

export function EventSources({ sources }: { sources: EventSource[] }) {
  return <details className="church-news-sources event-sources"><summary>자료를 가져오는 곳 · {sources.length}곳</summary>
    <p>아래 공식 게시처에서 날짜와 장소를 확인한 행사를 자동으로 모읍니다. 교계뉴스는 행사 발견에 활용하며, 기사만으로 일정을 확정하지 않습니다. 주최가 명시되지 않으면 ‘주최 확인 필요’로 표시합니다. 이미지에만 있거나 내용이 불명확한 일정은 빠질 수 있습니다.</p>
    <div>{sources.map(source => <span key={source.id}><strong>{source.name}</strong><small>{source.kind === "rss" ? "교계뉴스 · 행사 발견" : "공식 행사·공지"}</small>
      <a href={source.homepage} target="_blank" rel="noopener noreferrer">홈페이지 ↗</a><a href={source.url} target="_blank" rel="noopener noreferrer">{source.kind === "rss" ? "RSS" : "수집 페이지"} ↗</a>
      <small>{source.lastSuccessAt ? `최근 수집 ${new Date(source.lastSuccessAt.endsWith("Z") ? source.lastSuccessAt : `${source.lastSuccessAt}Z`).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}` : "첫 수집 준비 중"}</small>
      <small>{source.status === "stale" ? "최근 수집 지연 · 원문 확인 필요" : source.status === "ok" ? `수집 정상 · 공개 행사 ${source.eventCount}건` : source.status === "failed" ? "연결 지연 · 자동 재시도 예정" : source.status === "blocked" ? "수집 제한 · 원문에서 확인" : source.status === "running" ? "자료 확인 중" : "수집 대기"}</small>
    </span>)}</div>
  </details>;
}
