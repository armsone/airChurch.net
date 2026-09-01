import type {Metadata} from "next";
import {cache} from "react";
import HomeReloadLink from "../../../home-reload-link";
import SavedNavLink from "../../../saved-nav-link";
import SkipLink from "../../../skip-link";
import PastorEncouragementBoard from "../../../pastor-encouragement-board";
import PastorPrivateContactList from "../../../pastor-private-contact-list";
import type {EncouragementItem} from "../../../encouragement-board";
import {database,ensurePastorPeopleTables,ensurePrivateContactTables} from "../../../api/_shared";
import {accessSession} from "../../../admin-access";
import {readPastorPrivateContacts} from "../../../private-contact-vault";
import {safeHttpUrl} from "../../../safe-url";

export const dynamic="force-dynamic";
type Person={id:number;name:string;public_summary:string|null;updated_at:string};
type Role={id:number;church_id:number|null;church_name:string|null;denomination:string|null;region:string|null;role_title:string;role_status:string;start_date:string|null;end_date:string|null;source_url:string|null};
const getPerson=cache(async(id:number)=>{if(!Number.isInteger(id)||id<1)return null;const db=database();await ensurePastorPeopleTables(db);return db.prepare("SELECT id,name,public_summary,updated_at FROM pastor_people WHERE id=? AND review_status='approved' LIMIT 1").bind(id).first<Person>();});

export async function generateMetadata({params}:{params:Promise<{id:string}>}):Promise<Metadata>{const person=await getPerson(Number((await params).id));if(!person)return {title:"공개되지 않은 목회자 기록 | airChurch",robots:{index:false,follow:false}};return {title:`${person.name} 목회자 | airChurch`,description:`${person.name} 목회자의 공개 출처 기반 사역 이력과 응원글입니다.`,alternates:{canonical:`/pastors/p/${person.id}`}};}

export default async function PastorPersonPage({params}:{params:Promise<{id:string}>}){
  const person=await getPerson(Number((await params).id));
  if(!person)return <main className="church-detail-shell"><SkipLink/><section className="church-detail-missing" id="primary-content"><h1>현재 공개된 목회자 기록이 아닙니다</h1><a href="/pastors">목회자 찾기로 돌아가기 →</a></section></main>;
  const db=database(),session=await accessSession();const [roles,messages]=await Promise.all([
    db.prepare("SELECT id,church_id,church_name,denomination,region,role_title,role_status,start_date,end_date,source_url FROM pastor_church_roles WHERE pastor_id=? AND review_status='approved' ORDER BY CASE role_status WHEN 'current' THEN 0 ELSE 1 END,COALESCE(end_date,start_date,'') DESC,id DESC").bind(person.id).all<Role>(),
    db.prepare("SELECT id,nickname,content,created_at AS createdAt FROM pastor_encouragement_messages WHERE pastor_id=? AND status='approved' ORDER BY created_at DESC,id DESC LIMIT 30").bind(person.id).all<EncouragementItem>(),
  ]);
  let privateContacts:Awaited<ReturnType<typeof readPastorPrivateContacts>>=[];
  if(session){await ensurePrivateContactTables(db);privateContacts=await readPastorPrivateContacts(db,person.id,session);}
  const jsonLd={"@context":"https://schema.org","@type":"Person",name:person.name,url:`https://airchurch.net/pastors/p/${person.id}`};
  return <main className="church-detail-shell pastor-profile-shell"><SkipLink/><header className="church-detail-header"><HomeReloadLink className="brand"><span className="brand-mark" aria-hidden="true"/><span>airchurch</span></HomeReloadLink><nav><a href="/pastors">목회자 찾기</a><a href="/#church-directory">교회 찾기</a><SavedNavLink/><a href="/about">운영 안내</a></nav><a className="church-detail-back" href="/pastors">목록으로</a></header>
    <section className="pastor-profile-hero" id="primary-content" tabIndex={-1}><div><span>PASTOR STORY</span><p>공개 출처로 정리한 목회 여정</p><h1>{person.name}<small>목회자</small></h1>{person.public_summary&&<p>{person.public_summary}</p>}</div></section>
    <section className="pastor-profile-principle"><strong>목회자는 한 사람으로, 교회는 사역 이력으로</strong><p>현재와 이전의 사역 관계를 구분해 기록하며, 동명이인은 이름만으로 합치지 않습니다.</p><a href="/contact">정보 수정 요청</a></section>
    <section className="church-detail-content"><div className="section-heading"><div><span className="section-kicker">MINISTRY HISTORY</span><h2>교회와 사역 이력</h2></div><span className="result-count">{roles.results.length}건</span></div><div className="pastor-history-grid">{roles.results.length?roles.results.map((role)=>{const source=safeHttpUrl(role.source_url);return <article key={role.id}><span>{role.role_status==="current"?"현재 사역":"사역 이력"}</span><strong>{role.church_id?<a href={`/church/${role.church_id}`}>{role.church_name}</a>:role.church_name}</strong><p>{role.role_title}{role.region?` · ${role.region}`:""}{role.denomination?` · ${role.denomination}`:""}</p>{(role.start_date||role.end_date)&&<small>{role.start_date??"시작일 미상"} – {role.end_date??"현재"}</small>}{source&&<a href={source} target="_blank" rel="noopener noreferrer">공식 출처 ↗</a>}</article>}):<p className="empty">확인된 사역 이력을 정리하고 있습니다.</p>}</div></section>
    {session&&<PastorPrivateContactList items={privateContacts} viewer={session.role==="admin"?"관리자":"승인된 목회자"}/>}<PastorEncouragementBoard pastorId={person.id} title={`${person.name} 목사님 응원하기`} initialItems={messages.results}/><footer className="church-detail-footer"><a href="/pastors">목회자 찾기</a><span>공개 출처가 확인되는 정보부터 차분히 채웁니다.</span></footer><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(jsonLd).replace(/</g,"\\u003c")}}/>
  </main>;
}
