import { accessSession } from "../admin-access";
import AdminLogin from "../admin/admin-login";
import AdminListSearch from "../admin/admin-list-search";
import { ChurchReviewControls } from "../admin/admin-controls";
import HomeReloadLink from "../home-reload-link";
import { database, ensureReviewerTables, ensureSermonTables } from "../api/_shared";
import QuickReviewQueue from "./quick-review-queue";

export const dynamic="force-dynamic";

type ChurchReviewRow={id:number;name:string;pastor:string;region:string;denomination:string;youtube_channel_id:string|null;homepage_url:string|null;review_status:string;reviewer_status:string;reviewer_note:string|null;reviewed_at:string|null;handled_at:string|null};
function reviewLabel(status:string){return status==="confirmed"?"확인 완료":status==="concern"?"재검토 요청":"미검토";}

function ChurchCard({church}:{church:ChurchReviewRow}) {
  return <article data-admin-search={`${church.name} ${church.pastor} ${church.region} ${church.denomination} ${reviewLabel(church.reviewer_status)}`}><div className="reviewer-church-heading"><div><span>{church.region}</span><h3>{church.name}</h3><p>{church.pastor} · {church.denomination}</p></div><div><span className={`reviewer-status status-${church.reviewer_status}`}>{reviewLabel(church.reviewer_status)}</span>{church.review_status==="removed"&&<span className="reviewer-status status-removed">보류 중</span>}{church.youtube_channel_id&&<a href={`https://www.youtube.com/channel/${church.youtube_channel_id}`} target="_blank" rel="noreferrer">공식 채널 ↗</a>}</div></div>{church.reviewer_status==="concern"&&<p className={`review-process-status ${church.handled_at?"is-handled":""}`}>{church.handled_at?"관리자가 확인했어요":"관리자 확인을 기다리고 있어요"}</p>}<ChurchReviewControls id={church.id} status={church.reviewer_status} note={church.reviewer_note} reviewedAt={church.reviewed_at}/></article>;
}

export default async function ReviewPage() {
  const session=await accessSession();
  if(!session) return <AdminLogin />;
  const {role}=session;
  const db=database();await Promise.all([ensureSermonTables(db),ensureReviewerTables(db)]);
  const reviewerAccount=session.reviewerId>0?await db.prepare("SELECT name FROM reviewer_accounts WHERE id=? AND status='approved'").bind(session.reviewerId).first<{name:string}>():null;
  const reviewerName=role==="admin"?"관리자":reviewerAccount?.name??"교회 검토자";
  const selectReview="SELECT c.id,c.name,c.pastor,c.region,c.denomination,c.youtube_channel_id,c.homepage_url,c.review_status,COALESCE(r.status,'unreviewed') AS reviewer_status,r.note AS reviewer_note,r.reviewed_at,r.handled_at FROM churches c LEFT JOIN reviewer_church_reviews r ON r.church_id=c.id AND r.reviewer_id=?";
  const [todoRows,concernRows,doneRows,reviewCounts]=await Promise.all([
    db.prepare(`${selectReview} WHERE c.review_status='approved' AND COALESCE(r.status,'unreviewed')='unreviewed' ORDER BY c.name`).bind(session.reviewerId).all<ChurchReviewRow>(),
    db.prepare(`${selectReview} WHERE c.review_status IN ('approved','removed') AND r.status='concern' ORDER BY r.reviewed_at DESC LIMIT 400`).bind(session.reviewerId).all<ChurchReviewRow>(),
    db.prepare(`${selectReview} WHERE c.review_status IN ('approved','removed') AND r.status='confirmed' ORDER BY r.reviewed_at DESC LIMIT 400`).bind(session.reviewerId).all<ChurchReviewRow>(),
    db.prepare("SELECT SUM(CASE WHEN c.review_status='approved' AND COALESCE(r.status,'unreviewed')='unreviewed' THEN 1 ELSE 0 END) AS todo_count,SUM(CASE WHEN r.status='concern' THEN 1 ELSE 0 END) AS concern_count,SUM(CASE WHEN r.status='confirmed' THEN 1 ELSE 0 END) AS done_count FROM churches c LEFT JOIN reviewer_church_reviews r ON r.church_id=c.id AND r.reviewer_id=? WHERE c.review_status IN ('approved','removed')").bind(session.reviewerId).first<{todo_count:number;concern_count:number;done_count:number}>(),
  ]);
  const todo=todoRows.results,concerns=concernRows.results,done=doneRows.results;
  const todoTotal=Number(reviewCounts?.todo_count??todo.length),concernTotal=Number(reviewCounts?.concern_count??concerns.length),doneTotal=Number(reviewCounts?.done_count??done.length);
  return <main className="admin-shell reviewer-shell"><header className="admin-header"><HomeReloadLink className="brand"><span className="brand-mark" aria-hidden="true"/><span>airchurch</span></HomeReloadLink><div><span>{role==="admin"?"관리자 검토 모드":`${reviewerName}님`}</span>{role==="admin"&&<a href="/admin">전체 관리</a>}<form action="/api/admin/lock" method="post"><button type="submit">로그아웃</button></form></div></header>
    <section className="admin-title"><div><span>CHURCH REVIEW</span><h1>{reviewerName}님, 한 곳씩 확인해 주세요</h1><p>문제가 없으면 한 번만 누르면 됩니다. 확인이 필요한 경우에만 이유를 남겨 주세요.</p></div><HomeReloadLink>사이트 보기 ↗</HomeReloadLink></section>
    <section className="reviewer-metrics"><a href="#review-todo"><small>남은 검토</small><strong>{todoTotal}</strong><span>바로 시작 ↓</span></a><a className="concern" href="#review-concern"><small>관리자 확인 요청</small><strong>{concernTotal}</strong><span>처리 상태 보기 ↓</span></a><a href="#review-done"><small>문제 없음 확인</small><strong>{doneTotal}</strong><span>완료 내역 ↓</span></a></section>
    <div id="review-todo"><QuickReviewQueue key={`${todo[0]?.id??0}-${todo.length}-${todoTotal}`} todo={todo} total={todoTotal}/></div>
    <section className="admin-panel reviewer-panel reviewer-history"><div className="admin-panel-title"><div><small>MY REVIEW HISTORY</small><h2>내가 보낸 의견</h2><p>관리자 확인 요청의 처리 상태와 완료한 검토를 다시 볼 수 있습니다.</p></div><span>{concernTotal+doneTotal}곳</span></div><AdminListSearch targetId="reviewer-history-lists" total={concerns.length+done.length} label="내 검토 내역 검색" placeholder="교회명, 목사님, 지역, 교단 검색"/>
      <div id="reviewer-history-lists">
        <section className="review-section" id="review-concern"><div className="review-section-title"><div><small>보낸 의견</small><h2>재검토 요청한 교회</h2></div><strong>{concernTotal}곳</strong></div><div className="reviewer-church-list">{concerns.length?concerns.map((church)=><ChurchCard church={church} key={church.id}/>):<p className="admin-empty">보낸 재검토 요청이 없습니다.</p>}</div></section>
        <details className="review-section review-done" id="review-done"><summary><span><small>완료한 일</small><b>확인이 끝난 교회</b></span><strong>{doneTotal}곳 · 펼쳐 보기</strong></summary><div className="reviewer-church-list">{done.length?done.map((church)=><ChurchCard church={church} key={church.id}/>):<p className="admin-empty">아직 확인한 교회가 없습니다.</p>}</div></details>
      </div>
    </section>
  </main>;
}
