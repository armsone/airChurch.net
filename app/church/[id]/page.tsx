import type { Metadata } from "next";
import { cache } from "react";
import HomeReloadLink from "../../home-reload-link";
import { churchHomepageUrls } from "../../church-homepages";
import { churchImageUrls } from "../../church-images";
import { database, ensureMediaTables } from "../../api/_shared";
import { ensureChurchDetailTables,ensureEncouragementTables,ensureMinistryProfileTables,ensurePastorPeopleTables } from "../../api/_shared";
import ChurchSaveButton from "./church-save-button";
import ChurchShareButton from "./church-share-button";
import { safeHttpUrl } from "../../safe-url";
import SavedNavLink from "../../saved-nav-link";
import SkipLink from "../../skip-link";
import DailyMediaLink from "../../daily-media-link";
import { accessSession } from "../../admin-access";
import { ensurePrivateContactTables } from "../../api/_shared";
import { readChurchPrivateContacts } from "../../private-contact-vault";
import EncouragementBoard,{type EncouragementItem} from "../../encouragement-board";
import MinistrySuggestionForm from "../../ministry-suggestion-form";
import EncouragementJumpLink from "../../encouragement-jump-link";

export const dynamic="force-dynamic";

type ChurchRow={id:number;name:string;pastor:string;region:string;denomination:string;youtube_channel_id:string|null;homepage_url:string|null;channel_image_url:string|null};
type VideoRow={youtube_id:string;title:string;published_at:string};
type RelatedChurch={id:number;name:string;pastor:string;region:string;denomination:string};
type ChurchProfileRow={slogan:string|null;vision:string|null;summary:string|null;address:string|null;source_url:string;reviewed_at:string|null};
type WorshipScheduleRow={record_id:string;service_type:string;day_of_week:string;start_time:string;venue_audience:string|null;source_url:string};
type MinistryProfileRow={id:number;name:string;role_title:string;role_category:string;role_status:string;source_url:string};
type PersonMinistryRow={person_id:number;name:string;role_title:string;role_category:string;role_status:string;source_url:string|null};

const dayLabels:Record<string,string>={MON:"월",TUE:"화",WED:"수",THU:"목",FRI:"금",SAT:"토",SUN:"주일"};
function scheduleDays(value:string){try{const days=JSON.parse(value);return Array.isArray(days)?days.map((day)=>dayLabels[day]||day).join("·"):value}catch{return value}}
function scheduleTime(value:string){const [hour,minute]=value.split(":").map(Number);if(!Number.isFinite(hour)||!Number.isFinite(minute))return value;return `${hour<12?"오전":"오후"} ${hour%12||12}:${String(minute).padStart(2,"0")}`}

const publicChurch=cache(async(id:number)=>{
  if(!Number.isInteger(id)||id<1)return null;
  return database().prepare("SELECT id,name,pastor,region,denomination,youtube_channel_id,homepage_url,channel_image_url FROM churches WHERE id=? AND review_status='approved' LIMIT 1").bind(id).first<ChurchRow>();
});

export async function generateMetadata({params}:{params:Promise<{id:string}>}):Promise<Metadata>{
  const {id:rawId}=await params;const church=await publicChurch(Number(rawId));
  if(!church)return {title:"공개되지 않은 교회 | airChurch",robots:{index:false,follow:false}};
  const description=`${church.region} ${church.name}의 담임목사, 교단, 공식 홈페이지와 최근 말씀·찬양을 확인하세요. ${church.pastor} · ${church.denomination}`;
  return {
    title:`${church.name} | ${church.region} 교회 · airChurch`,
    description,
    alternates:{canonical:`/church/${church.id}`},
    openGraph:{title:`${church.name} | airChurch`,description,url:`/church/${church.id}`,type:"website",images:[]},
    twitter:{card:"summary",title:`${church.name} | airChurch`,description,images:[]},
  };
}

export default async function ChurchPage({params}:{params:Promise<{id:string}>}){
  const {id:rawId}=await params;const id=Number(rawId);
  const db=database();await Promise.all([ensureMediaTables(db),ensureChurchDetailTables(db),ensureEncouragementTables(db),ensureMinistryProfileTables(db),ensurePastorPeopleTables(db)]);
  const church=await publicChurch(id);
  if(!church)return <main className="church-detail-shell"><SkipLink/><header className="church-detail-header"><HomeReloadLink className="brand"><span className="brand-mark" aria-hidden="true"/><span>airchurch</span></HomeReloadLink><a href="/portal#church-directory">교회 찾기로 돌아가기</a></header><section className="church-detail-missing" id="primary-content" tabIndex={-1}><span>CHURCH DIRECTORY</span><h1>현재 공개된 교회가 아닙니다</h1><p>정보가 변경되었거나 운영 기준에 따라 보류되었을 수 있습니다.</p><a href="/portal#church-directory">다른 교회 찾아보기 →</a></section></main>;
  const regionPrefix=`${church.region.split(/\s+/)[0]}%`;
  const [sermons,praises,related,profile,schedules,encouragements,ministries,personMinistries]=await Promise.all([
    db.prepare("SELECT youtube_id,title,published_at FROM sermons WHERE church_id=? AND status='published' ORDER BY published_at DESC LIMIT 9").bind(id).all<VideoRow>(),
    db.prepare("SELECT youtube_id,title,published_at FROM praise_videos WHERE church_id=? AND status='published' ORDER BY published_at DESC LIMIT 6").bind(id).all<VideoRow>(),
    db.prepare("SELECT id,name,pastor,region,denomination FROM churches WHERE review_status='approved' AND id!=? AND (region LIKE ? OR denomination=?) ORDER BY RANDOM() LIMIT 6").bind(id,regionPrefix,church.denomination).all<RelatedChurch>(),
    db.prepare("SELECT slogan,vision,summary,address,source_url,reviewed_at FROM church_profiles WHERE church_id=? AND review_status='approved' LIMIT 1").bind(id).first<ChurchProfileRow>(),
    db.prepare("SELECT record_id,service_type,day_of_week,start_time,venue_audience,source_url FROM worship_schedules WHERE church_id=? AND review_status='approved' ORDER BY CASE WHEN instr(day_of_week,'SUN')>0 THEN 0 ELSE 1 END,day_of_week,start_time,service_type LIMIT 40").bind(id).all<WorshipScheduleRow>(),
    db.prepare("SELECT id,nickname,content,created_at AS createdAt FROM encouragement_messages WHERE church_id=? AND target_type='church' AND status='approved' ORDER BY created_at DESC,id DESC LIMIT 30").bind(id).all<EncouragementItem>(),
    db.prepare("SELECT id,name,CASE WHEN role_title='목회자' OR role_title LIKE '%목사' THEN '목사' ELSE role_title END AS role_title,role_category,role_status,source_url FROM church_ministry_profiles WHERE church_id=? AND review_status='approved' ORDER BY CASE role_category WHEN 'current_primary' THEN 0 WHEN 'associate' THEN 1 WHEN 'education' THEN 2 WHEN 'cooperating' THEN 3 WHEN 'emeritus' THEN 4 ELSE 5 END,name LIMIT 80").bind(id).all<MinistryProfileRow>(),
    db.prepare("SELECT p.id AS person_id,p.name,CASE WHEN r.role_title='목회자' OR r.role_title LIKE '%목사' THEN '목사' ELSE r.role_title END AS role_title,r.role_category,r.role_status,r.source_url FROM pastor_church_roles r JOIN pastor_people p ON p.id=r.pastor_id WHERE r.church_id=? AND r.review_status='approved' AND p.review_status='approved' ORDER BY CASE r.role_category WHEN 'current_primary' THEN 0 WHEN 'associate' THEN 1 WHEN 'education' THEN 2 WHEN 'cooperating' THEN 3 WHEN 'emeritus' THEN 4 ELSE 5 END,p.name LIMIT 80").bind(id).all<PersonMinistryRow>(),
  ]);
  const session=await accessSession();
  const privateContacts=session?(await ensurePrivateContactTables(db),await readChurchPrivateContacts(db,id,session)):[];
  const homepage=safeHttpUrl(churchHomepageUrls[church.name]||church.homepage_url);const image=safeHttpUrl(churchImageUrls[church.name]||church.channel_image_url);
  const normalized=(value:string)=>value.normalize("NFKC").replace(/\s+/g,"").replace(/목사(?:님)?$/u,"").toLocaleLowerCase("ko-KR"),independentKeys=new Set(personMinistries.results.map((item)=>`${normalized(item.name)}|${normalized(item.role_title)}`)),ministryCards=[...personMinistries.results.map((item)=>({...item,href:`/pastors/p/${item.person_id}`})),...ministries.results.filter((item)=>!independentKeys.has(`${normalized(item.name)}|${normalized(item.role_title)}`)).map((item)=>({...item,href:`/pastors/${church.id}?minister=${item.id}`}))],primaryPerson=personMinistries.results.find((item)=>item.role_category==="current_primary"&&normalized(item.name)===normalized(church.pastor))??personMinistries.results.find((item)=>item.role_category==="current_primary");
  const hasSchedules=schedules.results.length>0;
  const churchJsonLd={"@context":"https://schema.org","@type":"Church",name:church.name,url:`https://airchurch.net/church/${church.id}`,address:{"@type":"PostalAddress",addressRegion:church.region,addressCountry:"KR"},member:{"@type":"Person",name:church.pastor},sameAs:[homepage,church.youtube_channel_id?`https://www.youtube.com/channel/${church.youtube_channel_id}`:null].filter(Boolean)};
  const videoCard=(video:VideoRow,kind:"말씀"|"찬양")=><DailyMediaLink className="church-detail-video" href={`https://www.youtube.com/watch?v=${video.youtube_id}`} step={kind==="말씀"?"sermon":"praise"} key={`${kind}-${video.youtube_id}`}><img src={`https://i.ytimg.com/vi/${video.youtube_id}/mqdefault.jpg`} alt="" width={320} height={180} loading="lazy" decoding="async" referrerPolicy="no-referrer"/><span><small>{kind} · {new Date(video.published_at).toLocaleDateString("ko-KR",{timeZone:"Asia/Seoul"})}</small><strong>{video.title}</strong><em>YouTube에서 보기 ↗</em></span></DailyMediaLink>;
  return <main className="church-detail-shell"><SkipLink/>
    <header className="church-detail-header"><HomeReloadLink className="brand"><span className="brand-mark" aria-hidden="true"/><span>airchurch</span></HomeReloadLink><nav><a href="/portal#sermons">말씀</a><a href="/portal#church-directory">교회 찾기</a><a href="/portal#pastor-directory">목회자</a><SavedNavLink/><a href="/about">운영 안내</a></nav><a className="church-detail-back" href="/portal#church-directory">목록으로</a></header>
    <section className="church-detail-hero" id="primary-content" tabIndex={-1}><div className="church-detail-identity">{image?<img src={image} alt="" width={96} height={96} loading="eager" decoding="async" referrerPolicy="no-referrer"/>:<span aria-hidden="true">교회</span>}<div><small>확인된 공식 정보</small><h1>{church.name}</h1><p><a className="church-pastor-profile-link" href={primaryPerson?`/pastors/p/${primaryPerson.person_id}`:`/pastors/${church.id}`}>{church.pastor} 목회 기록 보기 →</a> · {church.region} · {church.denomination}</p></div></div><div className="church-detail-actions"><ChurchSaveButton id={church.id} name={church.name} pastor={church.pastor} region={church.region}/><ChurchShareButton name={church.name}/>{homepage&&<a href={homepage} target="_blank" rel="noopener noreferrer">공식 홈페이지 ↗</a>}{church.youtube_channel_id&&<a href={`https://www.youtube.com/channel/${church.youtube_channel_id}`} target="_blank" rel="noopener noreferrer">공식 YouTube ↗</a>}<EncouragementJumpLink/></div></section>
    <section className="church-detail-trust"><span>✓ 공개 상태</span><p>교단·노회·교회가 공개한 정보와 공식 채널을 기준으로 소개합니다. 문제가 제보되면 운영 검토 동안 노출을 보류할 수 있습니다.</p><a href="/contact">정보 수정·비공개 요청</a></section>
    {privateContacts.length>0&&<section className="church-private-contacts" aria-label="승인 사용자 전용 연락 정보"><div><small>승인 사용자 전용</small><h2>교회 연락 정보</h2><p>일반 방문자에게는 전송되지 않는 암호화 보관 자료입니다.</p></div><ul>{privateContacts.map((item)=>{const source=safeHttpUrl(item.sourceUrl);return <li key={item.id}><span>{item.type==="email"?"이메일":item.type==="phone"?"전화번호":"계좌번호"}</span><strong>{item.value}</strong>{source&&<a href={source} target="_blank" rel="noreferrer">공식 출처 ↗</a>}</li>})}</ul></section>}
    {(profile||hasSchedules)&&<section className="church-detail-content church-personalized"><div className="section-heading"><div><span className="section-kicker">공식 홈페이지에서 확인</span><h2>{church.name} 한눈에 보기</h2></div><span className="result-count">검토 승인 정보만 표시</span></div><div className={`church-personalized-grid ${profile&&hasSchedules?"":"single"}`}>{profile&&<article className="church-profile-card"><span className="church-card-symbol" aria-hidden="true">안내</span><div><h3>교회 정보</h3>{profile.slogan&&<blockquote>{profile.slogan}</blockquote>}{profile.vision&&<p className="church-profile-vision"><b>비전</b>{profile.vision}</p>}{profile.summary&&<p className="church-profile-summary">{profile.summary}</p>}<dl><div><dt>담임목사</dt><dd>{church.pastor}</dd></div><div><dt>교단</dt><dd>{church.denomination}</dd></div><div><dt>지역</dt><dd>{church.region}</dd></div>{profile.address&&<div><dt>주소</dt><dd>{profile.address}</dd></div>}</dl><a href={profile.source_url} target="_blank" rel="noopener noreferrer">공식 출처에서 확인 ↗</a></div></article>}{hasSchedules&&<article className="church-schedule-card"><span className="church-card-symbol" aria-hidden="true">시간</span><div><h3>예배시간</h3><details><summary><span>등록된 예배 {schedules.results.length}개</span><b><span className="schedule-closed">보기</span><span className="schedule-open">접기</span></b></summary><ul>{schedules.results.map((schedule)=><li key={schedule.record_id}><span><b>{schedule.service_type}</b><small>{scheduleDays(schedule.day_of_week)}{schedule.venue_audience&&` · ${schedule.venue_audience}`}</small></span><time dateTime={schedule.start_time}>{scheduleTime(schedule.start_time)}</time></li>)}</ul><a href={schedules.results[0].source_url} target="_blank" rel="noopener noreferrer">공식 예배안내 확인 ↗</a></details></div></article>}</div></section>}
    {sermons.results.length>0&&<section className="church-detail-content"><div className="section-heading"><div><span className="section-kicker">최근 공식 채널</span><h2>말씀</h2></div><span className="result-count">최근 {sermons.results.length}편</span></div><div className="church-detail-video-grid">{sermons.results.map((video)=>videoCard(video,"말씀"))}</div></section>}
    {praises.results.length>0&&<section className="church-detail-content"><div className="section-heading"><div><span className="section-kicker">함께 드리는 고백</span><h2>찬양</h2></div><span className="result-count">최근 {praises.results.length}편</span></div><div className="church-detail-video-grid">{praises.results.map((video)=>videoCard(video,"찬양"))}</div></section>}
    {ministryCards.length>0&&<section className="church-detail-content church-ministry"><div className="section-heading"><div><span className="section-kicker">공식 출처 확인</span><h2>함께 섬긴 목회자와 교역자</h2></div><span className="result-count">{ministryCards.length}명</span></div><div className="church-ministry-grid">{ministryCards.map((minister)=><a href={minister.href} key={minister.href}><span>{minister.role_status==="former"?"사역 이력":"현재 사역"}</span><strong>{minister.name}</strong><p>{minister.role_title}</p><em>개인 기록 보기 →</em></a>)}</div></section>}
    <section className="church-information-help"><div><strong>이 교회의 정보가 더 있나요?</strong><p>공식 출처가 확인되는 교역자와 예배시간을 알려주시면 검토 후 반영합니다.</p></div><MinistrySuggestionForm churchId={church.id} churchName={church.name}/><a href={`/contact?church=${encodeURIComponent(church.name)}&category=예배시간`}>예배시간 알려주기</a></section>
    <EncouragementBoard churchId={id} targetType="church" title={`${church.name} 응원하기`} initialItems={encouragements.results}/>
    {related.results.length>0&&<section className="church-detail-content church-related"><div className="section-heading"><div><span className="section-kicker">다음 발견</span><h2>가까운 교회와 같은 교단</h2></div><a href="/portal#church-directory">전체 교회 찾기 →</a></div><div className="church-related-grid">{related.results.map((item)=>{const reasons=[item.region.split(/\s+/)[0]===church.region.split(/\s+/)[0]?"같은 지역":null,item.denomination===church.denomination?"같은 교단":null].filter(Boolean);return <a href={`/church/${item.id}`} key={item.id}><span>{item.region}</span><strong>{item.name}</strong><p>{item.pastor}</p><small>{item.denomination}</small><small className="church-related-reason">{reasons.join(" · ")}</small><em>상세 보기 →</em></a>})}</div></section>}
    <footer className="church-detail-footer"><a href="/">airChurch 홈</a><span>발견은 airChurch에서 · 소속과 돌봄은 지역교회와 함께</span></footer><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(churchJsonLd).replace(/</g,"\\u003c")}} />
  </main>;
}
