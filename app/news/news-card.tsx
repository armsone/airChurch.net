export type NewsItem = { title:string; summary:string; url:string; publishedAt:string; source:string; tone:string; markUrl:string };
export type NewsSource = { name:string; rssUrl:string; homepage:string };

export default function NewsCard({ item }: { item:NewsItem }) {
  const date = new Date(item.publishedAt);
  const dateLabel = Number.isNaN(date.getTime()) ? "날짜는 원문 확인" : date.toLocaleDateString("ko-KR", { timeZone:"Asia/Seoul" });
  return <a className="church-news-card" href={item.url} target="_blank" rel="noopener noreferrer" aria-label={`${item.source} 원문에서 읽기: ${item.title}`}>
    <span className={`church-news-thumb ${item.tone}`} aria-hidden="true"><span className="church-news-mark">{item.markUrl&&<img src={item.markUrl} alt="" loading="lazy"/>}</span><small>{item.source}</small></span>
    <span className="church-news-copy"><small>{item.source} · {dateLabel}</small><strong>{item.title}</strong><span>{item.summary}</span><em>원문에서 읽기 ↗</em></span>
  </a>;
}
