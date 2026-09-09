import SourceDirectory from "../source-directory";
export type NewsItem = { title:string; summary:string; url:string; publishedAt:string; source:string; tone:string; markUrl:string };
export type NewsSource = { name:string; rssUrl:string; homepage:string;status?:string;lastSuccessAt?:string };

export function NewsSources({sources}:{sources:NewsSource[]}){
  const normal=sources.filter(s=>s.status==="ok").length;
  return <SourceDirectory title="교계소식 출처" note={`연결 ${sources.length}곳 · 최근 수집 정상 ${normal}곳. 제목과 짧은 소개만 모으며 전체 기사는 원문에서 읽습니다.`} groups={[{label:"교계 매체",sources:sources.map(s=>({name:s.name,homepage:s.homepage,url:s.rssUrl,linkLabel:"RSS",checkedLabel:s.lastSuccessAt?`최근 수집 ${new Date(s.lastSuccessAt).toLocaleString("ko-KR",{timeZone:"Asia/Seoul"})}`:undefined,statusLabel:s.status==="ok"?"수집 정상":s.status==="failed"?"연결 지연 · 자동 재시도":s.status==="stale"?"최근 수집 지연":"첫 수집 준비 중"}))}]}/>;
}

export default function NewsCard({ item }: { item:NewsItem }) {
  const date = new Date(item.publishedAt);
  const dateLabel = Number.isNaN(date.getTime()) ? "날짜는 원문 확인" : date.toLocaleDateString("ko-KR", { timeZone:"Asia/Seoul" });
  return <a className="church-news-card" href={item.url} target="_blank" rel="noopener noreferrer" aria-label={`${item.source} 원문에서 읽기: ${item.title}`}>
    <span className={`church-news-thumb ${item.tone}`} aria-hidden="true"><span className="church-news-mark">{item.markUrl&&<img src={item.markUrl} alt="" loading="lazy"/>}</span><small>{item.source}</small></span>
    <span className="church-news-copy"><small>{item.source} · {dateLabel}</small><strong>{item.title}</strong><span>{item.summary}</span><em>원문에서 읽기 ↗</em></span>
  </a>;
}
