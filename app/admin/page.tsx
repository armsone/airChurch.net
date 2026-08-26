import { hasAdminAccess } from "../admin-access";
import { ChurchControls, ReviewControls, ReviewerAccountControls, SermonControls } from "./admin-controls";
import AdminLogin from "./admin-login";
import AdminListSearch from "./admin-list-search";
import AdminLiveRefresh from "./admin-live-refresh";
import ReviewerResolutionControls from "./reviewer-resolution-controls";
import HomeReloadLink from "../home-reload-link";
import { database, ensureAnalyticsTables, ensureChurchRecommendationTables, ensureCommunityTables, ensureReviewerTables, ensureSermonTables } from "../api/_shared";

export const dynamic = "force-dynamic";

type CountRow = { views: number; visitors: number };
type TimeRow = { period: string; views: number; visitors: number };
type PathRow = { path: string; views: number; visitors: number };
type ChurchRow = { id: number; name: string; pastor: string; region: string; denomination: string; review_status: string; hold_reason: string | null; hold_note: string | null; held_at: string | null; priority_weight: number; reviewer_status:string; reviewer_note:string|null; reviewed_at:string|null };
type SermonRow = { id: number; title: string; youtube_id: string; published_at: string; status: string; church: string };
type PostRow = { id: number; category: string; nickname: string; content: string; status: string; created_at: string };
type TalentRow = { id: number; title: string; region: string; description: string; status: string; created_at: string };
type RecommendationRow = { id:number; church_name:string; pastor:string; region:string; denomination:string; youtube_url:string|null; reason:string; status:string; created_at:string };
type ReviewerAccountRow = { id:number; name:string; contact:string; username:string; status:string; created_at:string };
type ReviewerOpinionRow = { id:number; church_id:number; reviewer_name:string; status:string; note:string|null; reviewed_at:string; handled_at:string|null };
type ConcernOpinionRow = ReviewerOpinionRow & { admin_resolution:string|null; admin_note:string|null; church_name:string; church_pastor:string; church_region:string; church_denomination:string; church_status:string; hold_reason:string|null; hold_note:string|null; held_at:string|null; priority_weight:number };

async function countSince(db: D1Database, modifier: string): Promise<CountRow> {
  return (await db.prepare("SELECT COUNT(*) AS views, COUNT(DISTINCT visitor_hash) AS visitors FROM page_views WHERE created_at >= datetime('now',?)").bind(modifier).first<CountRow>()) ?? { views: 0, visitors: 0 };
}

function koreanTime(value: string) { return new Date(`${value}Z`).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }); }
function statusLabel(status: string) { return status === "approved" || status === "published" ? "공개" : status === "pending" ? "검토 중" : status === "removed" ? "보류" : "비공개"; }
function reviewerLabel(status:string){return status==="confirmed"?"목회자 확인":status==="concern"?"재검토 요청":"목회자 미검토";}
function pastorLabel(name:string){return name.trim().endsWith("목사")?name:`${name} 목사`;}
function TrafficChart({ rows, label, empty }: { rows: TimeRow[]; label: (period: string) => string; empty: string }) {
  const maxViews = Math.max(1, ...rows.map((row) => Number(row.views)));
  return <div className={`traffic-chart${rows.length > 16 ? " is-dense" : ""}`}>{rows.length ? rows.map((row) => <div className="traffic-day" key={row.period} title={`${row.visitors}명 · ${row.views}회`}><div className="traffic-bar-wrap"><span className="traffic-value">{row.views}</span><div className="traffic-bar" style={{height:`${Math.max(8,Number(row.views)/maxViews*100)}%`}} /></div><small>{label(row.period)}</small></div>) : <p className="admin-empty">{empty}</p>}</div>;
}

export default async function AdminPage() {
  if (!(await hasAdminAccess())) return <AdminLogin />;

  const db = database();
  await Promise.all([ensureAnalyticsTables(db), ensureCommunityTables(db), ensureSermonTables(db), ensureChurchRecommendationTables(db),ensureReviewerTables(db)]);
  const [today, week, month, active, hourly, daily, monthly, paths, churches, recommendations, churchRows, sermonRows, postRows, talentRows, recommendationRows] = await Promise.all([
    db.prepare("SELECT COUNT(*) AS views, COUNT(DISTINCT visitor_hash) AS visitors FROM page_views WHERE created_at >= datetime('now','+9 hours','start of day','-9 hours')").first<CountRow>(),
    countSince(db, "-7 days"), countSince(db, "-30 days"),
    db.prepare("SELECT COUNT(*) AS visitors FROM visitor_activity WHERE last_seen >= datetime('now','-5 minutes')").first<{ visitors: number }>(),
    db.prepare("SELECT strftime('%Y-%m-%d %H:00',created_at,'+9 hours') AS period,COUNT(*) AS views,COUNT(DISTINCT visitor_hash) AS visitors FROM page_views WHERE created_at >= datetime('now','-24 hours') GROUP BY period ORDER BY period").all<TimeRow>(),
    db.prepare("SELECT date(created_at,'+9 hours') AS period,COUNT(*) AS views,COUNT(DISTINCT visitor_hash) AS visitors FROM page_views WHERE created_at >= datetime('now','-29 days') GROUP BY period ORDER BY period").all<TimeRow>(),
    db.prepare("SELECT strftime('%Y-%m',created_at,'+9 hours') AS period,COUNT(*) AS views,COUNT(DISTINCT visitor_hash) AS visitors FROM page_views WHERE created_at >= datetime('now','start of month','-11 months') GROUP BY period ORDER BY period").all<TimeRow>(),
    db.prepare("SELECT path, COUNT(*) AS views, COUNT(DISTINCT visitor_hash) AS visitors FROM page_views WHERE created_at >= datetime('now','-30 days') GROUP BY path ORDER BY views DESC LIMIT 8").all<PathRow>(),
    db.prepare("SELECT COUNT(*) AS count FROM churches WHERE review_status='approved'").first<{ count: number }>(),
    db.prepare("SELECT COUNT(*) AS count FROM church_recommendations WHERE status='pending'").first<{ count: number }>(),
    db.prepare("SELECT id,name,pastor,region,denomination,review_status,hold_reason,hold_note,held_at,priority_weight,reviewer_status,reviewer_note,reviewed_at FROM churches WHERE review_status IN ('approved','removed') ORDER BY CASE reviewer_status WHEN 'concern' THEN 0 ELSE 1 END,CASE review_status WHEN 'approved' THEN 0 ELSE 1 END,priority_weight DESC,name LIMIT 300").all<ChurchRow>(),
    db.prepare("SELECT s.id,s.title,s.youtube_id,s.published_at,s.status,c.name AS church FROM sermons s JOIN churches c ON c.id=s.church_id ORDER BY s.published_at DESC LIMIT 80").all<SermonRow>(),
    db.prepare("SELECT id,category,nickname,content,status,created_at FROM community_posts ORDER BY created_at DESC LIMIT 50").all<PostRow>(),
    db.prepare("SELECT id,title,region,description,status,created_at FROM talent_offers ORDER BY created_at DESC LIMIT 50").all<TalentRow>(),
    db.prepare("SELECT id,church_name,pastor,region,denomination,youtube_url,reason,status,created_at FROM church_recommendations ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END,created_at DESC LIMIT 80").all<RecommendationRow>(),
  ]);
  const publicChurchRows = churchRows.results.filter((church) => church.review_status === "approved");
  const heldChurchRows = churchRows.results.filter((church) => church.review_status === "removed");
  const [reviewerRows,reviewerOpinions,pendingConcernRows]=await Promise.all([
    db.prepare("SELECT id,name,contact,username,status,created_at FROM reviewer_accounts ORDER BY CASE status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END,created_at DESC LIMIT 100").all<ReviewerAccountRow>(),
    db.prepare("SELECT r.id,r.church_id,COALESCE(a.name,CASE WHEN r.reviewer_id=0 THEN '기본 검토 계정' ELSE '삭제된 계정' END) AS reviewer_name,r.status,r.note,r.reviewed_at,r.handled_at FROM reviewer_church_reviews r LEFT JOIN reviewer_accounts a ON a.id=r.reviewer_id ORDER BY r.reviewed_at DESC LIMIT 1000").all<ReviewerOpinionRow>(),
    db.prepare("SELECT r.id,r.church_id,COALESCE(a.name,CASE WHEN r.reviewer_id=0 THEN '기본 검토 계정' ELSE '삭제된 계정' END) AS reviewer_name,r.status,r.note,r.reviewed_at,r.handled_at,r.admin_resolution,r.admin_note,c.name AS church_name,c.pastor AS church_pastor,c.region AS church_region,c.denomination AS church_denomination,c.review_status AS church_status,c.hold_reason,c.hold_note,c.held_at,c.priority_weight FROM reviewer_church_reviews r JOIN churches c ON c.id=r.church_id LEFT JOIN reviewer_accounts a ON a.id=r.reviewer_id WHERE r.status='concern' AND r.handled_at IS NULL AND c.review_status IN ('approved','removed') ORDER BY CASE WHEN r.admin_resolution='needs_follow_up' THEN 1 ELSE 0 END,r.reviewed_at ASC LIMIT 1000").all<ConcernOpinionRow>(),
  ]);
  const opinionsByChurch=new Map<number,ReviewerOpinionRow[]>();
  for(const opinion of reviewerOpinions.results) opinionsByChurch.set(opinion.church_id,[...(opinionsByChurch.get(opinion.church_id)??[]),opinion]);
  const concernGroups=new Map<number,{church:ConcernOpinionRow;opinions:ConcernOpinionRow[]}>();
  for(const opinion of pendingConcernRows.results) {
    const group=concernGroups.get(opinion.church_id)??{church:opinion,opinions:[]};
    group.opinions.push(opinion);concernGroups.set(opinion.church_id,group);
  }
  const pendingConcernGroups=[...concernGroups.values()];
  const concernChurchIds=new Set(pendingConcernGroups.map((group)=>group.church.church_id));
  const pendingConcernCount=pendingConcernRows.results.length;
  const pendingReviewerCount=reviewerRows.results.filter((reviewer)=>reviewer.status==="pending").length;

  return <main className="admin-shell">
    <AdminLiveRefresh />
    <header className="admin-header">
      <HomeReloadLink className="brand"><span className="brand-mark" aria-hidden="true" /><span>airchurch</span></HomeReloadLink><div><span>관리자</span><a href="/review">목사님 페이지</a><form action="/api/admin/lock" method="post"><button type="submit">로그아웃</button></form></div>
    </header>
    <section className="admin-title"><div><span>ADMIN ACTION CENTER</span><h1>오늘 처리할 운영 업무</h1><p>목사님이 확인을 요청한 교회부터 결정하고, 나머지 운영 현황은 아래에서 확인하세요.</p></div>
      <HomeReloadLink>사이트 보기 ↗</HomeReloadLink>
    </section>
    <section className="admin-operations action-center-cards"><a className="admin-operation-card opinion" href="#reviewer-queue"><small>재검토 요청 교회</small><strong>{pendingConcernGroups.length}</strong><span>{pendingConcernCount?`목사님 의견 ${pendingConcernCount}건 · 먼저 처리 ↓`:"새 요청 없음"}</span></a><a className="admin-operation-card" href="#reviewer-accounts"><small>가입 승인 대기</small><strong>{pendingReviewerCount}</strong><span>목회자 계정 확인 ↓</span></a><a className="admin-operation-card" href="#church-recommendations"><small>교회 추천 검토</small><strong>{recommendations?.count ?? 0}</strong><span>등록 결정 ↓</span></a><a className="admin-operation-card" href="#church-management"><small>공개 교회</small><strong>{churches?.count ?? 0}</strong><span>수정·관리 ↓</span></a></section>

    <section className="admin-panel reviewer-queue" id="reviewer-queue"><div className="admin-panel-title"><div><small>PASTOR CONCERNS</small><h2>목사님이 확인을 요청한 교회</h2><p>같은 교회의 의견은 한곳에 모았습니다. 공개 유지·보류는 의견 처리까지 함께 끝납니다. 추가 확인은 대기 목록에 남아 계속 표시됩니다.</p></div><span>{pendingConcernGroups.length}곳</span></div><div className="reviewer-queue-list">{pendingConcernGroups.length?pendingConcernGroups.map(({church,opinions})=><article className="is-concern" key={church.church_id}><div className="admin-record-heading"><div><strong>{church.church_name}</strong><small><b>{pastorLabel(church.church_pastor)}</b> · {church.church_region} · {church.church_denomination}</small></div><div className="admin-record-status"><span className="reviewer-concern">재검토 {opinions.length}명</span><span className={`status-${church.church_status}`}>{statusLabel(church.church_status)}</span></div></div>{opinions.some((opinion)=>opinion.admin_resolution==="needs_follow_up")&&<p className="admin-follow-up-note">추가 확인 중 · {opinions.find((opinion)=>opinion.admin_note)?.admin_note}</p>}<div className="reviewer-opinion-list">{opinions.map((opinion)=><div className="reviewer-opinion-copy" key={opinion.id}><strong>{opinion.reviewer_name}</strong><time>{koreanTime(opinion.reviewed_at)}</time><p>{opinion.note||"확인이 필요하다는 의견을 보냈습니다."}</p></div>)}</div><ReviewerResolutionControls churchId={church.church_id} churchStatus={church.church_status} opinions={opinions.map((opinion)=>({id:opinion.id,reviewedAt:opinion.reviewed_at}))} existingNote={opinions.find((opinion)=>opinion.admin_note)?.admin_note} existingHoldReason={church.hold_reason} existingHoldNote={church.hold_note}/></article>):<div className="reviewer-queue-empty"><strong>지금 처리할 재검토 요청이 없습니다</strong><p>목사님이 관리자 확인이 필요하다고 표시하면 이곳에 교회별로 모여 표시됩니다.</p></div>}</div></section>

    <section className="admin-section-heading" id="site-analytics"><span>SITE STATUS</span><h2>사이트 현황</h2><p>긴급 검토 업무 아래에서 방문 흐름을 확인합니다.</p></section>
    <section className="admin-metrics">
      <article className="active-visitors"><small>현재 접속자</small><strong>{Number(active?.visitors ?? 0).toLocaleString("ko-KR")}</strong><span>최근 5분 안에 활동한 방문자</span></article>
      <article><small>오늘 방문자</small><strong>{Number(today?.visitors ?? 0).toLocaleString("ko-KR")}</strong><span>{Number(today?.views ?? 0).toLocaleString("ko-KR")}회 조회</span></article>
      <article><small>최근 7일 방문자</small><strong>{Number(week.visitors).toLocaleString("ko-KR")}</strong><span>{Number(week.views).toLocaleString("ko-KR")}회 조회</span></article>
      <article><small>최근 30일 방문자</small><strong>{Number(month.visitors).toLocaleString("ko-KR")}</strong><span>{Number(month.views).toLocaleString("ko-KR")}회 조회</span></article>
    </section>
    <section className="admin-grid analytics-grid">
      <article className="admin-panel"><div className="admin-panel-title"><div><small>최근 24시간</small><h2>시간별 방문</h2></div><span>막대에 올리면 방문자 표시</span></div><TrafficChart rows={hourly.results} label={(period)=>`${period.slice(11,13)}시`} empty="방문이 쌓이면 시간별 추이가 표시됩니다." /></article>
      <article className="admin-panel"><div className="admin-panel-title"><div><small>최근 30일</small><h2>일별 방문</h2></div><span>조회수 기준</span></div><TrafficChart rows={daily.results} label={(period)=>period.slice(5)} empty="방문이 쌓이면 일별 추이가 표시됩니다." /></article>
      <article className="admin-panel"><div className="admin-panel-title"><div><small>최근 12개월</small><h2>월별 방문</h2></div><span>조회수 기준</span></div><TrafficChart rows={monthly.results} label={(period)=>`${Number(period.slice(5))}월`} empty="방문이 쌓이면 월별 추이가 표시됩니다." /></article>
      <article className="admin-panel"><div className="admin-panel-title"><div><small>최근 30일</small><h2>인기 페이지</h2></div></div><div className="path-list">{paths.results.length ? paths.results.map((row, index) => <div key={row.path}><b>{index + 1}</b><span>{row.path === "/" ? "홈" : row.path}</span><em>{row.views}회 <small>· {row.visitors}명</small></em></div>) : <p className="admin-empty">아직 집계된 페이지가 없습니다.</p>}</div></article>
    </section>

    <section className="admin-management-grid">
      <article className="admin-panel" id="church-management"><div className="admin-panel-title"><div><small>CHURCH MANAGEMENT</small><h2>공개 교회 관리</h2><p>목사님의 확인·재검토 의견을 먼저 표시합니다. 의견을 확인한 뒤 공개 유지 또는 보류를 관리자가 최종 결정해 주세요. <a href="/review">목사님 페이지 ↗</a></p></div><span>{publicChurchRows.length}곳</span></div><AdminListSearch targetId="public-church-list" total={publicChurchRows.length} label="공개 교회 검색" placeholder="교회명, 목사님, 지역, 교단 검색" /><div className="admin-manage-list" id="public-church-list">{publicChurchRows.length ? publicChurchRows.map((church) => <article key={church.id} data-admin-search={`${church.name} ${church.pastor} ${church.region} ${church.denomination} ${reviewerLabel(church.reviewer_status)} ${church.reviewer_note??""}`}><div className="admin-record-heading"><div><strong>{church.name}</strong><small><b>{pastorLabel(church.pastor)}</b> · {church.region} · {church.denomination}</small></div><div className="admin-record-status"><span className={`reviewer-${church.reviewer_status}`}>{reviewerLabel(church.reviewer_status)}</span><span className={`priority-${church.priority_weight}`}>{church.priority_weight === 3 ? "♥ 매우 높음" : church.priority_weight === 2 ? "♥ 높음" : "기본"}</span><span className={`status-${church.review_status}`}>{statusLabel(church.review_status)}</span></div></div>{(opinionsByChurch.get(church.id)??[]).map((opinion,index)=><p className="admin-reviewer-note" key={`${opinion.reviewer_name}-${opinion.reviewed_at}-${index}`}>{opinion.reviewer_name} · {reviewerLabel(opinion.status)}{opinion.note?` · ${opinion.note}`:""}</p>)}{concernChurchIds.has(church.id)?<a className="admin-concern-route" href="#reviewer-queue">목사님 의견 처리에서 결정하기 ↑</a>:<ChurchControls id={church.id} name={church.name} pastor={church.pastor} region={church.region} denomination={church.denomination} status={church.review_status} holdReason={church.hold_reason} holdNote={church.hold_note} heldAt={church.held_at} priorityWeight={church.priority_weight} />}</article>) : <p className="admin-empty">공개 중인 교회가 없습니다.</p>}</div></article>
      <article className="admin-panel" id="church-hold"><div className="admin-panel-title"><div><small>CHURCH HOLD</small><h2>보류 교회</h2><p>보류 사유와 메모는 관리자에게만 표시됩니다.</p></div><span>{heldChurchRows.length}곳</span></div><AdminListSearch targetId="held-church-list" total={heldChurchRows.length} label="보류 교회 검색" placeholder="교회명, 목사님, 지역, 보류 메모 검색" /><div className="admin-manage-list" id="held-church-list">{heldChurchRows.length ? heldChurchRows.map((church) => <article key={church.id} data-admin-search={`${church.name} ${church.pastor} ${church.region} ${church.denomination} ${church.hold_reason ?? ""} ${church.hold_note ?? ""}`}><div className="admin-record-heading"><div><strong>{church.name}</strong><small><b>{pastorLabel(church.pastor)}</b> · {church.region} · {church.denomination}</small></div><span className={`status-${church.review_status}`}>{statusLabel(church.review_status)}</span></div><ChurchControls id={church.id} name={church.name} pastor={church.pastor} region={church.region} denomination={church.denomination} status={church.review_status} holdReason={church.hold_reason} holdNote={church.hold_note} heldAt={church.held_at} priorityWeight={church.priority_weight} /></article>) : <p className="admin-empty">보류된 교회가 없습니다.</p>}</div></article>
      <article className="admin-panel" id="sermon-management"><div className="admin-panel-title"><div><small>SERMON MANAGEMENT</small><h2>수집 영상 긴급 관리</h2></div><span>최근 {sermonRows.results.length}개</span></div><AdminListSearch targetId="sermon-list" total={sermonRows.results.length} label="수집 영상 검색" placeholder="영상 제목, 교회명, 영상 ID 검색" /><div className="admin-manage-list compact" id="sermon-list">{sermonRows.results.map((sermon) => <article key={sermon.id} data-admin-search={`${sermon.title} ${sermon.church} ${sermon.youtube_id} ${sermon.status}`}><div className="admin-record-heading"><div><strong>{sermon.title}</strong><small>{sermon.church} · {new Date(sermon.published_at).toLocaleDateString("ko-KR")}</small></div><a href={`https://www.youtube.com/watch?v=${sermon.youtube_id}`} target="_blank" rel="noreferrer">영상 ↗</a></div><SermonControls id={sermon.id} status={sermon.status} /></article>)}</div></article>
    </section>

    <section className="admin-review-grid">
      <article className="admin-panel" id="reviewer-accounts"><div className="admin-panel-title"><div><small>REVIEWER ACCOUNTS</small><h2>목회자 검토 참여 신청</h2><p>성함과 연락처를 확인한 뒤 교회 검토 참여를 승인해 주세요.</p></div><span>{reviewerRows.results.length}명</span></div><div className="review-list">{reviewerRows.results.length?reviewerRows.results.map((item)=><article key={item.id}><div><span>{statusLabel(item.status)}</span><time>{koreanTime(item.created_at)}</time></div><strong>{item.name} · {item.username}</strong><p>{item.contact}</p><ReviewerAccountControls id={item.id} status={item.status}/></article>):<p className="admin-empty">목회자 참여 신청이 없습니다.</p>}</div></article>
      <article className="admin-panel" id="church-recommendations"><div className="admin-panel-title"><div><small>CHURCH RECOMMENDATIONS</small><h2>교회 추천 검토</h2><p>교단 소속과 공식 채널을 직접 확인한 뒤 등록을 승인해 주세요.</p></div><span>{recommendationRows.results.length}건</span></div><div className="review-list">{recommendationRows.results.length?recommendationRows.results.map((item)=><article key={item.id}><div><span>{item.region} · {statusLabel(item.status)}</span><time>{koreanTime(item.created_at)}</time></div><strong>{item.church_name} · {item.pastor}</strong><p>{item.denomination}</p><p>{item.reason}</p>{item.youtube_url&&<a className="admin-review-link" href={item.youtube_url} target="_blank" rel="noreferrer">공식 YouTube 확인 ↗</a>}<ReviewControls kind="recommendation" id={item.id} status={item.status} /></article>):<p className="admin-empty">접수된 교회 추천이 없습니다.</p>}</div></article>
      <article className="admin-panel" id="pending-posts"><div className="admin-panel-title"><div><small>COMMUNITY REVIEW</small><h2>익명 글 관리</h2></div><span>{postRows.results.length}건</span></div><div className="review-list">{postRows.results.length ? postRows.results.map((post) => <article key={post.id}><div><span>{post.category} · {statusLabel(post.status)}</span><time>{koreanTime(post.created_at)}</time></div><strong>{post.nickname}</strong><p>{post.content}</p><ReviewControls kind="post" id={post.id} status={post.status} /></article>) : <p className="admin-empty">접수된 익명 글이 없습니다.</p>}</div></article>
      <article className="admin-panel" id="pending-talents"><div className="admin-panel-title"><div><small>TALENT REVIEW</small><h2>달란트 관리</h2></div><span>{talentRows.results.length}건</span></div><div className="review-list">{talentRows.results.length ? talentRows.results.map((talent) => <article key={talent.id}><div><span>{talent.region} · {statusLabel(talent.status)}</span><time>{koreanTime(talent.created_at)}</time></div><strong>{talent.title}</strong><p>{talent.description}</p><ReviewControls kind="talent" id={talent.id} status={talent.status} /></article>) : <p className="admin-empty">접수된 달란트가 없습니다.</p>}</div></article>
    </section>
    <p className="admin-privacy">현재 접속자는 1분마다 자동 갱신됩니다. IP 주소, 이름, 이메일은 방문 통계에 저장하지 않습니다. 동일 브라우저의 익명 식별값은 해시 처리하고 같은 페이지의 30분 이내 중복 조회는 제외합니다.</p>
  </main>;
}
