import type {Metadata} from "next";
import {cache} from "react";
import HomeReloadLink from "../../../home-reload-link";
import SkipLink from "../../../skip-link";
import PastorEncouragementBoard from "../../../pastor-encouragement-board";
import PastorPrivateContactList from "../../../pastor-private-contact-list";
import PastorSaveButton from "../../../pastor-save-button";
import DailyMediaLink from "../../../daily-media-link";
import type {EncouragementItem} from "../../../encouragement-board";
import {database,ensurePastorPeopleTables,ensurePrivateContactTables,ensureSermonTables} from "../../../api/_shared";
import {accessSession} from "../../../admin-access";
import {readPastorPrivateContacts} from "../../../private-contact-vault";
import {safeHttpUrl} from "../../../safe-url";
import {isSermonAttributedTo} from "../../../pastor-sermon-attribution";
import EncouragementJumpLink from "../../../encouragement-jump-link";
import {displayRoleTitle} from "../../../pastor-name";
import {ChurchCardContent} from "../../../directory-cards";
import AdminSearchCard from "../../../search/admin-search-card";
import {ChurchControls} from "../../../admin/admin-controls";

export const dynamic="force-dynamic";
type Person={id:number;public_id:number;name:string;public_summary:string|null;photo_url:string|null;photo_source_url:string|null;updated_at:string;role_title:string|null};
type Role={id:number;church_id:number|null;church_name:string|null;denomination:string|null;region:string|null;role_title:string;role_category:string;role_status:string;start_date:string|null;end_date:string|null;source_url:string|null;church_pastor:string|null;church_priority_weight:number|null};
type PersonSermon={youtube_id:string;title:string;published_at:string;church_id:number;church_name:string};
const getPerson=cache(async(publicId:number)=>{if(!Number.isInteger(publicId)||publicId<0)return null;const db=database();await ensurePastorPeopleTables(db);return db.prepare("SELECT p.id,COALESCE(p.public_id,1000000+p.id) AS public_id,p.name,p.public_summary,CASE WHEN p.photo_review_status='approved' AND p.photo_usage_basis IN ('permission','open_license','owned','official_public_clergy_profile') THEN p.photo_url END AS photo_url,CASE WHEN p.photo_review_status='approved' AND p.photo_usage_basis IN ('permission','open_license','owned','official_public_clergy_profile') THEN p.photo_source_url END AS photo_source_url,p.updated_at,(SELECT r.role_title FROM pastor_church_roles r WHERE r.pastor_id=p.id AND r.review_status='approved' ORDER BY CASE WHEN r.role_title='목회자' OR r.role_title LIKE '%목사' THEN 0 ELSE 1 END,CASE r.role_status WHEN 'current' THEN 0 ELSE 1 END,r.id DESC LIMIT 1) AS role_title FROM pastor_people p WHERE COALESCE(p.public_id,1000000+p.id)=? AND p.review_status='approved' LIMIT 1").bind(publicId).first<Person>();});

export async function generateMetadata({params}:{params:Promise<{id:string}>}):Promise<Metadata>{
  const person=await getPerson(Number((await params).id));
  if(!person)return {title:"공개되지 않은 목회자 기록 | airChurch",robots:{index:false,follow:false}};
  const roleTitle=displayRoleTitle(person.role_title??"목회자"),title=`${person.name} ${roleTitle} | airChurch`,description=`${person.name} ${roleTitle}의 공개 출처 기반 사역 이력과 응원글입니다.`,images=safeHttpUrl(person.photo_url)?[`/api/pastor-photo/${person.public_id}`]:[];
  return {title,description,alternates:{canonical:`/pastors/${person.public_id}`},openGraph:{title,description,url:`/pastors/${person.public_id}`,type:"website",images},twitter:{card:"summary",title,description,images}};
}

export default async function PastorPersonPage({params}:{params:Promise<{id:string}>}){
  const person=await getPerson(Number((await params).id));
  if(!person)return <main className="church-detail-shell"><SkipLink/><section className="church-detail-missing" id="primary-content"><h1>현재 공개된 목회자 기록이 아닙니다</h1><a href="/#pastor-directory">목회자 찾기로 돌아가기 →</a></section></main>;
  const db=database(),session=await accessSession();const [roles,messages]=await Promise.all([
    db.prepare("WITH RECURSIVE linked(id) AS (SELECT ? UNION SELECT CASE WHEN i.left_pastor_id=linked.id THEN i.right_pastor_id ELSE i.left_pastor_id END FROM pastor_identity_candidates i JOIN linked ON (i.left_pastor_id=linked.id OR i.right_pastor_id=linked.id) WHERE i.status='confirmed_same') SELECT r.id,r.church_id,r.church_name,r.denomination,r.region,r.role_title,r.role_category,r.role_status,r.start_date,r.end_date,r.source_url,c.pastor AS church_pastor,c.priority_weight AS church_priority_weight FROM pastor_church_roles r LEFT JOIN churches c ON c.id=r.church_id WHERE r.pastor_id IN (SELECT id FROM linked) AND r.review_status='approved' ORDER BY CASE r.role_status WHEN 'current' THEN 0 ELSE 1 END,COALESCE(r.end_date,r.start_date,'') DESC,r.id DESC").bind(person.id).all<Role>(),
    db.prepare("SELECT id,nickname,content,created_at AS createdAt FROM pastor_encouragement_messages WHERE pastor_id=? AND status='approved' ORDER BY created_at DESC,id DESC LIMIT 30").bind(person.id).all<EncouragementItem>(),
  ]);
  let privateContacts:Awaited<ReturnType<typeof readPastorPrivateContacts>>=[];
  if(session){await ensurePrivateContactTables(db);privateContacts=await readPastorPrivateContacts(db,person.id,session);}
  const isAdmin=session?.role==="admin";
  const primaryRole=roles.results.find((role)=>role.role_status==="current"&&(role.role_title==="목회자"||role.role_title.endsWith("목사")))??roles.results.find((role)=>role.role_title==="목회자"||role.role_title.endsWith("목사"))??roles.results.find((role)=>role.role_status==="current")??roles.results[0];
  const photo=safeHttpUrl(person.photo_url),photoSource=safeHttpUrl(person.photo_source_url);
  const churchIds=[...new Set(roles.results.flatMap((role)=>role.church_id?[role.church_id]:[]))],primaryChurchIds=new Set(roles.results.filter((role)=>role.church_id&&role.role_status==="current"&&role.role_category==="current_primary").map((role)=>role.church_id));
  let attributedSermons:PersonSermon[]=[];
  if(churchIds.length){
    await ensureSermonTables(db);
    const placeholders=churchIds.map(()=>"?").join(","),primaryIds=[...primaryChurchIds],primaryPlaceholders=primaryIds.map(()=>"?").join(","),attributionWhere=primaryIds.length?`(replace(s.title,' ','') LIKE ? OR s.church_id IN (${primaryPlaceholders}))`:`replace(s.title,' ','') LIKE ?`;
    const sermons=await db.prepare(`SELECT s.youtube_id,s.title,s.published_at,s.church_id,c.name AS church_name FROM sermons s JOIN churches c ON c.id=s.church_id WHERE s.status='published' AND c.review_status='approved' AND s.church_id IN (${placeholders}) AND ${attributionWhere} ORDER BY s.published_at DESC,s.id DESC LIMIT 400`).bind(...churchIds,`%${person.name.replace(/\s+/g,"")}%`,...primaryIds).all<PersonSermon>();
    attributedSermons=sermons.results.filter((sermon)=>isSermonAttributedTo(sermon.title,person.name,primaryChurchIds.has(sermon.church_id))).slice(0,20);
  }
  const jsonLd={"@context":"https://schema.org","@type":"Person",name:person.name,url:`https://airchurch.net/pastors/${person.public_id}`};
  return <main className="church-detail-shell pastor-profile-shell"><SkipLink/><header className="church-detail-header"><HomeReloadLink className="brand"><span className="brand-mark" aria-hidden="true"/><span>airchurch</span></HomeReloadLink></header>
    <section className={`pastor-profile-hero${photo?" has-photo":""}`} id="primary-content" tabIndex={-1}><div className="pastor-profile-identity">{photo&&<figure className={photo.includes("main_visual_")?"is-wide-source":undefined}><img src={`/api/pastor-photo/${person.public_id}`} alt={`${person.name} 목회자 공식 사진`} width={180} height={220} loading="eager" decoding="async"/>{photoSource&&<figcaption><a href={photoSource} target="_blank" rel="noopener noreferrer">공식 사진 출처 ↗</a></figcaption>}</figure>}<div><span>PASTOR STORY</span><p>공개 출처로 정리한 목회 여정</p><h1>{person.name}<small>{displayRoleTitle(primaryRole?.role_title??"목사")}</small></h1>{person.public_summary&&<p>{person.public_summary}</p>}</div></div><div className="pastor-profile-actions"><PastorSaveButton personId={person.id} publicId={person.public_id} name={person.name} roleTitle={displayRoleTitle(primaryRole?.role_title??"목사")} churchName={primaryRole?.church_name}/><EncouragementJumpLink/></div></section>
    <section className="pastor-profile-principle"><strong>목회자는 한 사람으로, 교회는 사역 이력으로</strong><p>현재와 이전의 사역 관계를 구분해 기록하며, 동명이인은 이름만으로 합치지 않습니다.</p><a href="/contact">정보 수정 요청</a></section>
    <section className="church-detail-content"><div className="section-heading"><div><span className="section-kicker">MINISTRY HISTORY</span><h2>교회와 사역 이력</h2></div><span className="result-count">{roles.results.length}건</span></div><div className="pastor-history-grid">{roles.results.length?roles.results.map((role)=>{const source=safeHttpUrl(role.source_url),manageable=Boolean(isAdmin&&role.church_id&&role.church_pastor);return <AdminSearchCard admin={manageable} linksOnly href={role.church_id?`/church/${role.church_id}`:"#"} label={role.church_name??"소속 교회"} className="shared-church-card" key={role.id} controls={manageable&&role.church_id&&role.church_pastor?<ChurchControls id={role.church_id} name={role.church_name??"소속 교회 확인 중"} pastor={role.church_pastor} region={role.region??"지역 확인 중"} denomination={role.denomination??"교단 확인 중"} status="approved" holdReason={null} holdNote={null} heldAt={null} priorityWeight={role.church_priority_weight??1}/>:undefined}><ChurchCardContent id={role.church_id} name={role.church_name??"소속 교회 확인 중"} pastor={`${person.name} · ${role.role_title}`} pastorHref={`/pastors/${person.public_id}`} region={role.region??(role.role_status==="current"?"현재 사역":"사역 이력")} denomination={role.denomination??"교단 확인 중"} detail={<>{(role.start_date||role.end_date)&&<small>{role.start_date??"시작일 미상"} – {role.end_date??"현재"}</small>}{source&&<a className="pastor-source-link" href={source} target="_blank" rel="noopener noreferrer">공식 출처 확인 ↗</a>}</>}/></AdminSearchCard>}):<p className="empty">확인된 사역 이력을 정리하고 있습니다.</p>}</div></section>
    {attributedSermons.length>0&&<section className="church-detail-content"><div className="section-heading"><div><span className="section-kicker">SERMONS</span><h2>{person.name} 목회자의 말씀</h2></div><span className="result-count">최근 {attributedSermons.length}편</span></div><div className="church-detail-video-grid">{attributedSermons.map((sermon)=><DailyMediaLink className="church-detail-video" href={`https://www.youtube.com/watch?v=${sermon.youtube_id}`} step="sermon" key={sermon.youtube_id}><img src={`https://i.ytimg.com/vi/${sermon.youtube_id}/mqdefault.jpg`} alt="" width={320} height={180} loading="lazy" decoding="async" referrerPolicy="no-referrer"/><span><small>{sermon.church_name} · {new Date(sermon.published_at).toLocaleDateString("ko-KR",{timeZone:"Asia/Seoul"})}</small><strong>{sermon.title}</strong><em>YouTube에서 보기 ↗</em></span></DailyMediaLink>)}</div></section>}
    {session&&<PastorPrivateContactList items={privateContacts} viewer={session.role==="admin"?"관리자":"승인된 목회자"}/>}<PastorEncouragementBoard pastorId={person.id} title={`${person.name} ${displayRoleTitle(primaryRole?.role_title??"목사")}님 응원하기`} initialItems={messages.results}/><footer className="church-detail-footer"><a href="/#pastor-directory">목회자 찾기</a><span>공개 출처가 확인되는 정보부터 차분히 채웁니다.</span></footer><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(jsonLd).replace(/</g,"\\u003c")}}/>
  </main>;
}
