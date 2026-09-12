import type { Metadata } from "next";
import SiteFooter from "../site-footer";
import MakingNav from "./making-nav";
import { listMakingPosts } from "./store";
export const dynamic="force-dynamic";

export const metadata: Metadata = {
  title: "에어처치 만들기 | 조사와 고민", description: "에어처치를 만들며 조사한 자료, 나눈 고민과 선택의 이유를 기록합니다.", alternates: { canonical: "/making" },
  openGraph: { title: "에어처치 만들기", description: "조사한 자료와 선택의 이유, 아직 남은 질문을 기록합니다.", url: "/making", images: [] },
  twitter: { card: "summary", title: "에어처치 만들기", description: "조사한 자료와 선택의 이유, 아직 남은 질문을 기록합니다.", images: [] },
};
export default async function MakingPage() {
  const posts=await listMakingPosts();
  return <main><div className="making-shell"><header className="making-heading"><span>함께 쌓는 제작 기록</span><h1>에어처치 만들기</h1><p>어떤 사이트가 되어야 할지 고민하고, 다른 곳에서 배우고, 선택한 이유를 남깁니다.</p></header><MakingNav current="notes" /><section aria-label="조사와 고민 게시판"><div className="making-board-heading"><h2>조사와 고민</h2><span>{posts.length}개의 글 · <a href="/admin/making">글 관리</a></span></div><ol className="making-board">{posts.map((post, index) => <li key={post.slug}><a href={`/making/${post.slug}`}><span className="making-number">{String(posts.length - index).padStart(2, "0")}</span><div><span className="making-category">{post.category}</span><h3>{post.title}</h3><p>{post.summary}</p></div><time dateTime={post.date}>{post.date.replaceAll("-", ".")}</time></a></li>)}</ol></section></div><SiteFooter /></main>;
}
