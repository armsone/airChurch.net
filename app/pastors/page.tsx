import type {Metadata} from "next";
import HomeReloadLink from "../home-reload-link";
import SavedNavLink from "../saved-nav-link";
import SkipLink from "../skip-link";
import {database,ensureMinistryProfileTables,ensurePastorPeopleTables} from "../api/_shared";

export const dynamic="force-dynamic";
export const metadata:Metadata={title:"목회자 찾기 | airChurch",description:"담임·부교역자·협동·원로·은퇴 목회자를 교회와 함께 찾고 응원합니다."};

type PastorRow={person_id:number|null;church_id:number|null;minister_id:number|null;name:string;role_title:string;role_status:string;church_name:string|null;region:string|null;denomination:string|null;total_count:number};

const clean=(value:string)=>value.normalize("NFKC").replace(/\s+/g,"").toLocaleLowerCase("ko-KR");

export default async function PastorsPage({searchParams}:{searchParams:Promise<{q?:string;page?:string}>}){
  const params=await searchParams,query=params.q?.trim().slice(0,80)??"",requestedPage=Number(params.page),page=Number.isInteger(requestedPage)&&requestedPage>0?Math.min(requestedPage,1000):1,pageSize=60,offset=(page-1)*pageSize,normalized=query.replace(/\s+/g,""),term=`%${normalized}%`,db=database();
  await Promise.all([ensureMinistryProfileTables(db),ensurePastorPeopleTables(db)]);
  const rows=await db.prepare(`
    WITH people AS (
      SELECT p.id AS person_id,r.church_id,NULL AS minister_id,p.name,r.role_title,r.role_status,r.church_name,r.region,r.denomination
      FROM pastor_people p LEFT JOIN pastor_church_roles r ON r.id=(SELECT rr.id FROM pastor_church_roles rr WHERE rr.pastor_id=p.id AND rr.review_status='approved' ORDER BY CASE rr.role_status WHEN 'current' THEN 0 ELSE 1 END,rr.id DESC LIMIT 1)
      WHERE p.review_status='approved'
        AND (?='' OR REPLACE(p.name,' ','') LIKE ? OR REPLACE(COALESCE(r.role_title,''),' ','') LIKE ? OR REPLACE(COALESCE(r.church_name,''),' ','') LIKE ? OR REPLACE(COALESCE(r.region,''),' ','') LIKE ? OR REPLACE(COALESCE(r.denomination,''),' ','') LIKE ?)
      UNION ALL
      SELECT NULL AS person_id,c.id AS church_id,NULL AS minister_id,c.pastor AS name,'담임목사' AS role_title,'current' AS role_status,c.name AS church_name,c.region,c.denomination
      FROM churches c
      WHERE c.review_status='approved' AND TRIM(c.pastor)<>''
        AND NOT EXISTS (SELECT 1 FROM pastor_church_roles r JOIN pastor_people p ON p.id=r.pastor_id WHERE r.church_id=c.id AND REPLACE(p.name,' ','')=REPLACE(c.pastor,' ','') AND r.review_status='approved' AND p.review_status='approved')
        AND (?='' OR REPLACE(c.pastor,' ','') LIKE ? OR REPLACE(c.name,' ','') LIKE ? OR REPLACE(c.region,' ','') LIKE ? OR REPLACE(c.denomination,' ','') LIKE ? OR '담임목사' LIKE ?)
      UNION ALL
      SELECT NULL AS person_id,c.id AS church_id,m.id AS minister_id,m.name,m.role_title,m.role_status,c.name AS church_name,c.region,c.denomination
      FROM church_ministry_profiles m JOIN churches c ON c.id=m.church_id
      WHERE m.review_status='approved' AND c.review_status='approved'
        AND NOT EXISTS (SELECT 1 FROM pastor_church_roles r JOIN pastor_people p ON p.id=r.pastor_id WHERE r.church_id=c.id AND REPLACE(p.name,' ','')=REPLACE(m.name,' ','') AND r.review_status='approved' AND p.review_status='approved')
        AND (?='' OR REPLACE(m.name,' ','') LIKE ? OR REPLACE(m.role_title,' ','') LIKE ? OR REPLACE(c.name,' ','') LIKE ? OR REPLACE(c.region,' ','') LIKE ? OR REPLACE(c.denomination,' ','') LIKE ?)
    )
    SELECT people.*,COUNT(*) OVER() AS total_count FROM people ORDER BY name,church_name LIMIT ${pageSize} OFFSET ${offset}
  `).bind(normalized,term,term,term,term,term,normalized,term,term,term,term,term,normalized,term,term,term,term,term).all<PastorRow>();
  const unique=[...new Map(rows.results.map((item)=>[item.person_id?`person:${item.person_id}`:`legacy:${item.church_id}|${clean(item.name)}|${clean(item.role_title)}`,item])).values()],total=Number(rows.results[0]?.total_count??0);
  const totalPages=Math.max(1,Math.ceil(total/pageSize)),pageUrl=(next:number)=>{const value=new URLSearchParams();if(query)value.set("q",query);if(next>1)value.set("page",String(next));const encoded=value.toString();return encoded?`/pastors?${encoded}`:"/pastors";};
  return <main className="pastor-directory-shell"><SkipLink/><header className="church-detail-header"><HomeReloadLink className="brand"><span className="brand-mark" aria-hidden="true"/><span>airchurch</span></HomeReloadLink><nav><a href="/#church-directory">교회 찾기</a><SavedNavLink/><a href="/about">운영 안내</a></nav><HomeReloadLink className="church-detail-back">홈으로</HomeReloadLink></header>
    <section className="pastor-directory-hero" id="primary-content" tabIndex={-1}><span>PASTOR DIRECTORY</span><h1>목회자를 찾고 응원하세요</h1><p>담임·부교역자·협동·원로·은퇴 목회자의 사역 이력을 한 사람의 기록으로 이어갑니다.</p><form role="search"><label className="sr-only" htmlFor="pastor-query">목회자 검색</label><input id="pastor-query" name="q" defaultValue={query} placeholder="목사, 교회, 지역, 교단으로 검색"/><button type="submit">찾기</button></form></section>
    <section className="pastor-directory-content"><div className="section-heading"><div><span className="section-kicker">PEOPLE</span><h2>{query?`‘${query}’ 검색 결과`:"목회자 목록"}</h2></div><span className="result-count">{total.toLocaleString("ko-KR")}명 · {page}/{totalPages}쪽</span></div><div className="pastor-directory-grid">{unique.length?unique.map((pastor)=>{const href=pastor.person_id?`/pastors/p/${pastor.person_id}`:`/pastors/${pastor.church_id}${pastor.minister_id?`?minister=${pastor.minister_id}`:""}`;return <a href={href} className="pastor-directory-card" key={pastor.person_id?`person-${pastor.person_id}`:`legacy-${pastor.church_id}-${pastor.minister_id??"primary"}`}><span>{pastor.role_status==="former"?"사역 이력":"현재 사역"}</span><strong>{pastor.name.replace(/\s*목사(?:님)?$/u,"")}</strong><b>{pastor.role_title}</b>{pastor.church_name&&<p>{pastor.church_name}</p>}{(pastor.region||pastor.denomination)&&<small>{[pastor.region,pastor.denomination].filter(Boolean).join(" · ")}</small>}<em>목회 기록과 응원글 보기 →</em></a>}):<p className="empty">찾은 목회자가 없습니다. 이름이나 교회명을 짧게 다시 입력해 보세요.</p>}</div>{unique.length>0&&<nav className="search-pagination" aria-label="목회자 목록 페이지">{page>1?<a href={pageUrl(page-1)}>← 이전 60명</a>:<span/>}<span>{page} / {totalPages}</span>{page<totalPages&&<a href={pageUrl(page+1)}>다음 60명 →</a>}</nav>}</section>
  </main>;
}
