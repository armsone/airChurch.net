import { database } from "../api/_shared";
import { posts } from "./posts";
export type MakingPost = typeof posts[number] & { status: string; updatedAt?: string };
type Row = { slug: string; title: string; summary: string; category: string; body: string; sources: string; status: string; created_at: string; updated_at: string };
function fromRow(row: Row): MakingPost {
  return { slug: row.slug, title: row.title, summary: row.summary, category: row.category, sections: JSON.parse(row.body), sources: JSON.parse(row.sources), status: row.status, date: row.created_at.slice(0,10), updatedAt: row.updated_at.slice(0,10) };
}
export async function listMakingPosts(includeHidden = false) {
  const result = await database().prepare("SELECT * FROM making_posts ORDER BY created_at DESC").all<Row>();
  const all = new Map<string, MakingPost>(posts.map(post => [post.slug, {...post, status: "published"}]));
  for (const row of result.results) all.set(row.slug,fromRow(row));
  return [...all.values()].filter(post => includeHidden || post.status === "published").sort((a,b) => b.date.localeCompare(a.date));
}
export async function getMakingPost(slug: string) {
  const row = await database().prepare("SELECT * FROM making_posts WHERE slug=?").bind(slug).first<Row>();
  if (row) return row.status === "published" ? fromRow(row) : null;
  const original = posts.find(post => post.slug === slug);
  return original ? {...original, status: "published"} : null;
}
