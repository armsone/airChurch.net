import type { Metadata } from "next";
import { notFound } from "next/navigation";
import SiteFooter from "../../site-footer";
import MakingNav from "../making-nav";
import { getMakingPost } from "../store";
import MakingComments from "../comments";
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
  return <main className="making-page"><div className="making-shell"><a className="making-back" href="/making">에어처치 만들기</a><MakingNav current="notes" /><article className="making-article"><header><span className="making-category">{post.category}</span><h1>{post.title}</h1><p>{post.summary}</p><div className="making-byline">에어처치 · <time dateTime={post.date}>{post.date.replaceAll("-", ".")}</time> · 논의를 정리한 기록</div></header>{post.sections.map((section) => <section key={section.title}><h2>{section.title}</h2>{section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</section>)}{post.sources.length > 0 && <section className="making-sources"><h2>참고한 자료</h2><ul>{post.sources.map(([label, href]) => <li key={href}><a href={href}>{label}</a></li>)}</ul></section>}<MakingComments slug={post.slug} /><a className="making-back" href="/making">← 조사와 고민 목록</a></article></div><SiteFooter /></main>;
}
