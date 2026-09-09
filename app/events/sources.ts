export type SourceConfig = { id:string;name:string;homepage:string;url:string;kind:"official"|"rss";detailPattern:string;churchName?:string;organizer?:string };
// Official ownership and listing URLs checked 2026-09-09. Dates/venues are never inferred from headquarters.
export const officialEventSources:SourceConfig[] = [
  {id:"onnuri",name:"온누리교회",homepage:"https://www.onnuri.org/",url:"https://www.onnuri.org/festival/",kind:"official",detailPattern:"/festival/[^/?]+/",churchName:"온누리교회",organizer:"온누리교회"},
  {id:"jiguchon",name:"지구촌교회",homepage:"https://www.jiguchon.or.kr/",url:"https://www.jiguchon.or.kr/bbs/board.php?bo_table=G02",kind:"official",detailPattern:"[?&]wr_id=\\d+",churchName:"지구촌교회",organizer:"지구촌교회"},
  {id:"kmc",name:"기독교대한감리회",homepage:"https://kmc.or.kr/",url:"https://kmc.or.kr/head-quater-kmc/notice",kind:"official",detailPattern:"[?&]pid=\\d+"},
  {id:"prok",name:"한국기독교장로회 총회",homepage:"https://www.prok.org/",url:"https://www.prok.org/Board/Index/32",kind:"official",detailPattern:"/Board/Detail/32/\\d+"},
  {id:"pck",name:"대한예수교장로회 통합 총회",homepage:"https://www.pck.or.kr/",url:"https://www.pck.or.kr/bbs/board.php?bo_table=SM05_02_01",kind:"official",detailPattern:"[?&]wr_id=\\d+"},
  {id:"ncck",name:"한국기독교교회협의회",homepage:"https://www.kncc.or.kr/",url:"https://www.kncc.or.kr/newsList/knc002001000",kind:"official",detailPattern:"/newsView/[^/?]+"},
  {id:"cemk",name:"기독교윤리실천운동",homepage:"https://cemk.org/",url:"https://cemk.org/",kind:"official",detailPattern:"/\\d+/"},
  {id:"kwma",name:"한국세계선교협의회",homepage:"https://kwma.org/",url:"https://kwma.org/gongji/",kind:"official",detailPattern:"[?&]vid=\\d+"},
  {id:"eldprok",name:"기장 전국장로회연합회",homepage:"https://eldprok.org/",url:"https://eldprok.org/Board/Index/41",kind:"official",detailPattern:"/Board/Detail/41/\\d+"},
  {id:"sarang",name:"사랑의교회",homepage:"https://www.sarang.org/",url:"https://www.sarang.org/info/notice.asp",kind:"official",detailPattern:"/info/notice.*(?:[?&](?:id|idx|seq|num)=)",churchName:"사랑의교회",organizer:"사랑의교회"},
  {id:"ucck",name:"한국교회총연합",homepage:"https://www.ucck.org/Main/Index",url:"https://www.ucck.org/InfoMap/Notice",kind:"official",detailPattern:"/InfoMap/(?:Detail|Notice)[/?].+"},
  {id:"emik",name:"한국기독교장로회 총회교육국",homepage:"https://www.emik.org/",url:"https://www.emik.org/g5/bbs/board.php?bo_table=s6_1",kind:"official",detailPattern:"[?&]wr_id=\\d+"},
];
