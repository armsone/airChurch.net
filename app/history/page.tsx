import type { Metadata } from "next";
import MakingNav from "../making/making-nav";
import SiteFooter from "../site-footer";
import historyData from "../../data/site-history.json";

export const metadata: Metadata = {
  title: "airChurch 히스토리 | 함께 만들어 온 변화",
  description: "airChurch가 시작된 날부터 지금까지, 공개 화면과 운영 방식에 반영된 변화를 기록합니다.",
};

const history = historyData.entries;

export default function HistoryPage() {
  return <main className="history-page"><div className="making-section-nav"><a href="/making">에어처치 만들기</a><MakingNav current="history" /></div><section className="history-hero"><span>OUR HISTORY</span><h1>함께 만들어 온<br />airChurch의 변화</h1><p>작은 개선도 기록해, 이곳이 어디에서 시작해 어디로 가고 있는지 언제든 돌아볼 수 있게 합니다.</p></section><section className="history-list" aria-label="airChurch 변화 기록">{history.map((entry, index) => <article key={entry.date}><time>{entry.date}</time><div><span>{String(index + 1).padStart(2, "0")}</span><h2>{entry.title}</h2><ul>{entry.items.map((item) => <li key={item}>{item}</li>)}</ul></div></article>)}</section><SiteFooter /></main>;
}
