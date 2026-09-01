import type {Metadata} from "next";
import HomeReloadLink from "../home-reload-link";
import SavedNavLink from "../saved-nav-link";
import SkipLink from "../skip-link";
import {database,ensureMinistryProfileTables} from "../api/_shared";

export const dynamic="force-dynamic";
export const metadata:Metadata={title:"목회자 찾기 | airChurch",description:"담임·부교역자·협동·원로·은퇴 목회자를 교회와 함께 찾고 응원합니다."};

type PastorRow={church_id:number;minister_id:number|null;name:string;role_title:string;role_status:string;church_name:string;region:string;denomination:string;total_count:number};

const clean=(value:string)=>value.normalize("NFKC").replace(/\s+/g,"").toLocaleLowerCase("ko-KR");

export default async function PastorsPage({searchParams}:{searchParams:Promise<{q?:string}>}){
  const query=(await searchParams).q?.trim().slice(0,80)??"",normalized=query.replace(/\s+/g,""),term=`%${normalized}%`,db=database();
  await ensureMinistryProfileTables(db);
  const rows=await db.prepare(`
    WITH people AS (
      SELECT c.id AS church_id,NULL AS minister_id,c.pastor AS name,'담임목사' AS role_title,'current' AS role_status,c.name AS church_name,c.region,c.denomination
      FROM churches c
      WHERE c.review_status='approved' AND TRIM(c.pastor)<>''
        AND (?='' OR REPLACE(c.pastor,' ','') LIKE ? OR REPLACE(c.name,' ','') LIKE ? OR REPLACE(c.region,' ','') LIKE ? OR REPLACE(c.denomination,' ','') LIKE ? OR '담임목사' LIKE ?)
      UNION ALL
      SELECT c.id AS church_id,m.id AS minister_id,m.name,m.role_title,m.role_status,c.name AS church_name,c.region,c.denomination
      FROM church_ministry_profiles m JOIN churches c ON c.id=m.church_id
      WHERE m.review_status='approved' AND c.review_status='approved'
        AND (?='' OR REPLACE(m.name,' ','') LIKE ? OR REPLACE(m.role_title,' ','') LIKE ? OR REPLACE(c.name,' ','') LIKE ? OR REPLACE(c.region,' ','') LIKE ? OR REPLACE(c.denomination,' ','') LIKE ?)
    )
    SELECT people.*,COUNT(*) OVER() AS total_count FROM people ORDER BY church_name,name LIMIT 240
  `).bind(normalized,term,term,term,term,term,normalized,term,term,term,term,term).all<PastorRow>();
  const unique=[...new Map(rows.results.map((item)=>[`${item.church_id}|${clean(item.name)}|${clean(item.role_title)}`,item])).values()],total=Number(rows.results[0]?.total_count??0);
  return <main className="pastor-directory-shell"><SkipLink/><header className="church-detail-header"><HomeReloadLink className="brand"><span className="brand-mark" aria-hidden="true"/><span>airchurch</span></HomeReloadLink><nav><a href="/#church-directory">교회 찾기</a><SavedNavLink/><a href="/about">운영 안내</a></nav><HomeReloadLink className="church-detail-back">홈으로</HomeReloadLink></header>
    <section className="pastor-directory-hero" id="primary-content" tabIndex={-1}><span>PASTOR DIRECTORY</span><h1>목회자를 찾고 응원하세요</h1><p>담임·부교역자·협동·원로·은퇴 목회자를 함께 기록합니다. 영상이나 개인 채널이 없어도 목록에서 제외하지 않습니다.</p><form role="search"><label className="sr-only" htmlFor="pastor-query">목회자 검색</label><input id="pastor-query" name="q" defaultValue={query} placeholder="목사, 교회, 지역, 교단으로 검색"/><button type="submit">찾기</button></form></section>
    <section className="pastor-directory-content"><div className="section-heading"><div><span className="section-kicker">PEOPLE</span><h2>{query?`‘${query}’ 검색 결과`:"목회자 목록"}</h2></div><span className="result-count">{total.toLocaleString("ko-KR")}명</span></div><div className="pastor-directory-grid">{unique.length?unique.map((pastor)=>{const href=`/pastors/${pastor.church_id}${pastor.minister_id?`?minister=${pastor.minister_id}`:""}`;return <a href={href} className="pastor-directory-card" key={`${pastor.church_id}-${pastor.minister_id??"primary"}`}><span>{pastor.role_status==="former"?"이전 섬김":"함께 섬김"}</span><strong>{pastor.name.replace(/\s*목사(?:님)?$/u,"")}</strong><b>{pastor.role_title}</b><p>{pastor.church_name}</p><small>{pastor.region} · {pastor.denomination}</small><em>목회 기록과 응원글 보기 →</em></a>}):<p className="empty">찾은 목회자가 없습니다. 이름이나 교회명을 짧게 다시 입력해 보세요.</p>}</div></section>
  </main>;
}
