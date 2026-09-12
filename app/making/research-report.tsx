import sections from "./research-sections.json";
import "./research-report.css";

const articleSections: Record<string, (keyof typeof sections)[]> = {
  "learning-from-korean-religious-sites": ["3", "4", "5", "25", "26"],
  "learning-from-other-countries": ["3", "11", "12", "25", "26"],
  "better-before-more": ["2", "3", "17", "18", "20", "25", "26"],
  "people-and-churches": ["2", "19", "20", "25", "26"],
};

export default function ResearchReport({ slug }: { slug: string }) {
  const ids = articleSections[slug];
  if (!ids) return null;
  return <div className="making-research">
    <div className="making-research-intro"><h2>비교표와 상세 조사</h2><p>2026년 9월 12일 조사 보고서에서 이 글의 주제에 해당하는 본문을 함께 싣습니다. 조사 당시 확인한 사실과 적용 제안, 확인하지 못한 범위를 구분했습니다.</p><a href="/making/religion-services-report.html">전체 보고서 읽기 · 인쇄 / PDF 저장 →</a></div>
    {ids.map(id => <section key={id} dangerouslySetInnerHTML={{ __html: sections[id] }} />)}
  </div>;
}
