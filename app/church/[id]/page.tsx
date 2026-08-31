import type { Metadata } from "next";
import HomeReloadLink from "../../home-reload-link";
import { churchHomepageUrls } from "../../church-homepages";
import { churchImageUrls } from "../../church-images";
import { database, ensurePraiseTables, ensureSermonTables } from "../../api/_shared";
import ChurchSaveButton from "./church-save-button";

export const dynamic="force-dynamic";
export const metadata:Metadata={title:"교회 정보 | airChurch",description:"공식 정보와 최근 말씀·찬양을 한곳에서 확인합니다."};

type ChurchRow={id:number;name:string;pastor:string;region:string;denomination:string;youtube_channel_id:string|null;homepage_url:string|null;channel_image_url:string|null};
type VideoRow={youtube_id:string;title:string;published_at:string};
type RelatedChurch={id:number;name:string;pastor:string;region:string;denomination:string};

export default async function ChurchPage({params}:{params:Promise<{id:string}>}){
  const {id:rawId}=await params;const id=Number(rawId);
  const db=database();await Promise.all([ensureSermonTables(db),ensurePraiseTables(db)]);
  const church=Number.isInteger(id)&&id>0?await db.prepare("SELECT id,name,pastor,region,denomination,youtube_channel_id,homepage_url,channel_image_url FROM churches WHERE id=? AND review_status='approved' LIMIT 1").bind(id).first<ChurchRow>():null;
  if(!church)return <main className="church-detail-shell"><header className="church-detail-header"><HomeReloadLink className="brand"><span className="brand-mark" aria-hidden="true"/><span>airchurch</span></HomeReloadLink><a href="/#church-directory">교회 찾기로 돌아가기</a></header><section className="church-detail-missing"><span>CHURCH DIRECTORY</span><h1>현재 공개된 교회가 아닙니다</h1><p>정보가 변경되었거나 운영 기준에 따라 보류되었을 수 있습니다.</p><a href="/#church-directory">다른 교회 찾아보기 →</a></section></main>;
  const regionPrefix=`${church.region.split(/\s+/)[0]}%`;
  const [sermons,praises,related]=await Promise.all([
    db.prepare("SELECT youtube_id,title,published_at FROM sermons WHERE church_id=? AND status='published' ORDER BY published_at DESC LIMIT 9").bind(id).all<VideoRow>(),
    db.prepare("SELECT youtube_id,title,published_at FROM praise_videos WHERE church_id=? AND status='published' ORDER BY published_at DESC LIMIT 6").bind(id).all<VideoRow>(),
    db.prepare("SELECT id,name,pastor,region,denomination FROM churches WHERE review_status='approved' AND id!=? AND (region LIKE ? OR denomination=?) ORDER BY RANDOM() LIMIT 6").bind(id,regionPrefix,church.denomination).all<RelatedChurch>(),
  ]);
  const homepage=churchHomepageUrls[church.name]||church.homepage_url;const image=churchImageUrls[church.name]||church.channel_image_url;
  const videoCard=(video:VideoRow,kind:string)=><a className="church-detail-video" href={`https://www.youtube.com/watch?v=${video.youtube_id}`} target="_blank" rel="noopener noreferrer" key={`${kind}-${video.youtube_id}`}><img src={`https://i.ytimg.com/vi/${video.youtube_id}/mqdefault.jpg`} alt="" loading="lazy" decoding="async"/><span><small>{kind} · {new Date(video.published_at).toLocaleDateString("ko-KR",{timeZone:"Asia/Seoul"})}</small><strong>{video.title}</strong><em>YouTube에서 보기 ↗</em></span></a>;
  return <main className="church-detail-shell">
    <header className="church-detail-header"><HomeReloadLink className="brand"><span className="brand-mark" aria-hidden="true"/><span>airchurch</span></HomeReloadLink><nav><a href="/#sermons">말씀</a><a href="/#church-directory">교회 찾기</a><a href="/about">운영 안내</a></nav><a className="church-detail-back" href="/#church-directory">목록으로</a></header>
    <section className="church-detail-hero"><div className="church-detail-identity">{image?<img src={image} alt="" loading="eager" referrerPolicy="no-referrer"/>:<span aria-hidden="true">교회</span>}<div><small>확인된 공식 정보</small><h1>{church.name}</h1><p>{church.pastor} · {church.region} · {church.denomination}</p></div></div><div className="church-detail-actions"><ChurchSaveButton id={church.id} name={church.name} pastor={church.pastor} region={church.region}/>{homepage&&<a href={homepage} target="_blank" rel="noopener noreferrer">공식 홈페이지 ↗</a>}{church.youtube_channel_id&&<a href={`https://www.youtube.com/channel/${church.youtube_channel_id}`} target="_blank" rel="noopener noreferrer">공식 YouTube ↗</a>}</div></section>
    <section className="church-detail-trust"><span>✓ 공개 상태</span><p>교단·노회·교회가 공개한 정보와 공식 채널을 기준으로 소개합니다. 문제가 제보되면 운영 검토 동안 노출을 보류할 수 있습니다.</p><a href="/contact">정보 수정·비공개 요청</a></section>
    <section className="church-detail-content"><div className="section-heading"><div><span className="section-kicker">최근 공식 채널</span><h2>말씀</h2></div><span className="result-count">최근 {sermons.results.length}편</span></div><div className="church-detail-video-grid">{sermons.results.map((video)=>videoCard(video,"말씀"))}{!sermons.results.length&&<p className="empty">현재 연결된 말씀이 없습니다.</p>}</div></section>
    <section className="church-detail-content"><div className="section-heading"><div><span className="section-kicker">함께 드리는 고백</span><h2>찬양</h2></div><span className="result-count">최근 {praises.results.length}편</span></div><div className="church-detail-video-grid">{praises.results.map((video)=>videoCard(video,"찬양"))}{!praises.results.length&&<p className="empty">현재 연결된 찬양이 없습니다.</p>}</div></section>
    <section className="church-detail-content church-related"><div className="section-heading"><div><span className="section-kicker">다음 발견</span><h2>가까운 교회와 같은 교단</h2></div><a href="/#church-directory">전체 교회 찾기 →</a></div><div className="church-related-grid">{related.results.map((item)=><a href={`/church/${item.id}`} key={item.id}><span>{item.region}</span><strong>{item.name}</strong><p>{item.pastor}</p><small>{item.denomination}</small><em>상세 보기 →</em></a>)}{!related.results.length&&<p className="empty">연결해 보여드릴 다른 공개 교회가 없습니다.</p>}</div></section>
    <footer className="church-detail-footer"><a href="/">airChurch 홈</a><span>발견은 airChurch에서 · 소속과 돌봄은 지역교회와 함께</span></footer>
  </main>;
}
