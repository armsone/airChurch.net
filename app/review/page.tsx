import { accessSession } from "../admin-access";
import AdminLogin from "../admin/admin-login";
import AdminListSearch from "../admin/admin-list-search";
import { ChurchReviewControls } from "../admin/admin-controls";
import HomeReloadLink from "../home-reload-link";
import { database, ensureReviewerTables, ensureSermonTables } from "../api/_shared";

export const dynamic="force-dynamic";

type ChurchReviewRow={id:number;name:string;pastor:string;region:string;denomination:string;youtube_channel_id:string|null;review_status:string;reviewer_status:string;reviewer_note:string|null;reviewed_at:string|null;handled_at:string|null};
function reviewLabel(status:string){return status==="confirmed"?"확인 완료":status==="concern"?"재검토 요청":"미검토";}

function ChurchCard({church}:{church:ChurchReviewRow}) {
  return <article data-admin-search={`${church.name} ${church.pastor} ${church.region} ${church.denomination} ${reviewLabel(church.reviewer_status)}`}><div className="reviewer-church-heading"><div><span>{church.region}</span><h3>{church.name}</h3><p>{church.pastor} · {church.denomination}</p></div><div><span className={`reviewer-status status-${church.reviewer_status}`}>{reviewLabel(church.reviewer_status)}</span>{church.review_status==="removed"&&<span className="reviewer-status status-removed">보류 중</span>}{church.youtube_channel_id&&<a href={`https://www.youtube.com/channel/${church.youtube_channel_id}`} target="_blank" rel="noreferrer">공식 채널 ↗</a>}</div></div>{church.reviewer_status==="concern"&&<p className={`review-process-status ${church.handled_at?"is-handled":""}`}>{church.handled_at?"관리자가 확인했어요":"관리자 확인을 기다리고 있어요"}</p>}<ChurchReviewControls id={church.id} status={church.reviewer_status} note={church.reviewer_note} reviewedAt={church.reviewed_at}/></article>;
}

export default async function ReviewPage() {
  const session=await accessSession();
  if(!session) return <AdminLogin />;
  const {role}=session;
  const db=database();await Promise.all([ensureSermonTables(db),ensureReviewerTables(db)]);
  const result=await db.prepare("SELECT c.id,c.name,c.pastor,c.region,c.denomination,c.youtube_channel_id,c.review_status,COALESCE(r.status,'unreviewed') AS reviewer_status,r.note AS reviewer_note,r.reviewed_at,r.handled_at FROM churches c LEFT JOIN reviewer_church_reviews r ON r.church_id=c.id AND r.reviewer_id=? WHERE c.review_status IN ('approved','removed') ORDER BY CASE COALESCE(r.status,'unreviewed') WHEN 'unreviewed' THEN 0 WHEN 'concern' THEN 1 ELSE 2 END,c.name LIMIT 400").bind(session.reviewerId).all<ChurchReviewRow>();
  const todo=result.results.filter((item)=>item.reviewer_status==="unreviewed"),concerns=result.results.filter((item)=>item.reviewer_status==="concern"),done=result.results.filter((item)=>item.reviewer_status==="confirmed");
  return <main className="admin-shell reviewer-shell"><header className="admin-header"><HomeReloadLink className="brand"><span className="brand-mark" aria-hidden="true"/><span>airchurch</span></HomeReloadLink><div><span>{role==="admin"?"관리자 검토 모드":"교회 검토자"}</span>{role==="admin"&&<a href="/admin">전체 관리</a>}<form action="/api/admin/lock" method="post"><button type="submit">로그아웃</button></form></div></header>
    <section className="admin-title"><div><span>CHURCH REVIEW</span><h1>교회 목록 검토</h1><p>아직 검토하지 않은 교회부터 확인해 주세요. 의견을 저장하면 관리자가 바로 확인합니다.</p></div><HomeReloadLink>사이트 보기 ↗</HomeReloadLink></section>
    <section className="reviewer-metrics"><a href="#review-todo"><small>아직 검토 안 함</small><strong>{todo.length}</strong><span>여기부터 시작 ↓</span></a><a className="concern" href="#review-concern"><small>재검토 요청함</small><strong>{concerns.length}</strong><span>처리 상태 보기 ↓</span></a><a href="#review-done"><small>확인 끝남</small><strong>{done.length}</strong><span>다시 보기 ↓</span></a></section>
    <section className="admin-panel reviewer-panel"><div className="admin-panel-title"><div><small>REGISTERED CHURCHES</small><h2>등록 교회 {result.results.length}곳</h2><p>교회명, 담임목사, 지역, 교단과 공식 채널을 확인해 주세요.</p></div></div><AdminListSearch targetId="reviewer-church-lists" total={result.results.length} label="검토 교회 검색" placeholder="교회명, 목사님, 지역, 교단 검색"/>
      <div id="reviewer-church-lists">
        <section className="review-section" id="review-todo"><div className="review-section-title"><div><small>먼저 할 일</small><h2>아직 검토하지 않은 교회</h2></div><strong>{todo.length}곳</strong></div><div className="reviewer-church-list">{todo.length?todo.map((church)=><ChurchCard church={church} key={church.id}/>):<p className="admin-empty">검토할 교회가 없습니다.</p>}</div></section>
        <section className="review-section" id="review-concern"><div className="review-section-title"><div><small>보낸 의견</small><h2>재검토 요청한 교회</h2></div><strong>{concerns.length}곳</strong></div><div className="reviewer-church-list">{concerns.length?concerns.map((church)=><ChurchCard church={church} key={church.id}/>):<p className="admin-empty">보낸 재검토 요청이 없습니다.</p>}</div></section>
        <details className="review-section review-done" id="review-done"><summary><span><small>완료한 일</small><b>확인이 끝난 교회</b></span><strong>{done.length}곳 · 펼쳐 보기</strong></summary><div className="reviewer-church-list">{done.length?done.map((church)=><ChurchCard church={church} key={church.id}/>):<p className="admin-empty">아직 확인한 교회가 없습니다.</p>}</div></details>
      </div>
    </section>
  </main>;
}
