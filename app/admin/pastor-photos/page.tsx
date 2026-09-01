import type {Metadata} from "next";
import {hasAdminAccess} from "../../admin-access";
import {database,ensureAdminTables} from "../../api/_shared";
import {safeHttpUrl} from "../../safe-url";
import AdminLogin from "../admin-login";
import {PastorPhotoControls} from "../admin-controls";

export const dynamic="force-dynamic";
export const metadata:Metadata={title:"목회자 사진 검토 | airChurch",robots:{index:false,follow:false}};
type PhotoRow={id:number;name:string;photo_url:string;photo_source_url:string;photo_sha256:string|null;photo_review_status:string;updated_at:string};
const time=(value:string)=>new Date(`${value}Z`).toLocaleString("ko-KR",{timeZone:"Asia/Seoul"});

export default async function PastorPhotoReviewPage(){
  if(!await hasAdminAccess())return <AdminLogin/>;
  const db=database();await ensureAdminTables(db);
  const [count,rows]=await Promise.all([
    db.prepare("SELECT COUNT(*) AS count FROM pastor_people WHERE photo_review_status='pending' AND photo_url IS NOT NULL AND photo_url<>'' AND photo_source_url IS NOT NULL AND photo_source_url<>''").first<{count:number}>(),
    db.prepare("SELECT id,name,photo_url,photo_source_url,photo_sha256,photo_review_status,updated_at FROM pastor_people WHERE photo_review_status='pending' AND photo_url IS NOT NULL AND photo_url<>'' AND photo_source_url IS NOT NULL AND photo_source_url<>'' ORDER BY updated_at,id LIMIT 100").all<PhotoRow>(),
  ]);
  return <main className="admin-shell admin-subpage">
    <header className="admin-header"><a className="brand" href="/admin"><span className="brand-mark" aria-hidden="true"/><span>airchurch</span></a><div className="admin-utility-nav"><span>관리자 · 사진 검토</span><a href="/admin">업무 대시보드</a><a href="/admin/pastor-identities">동일인 검토</a></div></header>
    <section className="admin-title"><div><span>PASTOR PHOTOS</span><h1>공식 목회자 사진 확인</h1><p>사진과 공식 출처의 이름·소속을 비교한 뒤 공개 여부만 결정하세요. 사적 사진이나 제3자가 함께 나온 사진은 공개하지 않습니다.</p></div><a href="/admin">대시보드로 돌아가기</a></section>
    <nav className="admin-subpage-flow" aria-label="목회자 검토 순서"><a href="/admin#pastor-review"><b>1</b> 인물·사역 검토</a><a className="is-current" href="/admin/pastor-photos" aria-current="page"><b>2</b> 사진 검토</a><a href="/admin/pastor-identities"><b>3</b> 동일인 검토</a></nav>
    <section className="admin-panel"><div className="admin-panel-title"><div><small>REVIEW QUEUE</small><h2>사진 검토 대기</h2><p>위에서 아래 순서로 처리합니다. 결정하면 다음 후보가 같은 자리에 이어집니다.</p></div><span>남은 {Number(count?.count??0).toLocaleString("ko-KR")}건 · 현재 100건</span></div><div className="review-list admin-photo-review-grid">{rows.results.length?rows.results.map((item,index)=>{const photo=safeHttpUrl(item.photo_url),source=safeHttpUrl(item.photo_source_url);return <article key={item.id}><div className="admin-review-card-heading"><span>대기 {index+1}</span><time>{time(item.updated_at)}</time></div><strong>{item.name}</strong>{photo&&<img src={photo} alt={`${item.name} 목회자 사진 검토`} width={96} height={116} loading="lazy" decoding="async" referrerPolicy="no-referrer"/>}{source?<a className="admin-review-link is-primary" href={source} target="_blank" rel="noreferrer">공식 페이지에서 이름·소속 확인 ↗</a>:<span className="admin-reference-missing">공식 출처 링크 없음 · 공개하지 마세요</span>}<PastorPhotoControls id={item.id}/></article>}):<div className="admin-queue-complete"><strong>사진 검토를 모두 처리했습니다</strong><a href="/admin/pastor-identities">동일인 검토로 이동 →</a></div>}</div></section>
  </main>;
}
