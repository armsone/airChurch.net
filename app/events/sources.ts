export type SourceConfig = { id:string;name:string;homepage:string;url:string;kind:"official"|"rss";detailPattern:string;churchName?:string;organizer?:string;listingUrls?:string[];charset?:string;eventOnly?:boolean };
// Official ownership and listing URLs checked 2026-09-09. Dates/venues are never inferred from headquarters.
export const officialEventSources:SourceConfig[] = [
  {id:"bbb",name:"한국직장선교연합 BBB",homepage:"https://www.bbb.or.kr/",url:"https://www.bbb.or.kr/Notice",kind:"official",detailPattern:"/Notice/\\d+"},
  {id:"joy",name:"죠이선교회",homepage:"https://www.joymission.org/",url:"https://www.joymission.org/news/",kind:"official",detailPattern:"/news/view\\.php\\?no=\\d+"},
  {id:"pbp",name:"대한예수교장로회 평북노회",homepage:"https://pbp.or.kr/",url:"https://pbp.or.kr/Board/Index/26",kind:"official",detailPattern:"/Board/Detail/(?:26|28)/\\d+",listingUrls:["https://pbp.or.kr/Board/Index/28"]},
  {id:"spck",name:"대한예수교장로회 서울노회",homepage:"https://www.spck.org/",url:"https://www.spck.org/Board/Index/46",kind:"official",detailPattern:"/Board/Detail/46/\\d+"},
  {id:"sbpb",name:"대한예수교장로회 서울북노회",homepage:"https://sbpb.or.kr/",url:"https://sbpb.or.kr/Board/Index/39",kind:"official",detailPattern:"/Board/Detail/39/\\d+"},
  {id:"ispck",name:"대한예수교장로회 익산노회",homepage:"https://www.ispck.net/",url:"https://www.ispck.net/Board/Index/28",kind:"official",detailPattern:"/Board/Detail/(?:28|30)/\\d+",listingUrls:["https://www.ispck.net/Board/Index/30"]},
  {id:"east-kmc",name:"기독교대한감리회 동부연회",homepage:"https://east.kmc.or.kr/",url:"https://east.kmc.or.kr/소식과나눔/공지사항",kind:"official",detailPattern:"[?&]pid=\\d+"},
  {id:"busanpck",name:"대한예수교장로회 부산노회",homepage:"https://busanpck.or.kr/",url:"https://busanpck.or.kr/Board/Index/34",kind:"official",detailPattern:"/Board/Detail/(?:34|37)/\\d+",listingUrls:["https://busanpck.or.kr/Board/Index/37"]},
  {id:"honampck",name:"대한예수교장로회 호남노회",homepage:"https://honampck.org/",url:"https://honampck.org/boardList.do?boardId=EVENT&pageId=www24",kind:"official",detailPattern:"/boardView\\.do\\?[^#]*seq=\\d+"},
  {id:"busandong",name:"대한예수교장로회 부산동노회",homepage:"https://psdong.onmam.com/",url:"https://psdong.onmam.com/bbs/bbsList/8",kind:"official",detailPattern:"/bbs/bbsView/8/\\d+",listingUrls:["https://psdong.onmam.com/bbs/bbsList/10"]},
  {id:"snnh",name:"대한예수교장로회 성남노회",homepage:"https://www.snnh.org/",url:"https://www.snnh.org/",kind:"official",detailPattern:"/board/F040100/5/\\d+",listingUrls:["https://www.snnh.org/front/F040100"]},
  {id:"duranno-college",name:"두란노 바이블칼리지",homepage:"https://biblecollege.duranno.com/biblecollege/",url:"https://biblecollege.duranno.com/biblecollege/",kind:"official",detailPattern:"/biblecollege/view/seminar_detail\\.asp\\?smrnum=\\d+",charset:"euc-kr",eventOnly:true},
  {id:"gwangya",name:"광야아트센터",homepage:"https://gwangya.art/",url:"https://gwangya.art/tickets",kind:"official",detailPattern:"/Resistance/?$",eventOnly:true},
  {id:"chungeoram",name:"청어람ARMC",homepage:"https://ichungeoram.com/",url:"https://ichungeoram.com/meet",kind:"official",detailPattern:"/meet/?\\?[^#]*idx=\\d+",eventOnly:true},
  {id:"onnuri",name:"온누리교회",homepage:"https://www.onnuri.org/",url:"https://www.onnuri.org/festival/",kind:"official",detailPattern:"/festival/(?!page/)[^/?]+/",churchName:"온누리교회",organizer:"온누리교회"},
  {id:"jiguchon",name:"지구촌교회",homepage:"https://www.jiguchon.or.kr/",url:"https://www.jiguchon.or.kr/bbs/board.php?bo_table=G02",kind:"official",detailPattern:"[?&]wr_id=\\d+",churchName:"지구촌교회",organizer:"지구촌교회"},
  {id:"kmc",name:"기독교대한감리회",homepage:"https://kmc.or.kr/",url:"https://kmc.or.kr/head-quater-kmc/notice",kind:"official",detailPattern:"[?&]pid=\\d+"},
  {id:"prok",name:"한국기독교장로회 총회",homepage:"https://www.prok.org/",url:"https://www.prok.org/Board/Index/32",kind:"official",detailPattern:"/Board/Detail/32/\\d+"},
  {id:"pck",name:"대한예수교장로회 통합 총회",homepage:"https://www.pck.or.kr/",url:"https://www.pck.or.kr/bbs/board.php?bo_table=SM05_02_01",kind:"official",detailPattern:"[?&]wr_id=\\d+"},
  {id:"ncck",name:"한국기독교교회협의회",homepage:"https://www.kncc.or.kr/",url:"https://www.kncc.or.kr/newsList/knc002001000",kind:"official",detailPattern:"/newsView/[^/?]+",listingUrls:["https://www.kncc.or.kr/"]},
  {id:"cemk",name:"기독교윤리실천운동",homepage:"https://cemk.org/",url:"https://cemk.org/",kind:"official",detailPattern:"/\\d+/",listingUrls:["https://cemk.org/feed/","https://cemk.org/feed/?paged=2","https://cemk.org/feed/?paged=3"]},
  {id:"kwma",name:"한국세계선교협의회",homepage:"https://kwma.org/",url:"https://kwma.org/gongji/",kind:"official",detailPattern:"[?&]vid=\\d+"},
  {id:"eldprok",name:"기장 전국장로회연합회",homepage:"https://eldprok.org/",url:"https://eldprok.org/Board/Index/41",kind:"official",detailPattern:"/Board/Detail/41/\\d+"},
  {id:"sarang",name:"사랑의교회",homepage:"https://www.sarang.org/",url:"https://www.sarang.org/info/notice.asp",kind:"official",detailPattern:"/info/notice.*(?:[?&](?:id|idx|seq|num)=)",churchName:"사랑의교회",organizer:"사랑의교회"},
  {id:"ucck",name:"한국교회총연합",homepage:"https://www.ucck.org/Main/Index",url:"https://www.ucck.org/InfoMap/Notice",kind:"official",detailPattern:"/InfoMap/(?:Detail|Notice)[/?].+"},
  {id:"emik",name:"한국기독교장로회 총회교육국",homepage:"https://www.emik.org/",url:"https://www.emik.org/g5/bbs/board.php?bo_table=s6_1",kind:"official",detailPattern:"[?&]wr_id=\\d+"},
];

// Extra aggregators discover official references only; articles never become confirmed events by themselves.
export const additionalDiscoverySources:SourceConfig[]=[
  {id:"discover-bonhd",name:"본헤럴드",homepage:"https://www.bonhd.net/",url:"https://www.bonhd.net/",kind:"rss",detailPattern:"/news/articleView\\.html\\?idxno=\\d+"},
  {id:"discover-christiantoday",name:"크리스천투데이",homepage:"https://www.christiantoday.co.kr/",url:"https://www.christiantoday.co.kr/sections/lif_09",kind:"rss",detailPattern:"/articles/\\d+/"},
  {id:"discover-jrtimes",name:"정론타임즈",homepage:"https://jrtimes.co.kr/",url:"https://jrtimes.co.kr/news/list.php?mcode=m65idzi",kind:"rss",detailPattern:"/news/view\\.php\\?idx=\\d+"},
  {id:"discover-kmcnews",name:"KMC뉴스",homepage:"https://www.kmcnews.kr/",url:"https://www.kmcnews.kr/",kind:"rss",detailPattern:"/news/articleView\\.html\\?idxno=\\d+"},
  {id:"discover-themission",name:"국민일보 더미션",homepage:"https://www.themission.co.kr/",url:"https://www.themission.co.kr/",kind:"rss",detailPattern:"/news/articleView\\.html\\?idxno=\\d+"},
];

// Discovered, independently named sources not yet eligible for the collector.
// These do not enter the public event pipeline until a bounded, accurate adapter is available.
export const eventSourceCandidates=[
  {name:"제주열방대학",url:"https://uofnjeju.org/schedule/",reason:"날짜 목록 확인 · 상세 장소 검증 필요"},
  {name:"한국전문인선교훈련원 GPTI",url:"http://gpti.or.kr/모집안내",reason:"보안 연결 오류 · 포스터 일정 확인 필요"},
  {name:"한국선교훈련원 GMTC",url:"https://gmtc.co.kr/공지사항/",reason:"모집 목록 확인 · 미래 날짜 검증 필요"},
  {name:"기독연구원 느헤미야",url:"https://www.nics.or.kr/",reason:"보안 연결 오류 · 수집 보류"},
  {name:"한국기독학생회 IVF",url:"https://www.ivf.or.kr/",reason:"연결 지연 · 수집 경로 확인 필요"},
  {name:"인터서브코리아",url:"https://interserve.kr/category/news/",reason:"소식 목록 확인 · 미래 일정 검증 필요"},
  {name:"한국오픈도어",url:"https://www.opendoors.or.kr/board/list.do?iboardgroupseq=7&iboardmanagerseq=55",reason:"정기모임 휴지 공지 확인 · 재개 여부 확인 필요"},
  {name:"성서유니온",url:"https://www.su.or.kr/",reason:"동적 화면 · 행사 목록 연결 필요"},
  {name:"한국 예수전도단",url:"https://www.ywamkorea.org/dts.php",reason:"훈련 목록의 날짜·장소 검증 필요"},
  {name:"한국해외선교회 GMF",url:"https://www.gmf.or.kr/",reason:"기관 발견용 · 개별 일정 원천 연결 필요"},
  {name:"티켓링크",url:"https://www.ticketlink.co.kr/bridge/283",reason:"CCM 전용 목록 갱신 부족 · 일반 추천 제외 필요"},
  {name:"YES24 티켓",url:"https://ticket.yes24.com/Genre/Concert?Gcode=009_202_001",reason:"자동 접근 제한 · 원주최 안내 확인 필요"},
  {name:"NOL 티켓",url:"https://nol.yanolja.com/ticket",reason:"기독교 공연·주최자 범위 검증 필요"},
  {name:"온오프믹스",url:"https://www.onoffmix.com/event/main/?c=102",reason:"공식 개설자·기독교 행사 확인 필요"},
  {name:"공연예술통합전산망 KOPIS",url:"https://kopis.or.kr/por/db/pblprfr/pblprfr.do?menuId=MNU_00020",reason:"동적 공연 목록 · 기독교 작품 분류 필요"},
  {name:"서울문화포털",url:"https://culture.seoul.go.kr/culture/culture/cultureEvent/list.do?menuNo=200008",reason:"지역 문화행사 · 기독교 범위 검증 필요"},
  {name:"스테이지픽",url:"https://www.stagepick.co.kr/venues/detail/161",reason:"공연장만으로 기독교 분류 불가 · 주최 확인 필요"},
  {name:"멜론티켓",url:"https://ticket.melon.com/",reason:"동적 공연 목록 · 기독교 아티스트 확인 필요"},
  {name:"갓피플몰",url:"https://mall.godpeople.com/",reason:"상품과 날짜 있는 행사 티켓 구분 필요"},
  {name:"히즈쇼",url:"https://www.hisshow.co.kr/addpage/EventMusical/exhibition.html?menuS3=",reason:"공연 목록 이미지 중심 · 일정 검증 필요"},
  {name:"대한예수교장로회 광주동노회",url:"https://gdpck.kr/",reason:"동적 공지 목록 · 연결 경로 확인 필요"},
  {name:"한국기독교장로회 경북노회",url:"https://www.prokgb.org/",reason:"공식 공지 후보 · 상세 일정 검증 필요"},
  {name:"중앙노회",url:"https://www.jbnh.org/main.php?device=pc",reason:"공식 공지 후보 · 상세 일정 검증 필요"},
  {name:"기독교대한성결교회",url:"https://www.kehc.org/home/notice/view_list/page/0",reason:"목록 확인 · 동적 상세 링크 연결 필요"},
];
