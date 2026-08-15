import { hasAdminAccess } from "../admin-access";
import { ChurchControls, ReviewControls, SermonControls } from "./admin-controls";
import AdminLogin from "./admin-login";
import AdminListSearch from "./admin-list-search";
import HomeReloadLink from "../home-reload-link";
import { database, ensureAnalyticsTables, ensureCommunityTables, ensureSermonTables } from "../api/_shared";

export const dynamic = "force-dynamic";

type CountRow = { views: number; visitors: number };
type DailyRow = { day: string; views: number; visitors: number };
type PathRow = { path: string; views: number; visitors: number };
type ChurchRow = { id: number; name: string; pastor: string; region: string; denomination: string; review_status: string; hold_reason: string | null; hold_note: string | null; held_at: string | null; priority_weight: number };
type SermonRow = { id: number; title: string; youtube_id: string; published_at: string; status: string; church: string };
type PostRow = { id: number; category: string; nickname: string; content: string; status: string; created_at: string };
type TalentRow = { id: number; title: string; region: string; description: string; status: string; created_at: string };

async function countSince(db: D1Database, modifier: string): Promise<CountRow> {
  return (await db.prepare("SELECT COUNT(*) AS views, COUNT(DISTINCT visitor_hash) AS visitors FROM page_views WHERE created_at >= datetime('now',?)").bind(modifier).first<CountRow>()) ?? { views: 0, visitors: 0 };
}

function koreanTime(value: string) { return new Date(`${value}Z`).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }); }
function statusLabel(status: string) { return status === "approved" || status === "published" ? "공개" : status === "pending" ? "검토 중" : status === "removed" ? "보류" : "비공개"; }

export default async function AdminPage() {
  if (!(await hasAdminAccess())) return <AdminLogin />;

  const db = database();
  await Promise.all([ensureAnalyticsTables(db), ensureCommunityTables(db), ensureSermonTables(db)]);
  const [today, week, month, daily, paths, sermons, churches, posts, talents, churchRows, sermonRows, postRows, talentRows] = await Promise.all([
    db.prepare("SELECT COUNT(*) AS views, COUNT(DISTINCT visitor_hash) AS visitors FROM page_views WHERE created_at >= datetime('now','+9 hours','start of day','-9 hours')").first<CountRow>(),
    countSince(db, "-7 days"), countSince(db, "-30 days"),
    db.prepare("SELECT date(created_at,'+9 hours') AS day, COUNT(*) AS views, COUNT(DISTINCT visitor_hash) AS visitors FROM page_views WHERE created_at >= datetime('now','-13 days') GROUP BY date(created_at,'+9 hours') ORDER BY day").all<DailyRow>(),
    db.prepare("SELECT path, COUNT(*) AS views, COUNT(DISTINCT visitor_hash) AS visitors FROM page_views WHERE created_at >= datetime('now','-30 days') GROUP BY path ORDER BY views DESC LIMIT 8").all<PathRow>(),
    db.prepare("SELECT COUNT(*) AS count FROM sermons WHERE status='published'").first<{ count: number }>(),
    db.prepare("SELECT COUNT(*) AS count FROM churches WHERE review_status='approved'").first<{ count: number }>(),
    db.prepare("SELECT COUNT(*) AS count FROM community_posts WHERE status='pending'").first<{ count: number }>(),
    db.prepare("SELECT COUNT(*) AS count FROM talent_offers WHERE status='pending'").first<{ count: number }>(),
    db.prepare("SELECT id,name,pastor,region,denomination,review_status,hold_reason,hold_note,held_at,priority_weight FROM churches WHERE review_status IN ('approved','removed') ORDER BY CASE review_status WHEN 'approved' THEN 0 ELSE 1 END,priority_weight DESC,name LIMIT 200").all<ChurchRow>(),
    db.prepare("SELECT s.id,s.title,s.youtube_id,s.published_at,s.status,c.name AS church FROM sermons s JOIN churches c ON c.id=s.church_id ORDER BY s.published_at DESC LIMIT 80").all<SermonRow>(),
    db.prepare("SELECT id,category,nickname,content,status,created_at FROM community_posts ORDER BY created_at DESC LIMIT 50").all<PostRow>(),
    db.prepare("SELECT id,title,region,description,status,created_at FROM talent_offers ORDER BY created_at DESC LIMIT 50").all<TalentRow>(),
  ]);
  const maxViews = Math.max(1, ...daily.results.map((row) => Number(row.views)));
  const publicChurchRows = churchRows.results.filter((church) => church.review_status === "approved");
  const heldChurchRows = churchRows.results.filter((church) => church.review_status === "removed");

  return <main className="admin-shell">
    <header className="admin-header">
      <HomeReloadLink className="brand"><span className="brand-mark" aria-hidden="true" /><span>airchurch</span></HomeReloadLink><div><span>관리자</span><form action="/api/admin/lock" method="post"><button type="submit">로그아웃</button></form></div>
    </header>
    <section className="admin-title"><div><span>ADMIN</span><h1>방문 현황과 운영</h1><p>방문 흐름을 확인하고 공개 콘텐츠를 직접 관리합니다.</p></div>
      <HomeReloadLink>사이트 보기 ↗</HomeReloadLink>
    </section>
    <section className="admin-metrics">
      <article><small>오늘 방문자</small><strong>{Number(today?.visitors ?? 0).toLocaleString("ko-KR")}</strong><span>{Number(today?.views ?? 0).toLocaleString("ko-KR")}회 조회</span></article>
      <article><small>최근 7일 방문자</small><strong>{Number(week.visitors).toLocaleString("ko-KR")}</strong><span>{Number(week.views).toLocaleString("ko-KR")}회 조회</span></article>
      <article><small>최근 30일 방문자</small><strong>{Number(month.visitors).toLocaleString("ko-KR")}</strong><span>{Number(month.views).toLocaleString("ko-KR")}회 조회</span></article>
    </section>
    <section className="admin-grid">
      <article className="admin-panel"><div className="admin-panel-title"><div><small>최근 14일</small><h2>날짜별 방문</h2></div><span>조회수 기준</span></div><div className="traffic-chart">{daily.results.length ? daily.results.map((row) => <div className="traffic-day" key={row.day}><div className="traffic-bar-wrap"><span className="traffic-value">{row.views}</span><div className="traffic-bar" style={{height:`${Math.max(8,Number(row.views)/maxViews*100)}%`}} /></div><small>{row.day.slice(5)}</small></div>) : <p className="admin-empty">방문이 쌓이면 날짜별 추이가 표시됩니다.</p>}</div></article>
      <article className="admin-panel"><div className="admin-panel-title"><div><small>최근 30일</small><h2>인기 페이지</h2></div></div><div className="path-list">{paths.results.length ? paths.results.map((row, index) => <div key={row.path}><b>{index + 1}</b><span>{row.path === "/" ? "홈" : row.path}</span><em>{row.views}회 <small>· {row.visitors}명</small></em></div>) : <p className="admin-empty">아직 집계된 페이지가 없습니다.</p>}</div></article>
    </section>
    <section className="admin-operations"><a className="admin-operation-card" href="#church-management"><small>공개 교회</small><strong>{churches?.count ?? 0}</strong><span>수정·관리 ↓</span></a><a className="admin-operation-card" href="#sermon-management"><small>공개 영상</small><strong>{sermons?.count ?? 0}</strong><span>긴급 관리 ↓</span></a><a className="admin-operation-card" href="#pending-posts"><small>검토할 익명 글</small><strong>{posts?.count ?? 0}</strong><span>검토하기 ↓</span></a><a className="admin-operation-card" href="#pending-talents"><small>검토할 달란트</small><strong>{talents?.count ?? 0}</strong><span>검토하기 ↓</span></a></section>

    <section className="admin-management-grid">
      <article className="admin-panel" id="church-management"><div className="admin-panel-title"><div><small>CHURCH MANAGEMENT</small><h2>공개 교회 관리</h2><p>관심도가 높은 교회는 목록과 최신 말씀에서 더 자주 소개됩니다.</p></div><span>{publicChurchRows.length}곳</span></div><AdminListSearch targetId="public-church-list" total={publicChurchRows.length} label="공개 교회 검색" placeholder="교회명, 목사님, 지역, 교단 검색" /><div className="admin-manage-list" id="public-church-list">{publicChurchRows.length ? publicChurchRows.map((church) => <article key={church.id} data-admin-search={`${church.name} ${church.pastor} ${church.region} ${church.denomination}`}><div className="admin-record-heading"><strong>{church.name}</strong><div className="admin-record-status"><span className={`priority-${church.priority_weight}`}>{church.priority_weight === 3 ? "♥ 매우 높음" : church.priority_weight === 2 ? "♥ 높음" : "기본"}</span><span className={`status-${church.review_status}`}>{statusLabel(church.review_status)}</span></div></div><ChurchControls id={church.id} name={church.name} pastor={church.pastor} region={church.region} denomination={church.denomination} status={church.review_status} holdReason={church.hold_reason} holdNote={church.hold_note} heldAt={church.held_at} priorityWeight={church.priority_weight} /></article>) : <p className="admin-empty">공개 중인 교회가 없습니다.</p>}</div></article>
      <article className="admin-panel" id="church-hold"><div className="admin-panel-title"><div><small>CHURCH HOLD</small><h2>보류 교회</h2><p>보류 사유와 메모는 관리자에게만 표시됩니다.</p></div><span>{heldChurchRows.length}곳</span></div><AdminListSearch targetId="held-church-list" total={heldChurchRows.length} label="보류 교회 검색" placeholder="교회명, 목사님, 지역, 보류 메모 검색" /><div className="admin-manage-list" id="held-church-list">{heldChurchRows.length ? heldChurchRows.map((church) => <article key={church.id} data-admin-search={`${church.name} ${church.pastor} ${church.region} ${church.denomination} ${church.hold_reason ?? ""} ${church.hold_note ?? ""}`}><div className="admin-record-heading"><strong>{church.name}</strong><span className={`status-${church.review_status}`}>{statusLabel(church.review_status)}</span></div><ChurchControls id={church.id} name={church.name} pastor={church.pastor} region={church.region} denomination={church.denomination} status={church.review_status} holdReason={church.hold_reason} holdNote={church.hold_note} heldAt={church.held_at} priorityWeight={church.priority_weight} /></article>) : <p className="admin-empty">보류된 교회가 없습니다.</p>}</div></article>
      <article className="admin-panel" id="sermon-management"><div className="admin-panel-title"><div><small>SERMON MANAGEMENT</small><h2>수집 영상 긴급 관리</h2></div><span>최근 {sermonRows.results.length}개</span></div><AdminListSearch targetId="sermon-list" total={sermonRows.results.length} label="수집 영상 검색" placeholder="영상 제목, 교회명, 영상 ID 검색" /><div className="admin-manage-list compact" id="sermon-list">{sermonRows.results.map((sermon) => <article key={sermon.id} data-admin-search={`${sermon.title} ${sermon.church} ${sermon.youtube_id} ${sermon.status}`}><div className="admin-record-heading"><div><strong>{sermon.title}</strong><small>{sermon.church} · {new Date(sermon.published_at).toLocaleDateString("ko-KR")}</small></div><a href={`https://www.youtube.com/watch?v=${sermon.youtube_id}`} target="_blank" rel="noreferrer">영상 ↗</a></div><SermonControls id={sermon.id} status={sermon.status} /></article>)}</div></article>
    </section>

    <section className="admin-review-grid">
      <article className="admin-panel" id="pending-posts"><div className="admin-panel-title"><div><small>COMMUNITY REVIEW</small><h2>익명 글 관리</h2></div><span>{postRows.results.length}건</span></div><div className="review-list">{postRows.results.length ? postRows.results.map((post) => <article key={post.id}><div><span>{post.category} · {statusLabel(post.status)}</span><time>{koreanTime(post.created_at)}</time></div><strong>{post.nickname}</strong><p>{post.content}</p><ReviewControls kind="post" id={post.id} status={post.status} /></article>) : <p className="admin-empty">접수된 익명 글이 없습니다.</p>}</div></article>
      <article className="admin-panel" id="pending-talents"><div className="admin-panel-title"><div><small>TALENT REVIEW</small><h2>달란트 관리</h2></div><span>{talentRows.results.length}건</span></div><div className="review-list">{talentRows.results.length ? talentRows.results.map((talent) => <article key={talent.id}><div><span>{talent.region} · {statusLabel(talent.status)}</span><time>{koreanTime(talent.created_at)}</time></div><strong>{talent.title}</strong><p>{talent.description}</p><ReviewControls kind="talent" id={talent.id} status={talent.status} /></article>) : <p className="admin-empty">접수된 달란트가 없습니다.</p>}</div></article>
    </section>
    <p className="admin-privacy">IP 주소, 이름, 이메일은 방문 통계에 저장하지 않습니다. 동일 브라우저의 익명 식별값은 해시 처리하고 같은 페이지의 30분 이내 중복 조회는 제외합니다.</p>
  </main>;
}
