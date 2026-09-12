import type { Metadata } from "next";
import NewsBrowser from "./news-browser";
import "./news.css";

export const metadata:Metadata={title:"교계소식 | airChurch",description:"교계 매체의 소식을 최신순으로 모았습니다. 출처를 확인하고 원문에서 읽어보세요.",alternates:{canonical:"/news"}};
export const dynamic="force-static";

export default function NewsPage(){
  return <main className="church-detail-shell"><section className="news-page" id="primary-content" tabIndex={-1}><div className="section-heading"><div><span className="section-kicker">하나님 자녀들의 오늘</span><h1>교계소식</h1><p>교계의 소식을 최신순으로 모았습니다. 자세한 내용은 원문에서 확인하세요.</p></div></div><NewsBrowser/></section></main>;
}
