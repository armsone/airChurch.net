"use client";

import { FormEvent, lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import HomeReloadLink from "./home-reload-link";
import { matchesSearchTerms, metadataSearchValue, normalizeSearchValue } from "./search-domain";
import { fetchSearchSuggestions, SearchSuggestion } from "./search-suggestions-client";
import { hasSavedItemNewSermon, readSavedItems, SavedItem, writeSavedItems } from "./saved-items";
import SkipLink from "./skip-link";
import { shouldUseLowData } from "./low-data";

const ChurchControls = lazy(() => import("./admin/admin-controls").then((module) => ({ default: module.ChurchControls })));
const PastorControls = lazy(() => import("./admin/admin-controls").then((module) => ({ default: module.PastorControls })));

type Sermon = { id:number; church:string; pastor:string; region:string; denomination:string; title:string; verse:string; date:string; publishedAt?:string; tone:string; rank:number; verified:boolean; thumbnailUrl?:string; youtubeId?:string };
type Praise = { youtubeId:string; title:string; thumbnailUrl:string; publishedAt:string; church:string; pastor:string; region:string; denomination:string; pinned?:boolean };
type Short = { youtubeId:string; title:string; thumbnailUrl:string; publishedAt:string; church:string; pastor:string; region:string; denomination:string };
type ChurchNews = { title:string; summary:string; url:string; publishedAt:string; source:string; tone:string };
type ChurchNewsSource = { name:string; rssUrl:string; homepage:string };
type YouTubePlayer = { loadVideoById:(videoId:string)=>void; playVideo:()=>void; mute:()=>void; unMute:()=>void; getVideoData:()=>{video_id?:string} };
type YouTubeEvent = { data?:number; target:YouTubePlayer };
type YouTubeApi = { Player:new(
  element:HTMLIFrameElement,
  options:{events:{onReady:(event:YouTubeEvent)=>void; onStateChange:(event:YouTubeEvent)=>void; onError:(event:YouTubeEvent)=>void}}
)=>YouTubePlayer };
type CommunityItem = { id:number; category:string; nickname:string; content:string; createdAt:string };
type TalentItem = { id:number; title:string; region:string; description:string; createdAt:string };
type ChurchItem = { id:number; name:string; pastor:string; region:string; denomination:string; youtubeChannelId?:string|null; channelImageUrl?:string|null; homepageUrl?:string|null; priorityWeight?:number };
type PastorItem = { person_id:number|null; public_id:number|null; role_id:number|null; church_id:number|null; minister_id:number|null; name:string; role_title:string; role_titles:string; role_status:string; church_name:string|null; region:string|null; denomination:string|null; photo_url:string|null; source_url:string|null; merged_count:number };

const normalizeSearchText=normalizeSearchValue;
const prefersLowData=()=>{const connection=(navigator as Navigator&{connection?:{saveData?:boolean;effectiveType?:string}}).connection;return shouldUseLowData(connection?.saveData,connection?.effectiveType,window.matchMedia("(max-width: 600px)").matches);};

function denominationMark(denomination:string) {
  if (denomination === "대한예수교장로회 통합") return { src:"/denominations/pck-tonghap.png", alt:"대한예수교장로회 통합 교단 심볼" };
  if (denomination === "대한예수교장로회 합동") return { src:"/denominations/pck-hapdong.svg", alt:"대한예수교장로회 합동 교단 심볼" };
  if (denomination === "기독교대한감리회") return { src:"/denominations/kmc.ico", alt:"기독교대한감리회 교단 심볼" };
  if (denomination === "대한예수교장로회 고신") return { src:"/denominations/pck-kosin.jpg", alt:"대한예수교장로회 고신 교단 심볼" };
  if (denomination === "기독교한국침례회") return { src:"/denominations/kbch.png", alt:"기독교한국침례회 공식 로고" };
  if (denomination === "기독교대한성결교회") return { src:"/denominations/kehc-256.png", alt:"기독교대한성결교회 교단 심볼" };
  if (denomination === "대한예수교장로회 합신") return { src:"/denominations/pck-hapshin.png", alt:"대한예수교장로회 합신 공식 로고" };
  if (denomination === "대한예수교장로회 백석") return { src:"/denominations/pck-baekseok-256.png", alt:"대한예수교장로회 백석 교단 심볼" };
  if (denomination === "기독교대한하나님의성회") return { src:"/denominations/agk.png", alt:"기독교대한하나님의성회 공식 로고" };
  if (denomination === "기독교대한하나님의성회 광화문총회") return { src:"/denominations/agk-gwanghwamun.png", alt:"기독교대한하나님의성회 광화문총회 공식 로고" };
  if (denomination === "한국기독교장로회") return { src:"/denominations/prok-256.png", alt:"한국기독교장로회 교단 심볼" };
  if (denomination === "한국독립교회선교단체연합회") return { src:"/denominations/kaicam.png", alt:"한국독립교회선교단체연합회 공식 로고" };
  return null;
}

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
const dailyGuides = [
  { day:"주일", theme:"예배와 공동체", reference:"시편 122:1", question:"오늘 예배에서 마음에 오래 남은 한 문장은 무엇인가요?" },
  { day:"월요일", theme:"새로운 한 주", reference:"잠언 3:5-6", question:"이번 주 하나님께 맡기고 한 걸음 내디딜 일은 무엇인가요?" },
  { day:"화요일", theme:"일과 섬김", reference:"골로새서 3:23", question:"오늘 내가 맡은 일을 사랑으로 바꿀 수 있는 작은 행동은 무엇인가요?" },
  { day:"수요일", theme:"기도와 평안", reference:"빌립보서 4:6-7", question:"지금 염려 대신 기도로 올려드릴 한 가지는 무엇인가요?" },
  { day:"목요일", theme:"관계와 사랑", reference:"요한복음 13:34-35", question:"오늘 먼저 이해하고 품어야 할 사람은 누구인가요?" },
  { day:"금요일", theme:"쉼과 회복", reference:"마태복음 11:28", question:"한 주의 무게 가운데 내려놓아야 할 것은 무엇인가요?" },
  { day:"토요일", theme:"감사와 준비", reference:"데살로니가전서 5:16-18", question:"이번 주에 발견한 감사 세 가지를 떠올려 보세요." },
] as const;
const discoveryTopics=[
  {name:"위로",copy:"지친 마음에 머무는 말씀",symbol:"쉼"},
  {name:"기도",copy:"염려를 맡기고 다시 시작하기",symbol:"맡김"},
  {name:"가정",copy:"사랑과 관계를 세우는 지혜",symbol:"사랑"},
  {name:"청년",copy:"진로와 믿음 사이의 질문",symbol:"길"},
  {name:"믿음",copy:"흔들릴 때 붙드는 복음",symbol:"뿌리"},
  {name:"감사",copy:"평범한 하루에서 은혜 찾기",symbol:"기쁨"},
] as const;

function easterSunday(year:number){
  const a=year%19,b=Math.floor(year/100),c=year%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),month=Math.floor((h+l-7*m+114)/31),day=(h+l-7*m+114)%31+1;
  return new Date(Date.UTC(year,month-1,day));
}
function seasonGuide(now:Date){
  const date=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate())),year=date.getUTCFullYear(),day=24*60*60*1000,easter=easterSunday(year),lentStart=new Date(easter.getTime()-46*day),pentecost=new Date(easter.getTime()+49*day),nov27=new Date(Date.UTC(year,10,27)),adventStart=new Date(nov27.getTime()+((7-nov27.getUTCDay())%7)*day),christmas=new Date(Date.UTC(year,11,25)),epiphanyEnd=new Date(Date.UTC(year+1,0,6));
  if(date>=adventStart&&date<christmas)return {name:"대림절",copy:"기다림 속에서 오시는 주님을 바라보는 시간",reference:"이사야 9:6",accent:"기다림"};
  if(date>=christmas&&date<=epiphanyEnd)return {name:"성탄절",copy:"우리 가운데 오신 예수님의 사랑을 기뻐하는 시간",reference:"누가복음 2:10-11",accent:"기쁨"};
  if(date>=lentStart&&date<easter)return {name:"사순절",copy:"십자가를 바라보며 삶을 돌아보는 시간",reference:"마가복음 8:34",accent:"성찰"};
  if(date>=easter&&date<=pentecost)return {name:"부활절기",copy:"부활의 소망을 일상에서 살아내는 시간",reference:"고린도전서 15:20",accent:"소망"};
  return {name:"성령강림 후",copy:"말씀을 삶과 이웃 사랑으로 이어가는 성장의 시간",reference:"갈라디아서 5:22-23",accent:"성장"};
}

const regions = [
  "전체", "서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종",
  "경기", "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주",
];
const knownDenominations = [
  "대한예수교장로회 통합", "대한예수교장로회 합동", "기독교대한감리회", "대한예수교장로회 고신",
  "기독교한국침례회", "기독교대한성결교회", "대한예수교장로회 합신", "대한예수교장로회 백석",
  "기독교대한하나님의성회", "기독교대한하나님의성회 광화문총회", "한국기독교장로회", "독립교회", "한국독립교회선교단체연합회",
];
const churchSourceRows = knownDenominations.map((denomination) => ({
  denomination,
  source: "교단·노회 공개 홈페이지 및 공식 YouTube 채널",
  access: "공개(로그인 없이 열람 가능)",
  lastChecked: "공개 자료 확인 시 갱신",
}));

function shuffled<T>(items: T[]) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

let youtubeApiPromise:Promise<YouTubeApi>|null=null;
function loadYouTubeApi() {
  if(youtubeApiPromise) return youtubeApiPromise;
  youtubeApiPromise=new Promise<YouTubeApi>((resolve)=>{
    const browserWindow=window as Window&{YT?:YouTubeApi;onYouTubeIframeAPIReady?:()=>void};
    if(browserWindow.YT?.Player) { resolve(browserWindow.YT); return; }
    const previousReady=browserWindow.onYouTubeIframeAPIReady;
    browserWindow.onYouTubeIframeAPIReady=()=>{
      previousReady?.();
      if(browserWindow.YT?.Player) resolve(browserWindow.YT);
    };
    if(!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const script=document.createElement("script");
      script.src="https://www.youtube.com/iframe_api";
      document.head.appendChild(script);
    }
  });
  return youtubeApiPromise;
}

function LoadingCards({ count = 3 }: { count?: number }) {
  return Array.from({ length: count }, (_, index) => (
    <article className="sermon-card skeleton-card" aria-hidden="true" key={`skeleton-${index}`}>
      <div className="sermon-thumb skeleton-thumb" />
      <div className="sermon-copy skeleton-copy">
        <span className="skeleton-line skeleton-kicker" />
        <span className="skeleton-line skeleton-title" />
        <span className="skeleton-line skeleton-meta" />
        <div className="skeleton-actions"><span /><span /></div>
      </div>
    </article>
  ));
}

export default function Home({initialQuery=""}:{initialQuery?:string}) {
  const koreanNow=new Date(Date.now()+9*60*60*1000);
  const todayGuide=dailyGuides[koreanNow.getUTCDay()];
  const currentSeason=seasonGuide(koreanNow);
  const todayKey=koreanNow.toISOString().slice(0,10);
  const [query, setQuery] = useState(initialQuery);
  const [region, setRegion] = useState("전체");
  const [denomination, setDenomination] = useState("전체 교단");
  const [notice, setNotice] = useState("");
  const [activeVideoId,setActiveVideoId]=useState<string|null>(null);
  const [sermonItems,setSermonItems]=useState<Sermon[]>([]);
  const [sermonLoading,setSermonLoading]=useState(true);
  const [visibleSermonCount,setVisibleSermonCount]=useState(8);
  const [praiseItems,setPraiseItems]=useState<Praise[]>([]);
  const [praiseLoading,setPraiseLoading]=useState(true);
  const [showAllPraise,setShowAllPraise]=useState(false);
  const [shortItems,setShortItems]=useState<Short[]>([]);
  const [shortLoading,setShortLoading]=useState(true);
  const [activeShortIndex,setActiveShortIndex]=useState<number|null>(null);
  const [shortMuted,setShortMuted]=useState(true);
  const pullToRefreshStartRef=useRef<number|null>(null);
  const pullToRefreshDistanceRef=useRef(0);
  const shortPlayerRef=useRef<HTMLIFrameElement>(null);
  const shortViewerRef=useRef<HTMLDivElement>(null);
  const shortCloseButtonRef=useRef<HTMLButtonElement>(null);
  const shortTriggerRef=useRef<HTMLElement|null>(null);
  const shortPlayerInstanceRef=useRef<YouTubePlayer|null>(null);
  const shortViewerInitialIdRef=useRef<string|undefined>(undefined);
  const activeShortIdRef=useRef<string|undefined>(undefined);
  const shortMutedRef=useRef(true);
  const shortPlayerPlayPendingRef=useRef(false);
  const shortAutoSkipCountRef=useRef(0);
  const filteredShortsLengthRef=useRef(0);
  const pastorBucketRef=useRef(0);
  const shortViewerEmbedBase = "https://www.youtube-nocookie.com/embed";
  const [churchNews,setChurchNews]=useState<ChurchNews[]>([]);
  const [visibleChurchNews,setVisibleChurchNews]=useState<ChurchNews[]>([]);
  const [churchNewsSources,setChurchNewsSources]=useState<ChurchNewsSource[]>([]);
  const [churchNewsLoading,setChurchNewsLoading]=useState(true);
  const [approvedPosts,setApprovedPosts]=useState<CommunityItem[]>([]);
  const [approvedTalents,setApprovedTalents]=useState<TalentItem[]>([]);
  const [churchItems,setChurchItems]=useState<ChurchItem[]>([]);
  const [churchTotal,setChurchTotal]=useState(0);
  const [pastorItems,setPastorItems]=useState<PastorItem[]>([]);
  const [pastorBrowseItems,setPastorBrowseItems]=useState<PastorItem[]>([]);
  const [pastorTotal,setPastorTotal]=useState(0);
  const [pastorLoading,setPastorLoading]=useState(true);
  const [pastorVisibleCount,setPastorVisibleCount]=useState(12);
  const [pastorQuery,setPastorQuery]=useState("");
  const [selectedPastors,setSelectedPastors]=useState<Set<number>>(()=>new Set());
  const [pastorBatchBusy,setPastorBatchBusy]=useState(false);
  const [searchSuggestions,setSearchSuggestions]=useState<SearchSuggestion[]>([]);
  const [churchLoading,setChurchLoading]=useState(true);
  const [churchRadarRefresh,setChurchRadarRefresh]=useState(0);
  const [showAllChurches,setShowAllChurches]=useState(false);
  const [showRecommendationForm,setShowRecommendationForm]=useState(false);
  const [churchQuery,setChurchQuery]=useState("");
  const [churchSearch,setChurchSearch]=useState<{query:string;items:ChurchItem[];total:number}|null>(null);
  const [churchSearchLoading,setChurchSearchLoading]=useState(false);
  const [isAdmin,setIsAdmin]=useState(false);
  const [savedItems,setSavedItems]=useState<SavedItem[]>([]);
  const [dailyCompleted,setDailyCompleted]=useState<string[]>([]);
  const [dailyNote,setDailyNote]=useState("");
  const [personalStateReady,setPersonalStateReady]=useState(false);
  async function runPastorBatch(status:"approved"|"removed"|"deleted"){
    const ids=[...selectedPastors];if(!ids.length)return;
    const action=status==="approved"?"공개":status==="removed"?"보류":"삭제";
    if(!window.confirm(`선택한 ${ids.length}명의 목회자를 ${action}할까요?`))return;
    setPastorBatchBusy(true);
    try{const response=await fetch("/api/admin/manage",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({kind:"pastor-batch",ids,status})});const result=await response.json() as {error?:string};if(!response.ok)throw new Error(result.error||"처리하지 못했습니다.");window.location.reload();}catch(error){window.alert((error as Error).message);setPastorBatchBusy(false);}
  }
  useEffect(()=>{
    const refreshPersonalState=()=>{try {
      const completed=JSON.parse(localStorage.getItem(`airchurch:daily:${todayKey}`)||"[]") as string[];
      setSavedItems(readSavedItems());setDailyCompleted(Array.isArray(completed)?completed:[]);
      setDailyNote(localStorage.getItem(`airchurch:note:${todayKey}`)||"");
    } catch { /* 손상된 브라우저 저장값은 빈 상태로 시작합니다. */ }};
    refreshPersonalState();
    setPersonalStateReady(true);
    window.addEventListener("focus",refreshPersonalState);window.addEventListener("storage",refreshPersonalState);
    return()=>{window.removeEventListener("focus",refreshPersonalState);window.removeEventListener("storage",refreshPersonalState);};
  },[todayKey]);
  useEffect(()=>{if(prefersLowData())return;const controller=new AbortController(),fresh=sessionStorage.getItem("airchurch:church-cache-bust"),params=new URLSearchParams({countOnly:"1"});if(fresh)params.set("adminFresh",fresh);fetch(`/api/churches?${params}`,{cache:fresh?"no-store":"default",signal:controller.signal}).then((response)=>response.ok?response.json():null).then((result)=>{if(!controller.signal.aborted&&typeof result?.total==="number")setChurchTotal(result.total);}).catch(()=>{});return()=>controller.abort();},[]);
  useEffect(()=>{const controller=new AbortController();fetch("/api/admin/session",{cache:"no-store",signal:controller.signal}).then((response)=>response.ok?response.json():null).then((session)=>{if(!controller.signal.aborted)setIsAdmin(session?.role==="admin");}).catch(()=>{});return()=>controller.abort();},[]);
  useEffect(()=>{const term=query.trim();if(normalizeSearchText(term).length<2){setSearchSuggestions([]);return;}const controller=new AbortController(),timer=window.setTimeout(()=>{fetchSearchSuggestions(term,controller.signal).then(setSearchSuggestions).catch((error)=>{if(error?.name!=="AbortError")setSearchSuggestions([]);});},180);return()=>{window.clearTimeout(timer);controller.abort();};},[query]);
  useEffect(()=>{
    const resetPull=()=>{pullToRefreshStartRef.current=null;pullToRefreshDistanceRef.current=0;};
    const onTouchStart=(event:TouchEvent)=>{pullToRefreshStartRef.current=window.scrollY===0&&event.touches.length===1?event.touches[0].clientY:null;pullToRefreshDistanceRef.current=0;};
    const onTouchMove=(event:TouchEvent)=>{const start=pullToRefreshStartRef.current;if(start===null||window.scrollY>0||event.touches.length!==1)return;pullToRefreshDistanceRef.current=Math.max(0,event.touches[0].clientY-start);};
    const onTouchEnd=()=>{const shouldRefresh=pullToRefreshDistanceRef.current>=90;resetPull();if(shouldRefresh)window.location.reload();};
    window.addEventListener("touchstart",onTouchStart,{passive:true});
    window.addEventListener("touchmove",onTouchMove,{passive:true});
    window.addEventListener("touchend",onTouchEnd,{passive:true});
    window.addEventListener("touchcancel",resetPull,{passive:true});
    return()=>{window.removeEventListener("touchstart",onTouchStart);window.removeEventListener("touchmove",onTouchMove);window.removeEventListener("touchend",onTouchEnd);window.removeEventListener("touchcancel",resetPull);};
  },[]);
  useEffect(()=>{
    let alive=true;
    const controller=new AbortController();
    const loadItems=(url:string)=>fetch(url,{signal:controller.signal}).then((response)=>response.ok?response.json():{items:[]}).catch(()=>({items:[]}));
    const lowData=prefersLowData();
    const todayBucket=Math.floor(Date.now()/86400000)%50;let browserSeed=Number(sessionStorage.getItem("airchurch:pastor-bucket-seed"));if(!Number.isInteger(browserSeed)||browserSeed<0||browserSeed>49){browserSeed=Math.floor(Math.random()*50);sessionStorage.setItem("airchurch:pastor-bucket-seed",String(browserSeed));}pastorBucketRef.current=(todayBucket+browserSeed)%50;
    const loaders: Record<string, () => void> = {
      sermons: ()=>loadItems(`/api/sermons?limit=${lowData?12:60}`).then((sermonData)=>{
        if(!alive) return;
        const sermonResults=(sermonData as {items?:Array<{youtubeId:string;title:string;thumbnailUrl:string;publishedAt:string;church:string;pastor:string;region:string;denomination:string}>}).items;
        setSermonItems(sermonResults?.length ? sermonResults.map((item,index)=>({id:index+100,church:item.church,pastor:item.pastor,region:item.region,denomination:item.denomination,title:item.title,verse:"",date:new Date(item.publishedAt).toLocaleDateString("ko-KR"),publishedAt:item.publishedAt,tone:["peach","blue","green","gold","lavender","sky"][index%6],rank:index+1,verified:true,thumbnailUrl:item.thumbnailUrl,youtubeId:item.youtubeId})) : sermons);
        setSermonLoading(false);
      }),
      praises: ()=>loadItems(`/api/praises?limit=${lowData?12:48}`).then((data)=>{
        if(!alive) return;
        const items=(data as {items?:Praise[]}).items||[];
        setPraiseItems([...items.filter((item)=>item.pinned),...shuffled(items.filter((item)=>!item.pinned))]);
        setPraiseLoading(false);
      }),
      shorts: ()=>loadItems(`/api/shorts?limit=${lowData?12:60}`).then((data)=>{
        if(!alive) return;
        setShortItems((data as {items?:Short[]}).items||[]);
        setShortLoading(false);
      }),
      "church-news": ()=>loadItems("/api/church-news").then((data)=>{
        if(!alive) return;
        const result=data as {items?:ChurchNews[];sources?:ChurchNewsSource[]};
        const items=result.items||[];
        setChurchNews(items);
        setVisibleChurchNews(shuffled(items).slice(0,9));
        setChurchNewsSources(result.sources||[]);
        setChurchNewsLoading(false);
      }),
      community: ()=>loadItems("/api/posts").then((data)=>{
        if(alive) setApprovedPosts((data as {items?:CommunityItem[]}).items||[]);
      }),
      talent: ()=>loadItems("/api/talents").then((data)=>{
        if(alive) setApprovedTalents((data as {items?:TalentItem[]}).items||[]);
      }),
      "church-directory": ()=>{const fresh=sessionStorage.getItem("airchurch:church-cache-bust");return loadItems(`/api/churches${fresh?`?adminFresh=${encodeURIComponent(fresh)}`:""}`).then((data)=>{
        if(!alive) return;
        const result=data as {items?:ChurchItem[];total?:number};
        setChurchItems(result.items||[]);
        setChurchTotal(result.total??result.items?.length??0);
        setChurchLoading(false);
      })},
      "pastor-directory": ()=>{const fresh=sessionStorage.getItem("airchurch:pastor-cache-bust"),params=new URLSearchParams({limit:String(lowData?8:12),sample:String(pastorBucketRef.current)});if(fresh)params.set("adminFresh",fresh);return loadItems(`/api/pastors?${params}`).then((data)=>{
        if(!alive) return;
        const result=data as {items?:PastorItem[];total?:number};
        setPastorItems(result.items||[]);
        setPastorBrowseItems(result.items||[]);
        setPastorTotal(result.total??result.items?.length??0);
        setPastorLoading(false);
      })},
    };
    const loaded=new Set<string>();
    const loadSection=(id:string)=>{ if(!loaded.has(id)){ loaded.add(id);loaders[id]?.(); } };
    if(!("IntersectionObserver" in window)) {
      Object.keys(loaders).forEach(loadSection);
      return()=>{alive=false;controller.abort();};
    }
    const observer=new IntersectionObserver((entries)=>entries.forEach((entry)=>{
      if(entry.isIntersecting) { loadSection(entry.target.id);observer.unobserve(entry.target); }
    }),{rootMargin:lowData?"200px 0px":"800px 0px"});
    Object.keys(loaders).forEach((id)=>{ const section=document.getElementById(id);if(section) observer.observe(section); });
    return()=>{alive=false;controller.abort();observer.disconnect();};
  },[]);
  useEffect(()=>{
    const trimmed=churchQuery.trim(),global=query.trim(),active=Boolean(trimmed||global||region!=="전체"||denomination!=="전체 교단"),searchKey=[trimmed,global,region,denomination].join("|");
    if(!active) {
      const resetTimer=window.setTimeout(()=>{setChurchSearch(null);setChurchSearchLoading(false);},0);
      return()=>window.clearTimeout(resetTimer);
    }
    const controller=new AbortController();
    const timer=window.setTimeout(async()=>{
      setChurchSearchLoading(true);
      const params=new URLSearchParams();
      if(trimmed) params.set("q",trimmed);
      if(global) params.set("global",global);
      if(region!=="전체") params.set("region",region);
      if(denomination!=="전체 교단") params.set("denomination",denomination);
      const fresh=sessionStorage.getItem("airchurch:church-cache-bust");if(fresh)params.set("adminFresh",fresh);
      try {
        const response=await fetch(`/api/churches?${params}`,{cache:fresh?"no-store":"default",signal:controller.signal});
        if(!response.ok) throw new Error();
        const data=await response.json() as {items?:ChurchItem[];total?:number};
        setChurchSearch({query:searchKey,items:data.items??[],total:data.total??data.items?.length??0});
      } catch(error) {
        if((error as {name?:string}).name!=="AbortError") setChurchSearch({query:searchKey,items:[],total:0});
      } finally {
        if(!controller.signal.aborted) setChurchSearchLoading(false);
      }
    },300);
    return()=>{window.clearTimeout(timer);controller.abort();};
  },[churchQuery,query,region,denomination]);
  useEffect(()=>{
    const active=Boolean(pastorQuery.trim()||query.trim()||region!=="전체"||denomination!=="전체 교단");
    if(!active){setPastorItems(pastorBrowseItems);setPastorVisibleCount(12);return;}
    const controller=new AbortController(),timer=window.setTimeout(async()=>{
      setPastorLoading(true);setPastorVisibleCount(12);
      const params=new URLSearchParams({limit:"120"});
      if(pastorQuery.trim()) params.set("q",pastorQuery.trim());
      if(query.trim()) params.set("global",query.trim());
      if(region!=="전체") params.set("region",region);
      if(denomination!=="전체 교단") params.set("denomination",denomination);
      const fresh=sessionStorage.getItem("airchurch:pastor-cache-bust");if(fresh)params.set("adminFresh",fresh);
      try{const response=await fetch(`/api/pastors?${params}`,{cache:fresh?"no-store":"default",signal:controller.signal});if(!response.ok)throw new Error();const result=await response.json() as {items?:PastorItem[];total?:number};setPastorItems(result.items||[]);setPastorTotal(result.total??result.items?.length??0);}catch(error){if((error as {name?:string}).name!=="AbortError"){setPastorItems([]);setPastorTotal(0);}}finally{if(!controller.signal.aborted)setPastorLoading(false);}
    },300);
    return()=>{window.clearTimeout(timer);controller.abort();};
  },[pastorQuery,query,region,denomination,pastorBrowseItems]);
  useEffect(()=>{ if(location.hash==="#sermons-end") requestAnimationFrame(()=>document.querySelector("#sermons-end")?.scrollIntoView({block:"start"})); },[sermonItems]);
  const filtered = useMemo(() => sermonItems.filter((s) => {
    const haystack = metadataSearchValue(s.church,s.pastor,s.region,s.denomination,`${s.title}${s.verse}`);
    return matchesSearchTerms(haystack,query) && (region === "전체" || s.region.startsWith(region)) && (denomination === "전체 교단" || s.denomination === denomination);
  }), [query, region, denomination, sermonItems]);
  const visibleSermons = filtered.slice(0,visibleSermonCount);
  const previewSermons = filtered.slice(visibleSermonCount,visibleSermonCount+4);
  const sermonChurchCount = useMemo(() => new Set(filtered.map((sermon) => sermon.church)).size, [filtered]);
  const filteredPraises = useMemo(() => praiseItems.filter((praise) => {
    const haystack = metadataSearchValue(praise.church,praise.pastor,praise.region,praise.denomination,praise.title);
    return matchesSearchTerms(haystack,query) && (region === "전체" || praise.region.startsWith(region)) && (denomination === "전체 교단" || praise.denomination === denomination);
  }), [praiseItems, query, region, denomination]);
  const visiblePraises = (showAllPraise ? filteredPraises : filteredPraises.slice(0, 4)).slice(0, 12);
  const filteredShorts = useMemo(() => shortItems.filter((short) => {
    const haystack = metadataSearchValue(short.church,short.pastor,short.region,short.denomination,short.title);
    return matchesSearchTerms(haystack,query) && (region === "전체" || short.region.startsWith(region)) && (denomination === "전체 교단" || short.denomination === denomination);
  }), [shortItems, query, region, denomination]);
  const visibleShorts = filteredShorts.slice(0, 12);
  filteredShortsLengthRef.current = filteredShorts.length;
  function showDifferentChurchNews() {
    setVisibleChurchNews((current)=>{
      const currentUrls=new Set(current.map((item)=>item.url));
      const unseen=churchNews.filter((item)=>!currentUrls.has(item.url));
      const pool=unseen.length>=9?unseen:[...unseen,...churchNews.filter((item)=>currentUrls.has(item.url))];
      return shuffled(pool).slice(0,9);
    });
  }
  async function showDifferentPastors(){
    setPastorLoading(true);setPastorVisibleCount(12);
    pastorBucketRef.current=(pastorBucketRef.current+1)%50;const params=new URLSearchParams({limit:"12",sample:String(pastorBucketRef.current)}),fresh=sessionStorage.getItem("airchurch:pastor-cache-bust");if(pastorTotal>0)params.set("knownTotal",String(pastorTotal));if(fresh)params.set("adminFresh",fresh);
    try{const response=await fetch(`/api/pastors?${params}`,{cache:fresh?"no-store":"default"});if(!response.ok)throw new Error();const result=await response.json() as {items?:PastorItem[];total?:number};const items=result.items||[];setPastorBrowseItems(items);setPastorItems(items);setPastorTotal(result.total??items.length);}catch{setNotice("다른 목회자를 불러오지 못했습니다. 잠시 후 다시 눌러 주세요.");}finally{setPastorLoading(false);}
  }
  const activeShort = activeShortIndex !== null ? filteredShorts[activeShortIndex] : undefined;
  activeShortIdRef.current=activeShort?.youtubeId;
  shortMutedRef.current=shortMuted;
  if(activeShort && shortViewerInitialIdRef.current===undefined) shortViewerInitialIdRef.current=activeShort.youtubeId;
  if(!activeShort) { shortViewerInitialIdRef.current=undefined; shortAutoSkipCountRef.current=0; }
  const shortViewerEmbedUrl = `${shortViewerEmbedBase}/${shortViewerInitialIdRef.current}?autoplay=1&mute=1&rel=0&playsinline=1&enablejsapi=1&cc_load_policy=0`;
  useEffect(()=>{
    if(activeShortIndex===null) return;
    function onKeyDown(event:KeyboardEvent) {
      if(event.key==="Escape") { setActiveShortIndex(null); return; }
      if(event.key==="Tab") {
        const focusable=Array.from(shortViewerRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), iframe, [href], [tabindex]:not([tabindex="-1"])')??[]);
        if(!focusable.length)return;
        const first=focusable[0],last=focusable[focusable.length-1];
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
        return;
      }
      if(event.key==="ArrowUp") { event.preventDefault(); setActiveShortIndex((current)=>current!==null && current>0 ? current-1 : current); return; }
      if(event.key==="ArrowDown") { event.preventDefault(); setActiveShortIndex((current)=>current!==null && current<filteredShorts.length-1 ? current+1 : current); }
    }
    window.addEventListener("keydown",onKeyDown);
    return ()=>window.removeEventListener("keydown",onKeyDown);
  },[activeShortIndex,filteredShorts.length]);
  const shortViewerOpen=activeShortIndex!==null;
  useEffect(()=>{
    if(!shortViewerOpen)return;
    const timer=window.setTimeout(()=>shortCloseButtonRef.current?.focus(),0);
    return()=>{window.clearTimeout(timer);shortTriggerRef.current?.focus();};
  },[shortViewerOpen]);
  useEffect(()=>{
    if(!activeShort) { shortPlayerInstanceRef.current=null; return; }
  const startMutedPlayback=(player:YouTubePlayer)=>{
        if(shortMutedRef.current) player.mute(); else player.unMute();
        player.playVideo();
  };
    const requestPlay = () => {
      const player = shortPlayerInstanceRef.current;
      if(!player) return;
      if(!shortPlayerPlayPendingRef.current) return;
      shortPlayerPlayPendingRef.current = false;
      startMutedPlayback(player);
    };

    if(shortPlayerInstanceRef.current) {
      shortPlayerInstanceRef.current.loadVideoById(activeShort.youtubeId);
      shortPlayerPlayPendingRef.current = true;
      requestPlay();
      return;
    }
    if(!shortPlayerRef.current) return;
    let cancelled=false;
    const playerFrame=shortPlayerRef.current;
    shortPlayerPlayPendingRef.current = true;
    void loadYouTubeApi().then((youtube)=>{
      if(cancelled) return;
      shortPlayerInstanceRef.current=new youtube.Player(playerFrame,{
        events:{
          onReady: (event: YouTubeEvent) => {
            shortPlayerInstanceRef.current = event.target;
            event.target.mute();
            event.target.playVideo();
            requestPlay();
          },
          onStateChange:(event)=>{
            if(event.data===1) shortAutoSkipCountRef.current=0;
            if(event.data===5) { requestPlay(); return; }
            if(event.data!==0) return;
            const endedVideoId=event.target.getVideoData().video_id;
            if(endedVideoId&&endedVideoId!==activeShortIdRef.current) return;
            setActiveShortIndex((current)=>current===null?current:current<filteredShortsLengthRef.current-1?current+1:0);
          },
          onError:(event)=>{
            if(event.data!==101&&event.data!==150)return;
            if(shortAutoSkipCountRef.current>=filteredShortsLengthRef.current-1)return;
            shortAutoSkipCountRef.current+=1;
            setActiveShortIndex((current)=>current===null?current:current<filteredShortsLengthRef.current-1?current+1:0);
          },
        },
      });
    });
    return ()=>{cancelled=true;};
  },[activeShort?.youtubeId]);
  function unmuteShort() {
    shortPlayerInstanceRef.current?.unMute();
    setShortMuted(false);
  }
  const trimmedChurchQuery=churchQuery.trim();
  const hasActiveChurchFilter = Boolean(query.trim() || trimmedChurchQuery || region !== "전체" || denomination !== "전체 교단");
  const churchSearchKey=[trimmedChurchQuery,query.trim(),region,denomination].join("|");
  const currentChurchSearch=churchSearch?.query===churchSearchKey?churchSearch:null;
  const filteredChurches = useMemo(() => {
    const trimmedGlobal = query.trim();
    const source=hasActiveChurchFilter?(currentChurchSearch?.items??[]):churchItems;
    return source.filter((church) => {
      const haystack = metadataSearchValue(church.name,church.pastor,church.region,church.denomination);
      const matchesGlobal = !trimmedGlobal || matchesSearchTerms(haystack,trimmedGlobal);
      return matchesGlobal && (region === "전체" || church.region.startsWith(region)) && (denomination === "전체 교단" || church.denomination === denomination);
    });
  }, [churchItems, currentChurchSearch, hasActiveChurchFilter, query, region, denomination]);
  const denominationOptions=useMemo(()=>["전체 교단",...Array.from(new Set([...knownDenominations,...churchItems.map((church)=>church.denomination),...sermonItems.map((sermon)=>sermon.denomination),...praiseItems.map((praise)=>praise.denomination)])).filter(Boolean).sort((a,b)=>a.localeCompare(b,"ko"))],[churchItems,sermonItems,praiseItems]);
  const radarChurches=useMemo(()=>{
    if(hasActiveChurchFilter) return filteredChurches;
    const prioritized=filteredChurches.filter((church)=>(church.priorityWeight??1)>1).sort((a,b)=>(b.priorityWeight??1)-(a.priorityWeight??1));
    const standard=shuffled(filteredChurches.filter((church)=>(church.priorityWeight??1)<=1));
    if(standard.length&&churchRadarRefresh) standard.push(...standard.splice(0,churchRadarRefresh%standard.length));
    return [...prioritized,...standard].slice(0,12);
  },[filteredChurches,hasActiveChurchFilter,churchRadarRefresh]);
  const visibleChurches=hasActiveChurchFilter?filteredChurches.slice(0,showAllChurches?48:12):radarChurches;
  const isUnfilteredChurchDirectory=!query.trim()&&region==="전체"&&denomination==="전체 교단";
  const churchSearchTotal=hasActiveChurchFilter?(currentChurchSearch?.total??0):churchTotal;
  const churchSearchPending=Boolean(hasActiveChurchFilter&&!currentChurchSearch)||churchSearchLoading;
  const churchCountLabel=churchSearchPending?"검색 중…":isUnfilteredChurchDirectory?`전국 ${churchTotal.toLocaleString("ko-KR")}개 교회`:`${churchSearchTotal.toLocaleString("ko-KR")}개 검색 결과`;
  const churchDirectoryMoreLabel=showAllChurches?"검색 결과 12곳만 보기":`검색 결과 더 보기 (${Math.min(48,filteredChurches.length)}곳까지)`;
  const dailyProgress=Math.round(dailyCompleted.filter((step)=>["bible","sermon","praise"].includes(step)).length/3*100);

  function markDailyStep(step:"bible"|"sermon"|"praise") {
    setDailyCompleted((current)=>{
      if(current.includes(step)) return current;
      const next=[...current,step];
      try{localStorage.setItem(`airchurch:daily:${todayKey}`,JSON.stringify(next));}catch{/* 저장 제한 환경에서도 진행 표시는 유지합니다. */}
      return next;
    });
  }

  function toggleSaved(item:SavedItem) {
    setSavedItems((current)=>{
      const exists=current.some((saved)=>saved.id===item.id);
      const next=exists?current.filter((saved)=>saved.id!==item.id):[{...item,...((item.kind==="church"||item.kind==="pastor")&&!item.savedAt?{savedAt:new Date().toISOString()}: {})},...current].slice(0,30);
      writeSavedItems(next);
      setNotice(exists?"찜에서 뺐습니다.":"내 이어보기에 저장했습니다. 이 브라우저에만 보관됩니다.");
      return next;
    });
  }

  function isSaved(id:string){return savedItems.some((item)=>item.id===id);}
  const hasNewSermon=(item:SavedItem)=>hasSavedItemNewSermon(item,sermonItems);

  function saveDailyNote(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const note=dailyNote.trim().slice(0,240);
    try{if(note)localStorage.setItem(`airchurch:note:${todayKey}`,note);else localStorage.removeItem(`airchurch:note:${todayKey}`);}catch{/* 저장 제한 환경에서도 입력 화면은 유지합니다. */}
    setDailyNote(note);
    setNotice(note?"오늘의 한 줄을 이 브라우저에 저장했습니다.":"오늘의 한 줄을 비웠습니다.");
  }

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

  async function reportPost(post:CommunityItem) {
    if(!window.confirm("이 글을 운영자 검토 대상으로 신고할까요?")) return;
    const response=await fetch("/api/posts/report",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({id:post.id,reason:"공동체 원칙 위반 신고"})}).catch(()=>null);
    const result=await response?.json().catch(()=>({})) as {error?:string;hidden?:boolean}|undefined;
    if(!response?.ok){setNotice(result?.error||"신고를 접수하지 못했습니다.");return;}
    if(result?.hidden)setApprovedPosts((items)=>items.filter((item)=>item.id!==post.id));
    setNotice(result?.hidden?"신고가 누적되어 글을 검토 대기로 전환했습니다.":"신고를 접수했습니다. 운영자가 확인합니다.");
  }

  function searchYouTubePraise(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const term=String(new FormData(event.currentTarget).get("praiseQuery")||"").trim();
    if(!term) return;
    const url=`https://www.youtube.com/results?search_query=${encodeURIComponent(`${term} 찬양`)}`;
    window.open(url,"_blank","noopener,noreferrer");
  }

  async function loadDifferentShorts() {
    setShortLoading(true);
    try {
      const response=await fetch(`/api/shorts?limit=${prefersLowData()?24:60}`);
      const items=response.ok?((await response.json()) as {items?:Short[]}).items||[]:shortItems;
      const next=shuffled(items);
      if(next.length>1&&next[0]?.youtubeId===shortItems[0]?.youtubeId) next.push(next.shift() as Short);
      setShortItems(next);
      setActiveShortIndex(null);
    } catch {
      setShortItems((items)=>shuffled(items));
    } finally {
      setShortLoading(false);
    }
  }

  async function loadDifferentPraises() {
    setPraiseLoading(true);
    try {
      const response=await fetch(`/api/praises?limit=${prefersLowData()?24:48}`);
      const items=response.ok?((await response.json()) as {items?:Praise[]}).items||[]:praiseItems;
      const pinned=items.filter((item)=>item.pinned);
      const next=shuffled(items.filter((item)=>!item.pinned));
      const previousFirst=praiseItems.find((item)=>!item.pinned);
      if(next.length>1&&next[0]?.youtubeId===previousFirst?.youtubeId) next.push(next.shift() as Praise);
      setPraiseItems([...pinned,...next]);
      setShowAllPraise(false);
    } catch {
      setPraiseItems((items)=>shuffled(items));
      setShowAllPraise(false);
    } finally {
      setPraiseLoading(false);
    }
  }

  async function submitChurchRecommendation(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form=event.currentTarget;
    try {
      const response=await fetch("/api/church-recommendations",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(Object.fromEntries(new FormData(form)))});
      if(!response.ok) throw new Error();
      const result=await response.json() as {status?:string};
      form.reset();
      setShowRecommendationForm(false);
      setNotice(result.status==="already_held"?"이미 보류 기록이 있는 교회입니다. 기존 보류 사유와 비교해 중복 접수하지 않았습니다.":result.status==="already_listed"?"이미 에어처치에 공개된 교회입니다.":result.status==="already_received"?"이미 같은 교회 추천이 접수되어 있습니다.":"교회 추천을 접수했습니다. 관리자가 교단과 공식 채널을 확인한 뒤 등록 여부를 결정합니다.");
    } catch {
      setNotice("추천을 접수하지 못했습니다. 입력 내용을 확인하고 다시 시도해 주세요.");
    }
  }

  function toggleChurchDirectory() {
    const collapsing=showAllChurches;
    setShowAllChurches(!showAllChurches);
    if(collapsing) requestAnimationFrame(()=>document.querySelector("#church-directory")?.scrollIntoView({block:"start",behavior:"smooth"}));
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

  function videoThumbnail(video: { youtubeId?:string; thumbnailUrl?:string; tone?:string; marker:string|number; date:string; title:string; church:string; kind:"설교"|"찬양" }) {
    const isPlaying=Boolean(video.youtubeId&&activeVideoId===video.youtubeId);
    return <div className={`sermon-thumb ${video.tone??""}${video.thumbnailUrl?" has-image":""}`}>
      {isPlaying ? <><iframe className="video-frame" src={`https://www.youtube-nocookie.com/embed/${video.youtubeId}?autoplay=1&rel=0`} title={video.title} referrerPolicy="strict-origin-when-cross-origin" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen /><button className="video-close" type="button" onClick={()=>setActiveVideoId(null)} title="닫기" aria-label={`${video.church} ${video.kind} 영상 닫기`}>×</button></> : <>
        {video.thumbnailUrl&&<img className="thumbnail-image" src={video.thumbnailUrl} alt="" width={320} height={180} loading="lazy" decoding="async" fetchPriority="low" referrerPolicy="no-referrer" />}
        <span className="rank">{video.marker}</span>
        {video.youtubeId?<button className="play" type="button" onClick={()=>{setActiveVideoId(video.youtubeId!);markDailyStep(video.kind==="설교"?"sermon":"praise");}} aria-label={`${video.church} ${video.kind} 현 화면에서 재생`}>▶</button>:<button type="button" onClick={()=>setNotice("연결된 영상이 아직 없습니다.")} aria-label={`${video.church} ${video.kind} 재생 준비 중`}>▶</button>}
        <span className="duration">{video.date}</span>
      </>}
    </div>;
  }

  return (
    <main id="top"><SkipLink/>
      {notice && <div className="toast" role="status"><span>{notice}</span><button type="button" onClick={() => setNotice("")} title="닫기" aria-label="알림 닫기">×</button></div>}
      <header className="site-header simple-portal-header">
        <HomeReloadLink className="brand" ariaLabel="에어처치 첫 화면 새로 불러오기"><span className="brand-mark" aria-hidden="true" /><span>airchurch</span></HomeReloadLink>
      </header>

      <section className="hero simple-portal-hero" id="primary-content" tabIndex={-1}>
        <h1>무엇을 찾으세요?</h1>
        <p>교회나 목사님 이름을 입력하세요.</p>
        <form className="search simple-portal-search" role="search" action="/" method="get">
          <label className="sr-only" htmlFor="site-search">교회, 목사, 지역, 교단 검색</label><span aria-hidden="true">⌕</span>
          <input id="site-search" name="q" list="church-search-suggestions" type="search" inputMode="search" enterKeyHint="search" aria-describedby="site-search-help" autoComplete="off" autoCapitalize="none" spellCheck={false} value={query} onChange={(e) => { setQuery(e.target.value);setVisibleSermonCount(6);setShowAllChurches(false); }} onKeyDown={(event)=>{if(event.key==="Enter"){event.preventDefault();event.currentTarget.form?.requestSubmit();}}} placeholder={churchTotal?`교회, 목사, 지역, 교단으로 ${churchTotal.toLocaleString("ko-KR")}개의 교회에서 찾아 보세요.`:"교회, 목사, 지역, 교단으로 찾아 보세요."} />
          <span className="sr-only" id="site-search-help" role="status" aria-live="polite">{searchSuggestions.length?`자동완성 ${searchSuggestions.length}개가 있습니다.`:churchTotal?`등록된 ${churchTotal.toLocaleString("ko-KR")}개 교회에서 여러 조건을 함께 검색할 수 있습니다.`:"여러 조건을 함께 검색할 수 있습니다."}</span>
          <datalist id="church-search-suggestions">{searchSuggestions.map((item)=><option value={item.value} key={`${item.value}-${item.label}`}>{item.label}</option>)}</datalist>
          <button type="submit">찾기</button>
        </form>
        {query.trim()&&<div className="portal-result-jumps"><span>검색 결과</span><a href="#sermons">말씀</a><a href="#church-directory">교회</a><a href="#pastor-directory">목사</a></div>}
      </section>

      <nav className="portal-section-nav" aria-label="포털 내용">
        <a href="#sermons">말씀</a><a href="#shorts">쇼츠</a><a href="#praises">찬양</a><a href="#church-news">교계소식</a><a href="#church-directory">교회</a><a href="#pastor-directory">목사</a><a href="#community">나눔</a><a href="#about">소개</a>
      </nav>

      <section className={`continue-section${savedItems.length?" has-items":""}`} id="saved" aria-labelledby="continue-title">
        <div><span className="section-kicker">로그인 없이 이 브라우저에만 저장</span><h2 id="continue-title">나의 모음</h2></div>
        {personalStateReady&&savedItems.length>0?<div className="continue-list">{savedItems.slice(0,6).map((item)=>{const external=item.url.startsWith("http");return <article key={item.id}><span>{item.kind==="sermon"?"말씀":item.kind==="praise"?"찬양":item.kind==="pastor"?"목사":"교회"}{hasNewSermon(item)&&<b className="saved-new">NEW</b>}</span><a href={item.url} target={external?"_blank":undefined} rel={external?"noopener noreferrer":undefined}><strong>{item.title}</strong><small>{item.subtitle}</small></a><button type="button" onClick={()=>toggleSaved(item)} aria-label={`${item.title} 찜에서 빼기`}>×</button></article>})}</div>:<p className="portal-saved-empty">말씀·찬양·교회·목사에서 ♡를 누르면 여기에 모입니다.</p>}
      </section>

      <section className="content-section" id="sermons">
        <div className="section-heading"><div><span className="section-kicker">매일 새로 만나는</span><h2>오늘의 말씀</h2></div><span className="result-count">{sermonLoading ? "말씀을 불러오는 중…" : `검색한 교회 ${sermonChurchCount}개 · 설교말씀 ${filtered.length}개`}</span></div>
        <div className="sermon-grid">
          {sermonLoading ? <LoadingCards count={8} /> : visibleSermons.map((sermon, index) => <article className="sermon-card" id={index === visibleSermons.length - 1 ? "sermons-end" : undefined} key={sermon.id}>
              {videoThumbnail({youtubeId:sermon.youtubeId,thumbnailUrl:sermon.thumbnailUrl,tone:sermon.tone,marker:sermon.rank,date:sermon.date,title:sermon.title,church:sermon.church,kind:"설교"})}
            <div className="sermon-copy"><span className="fresh">{sermon.verified ? "✓ 검증 교회 · 공식 채널" : "검토 중"}</span><h3>{sermon.title}</h3><p>{sermon.church} · {sermon.pastor} · {sermon.region}</p>{sermon.verse && <small>{sermon.verse}</small>}<div className="card-actions"><button type="button" onClick={() => void shareVideo(sermon)}>↗ 말씀 공유</button><button className={isSaved(`sermon:${sermon.youtubeId??sermon.id}`)?"is-saved":""} type="button" onClick={()=>toggleSaved({id:`sermon:${sermon.youtubeId??sermon.id}`,kind:"sermon",title:sermon.title,subtitle:`${sermon.church} · ${sermon.pastor}`,url:sermon.youtubeId?`https://www.youtube.com/watch?v=${sermon.youtubeId}`:"#sermons"})}>{isSaved(`sermon:${sermon.youtubeId??sermon.id}`)?"♥ 찜됨":"♡ 찜"}</button></div></div>
          </article>)}
          {!sermonLoading && !filtered.length && <div className="empty">검색 결과가 없습니다. 교회 등록을 요청하면 확인 후 연결하겠습니다.</div>}
        </div>
        {!sermonLoading && previewSermons.length > 0 && <div className="sermon-next-preview"><div className="sermon-grid">{previewSermons.map((sermon)=><article className="sermon-card" key={`preview-${sermon.id}`}>
          <div className={`sermon-thumb ${sermon.tone}${sermon.thumbnailUrl?" has-image":""}`}>{sermon.thumbnailUrl&&<img className="thumbnail-image" src={sermon.thumbnailUrl} alt="" width={320} height={180} loading="lazy" decoding="async" fetchPriority="low" referrerPolicy="no-referrer" />}<span className="rank">{sermon.rank}</span></div>
          <div className="sermon-copy"><span className="fresh">✓ 검증 교회 · 공식 채널</span><h3>{sermon.title}</h3><p>{sermon.church} · {sermon.pastor} · {sermon.region}</p></div>
        </article>)}</div><button type="button" onClick={()=>setVisibleSermonCount((count)=>count+16)} aria-label="말씀 16개 더 펼치기"><span>눌러서 말씀 더 보기</span></button></div>}
        {!sermonLoading && visibleSermons.length < filtered.length && <button className="sermon-more" type="button" onClick={()=>setVisibleSermonCount((count)=>count+16)}>말씀 16개 더 보기 <small>{visibleSermons.length} / {filtered.length}</small></button>}
      </section>

      <section className="content-section shorts-section" id="shorts">
        <div className="section-heading"><div><span className="section-kicker">짧지만 진한 은혜</span><h2>교회 쇼츠</h2></div><button className="shorts-refresh-button" type="button" onClick={()=>void loadDifferentShorts()} disabled={shortLoading}>{shortLoading ? "불러오는 중…" : "↻ 다른 쇼츠 보기"}</button></div>
        <div className="shorts-grid">
          {shortLoading ? <LoadingCards count={6} /> : visibleShorts.map((short, index) => <button className="shorts-card" type="button" key={short.youtubeId} onClick={(event)=>{shortTriggerRef.current=event.currentTarget;setShortMuted(true);setActiveShortIndex(index);}} aria-label={`${short.church} 쇼츠 ${short.title} 재생`}>
            <img className="shorts-thumb" src={short.thumbnailUrl} alt="" width={180} height={320} loading="lazy" decoding="async" fetchPriority="low" referrerPolicy="no-referrer" />
            <span className="shorts-play-badge" aria-hidden="true">▶</span>
            <span className="shorts-card-meta"><strong>{short.church}</strong><small>{short.title}</small></span>
          </button>)}
          {!shortLoading && !filteredShorts.length && <div className="empty">아직 연결된 쇼츠가 없습니다.</div>}
        </div>
      </section>

      {activeShort && <div className="shorts-viewer-overlay" role="dialog" aria-modal="true" aria-label={`${activeShort.church} 쇼츠 재생 화면`} onClick={()=>setActiveShortIndex(null)}>
        <div ref={shortViewerRef} className="shorts-viewer" onClick={(event)=>event.stopPropagation()}>
          <iframe
            ref={shortPlayerRef}
            className="shorts-viewer-frame"
            src={shortViewerEmbedUrl}
            title={activeShort.title}
            referrerPolicy="strict-origin-when-cross-origin"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
          {shortMuted&&<button type="button" onClick={unmuteShort} style={{position:"absolute",top:"40%",left:"50%",zIndex:3,transform:"translate(-50%,-50%)",minWidth:190,minHeight:60,padding:"18px 32px",border:"2px solid rgba(255,255,255,.82)",borderRadius:999,background:"rgba(0,0,0,.86)",boxShadow:"0 8px 28px rgba(0,0,0,.45)",color:"white",fontSize:20,fontWeight:900,whiteSpace:"nowrap",cursor:"pointer",touchAction:"manipulation"}}>🔊 소리 켜기</button>}
          <span className="shorts-viewer-count" aria-live="polite">{(activeShortIndex??0)+1} / {filteredShorts.length}</span>
          <button ref={shortCloseButtonRef} type="button" className="shorts-viewer-close" onClick={()=>setActiveShortIndex(null)} title="닫기" aria-label="쇼츠 재생 닫기">×</button>
          <button type="button" className="shorts-viewer-nav shorts-viewer-prev" onClick={()=>setActiveShortIndex((current)=>current!==null && current>0 ? current-1 : current)} disabled={activeShortIndex===0} aria-label="이전 쇼츠 보기">‹</button>
          <button type="button" className="shorts-viewer-nav shorts-viewer-next" onClick={()=>setActiveShortIndex((current)=>current!==null && current<filteredShorts.length-1 ? current+1 : current)} disabled={activeShortIndex===filteredShorts.length-1} aria-label="다음 쇼츠 보기">›</button>
          <div className="shorts-viewer-meta"><strong>{activeShort.church}</strong><span>{activeShort.title}</span></div>
        </div>
      </div>}

      <section className="content-section praise-section" id="praises">
        <div className="section-heading"><div><span className="section-kicker">함께 부르는 믿음의 고백</span><h2>오늘의 찬양</h2></div><button className="shorts-refresh-button" type="button" onClick={()=>void loadDifferentPraises()} disabled={praiseLoading}>{praiseLoading ? "불러오는 중…" : "↻ 다른 찬양 보기"}</button></div>
        <form className="praise-youtube-search" role="search" onSubmit={searchYouTubePraise}><label className="sr-only" htmlFor="praise-youtube-query">YouTube에서 찬양 검색</label><input id="praise-youtube-query" name="praiseQuery" required placeholder="듣고 싶은 찬양을 검색하세요" /><button type="submit">YouTube에서 찾기 ↗</button></form>
        <div className={`praise-preview${!praiseLoading && !showAllPraise && filteredPraises.length > 4 ? " is-collapsed" : ""}`}><div className="sermon-grid praise-grid">{praiseLoading ? <LoadingCards count={4} /> : visiblePraises.map((praise)=><article className="sermon-card" key={praise.youtubeId}>
          {videoThumbnail({youtubeId:praise.youtubeId,thumbnailUrl:praise.thumbnailUrl,marker:"♪",date:new Date(praise.publishedAt).toLocaleDateString("ko-KR"),title:praise.title,church:praise.church,kind:"찬양"})}
          <div className="sermon-copy"><span className="fresh">✓ 검증 교회 · 공식 채널</span><h3>{praise.title}</h3><p>{praise.church} · {praise.region}</p><div className="card-actions"><button type="button" onClick={()=>void shareVideo(praise)}>↗ 찬양 공유</button><button className={isSaved(`praise:${praise.youtubeId}`)?"is-saved":""} type="button" onClick={()=>toggleSaved({id:`praise:${praise.youtubeId}`,kind:"praise",title:praise.title,subtitle:`${praise.church} · ${praise.region}`,url:`https://www.youtube.com/watch?v=${praise.youtubeId}`})}>{isSaved(`praise:${praise.youtubeId}`)?"♥ 찜됨":"♡ 찜"}</button></div></div>
        </article>)}</div>{!praiseLoading && !showAllPraise && filteredPraises.length > 4 && <button className="praise-peek-expand" type="button" onClick={()=>setShowAllPraise(true)} aria-label="숨겨진 찬양 전체 펼치기"><span>눌러서 더 보기</span></button>}</div>
        {!praiseLoading && !visiblePraises.length && <div className="empty">아직 연결된 찬양이 없습니다.</div>}
        {!praiseLoading && filteredPraises.length > 4 && <button className="praise-more" type="button" onClick={()=>setShowAllPraise((shown)=>!shown)}>{showAllPraise ? "4개만 보기" : `전체 ${Math.min(12,filteredPraises.length)}개 펼쳐보기`}</button>}
      </section>

      <section className="church-directory-section" id="church-directory">
        <div className="section-heading"><div><span className="section-kicker">교회 레이더</span><h2>나와 맞는 교회를 찾아보세요</h2></div><span className="result-count">{churchLoading?"교회를 확인하는 중…":`전국 ${churchTotal.toLocaleString("ko-KR")}곳`}</span></div>
        <div className="church-radar-intro"><span><img src="/church-radar-ai-badge.webp" alt="교회 공개 자료 확인 서비스 아이콘" width={42} height={42} loading="lazy" decoding="async" /></span><div><strong>공개 자료를 찾고, 운영 기준으로 확인한 교회만 소개합니다.</strong><p>교단·노회와 교회가 일반에 공개한 공식 정보를 확인합니다. 로그인·비공개 영역과 개인 민감정보는 수집하지 않습니다. 교회명·지역·담임목사와 공식 홈페이지 등 공개 출처를 정리하며, 문제 제보가 들어오면 즉시 보류해 다시 확인합니다.</p>
          <details className="church-radar-sources"><summary>자료 확인 기준과 출처</summary>
            <p className="church-radar-sources-note">로그인 없이 공개된 자료만 확인합니다.</p>
            <table className="church-radar-sources-table"><caption className="sr-only">자료 확인 기준과 출처</caption>
              <thead><tr><th scope="col">교단명</th><th scope="col">공식 출처</th><th scope="col">공개/로그인 여부</th><th scope="col">마지막 확인일</th></tr></thead>
              <tbody>{churchSourceRows.map((row)=><tr key={row.denomination}><td data-label="교단">{row.denomination}</td><td data-label="공식 출처">{row.source}</td><td data-label="접근">{row.access}</td><td data-label="확인일">{row.lastChecked}</td></tr>)}</tbody>
            </table>
          </details>
        </div></div>
        <div className="church-radar-actions" aria-label="교회 찾기 방법">
          <label><span aria-hidden="true">◫</span><strong>지역으로 찾기</strong><select id="church-radar-region" aria-label="교회 레이더 지역 선택" value={region} onChange={(event)=>{setRegion(event.target.value);setShowAllChurches(false);}}>{regions.map((item)=><option key={item}>{item}</option>)}</select></label>
          <label><span aria-hidden="true">◇</span><strong>교단으로 찾기</strong><select aria-label="교회 레이더 교단 선택" value={denomination} onChange={(event)=>{setDenomination(event.target.value);setShowAllChurches(false);}}>{denominationOptions.map((item)=><option key={item}>{item}</option>)}</select></label>
        </div>
        <div className="church-directory-search" role="search">
          <label className="sr-only" htmlFor="church-directory-search-input">등록교회 검색</label>
          <span aria-hidden="true">⌕</span>
          <input
            id="church-directory-search-input"
            type="search"
            value={churchQuery}
            onChange={(e) => {setChurchQuery(e.target.value);setShowAllChurches(false);}}
            placeholder="등록된 교회명, 목사님, 지역, 교단으로 찾아보세요"
            aria-controls="church-directory-grid"
          />
          {churchQuery && <button className="church-search-clear" type="button" onClick={() => {setChurchQuery("");setShowAllChurches(false);}} aria-label="검색어 지우기">✕</button>}
          <span className="church-search-count" aria-live="polite">{churchLoading ? "불러오는 중…" : churchCountLabel}</span>
        </div>
        <div className="church-radar-results-heading"><div><strong>{hasActiveChurchFilter?"조건에 맞는 교회":"오늘 발견할 교회"}</strong><p>{hasActiveChurchFilter?"가장 관련 있는 교회부터 12곳씩 보여드립니다.":"관리자 추천을 먼저 보여드리고, 나머지는 방문할 때마다 새롭게 골라드립니다."}</p></div>{hasActiveChurchFilter?<span>{churchSearchPending?"검색 중…":`${churchSearchTotal.toLocaleString("ko-KR")}곳 중 ${visibleChurches.length}곳`}</span>:<button className="church-directory-refresh" type="button" onClick={()=>setChurchRadarRefresh((value)=>value+1)} disabled={churchLoading||filteredChurches.length<=12}><span aria-hidden="true">↻</span> 다른 교회 보기</button>}</div>
          {churchLoading?<div className="church-directory-grid" id="church-directory-grid"><LoadingCards count={6} /></div>:<div className="church-directory-grid" id="church-directory-grid">{visibleChurches.map((church)=>{const mark=denominationMark(church.denomination);const savedId=`church:${church.id}`;return <article key={church.id} className={isAdmin?"is-admin-card":""} role={isAdmin?"button":"link"} tabIndex={0} aria-label={isAdmin?`${church.name} 관리 열기`:`${church.name} 교회 상세 보기`} onClick={(event)=>{if((event.target as HTMLElement).closest("a,button,input,select,textarea,label,form,summary"))return;if(isAdmin){const details=event.currentTarget.querySelector<HTMLDetailsElement>(".admin-church-details");if(details)details.open=!details.open;}else window.location.href=`/church/${church.id}`;}} onKeyDown={(event)=>{if(event.target!==event.currentTarget||!["Enter"," "].includes(event.key))return;event.preventDefault();if(isAdmin){const details=event.currentTarget.querySelector<HTMLDetailsElement>(".admin-church-details");if(details)details.open=!details.open;}else window.location.href=`/church/${church.id}`;}}><div className="church-directory-top"><span>{church.region}</span><div className="church-directory-top-actions">{mark&&<img className="church-denomination-mark" src={mark.src} alt={mark.alt} width={21} height={21} loading="lazy" decoding="async" referrerPolicy="no-referrer" />}<button className={`church-save${isSaved(savedId)?" is-saved":""}`} type="button" onClick={()=>toggleSaved({id:savedId,kind:"church",title:church.name,subtitle:`${church.pastor} · ${church.region}`,url:`/church/${church.id}`})} title={isSaved(savedId)?"찜에서 빼기":"찜하기"} aria-label={`${church.name} ${isSaved(savedId)?"찜에서 빼기":"찜하기"}`}>{isSaved(savedId)?"♥":"♡"}</button></div></div><h3>{isAdmin?church.name:<a className="church-primary-link" href={`/church/${church.id}`}>{church.name}</a>}</h3><div className="church-directory-meta"><div className="church-directory-meta-copy"><p>{church.pastor}</p><small>{church.denomination}</small></div><div className="church-directory-links">{church.homepageUrl&&<a className="homepage-link" href={church.homepageUrl} target="_blank" rel="noreferrer" title={`${church.name} 공식 홈페이지`} aria-label={`${church.name} 공식 홈페이지 열기`}><span className="homepage-visual" aria-hidden="true"><span>⛪</span>{church.channelImageUrl&&<img src={church.channelImageUrl} alt="" width={27} height={27} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={(event)=>{event.currentTarget.hidden=true}} />}</span></a>}{church.youtubeChannelId&&<a className="youtube-link" href={`https://www.youtube.com/channel/${church.youtubeChannelId}`} target="_blank" rel="noreferrer" title={`${church.name} 공식 YouTube`} aria-label={`${church.name} 공식 YouTube 열기`}><span className="directory-icon youtube-icon" aria-hidden="true" /></a>}</div></div>{isAdmin&&<Suspense fallback={null}><ChurchControls id={church.id} name={church.name} pastor={church.pastor} region={church.region} denomination={church.denomination} status="approved" holdReason={null} holdNote={null} heldAt={null} priorityWeight={church.priorityWeight??1}/></Suspense>}</article>})}{!filteredChurches.length&&<div className="empty">조건에 맞는 등록 교회가 없습니다. 아래에서 추천해 주세요.</div>}</div>}
        {!churchLoading&&hasActiveChurchFilter&&filteredChurches.length>12&&<button className="church-directory-more" type="button" onClick={toggleChurchDirectory}>{churchDirectoryMoreLabel}</button>}
        <div className={`church-recommendation${showRecommendationForm?" is-open":""}`}>
          <div className="church-recommendation-intro"><div><span className="section-kicker">교회 추천</span><h2>함께 소개하고 싶은 교회가 있나요?</h2><p>추천은 관리자 검토 후 목록에 반영됩니다.</p></div><button type="button" aria-expanded={showRecommendationForm} aria-controls="church-recommendation-form" onClick={()=>setShowRecommendationForm((shown)=>!shown)}>{showRecommendationForm?"입력창 닫기":"추천하기"}</button></div>
          {showRecommendationForm&&<form className="church-recommendation-form" id="church-recommendation-form" onSubmit={submitChurchRecommendation}>
            <div className="recommendation-fields"><label>교회명<input name="churchName" minLength={2} maxLength={100} required /></label><label>담임목사<input name="pastor" minLength={2} maxLength={80} required /></label><label>지역<select name="region" required defaultValue=""><option value="" disabled>지역 선택</option>{regions.slice(1).map((item)=><option key={item}>{item}</option>)}</select></label><label>교단<input name="denomination" minLength={2} maxLength={120} required placeholder="예: 대한예수교장로회 통합" /></label></div>
            <label>공식 YouTube 주소 <small>선택</small><input name="youtubeUrl" type="url" inputMode="url" maxLength={300} placeholder="https://www.youtube.com/@..." /></label>
            <label>추천 이유<textarea name="reason" minLength={10} maxLength={800} rows={4} required placeholder="이 교회를 추천하는 이유를 10자 이상 적어 주세요." /></label>
            <input className="honeypot" name="company" tabIndex={-1} autoComplete="off" aria-hidden="true" />
            <label className="agreement"><input type="checkbox" required /> 관리자 검토 후 등록 여부가 결정되는 것에 동의합니다.</label>
            <button type="submit">교회 추천 보내기</button>
          </form>}
        </div>
      </section>

      <section className="church-directory-section pastor-home-directory" id="pastor-directory">
        <div className="section-heading"><div><span className="section-kicker">목회자</span><h2>목사님의 근황을 찾아보세요</h2></div><span className="result-count">{pastorLoading?"목회자를 확인하는 중…":`${pastorTotal.toLocaleString("ko-KR")}명`}</span></div>
        <div className="church-radar-intro pastor-home-intro"><span aria-hidden="true">사람</span><div><strong>이름이나 교회, 지역, 교단으로 목회자를 찾아보세요.</strong><p>담임·부교역자·협동·원로·은퇴 목회자의 현재 사역과 지나온 발자취를 확인하고 응원할 수 있습니다. 위 통합 검색의 조건이 이 목록에도 그대로 적용됩니다.</p></div></div>
        <form className="church-directory-search" role="search" onSubmit={(event)=>event.preventDefault()}><label className="sr-only" htmlFor="pastor-directory-search-input">등록 목회자 검색</label><span aria-hidden="true">⌕</span><input id="pastor-directory-search-input" type="search" value={pastorQuery} onChange={(event)=>{setPastorQuery(event.target.value);setPastorVisibleCount(12);}} placeholder="목회자 이름, 교회, 지역, 교단으로 찾아보세요" aria-controls="pastor-directory-grid"/>{pastorQuery&&<button className="church-search-clear" type="button" onClick={()=>{setPastorQuery("");setPastorVisibleCount(12);}} aria-label="목회자 검색어 지우기">✕</button>}<span className="church-search-count" aria-live="polite">{pastorLoading?"검색 중…":`${pastorTotal.toLocaleString("ko-KR")}명`}</span></form>
        <div className="church-radar-results-heading"><div><strong>{pastorQuery.trim()||query.trim()||region!=="전체"||denomination!=="전체 교단"?"조건에 맞는 목회자":"목회자 둘러보기"}</strong><p>카드를 누르면 목사님의 사역 이력과 말씀, 응원글을 볼 수 있습니다.</p></div>{pastorQuery.trim()||query.trim()||region!=="전체"||denomination!=="전체 교단"?<span>{pastorLoading?"검색 중…":`${pastorTotal.toLocaleString("ko-KR")}명 중 ${Math.min(pastorVisibleCount,pastorItems.length)}명`}</span>:<button className="church-directory-refresh" type="button" onClick={()=>void showDifferentPastors()} disabled={pastorLoading}><span aria-hidden="true">↻</span> 다른 목회자 보기</button>}</div>
        {isAdmin&&selectedPastors.size>0&&<div className="admin-batch-bar pastor-home-batch" role="toolbar" aria-label="선택한 목회자 일괄 처리"><strong>{selectedPastors.size}명 선택</strong><button disabled={pastorBatchBusy} className="restore" type="button" onClick={()=>void runPastorBatch("approved")}>공개</button><button disabled={pastorBatchBusy} type="button" onClick={()=>void runPastorBatch("removed")}>보류</button><button disabled={pastorBatchBusy} className="danger" type="button" onClick={()=>void runPastorBatch("deleted")}>삭제</button><button disabled={pastorBatchBusy} type="button" onClick={()=>setSelectedPastors(new Set(pastorItems.slice(0,pastorVisibleCount).flatMap((item)=>item.person_id?[item.person_id]:[])))}>화면 전체 선택</button><button disabled={pastorBatchBusy} type="button" onClick={()=>setSelectedPastors(new Set())}>선택 해제</button></div>}
        {pastorLoading?<div className="pastor-directory-grid" id="pastor-directory-grid"><LoadingCards count={8}/></div>:<div className="pastor-directory-grid" id="pastor-directory-grid">{pastorItems.slice(0,pastorVisibleCount).map((pastor)=>{
          const name=pastor.name.replace(/\s*목사(?:님)?$/u,""),href=pastor.person_id&&pastor.public_id!==null?`/pastors/${pastor.public_id}`:`/church/${pastor.church_id}`,photo=pastor.photo_url&&pastor.public_id!==null?`/api/pastor-photo/${pastor.public_id}`:"/pastor-silhouette-soft.png",roles=(pastor.role_titles||pastor.role_title).split(",").filter(Boolean),savedId=`pastor:${pastor.person_id??`${pastor.church_id}-${pastor.minister_id??"primary"}`}`,manageable=isAdmin&&Boolean(pastor.person_id);
          const toggleAdmin=(card:HTMLElement)=>{const details=card.querySelector<HTMLDetailsElement>(".admin-pastor-details");if(!details)return;if(details.open){details.querySelector<HTMLFormElement>("form")?.requestSubmit();return;}details.open=true;};
          return <article className={`pastor-home-card${manageable?" is-admin-card":""}`} key={savedId} role={manageable?"button":undefined} tabIndex={manageable?0:undefined} aria-label={manageable?`${name} 목회자 관리 열기`:undefined} onClick={manageable?(event)=>{if((event.target as HTMLElement).closest("a,button,input,select,textarea,label,form,summary,.admin-pastor-details"))return;toggleAdmin(event.currentTarget);}:undefined} onKeyDown={manageable?(event)=>{if(event.target!==event.currentTarget||!["Enter"," "].includes(event.key))return;event.preventDefault();toggleAdmin(event.currentTarget);}:undefined}>{manageable&&pastor.person_id&&<label className="admin-card-select pastor-home-select"><input type="checkbox" checked={selectedPastors.has(pastor.person_id)} onChange={(event)=>setSelectedPastors((current)=>{const next=new Set(current);if(event.target.checked)next.add(pastor.person_id!);else next.delete(pastor.person_id!);return next;})} aria-label={`${name} 선택`}/></label>}<div className="pastor-directory-card"><span className={`pastor-directory-photo${pastor.photo_url?" has-photo":" is-placeholder"}`}><img src={photo} alt={pastor.photo_url?`${name} 목회자`:""} width={92} height={116} loading="lazy" decoding="async" referrerPolicy="no-referrer"/></span><span className="pastor-directory-copy"><span className="pastor-directory-status">{pastor.role_status==="former"?"사역 이력":"현재 사역"}</span><strong><a href={href}>{name}</a></strong><span className="pastor-directory-roles">{roles.map((role)=><b key={role}>{role}</b>)}</span>{pastor.church_name&&(pastor.church_id?<p><a href={`/church/${pastor.church_id}`}>{pastor.church_name}</a></p>:<p>{pastor.church_name}</p>)}{(pastor.region||pastor.denomination)&&<small>{[pastor.region,pastor.denomination].filter(Boolean).join(" · ")}</small>}{pastor.source_url&&<a className="pastor-source-link" href={pastor.source_url} target="_blank" rel="noreferrer">공식 출처 확인 ↗</a>}<em>{manageable?"나머지 영역을 눌러 정보 관리":"목회 기록과 응원글 보기 →"}</em></span></div><button className={`church-save pastor-home-save${isSaved(savedId)?" is-saved":""}`} type="button" onClick={()=>toggleSaved({id:savedId,kind:"pastor",title:name,subtitle:[pastor.church_name,pastor.role_title].filter(Boolean).join(" · "),url:href})} title={isSaved(savedId)?"찜에서 빼기":"찜하기"} aria-label={`${name} 목회자 ${isSaved(savedId)?"찜에서 빼기":"찜하기"}`}>{isSaved(savedId)?"♥":"♡"}</button>{manageable&&pastor.person_id&&<Suspense fallback={null}><PastorControls id={pastor.person_id} roleId={pastor.role_id} name={pastor.name} roleTitle={pastor.role_title} churchName={pastor.church_name} region={pastor.region} denomination={pastor.denomination} roleStatus={pastor.role_status} status="approved"/></Suspense>}</article>;
        })}{!pastorItems.length&&<div className="empty">조건에 맞는 목회자가 없습니다. 이름이나 교회명을 짧게 다시 입력해 보세요.</div>}</div>}
        {!pastorLoading&&pastorItems.length>pastorVisibleCount&&<button className="church-directory-more" type="button" onClick={()=>setPastorVisibleCount((count)=>Math.min(count+12,pastorItems.length))}>목회자 12명 더 보기</button>}
      </section>

      <section className="content-section church-news-section" id="church-news">
        <div className="section-heading"><div><span className="section-kicker">하나님 자녀들의 오늘</span><h2>교계소식</h2><p>공식 RSS의 제목과 필요한 범위의 짧은 소개만 보여드립니다. 콘텐츠 권리는 원 제공자에게 있으며, 자세한 내용은 원문에서 읽습니다.</p></div><button className="church-news-shuffle" type="button" onClick={showDifferentChurchNews} disabled={churchNewsLoading||churchNews.length<=9}>다른 뉴스 보기 ↻</button></div>
        {!churchNewsLoading&&churchNewsSources.length>0&&<details className="church-news-sources"><summary>현재 소식을 가져오는 곳 · {churchNewsSources.length}곳</summary><div>{churchNewsSources.map((source)=><span key={source.rssUrl}><strong>{source.name}</strong><a href={source.homepage} target="_blank" rel="noopener noreferrer">홈페이지 ↗</a><a href={source.rssUrl} target="_blank" rel="noopener noreferrer">RSS ↗</a></span>)}</div></details>}
        <div className="church-news-grid">
          {churchNewsLoading ? Array.from({length:9},(_,index)=><article className="church-news-card skeleton-card" aria-hidden="true" key={`news-loading-${index}`}><div className="church-news-thumb skeleton-thumb" /><div className="church-news-copy"><span className="skeleton-line skeleton-kicker"/><span className="skeleton-line skeleton-title"/><span className="skeleton-line skeleton-meta"/></div></article>) : visibleChurchNews.map((item)=><a className="church-news-card" href={item.url} target="_blank" rel="noopener noreferrer" key={`${item.source}-${item.url}`} aria-label={`${item.source} 원문에서 읽기: ${item.title}`}>
            <span className={`church-news-thumb ${item.tone}`} aria-hidden="true"><span className="church-news-mark">{item.source.slice(0,2)}</span><small>{item.source}</small></span>
            <span className="church-news-copy"><small>{item.source} · {new Date(item.publishedAt).toLocaleDateString("ko-KR")}</small><strong>{item.title}</strong><span>{item.summary}</span><em>원문에서 읽기 ↗</em></span>
          </a>)}
          {!churchNewsLoading&&!churchNews.length&&<div className="empty">새 소식을 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.</div>}
        </div>
      </section>

      <section className="community-section" id="community">
        <div className="community-copy"><span className="section-kicker">서로를 지키는 익명 광장</span><h2>이름을 숨겨도,<br />말의 책임은 남도록</h2><p>신앙의 생각과 고민을 솔직하게 나누되, 교리 논쟁·비방·선동이 공동체를 해치지 않도록 모든 첫 글은 운영 원칙에 따라 검토합니다.</p><ul><li>개인정보를 요구하지 않는 별칭</li><li>신고 누적 시 자동 숨김과 운영자 확인</li><li>특정 교회·개인을 향한 확인되지 않은 비방 금지</li></ul><div className="community-safety"><strong>긴급한 도움이 필요한가요?</strong><p>이 광장은 상담기관이 아닙니다. 생명이나 안전이 위험하면 112·119, 자살예방상담전화 109에 바로 연락해 주세요.</p><a href="/community-guidelines">공동체 안전 원칙 보기 →</a></div></div>
        <form className="community-form" onSubmit={(e) => submitInterest(e,"community")}><div className="form-top"><select name="category" aria-label="글 분류"><option>신앙과 삶</option><option>말씀 나눔</option><option>우리 교회 이야기</option><option>기도 부탁</option></select><input name="nickname" maxLength={16} required placeholder="별칭" /></div><textarea name="content" required minLength={20} maxLength={1000} rows={6} placeholder="서로에게 도움이 되는 생각을 나눠주세요. (20자 이상)" /><input className="honeypot" name="company" tabIndex={-1} autoComplete="off" aria-hidden="true" /><label className="agreement"><input type="checkbox" required /> 공동체 원칙과 검토 후 공개에 동의합니다.</label><button type="submit">익명으로 나누기</button></form>
      </section>

      {(approvedPosts.length > 0 || approvedTalents.length > 0) && <section className="approved-section" aria-label="공개된 공동체 이야기와 달란트">
        {approvedPosts.length > 0 && <div><span className="section-kicker">광장에서 나눈 이야기</span><h2>함께 읽는 마음</h2><div className="approved-list">{approvedPosts.map((post)=><article key={post.id}><small>{post.category}</small><h3>{post.nickname}</h3><p>{post.content}</p><button className="community-report" type="button" aria-label={`${post.nickname} 글을 운영자에게 신고`} onClick={()=>void reportPost(post)}>원칙에 맞지 않는 글 신고</button></article>)}</div></div>}
        {approvedTalents.length > 0 && <div><span className="section-kicker">이어진 달란트</span><h2>나눌 수 있는 선물</h2><div className="approved-list">{approvedTalents.map((talent)=><article key={talent.id}><small>{talent.region}</small><h3>{talent.title}</h3><p>{talent.description}</p></article>)}</div></div>}
      </section>}

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
        <form className="talent-form" onSubmit={(e) => submitInterest(e,"talent")}><h3>나눌 수 있는 달란트</h3><label>무엇을 나눌 수 있나요?<input name="title" required placeholder="예: 교회 홈페이지를 만들어 드릴 수 있어요" /></label><label>활동 가능 지역<input name="region" required placeholder="예: 경기 고양 또는 온라인" /></label><label>간단한 설명<textarea name="description" required placeholder="가능한 시간과 도울 수 있는 범위를 알려주세요" rows={4} /></label><input className="honeypot" name="company" tabIndex={-1} autoComplete="off" aria-hidden="true" /><button type="submit">착한나눔에 마음 전하기</button><small>연락처는 공개하지 않으며, 확인된 요청과 연결할 때만 사용합니다.</small></form>
      </section>

      <section className="portal-about" id="about"><span className="section-kicker">소개</span><h2>말씀과 교회를 정직하게 연결합니다</h2><p>airChurch는 공개된 자료를 바탕으로 말씀, 교회와 목사님, 교계소식과 나눔을 한곳에 모읍니다.</p><div><a href="/about">운영 안내</a><a href="/contact">문의</a><a href="/privacy">개인정보</a><a href="/terms">이용약관</a></div></section>

      <div className="page-jumps" aria-label="페이지 빠른 이동"><a href="#top" aria-label="맨 위로 이동" title="맨 위로">↑</a><a className="jump-logo" href="#sermons" aria-label="오늘의 말씀으로 이동" title="오늘의 말씀" /><a className="jump-praise" href="#praises" aria-label="CCM과 찬양으로 이동" title="CCM 듣기">♫</a><a href="#page-bottom" aria-label="맨 아래로 이동" title="맨 아래로">↓</a></div>
      <footer id="page-bottom">
        <HomeReloadLink className="brand footer-brand"><span className="brand-mark" aria-hidden="true" /><span>airchurch</span></HomeReloadLink><p>airchurch.net · goodshare.net · linechurch.net<br />공개 자료를 정리해 사람과 교회를 잇는 크리스천 포털</p><div className="footer-meta"><div className="footer-links"><a href="/about">운영 안내</a><a href="/community-guidelines">공동체 안전</a><a href="/privacy">개인정보처리방침</a><a href="/copyright">저작권 원칙</a><a href="/terms">이용약관</a><a href="/contact">문의</a><a href="/admin">관리자</a><a href="/pastor">목사님</a></div><a className="footer-pastor-link" href="/pastors/2">협동 목사 : 김민석 <span>(바로가기)</span></a></div>
      </footer>
    </main>
  );
}
