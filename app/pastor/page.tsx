import type { Metadata } from "next";
import { accessSession } from "../admin-access";
import AdminLogin from "../admin/admin-login";
import HomeReloadLink from "../home-reload-link";
import { database, ensureReviewerTables, ensureSermonTables } from "../api/_shared";
import ChurchRequestManager from "./church-request-manager";

export const dynamic="force-dynamic";
export const metadata:Metadata={title:"목회자 검토 | airChurch",robots:{index:false,follow:false}};

type Church={id:number;name:string;pastor:string;region:string;denomination:string;review_status:string;homepage_url:string|null;youtube_channel_id:string|null;channel_image_url:string|null;hold_reason:string|null;hold_note:string|null;held_at:string|null;priority_weight:number};
type RequestItem={id:number;church_name:string;request_type:string;reason:string;status:string;admin_note:string|null;created_at:string;proposed_name:string|null;proposed_pastor:string|null;proposed_region:string|null;proposed_denomination:string|null};

export default async function PastorPage() {
  const session=await accessSession();
  if(!session)return <AdminLogin context="reviewer"/>;
  const db=database();await Promise.all([ensureSermonTables(db),ensureReviewerTables(db)]);
  const reviewerAccount=session.reviewerId>0?await db.prepare("SELECT name FROM reviewer_accounts WHERE id=? AND status='approved'").bind(session.reviewerId).first<{name:string}>():null;
  const reviewerName=session.role==="admin"?"관리자":reviewerAccount?.name??"목사님";
  const [churchRows,featuredRows,requestRows]=await Promise.all([
    db.prepare("SELECT id,name,pastor,region,denomination,review_status,homepage_url,youtube_channel_id,channel_image_url,hold_reason,hold_note,held_at,priority_weight FROM churches WHERE review_status IN ('approved','removed') ORDER BY name LIMIT 2000").all<Church>(),
    db.prepare("SELECT id,name,pastor,region,denomination,review_status,homepage_url,youtube_channel_id,channel_image_url,hold_reason,hold_note,held_at,priority_weight FROM churches WHERE review_status IN ('approved','removed') ORDER BY RANDOM() LIMIT 20").all<Church>(),
    db.prepare("SELECT r.id,c.name AS church_name,r.request_type,r.reason,r.status,r.admin_note,r.created_at,r.proposed_name,r.proposed_pastor,r.proposed_region,r.proposed_denomination FROM church_change_requests r JOIN churches c ON c.id=r.church_id WHERE r.reviewer_id=? ORDER BY r.created_at DESC LIMIT 500").bind(session.reviewerId).all<RequestItem>(),
  ]);
  return <main className="admin-shell reviewer-shell"><header className="admin-header"><HomeReloadLink className="brand"><span className="brand-mark" aria-hidden="true"/><span>airchurch</span></HomeReloadLink><div><span>{reviewerName}님</span>{session.role==="admin"&&<a href="/admin">전체 관리</a>}<form action="/api/admin/lock" method="post"><button type="submit">로그아웃</button></form></div></header><section className="admin-title"><div><span>교회 정보 제안</span><h1>수정은 하나씩, 보류는 한 번에</h1><p>교회 카드에서 내용 수정하기 또는 보류로 보내기만 선택하면 됩니다.</p></div><HomeReloadLink>에어처치 보기 ↗</HomeReloadLink></section><ChurchRequestManager churches={churchRows.results} featuredChurches={featuredRows.results} requests={requestRows.results}/></main>;
}
