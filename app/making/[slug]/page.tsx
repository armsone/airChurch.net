import type { Metadata } from "next";
import { notFound } from "next/navigation";
import SiteFooter from "../../site-footer";
import MakingNav from "../making-nav";
import { getMakingPost, listMakingPosts } from "../store";
import MakingComments from "../comments";
import ResearchReport from "../research-report";
import "../article-reading.css";
export const dynamic="force-dynamic";
type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getMakingPost(slug);
  if (!post) return { title: "글을 찾을 수 없습니다" };
  return { title: `${post.title} | 에어처치 만들기`, description: post.summary, alternates: { canonical: `/making/${post.slug}` }, openGraph: { title: post.title, description: post.summary, url: `/making/${post.slug}`, type: "article", images: [] }, twitter: { card: "summary", title: post.title, description: post.summary, images: [] } };
}
export default async function MakingPost({ params }: Props) {
  const { slug } = await params;
  const post = await getMakingPost(slug);
  if (!post) notFound();
  const articles = await listMakingPosts();
  const index = articles.findIndex(item => item.slug === slug);
  const previous = articles[index + 1];
  const next = index > 0 ? articles[index - 1] : undefined;
  return <main className="making-page"><div className="making-shell"><a className="making-back" href="/making">에어처치 만들기</a><MakingNav current="notes" /><article className="making-article"><header><span className="making-category">{post.category}</span><h1>{post.title}</h1><p>{post.summary}</p><div className="making-byline">에어처치 · 기록일 <time dateTime={post.date}>{post.date.replaceAll("-", ".")}</time> · 조사와 고민의 기록</div></header><div className="making-article-body">{post.sections.map((section) => <section key={section.title}><h2>{section.title}</h2>{section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</section>)}<ResearchReport slug={post.slug} />{post.sources.length > 0 && <section className="making-sources"><h2>참고한 자료</h2><ul>{post.sources.map(([label, href]) => <li key={href}><a href={href}>{label}</a></li>)}</ul></section>}</div><nav className="making-adjacent" aria-label="이전 글과 다음 글">{previous ? <a href={`/making/${previous.slug}`} rel="prev"><span>← 이전 글</span><strong>{previous.title}</strong></a> : <div><span>이전 글이 없습니다</span></div>}{next ? <a href={`/making/${next.slug}`} rel="next"><span>다음 글 →</span><strong>{next.title}</strong></a> : <div><span>가장 최근 글입니다</span></div>}</nav><MakingComments slug={post.slug} /><section className="making-bottom-list"><h2>조사와 고민 글 목록</h2><ul>{articles.map(item => <li key={item.slug}><a href={`/making/${item.slug}`} aria-current={item.slug === slug ? "page" : undefined}><span>{item.slug === slug && <em>읽는 글</em>}{item.title}</span><time dateTime={item.date}>{item.date.replaceAll("-", ".")}</time></a></li>)}</ul></section><a className="making-back" href="/making">← 조사와 고민 목록</a></article></div><SiteFooter /></main>;
}
