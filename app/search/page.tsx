import type { Metadata } from "next";
import HomeReloadLink from "../home-reload-link";
import { database, ensurePraiseTables, ensureSermonTables } from "../api/_shared";

export const dynamic="force-dynamic";
export const metadata:Metadata={title:"통합 검색 | airChurch",description:"교회, 목사님, 말씀과 찬양을 한 번에 찾습니다."};

type ChurchResult={id:number;name:string;pastor:string;region:string;denomination:string};
type VideoResult={youtube_id:string;title:string;published_at:string;church_id:number;church:string;pastor:string;region:string;denomination:string};

const regions=["전체","서울","부산","대구","인천","광주","대전","울산","세종","경기","강원","충북","충남","전북","전남","경북","경남","제주"];
const denominations=["전체 교단","대한예수교장로회 통합","대한예수교장로회 합동","기독교대한감리회","대한예수교장로회 고신","기독교한국침례회","기독교대한성결교회","대한예수교장로회 합신","대한예수교장로회 백석","기독교대한하나님의성회","한국기독교장로회","독립교회","한국독립교회선교단체연합회"];

export default async function SearchPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
  const params=await searchParams;
  const value=(key:string,max:number)=>String(Array.isArray(params[key])?params[key]?.[0]??"":params[key]??"").trim().slice(0,max);
  const q=value("q",100),region=value("region",40),denomination=value("denomination",100),terms=q.toLowerCase().split(/\s+/).map((term)=>term.replace(/\s/g,"")).filter(Boolean).slice(0,5);
  const filters=(haystack:string)=>{const conditions=[...terms.map(()=>`instr(${haystack},?)>0`)];const bindings:string[]=[...terms];if(region&&region!=="전체"){conditions.push("substr(c.region,1,length(?))=?");bindings.push(region,region);}if(denomination&&denomination!=="전체 교단"){conditions.push("c.denomination=?");bindings.push(denomination);}return {sql:conditions.length?` AND ${conditions.join(" AND ")}`:"",bindings};};
  const churchFilter=filters("replace(lower(c.name||c.pastor||c.region||c.denomination),' ','')"),videoFilter=filters("replace(lower(c.name||c.pastor||c.region||c.denomination||v.title),' ','')");
  const db=database();await Promise.all([ensureSermonTables(db),ensurePraiseTables(db)]);
  const [churches,sermons,praises]=await Promise.all([
    db.prepare(`SELECT c.id,c.name,c.pastor,c.region,c.denomination FROM churches c WHERE c.review_status='approved'${churchFilter.sql} ORDER BY c.priority_weight DESC,c.name LIMIT 48`).bind(...churchFilter.bindings).all<ChurchResult>(),
    db.prepare(`SELECT v.youtube_id,v.title,v.published_at,c.id AS church_id,c.name AS church,c.pastor,c.region,c.denomination FROM sermons v JOIN churches c ON c.id=v.church_id WHERE c.review_status='approved' AND v.status='published'${videoFilter.sql} ORDER BY v.published_at DESC LIMIT 36`).bind(...videoFilter.bindings).all<VideoResult>(),
    db.prepare(`SELECT v.youtube_id,v.title,v.published_at,c.id AS church_id,c.name AS church,c.pastor,c.region,c.denomination FROM praise_videos v JOIN churches c ON c.id=v.church_id WHERE c.review_status='approved' AND v.status='published'${videoFilter.sql} ORDER BY v.published_at DESC LIMIT 24`).bind(...videoFilter.bindings).all<VideoResult>(),
  ]);
  const total=churches.results.length+sermons.results.length+praises.results.length;
  const videoCard=(item:VideoResult,kind:string)=><a className="search-result-video" href={`https://www.youtube.com/watch?v=${item.youtube_id}`} target="_blank" rel="noopener noreferrer" key={`${kind}-${item.youtube_id}`}><img src={`https://i.ytimg.com/vi/${item.youtube_id}/mqdefault.jpg`} alt="" loading="lazy" decoding="async"/><span><small>{kind} · {item.church}</small><strong>{item.title}</strong><em>{new Date(item.published_at).toLocaleDateString("ko-KR",{timeZone:"Asia/Seoul"})} · YouTube ↗</em></span></a>;
  return <main className="search-page">
    <header className="search-page-header"><HomeReloadLink className="brand"><span className="brand-mark" aria-hidden="true"/><span>airchurch</span></HomeReloadLink><nav><a href="/#sermons">말씀</a><a href="/#church-directory">교회 찾기</a><a href="/#community">공동체</a></nav><a href="/">홈으로</a></header>
    <section className="search-page-hero"><span>CHRISTIAN PORTAL SEARCH</span><h1>교회와 말씀을<br/>한 번에 찾습니다</h1><form action="/search" method="get"><label><span aria-hidden="true">⌕</span><input name="q" defaultValue={q} placeholder="교회명, 목사님, 말씀·찬양 제목" autoFocus/></label><select name="region" defaultValue={region||"전체"} aria-label="지역">{regions.map((item)=><option key={item}>{item}</option>)}</select><select name="denomination" defaultValue={denomination||"전체 교단"} aria-label="교단">{denominations.map((item)=><option key={item}>{item}</option>)}</select><button type="submit">통합 검색</button></form><p>{q||region&&region!=="전체"||denomination&&denomination!=="전체 교단"?`조건에 맞는 결과 ${total}개를 찾았습니다.`:"최근 교회·말씀·찬양을 보여드립니다."}</p></section>
    <section className="search-results"><div className="search-results-heading"><div><span className="section-kicker">CHURCHES</span><h2>교회</h2></div><b>{churches.results.length}곳</b></div><div className="search-church-grid">{churches.results.map((church)=><a href={`/church/${church.id}`} key={church.id}><span>{church.region}</span><strong>{church.name}</strong><p>{church.pastor}</p><small>{church.denomination}</small><em>교회 상세 보기 →</em></a>)}{!churches.results.length&&<p className="empty">조건에 맞는 공개 교회가 없습니다.</p>}</div></section>
    <section className="search-results"><div className="search-results-heading"><div><span className="section-kicker">SERMONS</span><h2>말씀</h2></div><b>{sermons.results.length}편</b></div><div className="search-video-grid">{sermons.results.map((item)=>videoCard(item,"말씀"))}{!sermons.results.length&&<p className="empty">조건에 맞는 말씀이 없습니다.</p>}</div></section>
    <section className="search-results"><div className="search-results-heading"><div><span className="section-kicker">PRAISE</span><h2>찬양</h2></div><b>{praises.results.length}편</b></div><div className="search-video-grid">{praises.results.map((item)=>videoCard(item,"찬양"))}{!praises.results.length&&<p className="empty">조건에 맞는 찬양이 없습니다.</p>}</div></section>
    <footer className="church-detail-footer"><a href="/">airChurch 홈</a><span>공개 자료와 공식 채널을 기준으로 검색합니다.</span></footer>
  </main>;
}
