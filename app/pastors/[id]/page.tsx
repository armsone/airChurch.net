import type { Metadata } from "next";
import { cache } from "react";
import HomeReloadLink from "../../home-reload-link";
import SavedNavLink from "../../saved-nav-link";
import SkipLink from "../../skip-link";
import DailyMediaLink from "../../daily-media-link";
import { database, ensureEncouragementTables, ensureMinistryProfileTables, ensureSermonTables } from "../../api/_shared";
import { safeHttpUrl } from "../../safe-url";
import EncouragementBoard,{type EncouragementItem} from "../../encouragement-board";

export const dynamic="force-dynamic";

type PastorChurch={id:number;name:string;pastor:string;region:string;denomination:string;youtube_channel_id:string|null;homepage_url:string|null};
type Sermon={youtube_id:string;title:string;published_at:string};
type SermonHistory={total:number;first_at:string|null;latest_at:string|null};
type Minister={id:number;name:string;role_title:string;role_status:string;source_url:string};

const profile=cache(async(id:number)=>{
  if(!Number.isInteger(id)||id<1)return null;
  const db=database();await ensureSermonTables(db);
  return db.prepare("SELECT id,name,pastor,region,denomination,youtube_channel_id,homepage_url FROM churches WHERE id=? AND review_status='approved' LIMIT 1").bind(id).first<PastorChurch>();
});
const date=(value:string|null)=>value?new Date(value).toLocaleDateString("ko-KR",{timeZone:"Asia/Seoul",year:"numeric",month:"long",day:"numeric"}):"기록 준비 중";

export async function generateMetadata({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{minister?:string}>}):Promise<Metadata>{
  const [{id},{minister:ministerRaw}]=await Promise.all([params,searchParams]);const church=await profile(Number(id));
  if(!church)return {title:"공개되지 않은 목회 기록 | airChurch",robots:{index:false,follow:false}};
  const ministerId=Number(ministerRaw);let minister:Minister|null=null;
  if(Number.isInteger(ministerId)&&ministerId>0){const db=database();await ensureMinistryProfileTables(db);minister=await db.prepare("SELECT id,name,role_title,role_status,source_url FROM church_ministry_profiles WHERE id=? AND church_id=? AND review_status='approved' LIMIT 1").bind(ministerId,church.id).first<Minister>();}
  if(ministerRaw&&!minister)return {title:"공개되지 않은 교역자 기록 | airChurch",robots:{index:false,follow:false}};
  const displayName=minister?.name??church.pastor.replace(/\s*목사(?:님)?$/,""),roleTitle=minister?.role_title??"목사",canonical=`/pastors/${church.id}${minister?`?minister=${minister.id}`:""}`;
  const description=`${church.name} ${displayName} ${roleTitle}의 공식 공개 출처로 확인된 목회 정보를 봅니다.`;
  return {title:`${displayName} ${roleTitle} | ${church.name} · airChurch`,description,alternates:{canonical}};
}

export default async function PastorProfilePage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{minister?:string}>}){
  const [{id:rawId},{minister:ministerRaw}]=await Promise.all([params,searchParams]);const id=Number(rawId),church=await profile(id);
  if(!church)return <main className="church-detail-shell"><SkipLink/><header className="church-detail-header"><HomeReloadLink className="brand"><span className="brand-mark" aria-hidden="true"/><span>airchurch</span></HomeReloadLink><a href="/#church-directory">교회 찾기</a></header><section className="church-detail-missing" id="primary-content" tabIndex={-1}><span>PASTOR STORY</span><h1>현재 공개된 목회 기록이 아닙니다</h1><p>연결된 교회 정보가 변경되었거나 검토 중일 수 있습니다.</p><a href="/#church-directory">다른 교회 찾아보기 →</a></section></main>;
  const db=database();
  await Promise.all([ensureEncouragementTables(db),ensureMinistryProfileTables(db)]);
  const ministerId=Number(ministerRaw),minister=Number.isInteger(ministerId)&&ministerId>0?await db.prepare("SELECT id,name,role_title,role_status,source_url FROM church_ministry_profiles WHERE id=? AND church_id=? AND review_status='approved' LIMIT 1").bind(ministerId,id).first<Minister>():null;
  if(ministerRaw&&!minister)return <main className="church-detail-shell"><SkipLink/><section className="church-detail-missing"><h1>검토 승인된 교역자 정보가 아닙니다</h1><a href={`/church/${id}`}>교회 페이지로 돌아가기 →</a></section></main>;
  const displayName=minister?.name??church.pastor.replace(/\s*목사(?:님)?$/,""),roleTitle=minister?.role_title??"목사",targetRef=minister?`minister:${minister.id}`:"";
  const [history,sermons,encouragements]=await Promise.all([
    minister?Promise.resolve(null):db.prepare("SELECT COUNT(*) AS total,MIN(published_at) AS first_at,MAX(published_at) AS latest_at FROM sermons WHERE church_id=? AND status='published'").bind(id).first<SermonHistory>(),
    minister?Promise.resolve({results:[]} as {results:Sermon[]}):db.prepare("SELECT youtube_id,title,published_at FROM sermons WHERE church_id=? AND status='published' ORDER BY published_at DESC LIMIT 12").bind(id).all<Sermon>(),
    db.prepare("SELECT id,nickname,content,created_at AS createdAt FROM encouragement_messages WHERE church_id=? AND target_type='pastor' AND target_ref=? AND status='approved' ORDER BY created_at DESC,id DESC LIMIT 30").bind(id,targetRef).all<EncouragementItem>(),
  ]);
  const homepage=safeHttpUrl(church.homepage_url),ministerSource=safeHttpUrl(minister?.source_url);
  const personJsonLd={"@context":"https://schema.org","@type":"Person",name:displayName,jobTitle:roleTitle,worksFor:{"@type":"Church",name:church.name,url:`https://airchurch.net/church/${church.id}`},url:`https://airchurch.net/pastors/${church.id}${minister?`?minister=${minister.id}`:""}`};
  return <main className="church-detail-shell pastor-profile-shell"><SkipLink/>
    <header className="church-detail-header"><HomeReloadLink className="brand"><span className="brand-mark" aria-hidden="true"/><span>airchurch</span></HomeReloadLink><nav><a href="/#sermons">말씀</a><a href="/#church-directory">교회 찾기</a><SavedNavLink/><a href="/about">운영 안내</a></nav><a className="church-detail-back" href={`/church/${church.id}`}>교회로</a></header>
    <section className="pastor-profile-hero" id="primary-content" tabIndex={-1}><div><span>PASTOR STORY</span><p>공식 공개 정보로 보는 목회 여정</p><h1>{displayName}<small>{roleTitle}</small></h1><a href={`/church/${church.id}`}>{church.name} · {church.region} · {church.denomination}</a><nav className="pastor-profile-sources" aria-label="공식 출처">{ministerSource&&<a href={ministerSource} target="_blank" rel="noopener noreferrer">교역자 공식 출처 ↗</a>}{homepage&&<a href={homepage} target="_blank" rel="noopener noreferrer">교회 홈페이지 ↗</a>}{!minister&&church.youtube_channel_id&&<a href={`https://www.youtube.com/channel/${church.youtube_channel_id}`} target="_blank" rel="noopener noreferrer">공식 YouTube ↗</a>}</nav></div>{Number(history?.total??0)>0&&<aside><span>airChurch 기록</span><strong>{Number(history?.total??0).toLocaleString("ko-KR")}편</strong><small>연결된 공개 말씀</small></aside>}</section>
    <section className="pastor-profile-principle"><strong>사생활이 아닌, 공개된 목회 기록만</strong><p>교회·교단·공식 채널에서 확인되는 정보만 정리합니다. 학력·가족·개인 이력은 공식 출처가 확인되지 않으면 싣지 않습니다.</p><a href="/contact">정보 수정 요청</a></section>
    <section className="pastor-history-grid" aria-label="목회 기록 요약"><article><span>{minister?.role_status==="former"?"이전 섬김":"현재 섬김"}</span><strong>{church.name}</strong><p>{roleTitle} · {church.region} · {church.denomination}</p></article>{history?.first_at&&<article><span>첫 연결 기록</span><strong>{date(history.first_at)}</strong><p>airChurch에 연결된 공식 채널 기준</p></article>}{history?.latest_at&&<article><span>최근 말씀</span><strong>{date(history.latest_at)}</strong><p>공식 채널의 공개 영상 기준</p></article>}</section>
    {sermons.results.length>0&&<section className="church-detail-content"><div className="section-heading"><div><span className="section-kicker">MINISTRY TIMELINE</span><h2>말씀으로 남은 목회 기록</h2></div><span className="result-count">최근 {sermons.results.length}편</span></div><div className="church-detail-video-grid">{sermons.results.map((sermon)=><DailyMediaLink className="church-detail-video" href={`https://www.youtube.com/watch?v=${sermon.youtube_id}`} step="sermon" key={sermon.youtube_id}><img src={`https://i.ytimg.com/vi/${sermon.youtube_id}/mqdefault.jpg`} alt="" width={320} height={180} loading="lazy" decoding="async" referrerPolicy="no-referrer"/><span><small>{date(sermon.published_at)}</small><strong>{sermon.title}</strong><em>YouTube에서 보기 ↗</em></span></DailyMediaLink>)}</div></section>}
    <EncouragementBoard churchId={id} targetType="pastor" targetRef={targetRef} title={`${displayName} ${roleTitle} 응원하기`} initialItems={encouragements.results}/>
    <footer className="church-detail-footer"><a href={`/church/${church.id}`}>{church.name}</a><span>공개 출처가 확인되는 정보부터 차분히 채웁니다.</span></footer><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(personJsonLd).replace(/</g,"\\u003c")}}/>
  </main>;
}
