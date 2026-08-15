"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import HomeReloadLink from "./home-reload-link";

type Sermon = { id:number; church:string; pastor:string; region:string; denomination:string; title:string; verse:string; date:string; tone:string; rank:number; verified:boolean; thumbnailUrl?:string; youtubeId?:string };
type Praise = { youtubeId:string; title:string; thumbnailUrl:string; publishedAt:string; church:string; pastor:string; region:string; denomination:string };
type CommunityItem = { id:number; category:string; nickname:string; content:string; createdAt:string };
type TalentItem = { id:number; title:string; region:string; description:string; createdAt:string };

const sermons: Sermon[] = [
  { id:1, church:"온누리교회", pastor:"이재훈 목사", region:"서울 용산", denomination:"대한예수교장로회 통합", title:"온누리교회 최신 주일말씀", verse:"공식 채널에서 새 말씀을 자동으로 연결합니다", date:"매주 갱신", tone:"peach", rank:1, verified:true },
  { id:2, church:"분당우리교회", pastor:"이찬수 목사", region:"경기 성남", denomination:"대한예수교장로회 합동", title:"분당우리교회 최신 주일말씀", verse:"공식 채널에서 새 말씀을 자동으로 연결합니다", date:"매주 갱신", tone:"blue", rank:2, verified:true },
  { id:3, church:"여의도순복음교회", pastor:"이영훈 목사", region:"서울 영등포", denomination:"기독교대한하나님의성회", title:"여의도순복음교회 최신 주일말씀", verse:"공식 채널 검증 후 자동 연동됩니다", date:"연동 준비", tone:"green", rank:3, verified:true },
  { id:4, church:"거룩한빛광성교회", pastor:"곽승현 목사", region:"경기 고양", denomination:"대한예수교장로회 통합", title:"거룩한빛광성교회 최신 주일말씀", verse:"섬기고, 사람을 세우고, 상식이 통하는 교회", date:"매주 갱신", tone:"gold", rank:4, verified:true },
  { id:5, church:"사랑의교회", pastor:"오정현 목사", region:"서울 서초", denomination:"대한예수교장로회 합동", title:"사랑의교회 최신 주일말씀", verse:"공식 채널 검증 후 자동 연동됩니다", date:"연동 준비", tone:"lavender", rank:5, verified:true },
  { id:6, church:"소망교회", pastor:"김경진 목사", region:"서울 강남", denomination:"대한예수교장로회 통합", title:"소망교회 최신 주일말씀", verse:"공식 채널 검증 후 자동 연동됩니다", date:"연동 준비", tone:"sky", rank:6, verified:true },
];

const goals = [
  ["섬기는 공동체", "하나님과 지역사회, 형제와 이웃을 섬깁니다."],
  ["사람을 세우는 공동체", "평신도 지도자와 미래 사회·교회의 인재를 세웁니다."],
  ["상식이 통하는 공동체", "하나님만 영광받고 예수님이 주인 되며 평신도가 함께 운영합니다."],
];

const regions = [
  "전체 지역", "서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종",
  "경기", "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주",
];

export default function Home() {
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState("전체 지역");
  const [ranking, setRanking] = useState("말씀");
  const [notice, setNotice] = useState("");
  const [sermonItems,setSermonItems]=useState<Sermon[]>(sermons);
  const [praiseItems,setPraiseItems]=useState<Praise[]>([]);
  const [showAllPraise,setShowAllPraise]=useState(false);
  const [approvedPosts,setApprovedPosts]=useState<CommunityItem[]>([]);
  const [approvedTalents,setApprovedTalents]=useState<TalentItem[]>([]);
  useEffect(()=>{ let alive=true; (async()=>{ await fetch("/api/sermons/sync",{method:"POST"}).catch(()=>null); const sermonResponse=await fetch("/api/sermons").catch(()=>null); if(sermonResponse?.ok){const data=await sermonResponse.json() as {items?:Array<{youtubeId:string;title:string;thumbnailUrl:string;publishedAt:string;church:string;pastor:string;region:string;denomination:string}>}; if(alive&&data.items?.length) setSermonItems(data.items.map((item,index)=>({id:index+100,church:item.church,pastor:item.pastor,region:item.region,denomination:item.denomination,title:item.title,verse:"",date:new Date(item.publishedAt).toLocaleDateString("ko-KR"),tone:["peach","blue","green","gold","lavender","sky"][index%6],rank:index+1,verified:true,thumbnailUrl:item.thumbnailUrl,youtubeId:item.youtubeId})));} })(); return()=>{alive=false}; },[]);
  useEffect(()=>{ let alive=true; (async()=>{ await fetch("/api/praises/sync",{method:"POST"}).catch(()=>null); const response=await fetch("/api/praises").catch(()=>null); if(!response?.ok)return; const data=await response.json() as {items?:Praise[]}; if(alive)setPraiseItems(data.items||[]); })(); return()=>{alive=false}; },[]);
  useEffect(()=>{ if(location.hash==="#sermons-end") requestAnimationFrame(()=>document.querySelector("#sermons-end")?.scrollIntoView({block:"start"})); },[sermonItems]);
  useEffect(()=>{ let alive=true; Promise.all([fetch("/api/posts").then((r)=>r.ok?r.json():{items:[]}),fetch("/api/talents").then((r)=>r.ok?r.json():{items:[]})]).then(([posts,talents])=>{ if(alive){setApprovedPosts(posts.items||[]);setApprovedTalents(talents.items||[]);} }).catch(()=>null); return()=>{alive=false}; },[]);
  const filtered = useMemo(() => sermonItems.filter((s) => {
    const haystack = `${s.church} ${s.pastor} ${s.region} ${s.denomination}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase()) && (region === "전체 지역" || s.region.startsWith(region));
  }), [query, region, sermonItems]);
  const sermonChurchCount = useMemo(() => new Set(filtered.map((sermon) => sermon.church)).size, [filtered]);
  const filteredPraises = useMemo(() => praiseItems.filter((praise) => {
    const haystack = `${praise.church} ${praise.pastor} ${praise.region} ${praise.denomination} ${praise.title}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase()) && (region === "전체 지역" || praise.region.startsWith(region));
  }), [praiseItems, query, region]);
  const visiblePraises = (showAllPraise ? filteredPraises : filteredPraises.slice(0, 6)).slice(0, 12);

  async function submitInterest(event: FormEvent<HTMLFormElement>, kind: "talent" | "community") {
    event.preventDefault();
    const form = event.currentTarget;
    const body = Object.fromEntries(new FormData(form));
    try {
      const response = await fetch(`/api/${kind === "talent" ? "talents" : "posts"}`, { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify(body) });
      if (!response.ok) throw new Error();
      form.reset();
      setNotice(kind === "talent" ? "따뜻한 마음이 접수되었습니다. 연결 전 확인을 거쳐 안내할게요." : "글이 접수되었습니다. 서로를 지키기 위한 검토 후 공개됩니다.");
    } catch {
      setNotice("아직 접수 기능을 준비하고 있습니다. 화면 구성은 먼저 둘러보실 수 있어요.");
    }
  }

  async function shareVideo(video: { youtubeId?: string; title: string; church: string; pastor: string }) {
    const url = video.youtubeId ? `https://www.youtube.com/watch?v=${video.youtubeId}` : window.location.href;
    const text = `${video.church} · ${video.pastor}`;

    try {
      if (navigator.share) {
        await navigator.share({ title: video.title, text, url });
        setNotice("공유 화면을 열었습니다.");
        return;
      }

      await navigator.clipboard.writeText(url);
      setNotice("설교 링크를 복사했습니다.");
    } catch (error) {
      if ((error as { name?: string })?.name === "AbortError") return;

      try {
        await navigator.clipboard.writeText(url);
        setNotice("설교 링크를 복사했습니다.");
      } catch {
        setNotice("공유하지 못했습니다. 다시 시도해 주세요.");
      }
    }
  }

  async function handleSearchChange(value: string) {
    setQuery(value);
    if (value.trim() === "관리자1701") {
      const response = await fetch("/api/admin/unlock", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code: value }) }).catch(() => null);
      if (response?.ok) {
        setQuery("");
        window.location.replace("/admin");
      } else {
        setNotice("관리자 연결을 준비하지 못했습니다.");
      }
    }
  }

  return (
    <main>
      {notice && <div className="toast" role="status"><span>{notice}</span><button onClick={() => setNotice("")} aria-label="알림 닫기">×</button></div>}
      <header className="site-header">
        <HomeReloadLink className="brand" ariaLabel="에어처치 첫 화면 새로 불러오기"><span className="brand-mark" aria-hidden="true" /><span>airchurch</span></HomeReloadLink>
        <nav aria-label="주요 메뉴"><a href="#sermons">말씀</a><a href="#praises">찬양</a><a href="#rankings">랭킹</a><a href="#goodshare">착한나눔</a><a href="#community">광장</a><a href="#vision">비전</a></nav>
        <a className="support-button" href="#talent">내 달란트 나누기</a>
      </header>

      <section className="hero" id="top">
        <div className="eyebrow"><span /> 오늘의 말씀을 가장 가까이</div>
        <h1>좋은 말씀과<br />선한 마음이 만나는 곳</h1>
        <p>여러 교회의 설교를 한곳에서 만나고, 우리 교회를 응원하며,<br className="desktop" /> 내가 가진 달란트로 누군가의 내일을 돕는 크리스천 포털입니다.</p>
        <div className="search" role="search">
          <label className="sr-only" htmlFor="site-search">교회, 목사님, 지역 검색</label><span aria-hidden="true">⌕</span>
          <input id="site-search" value={query} onChange={(e) => handleSearchChange(e.target.value)} placeholder="교회명, 목사님, 지역으로 찾아보세요" />
          <select aria-label="지역 선택" value={region} onChange={(e) => setRegion(e.target.value)}>{regions.map((item) => <option key={item}>{item}</option>)}</select>
          <a href="#sermons">찾기</a>
        </div>
        <div className="trust-note"><span>✓</span> 교단 소속과 공식 채널을 확인한 교회만 소개합니다</div>
      </section>

      <section className="content-section" id="sermons">
        <div className="section-heading"><div><span className="section-kicker">매일 새로 만나는</span><h2>오늘의 말씀</h2></div><span className="result-count">검색한 교회 {sermonChurchCount}개 · 설교말씀 {filtered.length}개</span></div>
        <div className="sermon-grid">
          {filtered.map((sermon, index) => <article className="sermon-card" id={index === filtered.length - 1 ? "sermons-end" : undefined} key={sermon.id}>
              <div className={`sermon-thumb ${sermon.tone}`} style={sermon.thumbnailUrl?{backgroundImage:`url(${sermon.thumbnailUrl})`}:undefined}><span className="rank">{sermon.rank}</span>{sermon.youtubeId?<a className="play" href={`https://www.youtube.com/watch?v=${sermon.youtubeId}`} target="_blank" rel="noreferrer" aria-label={`${sermon.church} 설교 재생`}>▶</a>:<button aria-label={`${sermon.church} 설교 재생`}>▶</button>}<span className="duration">{sermon.date}</span></div>
            <div className="sermon-copy"><span className="fresh">{sermon.verified ? "✓ 검증 교회 · 공식 채널" : "검토 중"}</span><h3>{sermon.title}</h3><p>{sermon.pastor} · {sermon.region}</p>{sermon.verse && <small>{sermon.verse}</small>}<div className="card-actions"><button type="button" onClick={() => setNotice(`${sermon.church}를 응원했습니다. 건강한 응원만 집계됩니다.`)}>♡ 응원</button><button type="button" onClick={() => void shareVideo(sermon)}>↗ 공유</button></div></div>
          </article>)}
          {!filtered.length && <div className="empty">검색 결과가 없습니다. 교회 등록을 요청하면 확인 후 연결하겠습니다.</div>}
        </div>
      </section>

      <section className="content-section praise-section" id="praises">
        <div className="section-heading"><div><span className="section-kicker">함께 부르는 믿음의 고백</span><h2>오늘의 찬양</h2></div><span className="result-count">{filteredPraises.length}개의 찬양</span></div>
        <div className={`praise-preview${!showAllPraise && filteredPraises.length > 3 ? " is-collapsed" : ""}`}><div className="sermon-grid praise-grid">{visiblePraises.map((praise)=><article className="sermon-card" key={praise.youtubeId}>
          <div className="sermon-thumb" style={{backgroundImage:`url(${praise.thumbnailUrl})`}}><span className="rank">♪</span><a className="play" href={`https://www.youtube.com/watch?v=${praise.youtubeId}`} target="_blank" rel="noreferrer" aria-label={`${praise.church} 찬양 재생`}>▶</a><span className="duration">{new Date(praise.publishedAt).toLocaleDateString("ko-KR")}</span></div>
          <div className="sermon-copy"><span className="fresh">✓ 검증 교회 · 공식 채널</span><h3>{praise.title}</h3><p>{praise.church} · {praise.region}</p><div className="card-actions"><button type="button" onClick={()=>setNotice(`${praise.church} 찬양을 응원했습니다.`)}>♡ 응원</button><button type="button" onClick={()=>void shareVideo(praise)}>↗ 공유</button></div></div>
        </article>)}</div></div>
        {!visiblePraises.length && <div className="empty">공식 채널의 최신 찬양을 불러오고 있습니다.</div>}
        {filteredPraises.length > 3 && <button className="praise-more" type="button" onClick={()=>setShowAllPraise((shown)=>!shown)}>{showAllPraise ? "3개만 보기" : `전체 ${Math.min(12,filteredPraises.length)}개 펼쳐보기`}</button>}
      </section>

      <section className="ranking-section" id="rankings">
        <div className="ranking-intro"><span className="section-kicker light">건강한 발견을 위한 랭킹</span><h2>경쟁보다 발견,<br />인기보다 꾸준함</h2><p>목회자의 서열을 만들지 않습니다. 중복·비정상 반응을 제외하고, 작은 교회에도 발견 기회가 돌아가도록 지표별로 보여드립니다.</p><a href="#principles">집계 원칙 보기 →</a></div>
        <div className="ranking-board">
          <div className="ranking-tabs">{["말씀","작은교회","지역응원"].map((tab) => <button className={ranking === tab ? "active" : ""} onClick={() => setRanking(tab)} key={tab}>{tab}</button>)}</div>
          <p className="ranking-label">{ranking === "말씀" ? "이번 주 많이 들은 말씀" : ranking === "작은교회" ? "이번 주 새롭게 발견된 작은 교회" : "우리 지역에서 받은 따뜻한 응원"}</p>
          {sermonItems.slice(0,4).map((s, i) => <div className="ranking-row" key={s.id}><b>{i+1}</b><span className={`mini-avatar ${s.tone}`}>{s.church[0]}</span><div><strong>{ranking === "작은교회" && i === 0 ? "새빛마을교회" : s.church}</strong><small>{ranking === "지역응원" ? s.region : s.pastor}</small></div><em>{["1,284","986","743","512"][i]} <small>{ranking === "말씀" ? "청취" : "응원"}</small></em></div>)}
        </div>
      </section>

      <section className="goodshare-section" id="goodshare">
        <div className="section-heading centered"><div><span className="section-kicker">goodshare · 착한나눔</span><h2>마음이 필요한 곳에 닿도록</h2><p>돈만이 아니라 시간, 경험, 공간, 기술, 기도로 서로의 빈틈을 채웁니다.</p></div></div>
        <div className="impact-grid">
          <article><span className="impact-icon">⌂</span><small>함께 서는 교회</small><h3>작은 교회 살리기</h3><p>지역을 지키는 작은 교회의 필요한 일과 도울 수 있는 성도를 연결합니다.</p><a href="#talent">필요와 달란트 연결하기 →</a></article>
          <article><span className="impact-icon">✦</span><small>수고를 기억하는 공동체</small><h3>은퇴 목회자 동행</h3><p>오랜 섬김 뒤의 생활·건강·사역 경험이 단절되지 않도록 함께합니다.</p><a href="#talent">동행 방법 알아보기 →</a></article>
          <article className="accent"><span className="impact-icon">∞</span><small>나를 나누는 새로운 방법</small><h3>달란트 브릿지</h3><p>내가 가진 것과 할 수 있는 것, 기꺼이 내어놓는 마음을 실제 필요와 잇습니다.</p><a href="#talent">내 달란트 등록하기 →</a></article>
        </div>
      </section>

      <section className="talent-section" id="talent">
        <div><span className="section-kicker">TALENT BRIDGE</span><h2>당신의 평범한 능력이<br />누군가에겐 꼭 필요한 선물입니다</h2><p>웹사이트 제작, 사진 촬영, 차량 이동, 법률·회계 조언, 공간 제공, 반찬 한 끼까지 모두 달란트가 될 수 있습니다.</p><div className="talent-tags"><span>디자인·영상</span><span>교육·상담</span><span>수리·봉사</span><span>공간·물품</span><span>전문 지식</span><span>기도·동행</span></div></div>
        <form className="talent-form" onSubmit={(e) => submitInterest(e,"talent")}><h3>나눌 수 있는 달란트</h3><label>무엇을 나눌 수 있나요?<input name="title" required placeholder="예: 교회 홈페이지를 만들어 드릴 수 있어요" /></label><label>활동 가능 지역<input name="region" required placeholder="예: 경기 고양 또는 온라인" /></label><label>간단한 설명<textarea name="description" required placeholder="가능한 시간과 도울 수 있는 범위를 알려주세요" rows={4} /></label><input className="honeypot" name="company" tabIndex={-1} autoComplete="off" /><button type="submit">착한나눔에 마음 전하기</button><small>연락처는 공개하지 않으며, 확인된 요청과 연결할 때만 사용합니다.</small></form>
      </section>

      <section className="community-section" id="community">
        <div className="community-copy"><span className="section-kicker">서로를 지키는 익명 광장</span><h2>이름을 숨겨도,<br />말의 책임은 남도록</h2><p>신앙의 생각과 고민을 솔직하게 나누되, 교리 논쟁·비방·선동이 공동체를 해치지 않도록 모든 첫 글은 운영 원칙에 따라 검토합니다.</p><ul><li>개인정보를 요구하지 않는 별칭</li><li>신고 누적 시 자동 숨김과 운영자 확인</li><li>특정 교회·개인을 향한 확인되지 않은 비방 금지</li></ul></div>
        <form className="community-form" onSubmit={(e) => submitInterest(e,"community")}><div className="form-top"><select name="category" aria-label="글 분류"><option>신앙과 삶</option><option>말씀 나눔</option><option>우리 교회 이야기</option><option>기도 부탁</option></select><input name="nickname" maxLength={16} required placeholder="별칭" /></div><textarea name="content" required minLength={20} maxLength={1000} rows={6} placeholder="서로에게 도움이 되는 생각을 나눠주세요. (20자 이상)" /><input className="honeypot" name="company" tabIndex={-1} autoComplete="off" /><label className="agreement"><input type="checkbox" required /> 공동체 원칙과 검토 후 공개에 동의합니다.</label><button type="submit">익명으로 나누기</button></form>
      </section>

      {(approvedPosts.length > 0 || approvedTalents.length > 0) && <section className="approved-section" aria-label="공개된 공동체 이야기와 달란트">
        {approvedPosts.length > 0 && <div><span className="section-kicker">광장에서 나눈 이야기</span><h2>함께 읽는 마음</h2><div className="approved-list">{approvedPosts.map((post)=><article key={post.id}><small>{post.category}</small><h3>{post.nickname}</h3><p>{post.content}</p></article>)}</div></div>}
        {approvedTalents.length > 0 && <div><span className="section-kicker">이어진 달란트</span><h2>나눌 수 있는 선물</h2><div className="approved-list">{approvedTalents.map((talent)=><article key={talent.id}><small>{talent.region}</small><h3>{talent.title}</h3><p>{talent.description}</p></article>)}</div></div>}
      </section>}

      <section className="vision-section" id="vision">
        <div className="vision-quote"><span>우리가 향하는 한 문장</span><blockquote>“성경을 중심으로 사람을 세우고, 세상을 섬기며, 상식이 통하는 바른 공동체가 되어 지역에서 세계까지 복음을 전합니다.”</blockquote></div>
        <div className="goal-grid">{goals.map(([title,copy],i) => <article key={title}><span>0{i+1}</span><h3>{title}</h3><p>{copy}</p></article>)}</div>
        <div className="vision-footer"><div><small>3가지 핵심가치</small><strong>성경중심 · 선교중심 · 지역사회중심</strong></div><div><small>지역에서 세계까지</small><strong>지역문화 · 고양파주 · 교회개혁 · 북한선교 · 세계선교</strong></div></div>
      </section>

      <section className="safety-section" id="principles"><div><span className="section-kicker">건강한 신앙 생태계</span><h2>열린 문에는<br />분명한 기준이 필요합니다</h2></div><div className="safety-steps"><article><b>1</b><div><h3>소속 확인</h3><p>교단·노회·공식 홈페이지와 공식 영상 채널을 교차 확인합니다.</p></div></article><article><b>2</b><div><h3>독립 검토</h3><p>한 사람의 판단이 아닌 초교파 검토위원회와 공개된 기준으로 심사합니다.</p></div></article><article><b>3</b><div><h3>상시 보호</h3><p>신고, 재검토, 이의제기 절차를 두고 문제가 확인되면 노출을 즉시 중단합니다.</p></div></article><p className="safety-note">‘이단’이라는 표현은 자의적으로 붙이지 않으며, 참여 제한의 근거와 이의제기 절차를 투명하게 공개합니다.</p></div></section>

      <div className="page-jumps" aria-label="페이지 빠른 이동"><a href="#top" aria-label="맨 위로 이동" title="맨 위로">↑</a><a className="jump-logo" href="#sermons" aria-label="오늘의 말씀으로 이동" title="오늘의 말씀" /><a className="jump-praise" href="#praises" aria-label="CCM과 찬양으로 이동" title="CCM 듣기">♫</a><a href="#page-bottom" aria-label="맨 아래로 이동" title="맨 아래로">↓</a></div>
      <footer id="page-bottom">
        <HomeReloadLink className="brand footer-brand"><span className="brand-mark" aria-hidden="true" /><span>airchurch</span></HomeReloadLink><p>airchurch.net · goodshare.net · linechurch.net<br />말씀과 선한 영향력을 잇는 하나의 공동체</p><div><a href="#principles">운영원칙</a><a href="#vision">비전</a><a href="#community">문의</a><a href="/admin">관리자</a></div>
      </footer>
    </main>
  );
}
