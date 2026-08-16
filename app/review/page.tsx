import { accessRole } from "../admin-access";
import AdminLogin from "../admin/admin-login";
import AdminListSearch from "../admin/admin-list-search";
import { ChurchReviewControls } from "../admin/admin-controls";
import HomeReloadLink from "../home-reload-link";
import { database, ensureSermonTables } from "../api/_shared";

export const dynamic="force-dynamic";

type ChurchReviewRow={id:number;name:string;pastor:string;region:string;denomination:string;youtube_channel_id:string|null;review_status:string;reviewer_status:string;reviewer_note:string|null;reviewed_at:string|null};
function reviewLabel(status:string){return status==="confirmed"?"확인 완료":status==="concern"?"재검토 요청":"미검토";}

export default async function ReviewPage() {
  const role=await accessRole();
  if(!role) return <AdminLogin />;
  const db=database();await ensureSermonTables(db);
  const result=await db.prepare("SELECT id,name,pastor,region,denomination,youtube_channel_id,review_status,reviewer_status,reviewer_note,reviewed_at FROM churches WHERE review_status IN ('approved','removed') ORDER BY CASE reviewer_status WHEN 'concern' THEN 0 WHEN 'unreviewed' THEN 1 ELSE 2 END,name LIMIT 400").all<ChurchReviewRow>();
  const unreviewed=result.results.filter((item)=>item.reviewer_status==="unreviewed").length,confirmed=result.results.filter((item)=>item.reviewer_status==="confirmed").length,concerns=result.results.filter((item)=>item.reviewer_status==="concern").length;
  return <main className="admin-shell reviewer-shell"><header className="admin-header"><HomeReloadLink className="brand"><span className="brand-mark" aria-hidden="true"/><span>airchurch</span></HomeReloadLink><div><span>{role==="admin"?"관리자 검토 모드":"교회 검토자"}</span>{role==="admin"&&<a href="/admin">전체 관리</a>}<form action="/api/admin/lock" method="post"><button type="submit">로그아웃</button></form></div></header>
    <section className="admin-title"><div><span>CHURCH REVIEW</span><h1>교회 목록 검토</h1><p>복잡한 운영 기능 없이 교회 정보만 확인하고 결과를 남길 수 있습니다.</p></div><HomeReloadLink>사이트 보기 ↗</HomeReloadLink></section>
    <section className="reviewer-metrics"><article><small>미검토</small><strong>{unreviewed}</strong></article><article><small>확인 완료</small><strong>{confirmed}</strong></article><article className="concern"><small>관리자 재검토</small><strong>{concerns}</strong></article></section>
    <section className="admin-panel reviewer-panel"><div className="admin-panel-title"><div><small>REGISTERED CHURCHES</small><h2>등록 교회 {result.results.length}곳</h2><p>교회명, 담임목사, 지역, 교단과 공식 채널을 확인해 주세요.</p></div></div><AdminListSearch targetId="reviewer-church-list" total={result.results.length} label="검토 교회 검색" placeholder="교회명, 목사님, 지역, 교단 검색"/><div className="reviewer-church-list" id="reviewer-church-list">{result.results.map((church)=><article key={church.id} data-admin-search={`${church.name} ${church.pastor} ${church.region} ${church.denomination} ${reviewLabel(church.reviewer_status)}`}><div className="reviewer-church-heading"><div><span>{church.region}</span><h3>{church.name}</h3><p>{church.pastor} · {church.denomination}</p></div><div><span className={`reviewer-status status-${church.reviewer_status}`}>{reviewLabel(church.reviewer_status)}</span>{church.youtube_channel_id&&<a href={`https://www.youtube.com/channel/${church.youtube_channel_id}`} target="_blank" rel="noreferrer">공식 채널 ↗</a>}</div></div><ChurchReviewControls id={church.id} status={church.reviewer_status} note={church.reviewer_note} reviewedAt={church.reviewed_at}/></article>)}</div></section>
  </main>;
}
