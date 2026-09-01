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
  return <main className="admin-shell"><header className="admin-header"><a className="brand" href="/admin"><span className="brand-mark" aria-hidden="true"/><span>airchurch</span></a><div><span>목회자 사진 검토</span><a href="/admin">관리자로 돌아가기</a></div></header><section className="admin-panel"><div className="admin-panel-title"><div><small>PASTOR PHOTOS</small><h1>공식 사진 별도 승인</h1><p>공식 페이지에 있다는 사실만으로 재게시하지 않습니다. 사용 허락·오픈 라이선스·직접 보유 중 하나가 확인된 사진만 승인합니다.</p></div><span>대기 {Number(count?.count??0).toLocaleString("ko-KR")}건 · 100건 표시</span></div><div className="review-list">{rows.results.length?rows.results.map((item)=>{const photo=safeHttpUrl(item.photo_url),source=safeHttpUrl(item.photo_source_url);return <article key={item.id}>{photo&&<img src={photo} alt={`${item.name} 목회자 사진 검토`} width={96} height={116} loading="lazy" decoding="async" referrerPolicy="no-referrer"/>}<div><span>{item.photo_sha256?`파일 해시 ${item.photo_sha256.slice(0,12)}…`:"파일 해시 확인 중"}</span><time>{time(item.updated_at)}</time></div><strong>{item.name}</strong>{source&&<a className="admin-review-link" href={source} target="_blank" rel="noreferrer">공식 이름표·출처 확인 ↗</a>}<PastorPhotoControls id={item.id}/></article>}):<p className="admin-empty">검토 대기 중인 공식 사진이 없습니다.</p>}</div></section></main>;
}
