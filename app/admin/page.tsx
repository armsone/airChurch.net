import { env } from "cloudflare:workers";
import Link from "next/link";
import { database, ensureAnalyticsTables, ensureCommunityTables, ensureSermonTables } from "../api/_shared";
import { chatGPTSignOutPath, requireChatGPTUser } from "../chatgpt-auth";

type CountRow = { views: number; visitors: number };
type DailyRow = { day: string; views: number; visitors: number };
type PathRow = { path: string; views: number; visitors: number };
type PendingPost = { id: number; category: string; nickname: string; content: string; created_at: string };
type PendingTalent = { id: number; title: string; region: string; description: string; created_at: string };

async function countSince(db: D1Database, modifier: string): Promise<CountRow> {
  return (await db.prepare(`SELECT COUNT(*) AS views, COUNT(DISTINCT visitor_hash) AS visitors FROM page_views WHERE created_at >= datetime('now',?)`).bind(modifier).first<CountRow>()) ?? { views: 0, visitors: 0 };
}

export default async function AdminPage() {
  const user = await requireChatGPTUser("/admin");
  const allowedEmail = (env as unknown as { ADMIN_EMAIL?: string }).ADMIN_EMAIL?.trim().toLowerCase();
  if (!allowedEmail || user.email.toLowerCase() !== allowedEmail) {
    return <main className="admin-shell"><section className="admin-denied"><span className="brand-mark" aria-hidden="true" /><h1>관리자 전용 페이지입니다</h1><p>허용된 관리자 계정으로 다시 로그인해 주세요.</p><a href={chatGPTSignOutPath("/admin")}>다른 계정으로 로그인</a></section></main>;
  }

  const db = database();
  await Promise.all([ensureAnalyticsTables(db), ensureCommunityTables(db), ensureSermonTables(db)]);
  const [today, week, month, daily, paths, sermons, churches, posts, talents, pendingPosts, pendingTalents] = await Promise.all([
    db.prepare("SELECT COUNT(*) AS views, COUNT(DISTINCT visitor_hash) AS visitors FROM page_views WHERE created_at >= datetime('now','+9 hours','start of day','-9 hours')").first<CountRow>(),
    countSince(db, "-7 days"),
    countSince(db, "-30 days"),
    db.prepare("SELECT date(created_at,'+9 hours') AS day, COUNT(*) AS views, COUNT(DISTINCT visitor_hash) AS visitors FROM page_views WHERE created_at >= datetime('now','-13 days') GROUP BY date(created_at,'+9 hours') ORDER BY day").all<DailyRow>(),
    db.prepare("SELECT path, COUNT(*) AS views, COUNT(DISTINCT visitor_hash) AS visitors FROM page_views WHERE created_at >= datetime('now','-30 days') GROUP BY path ORDER BY views DESC LIMIT 8").all<PathRow>(),
    db.prepare("SELECT COUNT(*) AS count FROM sermons").first<{ count: number }>(),
    db.prepare("SELECT COUNT(*) AS count FROM churches WHERE review_status='approved'").first<{ count: number }>(),
    db.prepare("SELECT COUNT(*) AS count FROM community_posts WHERE status='pending'").first<{ count: number }>(),
    db.prepare("SELECT COUNT(*) AS count FROM talent_offers WHERE status='pending'").first<{ count: number }>(),
    db.prepare("SELECT id, category, nickname, content, created_at FROM community_posts WHERE status='pending' ORDER BY created_at DESC LIMIT 50").all<PendingPost>(),
    db.prepare("SELECT id, title, region, description, created_at FROM talent_offers WHERE status='pending' ORDER BY created_at DESC LIMIT 50").all<PendingTalent>(),
  ]);
  const maxViews = Math.max(1, ...daily.results.map((row) => Number(row.views)));

  return <main className="admin-shell">
    <header className="admin-header"><Link className="brand" href="/"><span className="brand-mark" aria-hidden="true" /><span>airchurch</span></Link><div><span>{user.displayName}</span><a href={chatGPTSignOutPath("/")}>로그아웃</a></div></header>
    <section className="admin-title"><div><span>ADMIN</span><h1>방문 현황</h1><p>개인정보 없이 익명 방문 흐름만 집계합니다.</p></div><Link href="/">사이트 보기 ↗</Link></section>
    <section className="admin-metrics">
      <article><small>오늘 방문자</small><strong>{Number(today?.visitors ?? 0).toLocaleString("ko-KR")}</strong><span>{Number(today?.views ?? 0).toLocaleString("ko-KR")}회 조회</span></article>
      <article><small>최근 7일 방문자</small><strong>{Number(week.visitors).toLocaleString("ko-KR")}</strong><span>{Number(week.views).toLocaleString("ko-KR")}회 조회</span></article>
      <article><small>최근 30일 방문자</small><strong>{Number(month.visitors).toLocaleString("ko-KR")}</strong><span>{Number(month.views).toLocaleString("ko-KR")}회 조회</span></article>
    </section>
    <section className="admin-grid">
      <article className="admin-panel"><div className="admin-panel-title"><div><small>최근 14일</small><h2>날짜별 방문</h2></div><span>조회수 기준</span></div><div className="traffic-chart">{daily.results.length ? daily.results.map((row) => <div className="traffic-day" key={row.day}><div className="traffic-bar-wrap"><span className="traffic-value">{row.views}</span><div className="traffic-bar" style={{height:`${Math.max(8,Number(row.views)/maxViews*100)}%`}} /></div><small>{row.day.slice(5)}</small></div>) : <p className="admin-empty">방문이 쌓이면 날짜별 추이가 표시됩니다.</p>}</div></article>
      <article className="admin-panel"><div className="admin-panel-title"><div><small>최근 30일</small><h2>인기 페이지</h2></div></div><div className="path-list">{paths.results.length ? paths.results.map((row, index) => <div key={row.path}><b>{index + 1}</b><span>{row.path === "/" ? "홈" : row.path}</span><em>{row.views}회 <small>· {row.visitors}명</small></em></div>) : <p className="admin-empty">아직 집계된 페이지가 없습니다.</p>}</div></article>
    </section>
    <section className="admin-operations"><article><small>공개 교회</small><strong>{churches?.count ?? 0}</strong></article><article><small>수집 영상</small><strong>{sermons?.count ?? 0}</strong></article><a className="admin-operation-card" href="#pending-posts"><small>검토할 익명 글</small><strong>{posts?.count ?? 0}</strong><span>목록 보기 ↓</span></a><a className="admin-operation-card" href="#pending-talents"><small>검토할 달란트</small><strong>{talents?.count ?? 0}</strong><span>목록 보기 ↓</span></a></section>
    <section className="admin-review-grid">
      <article className="admin-panel" id="pending-posts"><div className="admin-panel-title"><div><small>COMMUNITY REVIEW</small><h2>검토할 익명 글</h2></div><span>{pendingPosts.results.length}건</span></div><div className="review-list">{pendingPosts.results.length ? pendingPosts.results.map((post) => <article key={post.id}><div><span>{post.category}</span><time>{new Date(`${post.created_at}Z`).toLocaleString("ko-KR", { timeZone:"Asia/Seoul" })}</time></div><strong>{post.nickname}</strong><p>{post.content}</p></article>) : <p className="admin-empty">현재 검토할 익명 글이 없습니다.</p>}</div></article>
      <article className="admin-panel" id="pending-talents"><div className="admin-panel-title"><div><small>TALENT REVIEW</small><h2>검토할 달란트</h2></div><span>{pendingTalents.results.length}건</span></div><div className="review-list">{pendingTalents.results.length ? pendingTalents.results.map((talent) => <article key={talent.id}><div><span>{talent.region}</span><time>{new Date(`${talent.created_at}Z`).toLocaleString("ko-KR", { timeZone:"Asia/Seoul" })}</time></div><strong>{talent.title}</strong><p>{talent.description}</p></article>) : <p className="admin-empty">현재 검토할 달란트가 없습니다.</p>}</div></article>
    </section>
    <p className="admin-privacy">IP 주소, 이름, 이메일은 방문 통계에 저장하지 않습니다. 동일 브라우저의 익명 식별값은 해시 처리하고 같은 페이지의 30분 이내 중복 조회는 제외합니다.</p>
  </main>;
}
