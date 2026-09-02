import { env } from "cloudflare:workers";
import { database, ensureMediaCollectionTables, internalTaskRequestAllowed } from "../../_shared";
import { isPraiseTitle, isSermonTitle, isShortTitle } from "../_selection";
import { isShortCandidate, youtubeDurationSeconds } from "../_selection";
import { hapdongSources } from "../hapdong-sources";
import { kosinSources } from "../kosin-sources";
import { prokSources } from "../prok-sources";
import { tonghapSources } from "../tonghap-sources";
import { kmcSources } from "../kmc-sources";
import { salvationSources } from "../salvation-sources";
import { publicRemainingSources } from "../public-remaining-sources";
import { normalizeSearchValue, sqlNormalized } from "../../../search-domain";
import { isSermonAttributedTo } from "../../../pastor-sermon-attribution";

type SourceBase={name:string;pastor:string;region:string;denomination:string;homepage?:string;verifiedSermonFeed?:boolean;pastorNames?:string;primaryPastorNames?:string};
type Source=SourceBase&({channelId:string;handle?:never;username?:never}|{channelId?:never;handle:string;username?:never}|{channelId?:never;handle?:never;username:string});

const heldSources:SourceBase[]=[
  {name:"해마루광성교회",pastor:"김희중 목사",region:"경기 파주",denomination:"대한예수교장로회 통합"},
  {name:"푸른빛광성교회",pastor:"문재진 목사",region:"지역 확인 필요",denomination:"대한예수교장로회 통합"},
  {name:"사랑의빛광성교회",pastor:"박경환 목사",region:"지역 확인 필요",denomination:"대한예수교장로회 통합"},
  {name:"교하광성교회",pastor:"홍종학 목사",region:"경기 파주",denomination:"대한예수교장로회 통합"},
  {name:"열린광성교회",pastor:"김광배 목사",region:"지역 확인 필요",denomination:"대한예수교장로회 통합"},
  {name:"일선누림교회",pastor:"박순원 목사",region:"지역 확인 필요",denomination:"대한예수교장로회 통합"},
  {name:"천안광성교회",pastor:"이한결 목사",region:"충남 천안",denomination:"대한예수교장로회 통합"},
];

const regionalHeldSources:Array<SourceBase&{holdReason:"youtube_unavailable"|"info_unverified";holdNote:string}>=[
  {name:"속초중앙교회",pastor:"강석훈 목사",region:"강원 속초",denomination:"대한예수교장로회 통합",holdReason:"info_unverified",holdNote:"공식 홈페이지와 다음세대 사역은 확인했으나 공식 YouTube 채널의 고유 식별값을 홈페이지 연결과 대조하지 못해 보류했습니다."},
  {name:"양산중앙교회",pastor:"정지훈 목사",region:"경남 양산",denomination:"대한예수교장로회 통합",holdReason:"youtube_unavailable",holdNote:"최근 설교와 유아부부터 청년부까지의 운영은 확인했으나 공식 YouTube 채널 연결과 최근 180일 업로드를 함께 확인하지 못해 보류했습니다."},
  {name:"김해중앙교회",pastor:"강동명 목사",region:"경남 김해",denomination:"대한예수교장로회 고신",holdReason:"info_unverified",holdNote:"공식 홈페이지와 YouTube 운영 이력은 확인했으나 공식 채널에서 최근 180일 내 설교·예배 업로드가 지속되는지 확인하지 못해 보류했습니다."},
  {name:"진주성남교회",pastor:"양대식 목사",region:"경남 진주",denomination:"대한예수교장로회 합동",holdReason:"youtube_unavailable",holdNote:"교단·담임목사·어린이 교육부서는 확인했으나 확인된 YouTube가 중등부 소규모 채널뿐이어서 교회 공식 설교 채널을 확인할 때까지 보류했습니다."},
  {name:"군산드림교회",pastor:"임만호 목사",region:"전북 군산",denomination:"대한예수교장로회 합동",holdReason:"info_unverified",holdNote:"공식 홈페이지의 최근 설교와 다음세대 사역은 확인했으나 현재 공식 YouTube 채널의 고유 식별값과 최근 업로드를 최종 대조하지 못해 보류했습니다."},
  {name:"군산중동교회",pastor:"임재규 목사",region:"전북 군산",denomination:"기독교대한성결교회",holdReason:"info_unverified",holdNote:"최근 온라인예배 게시물은 확인했으나 교회 공식 YouTube 채널의 소유 관계와 최근 180일 연속 운영을 확인하지 못해 보류했습니다."},
  {name:"익산영생교회",pastor:"담임목사 확인 필요",region:"전북 익산",denomination:"교단 확인 필요",holdReason:"youtube_unavailable",holdNote:"과거 영상 운영 흔적만 확인되며 담임목사·교단과 최근 180일 내 공식 YouTube 설교 업로드를 확인하지 못해 보류했습니다."},
  {name:"보목교회",pastor:"담임목사 확인 필요",region:"제주 서귀포",denomination:"교단 확인 필요",holdReason:"youtube_unavailable",holdNote:"공식 홈페이지의 다음세대 활동은 확인했으나 교단·담임목사와 공식 YouTube 채널 및 최근 180일 업로드를 확인하지 못해 보류했습니다."},
  {name:"정읍성광교회",pastor:"김기철 목사",region:"전북 정읍",denomination:"대한예수교장로회 합동",holdReason:"youtube_unavailable",holdNote:"교단·담임목사·지역은 확인했으나 공식 YouTube 채널과 최근 180일 내 설교·예배 업로드를 확인하지 못해 보류했습니다."},
  {name:"진천중앙교회",pastor:"김우종 목사",region:"충북 진천",denomination:"대한예수교장로회 통합",holdReason:"info_unverified",holdNote:"공식 홈페이지는 확인했으나 조사된 YouTube 핸들이 실제 채널로 확인되지 않았고 홈페이지에서도 공식 채널 연결을 대조하지 못해 보류했습니다."},
  {name:"충주남부교회",pastor:"담임목사 확인 필요",region:"충북 충주",denomination:"교단 확인 필요",holdReason:"info_unverified",holdNote:"동명 교회가 여러 지역에 있어 홈페이지와 YouTube 채널의 소유 관계, 담임목사·교단, 다음세대 부서를 한 교회 정보로 확정하지 못해 보류했습니다."},
  {name:"제천성광교회",pastor:"담임목사 확인 필요",region:"충북 제천",denomination:"교단 확인 필요",holdReason:"info_unverified",holdNote:"한글 도메인 연결이 불안정하고 청년부 정기 운영 및 공식 YouTube 채널의 최근 설교 업로드를 함께 확인하지 못해 보류했습니다."},
];

// Rows are idempotent (INSERT ... WHERE NOT EXISTS), so once this has run successfully in an
// isolate there is nothing left to insert; skip re-running the batch on every sync trigger.
let heldSourcesSeeded:Promise<void>|null=null;
async function seedHeldSources(db:D1Database) {
  if(heldSourcesSeeded) return heldSourcesSeeded;
  const holdNote="지난 24곳 재검토에서 공식 YouTube 채널과 최근 180일 내 설교·예배 운영을 확인하지 못해 보류했습니다. 새 추천 시 이 기록과 먼저 비교합니다.";
  heldSourcesSeeded=db.batch([
    ...heldSources.map((source)=>db.prepare(`INSERT INTO churches (name,pastor,region,denomination,review_status,hold_reason,hold_note,held_at) SELECT ?,?,?,?,'removed','youtube_unavailable',?,CURRENT_TIMESTAMP WHERE NOT EXISTS (SELECT 1 FROM churches WHERE ${sqlNormalized("name")}=?)`).bind(source.name,source.pastor,source.region,source.denomination,holdNote,normalizeSearchValue(source.name))),
    ...regionalHeldSources.map((source)=>db.prepare(`INSERT INTO churches (name,pastor,region,denomination,review_status,hold_reason,hold_note,held_at) SELECT ?,?,?,?,'removed',?,?,CURRENT_TIMESTAMP WHERE NOT EXISTS (SELECT 1 FROM churches WHERE ${sqlNormalized("name")}=?)`).bind(source.name,source.pastor,source.region,source.denomination,source.holdReason,source.holdNote,normalizeSearchValue(source.name))),
  ]).then(()=>undefined).catch((error)=>{heldSourcesSeeded=null;throw error;});
  return heldSourcesSeeded;
}

const sourceCandidates:Source[]=[
  {name:"더작은교회",pastor:"전영준 목사",region:"인천 계양",denomination:"기독교대한성결교회",channelId:"UCp1lD5gI8JRKZurlAPRSHiw",homepage:"https://cafe.daum.net/the-sc"},
  {name:"구파발교회",pastor:"김춘곤 목사",region:"서울 은평",denomination:"대한예수교장로회 통합",channelId:"UCzLn1mDAnao7GAXfYL5Ze2A"},
  {name:"개봉교회",pastor:"노창영 목사",region:"서울 구로",denomination:"대한예수교장로회 통합",channelId:"UCfttSAr79s5vyYiBstgDUfg"},
  {name:"문창교회",pastor:"성종근 목사",region:"대전 중구",denomination:"대한예수교장로회 통합",channelId:"UClDQSCD3ZOaJy4sLIX1iXGw"},
  {name:"대구신광교회",pastor:"전광민 목사",region:"대구 북구",denomination:"대한예수교장로회 통합",channelId:"UCl6G8WEAgdMMCEOnSvCjv5w"},
  {name:"동래중앙교회",pastor:"정대훈 목사",region:"부산 동래",denomination:"대한예수교장로회 통합",channelId:"UCetdj5X51mI_RLGXd0UQW3w"},
  {name:"구포교회",pastor:"정명호 목사",region:"부산 북구",denomination:"대한예수교장로회 통합",channelId:"UCNQBdYnHG6JAB0aym2rgUGQ"},
  {name:"광릉내교회",pastor:"김상룡 목사",region:"경기 남양주",denomination:"대한예수교장로회 통합",channelId:"UCmkjq0eLg3zKVyD-VZO99oQ"},
  {name:"경기중앙교회",pastor:"이춘복 목사",region:"경기 의왕",denomination:"대한예수교장로회 통합",channelId:"UCjY8jDwhFLrTA0rIEfxR8cg"},
  {name:"광주제일교회",pastor:"권대현 목사",region:"광주 서구",denomination:"대한예수교장로회 통합",channelId:"UCkLt9jMVSzjA9yUJaR_PPMA"},
  {name:"대구신암교회",pastor:"곽숭기 목사",region:"대구 동구",denomination:"대한예수교장로회 통합",channelId:"UCHGVVmnGncEK64cXMnfZGUQ"},
  {name:"대성교회",pastor:"정영협 목사",region:"대전 서구",denomination:"대한예수교장로회 통합",channelId:"UCCtKOGH5myjdG2fI2IB5WmA"},
  {name:"가야교회",pastor:"박남규 목사",region:"부산 부산진",denomination:"대한예수교장로회 통합",channelId:"UCdPw7POSYx6v8RDHoPEP5cw"},
  {name:"땅끝교회",pastor:"안맹환 목사",region:"부산 영도",denomination:"대한예수교장로회 통합",channelId:"UCEEx0Z6ZWQRejRxj7-QEu1Q"},
  {name:"남광교회",pastor:"정용철 목사",region:"인천 연수",denomination:"대한예수교장로회 통합",channelId:"UCQo-rkjxguVzgA6UUZIAOtA"},
  {name:"가나안교회",pastor:"서진영 목사",region:"경기 광주",denomination:"대한예수교장로회 합동",channelId:"UCQ97oMrF68ctJVeTWp3Rm_Q"},
  {name:"주다산교회",pastor:"권순웅 목사",region:"경기 화성",denomination:"대한예수교장로회 합동",channelId:"UCHPObmscdWflQ2pKvzU0ksg"},
  {name:"덕소교회",pastor:"문홍선 목사",region:"경기 남양주",denomination:"대한예수교장로회 합동",channelId:"UCqmluYfs0hWw0KFXzAqt4iQ"},
  {name:"과천영광교회",pastor:"우진성 목사",region:"경기 과천",denomination:"한국기독교장로회",channelId:"UCsVzcHPbcjdg3gK1MSBp1hw"},
  {name:"온누리교회",pastor:"이재훈 목사",region:"서울 용산",denomination:"대한예수교장로회 통합",handle:"@Onnuriservice"},
  {name:"분당우리교회",pastor:"이찬수 목사",region:"경기 성남",denomination:"대한예수교장로회 합동",handle:"@BundangWooriChurch"},
  {name:"거룩한빛광성교회",pastor:"곽승현 목사",region:"경기 고양",denomination:"대한예수교장로회 통합",channelId:"UCpRPXBwj33S73e3SFDD9_-Q"},
  {name:"여의도순복음교회",pastor:"이영훈 목사",region:"서울 영등포",denomination:"기독교대한하나님의성회",channelId:"UCa-36V2wccHkTQ0SUziSn0A"},
  {name:"수영로교회",pastor:"이규현 목사",region:"부산 해운대",denomination:"대한예수교장로회 합동",channelId:"UCfJqjGzxG09kzLNDkYJJegA"},
  {name:"대구동신교회",pastor:"문대원 목사",region:"대구 수성",denomination:"대한예수교장로회 합동",channelId:"UCuWebi6hqVRFsvb6UmWr9Qg"},
  {name:"광주동명교회",pastor:"이상복 목사",region:"광주 동구",denomination:"대한예수교장로회",handle:"@cocho7406"},
  {name:"인천제일교회",pastor:"이제일 목사",region:"인천 남동",denomination:"기독교대한감리회",handle:"@인천제일교회"},
  {name:"소망교회",pastor:"김경진 목사",region:"서울 강남",denomination:"대한예수교장로회 통합",channelId:"UCIItIEnZPjKo0eqvq9qIJAg"},
  {name:"새로남교회",pastor:"오정호 목사",region:"대전 서구",denomination:"대한예수교장로회 합동",username:"srnchurch"},
  {name:"우리들교회",pastor:"김양재 목사",region:"경기 성남",denomination:"대한예수교장로회 통합",username:"wooridlechurch"},
  {name:"영락교회",pastor:"김운성 목사",region:"서울 중구",denomination:"대한예수교장로회 통합",handle:"@youngnakchurch"},
  {name:"사랑의교회",pastor:"오정현 목사",region:"서울 서초",denomination:"대한예수교장로회 합동",handle:"@sarangchurch121"},
  {name:"서머나교회",pastor:"배성현 목사",region:"경남 창원",denomination:"대한예수교장로회 합동",handle:"@서머나교회"},
  {name:"선한목자교회",pastor:"김다위 목사",region:"경기 성남",denomination:"기독교대한감리회",channelId:"UCjXMsndMsc538jppd4zqnCg"},
  {name:"남서울교회",pastor:"화종부 목사",region:"서울 서초",denomination:"대한예수교장로회 합동",handle:"@namseoulchurch"},
  {name:"주안교회",pastor:"주승중 목사",region:"인천 부평",denomination:"대한예수교장로회 통합",handle:"@juanchurch"},
  {name:"지구촌교회",pastor:"김우준 목사",region:"경기 성남",denomination:"기독교한국침례회",channelId:"UCk9nXMCHaKKjEV3waM5327g"},
  {name:"할렐루야교회",pastor:"김승욱 목사",region:"경기 성남",denomination:"한국독립교회선교단체연합회",channelId:"UCjHPrYoxZnPlYohdMQYEL7A"},
  {name:"포항제일교회",pastor:"박영호 목사",region:"경북 포항",denomination:"대한예수교장로회 통합",handle:"@pohangjeil"},
  {name:"제자광성교회",pastor:"박한수 목사",region:"경기 고양",denomination:"대한예수교장로회",channelId:"UCh3BRUypgg56_4KFXUn3UaQ"},
  {name:"한소망교회",pastor:"최봉규 목사",region:"경기 파주",denomination:"대한예수교장로회 통합",channelId:"UCCUiwnIMfFpig9Ui0u4y3Rg"},
  {name:"만나교회",pastor:"김병삼 목사",region:"경기 성남",denomination:"기독교대한감리회",channelId:"UC0EweXMQqvbiTPYLXY0WFzA"},
  {name:"호산나교회",pastor:"유진소 목사",region:"부산 강서",denomination:"대한예수교장로회 합신",channelId:"UCjms0bjEtU_me52S5Y-su_w"},
  {name:"새문안교회",pastor:"이상학 목사",region:"서울 종로",denomination:"대한예수교장로회 통합",channelId:"UCM1lj8Gqmiw_aqTKqYNXcSQ"},
  {name:"충현교회",pastor:"한규삼 목사",region:"서울 강남",denomination:"대한예수교장로회 합동",channelId:"UCctXsTmxLVtoGCe6yuMehVw"},
  {name:"남포교회",pastor:"최태준 목사",region:"서울 송파",denomination:"대한예수교장로회 합신",channelId:"UCMTIup8Qw7JmPbPwUnb32sw"},
  {name:"남서울은혜교회",pastor:"박완철 목사",region:"서울 강남",denomination:"대한예수교장로회 합신",channelId:"UC8iyq7XGmvER26ihP0xqPVw"},
  {name:"동안교회",pastor:"김형준 목사",region:"서울 동대문",denomination:"대한예수교장로회 통합",channelId:"UC8ZHlcdd7CClYj5pOpbdRLg"},
  {name:"삼일교회",pastor:"송태근 목사",region:"서울 용산",denomination:"대한예수교장로회 합동",channelId:"UCdUkQwI7Ozo5KnTGMPhzuhw"},
  {name:"한성교회",pastor:"도원욱 목사",region:"서울 성북",denomination:"대한예수교장로회 합동",channelId:"UCwg1mSaYYvY4zzxyCnjgo7A"},
  {name:"중앙성결교회",pastor:"한기채 목사",region:"서울 종로",denomination:"기독교대한성결교회",channelId:"UCx1JYOy9Y4MujQyy5qwZKtw"},
  {name:"신촌성결교회",pastor:"박노훈 목사",region:"서울 마포",denomination:"기독교대한성결교회",channelId:"UCcGkobjI9S3VjDFOil7AYUQ"},
  {name:"성락성결교회",pastor:"지형은 목사",region:"서울 성동",denomination:"기독교대한성결교회",channelId:"UCphd-VgnvrbRqytM2EEsa7Q"},
  {name:"강남중앙침례교회",pastor:"최병락 목사",region:"서울 강남",denomination:"기독교한국침례회",channelId:"UCddiBkwjHEctRjt6RNoKLyQ"},
  {name:"여의도침례교회",pastor:"국명호 목사",region:"서울 영등포",denomination:"기독교한국침례회",channelId:"UCX1cEHYvSD9SPCT-Ag010wQ"},
  {name:"서울영동교회",pastor:"정현구 목사",region:"서울 강남",denomination:"대한예수교장로회 고신",channelId:"UCT6SL_iZ3EBBxeC0VFCOr2g"},
  {name:"신반포교회",pastor:"홍문수 목사",region:"서울 서초",denomination:"대한예수교장로회 합동",channelId:"UC_YmxdPJMFMNOiWCmRpCK7A"},
  {name:"더사랑의교회",pastor:"이인호 목사",region:"경기 수원",denomination:"대한예수교장로회 합동",channelId:"UCEW0ELXuAt7gVCJSCkYl2Iw"},
  {name:"안산동산교회",pastor:"김성겸 목사",region:"경기 안산",denomination:"대한예수교장로회 통합",channelId:"UCFJrKLtMEjhibI6gJav6F3g"},
  {name:"안산제일교회",pastor:"허요환 목사",region:"경기 안산",denomination:"대한예수교장로회 통합",channelId:"UCCTPkC9-7MKSSM1GxnAPGkw"},
  {name:"수원중앙침례교회",pastor:"고명진 목사",region:"경기 수원",denomination:"기독교한국침례회",channelId:"UC5JFLdlLe5_XMkVQuT6t7NQ"},
  {name:"꿈의교회",pastor:"김학중 목사",region:"경기 안산",denomination:"기독교대한감리회",channelId:"UCaNoaz05HCffa_61Jf_9Qng"},
  {name:"군포제일교회",pastor:"권태진 목사",region:"경기 군포",denomination:"대한예수교장로회 합신",channelId:"UCb3u0ONiSfTMGKiDx26sgsw"},
  {name:"은혜샘물교회",pastor:"윤만선 목사",region:"경기 용인",denomination:"대한예수교장로회 고신",channelId:"UCRB69CTifmGJoZcL6RWKaHg"},
  {name:"갈보리교회",pastor:"이웅조 목사",region:"경기 성남",denomination:"한국독립교회선교단체연합회",channelId:"UCkTux8ozOPWRu4JlbSoxs7Q"},
  {name:"새중앙교회",pastor:"황덕영 목사",region:"경기 안양",denomination:"대한예수교장로회 백석",channelId:"UC2-SL5ohy5WjcfxGnocU8aA"},
  {name:"용인기쁨의교회",pastor:"정의호 목사",region:"경기 용인",denomination:"대한예수교장로회 합동",channelId:"UCDrtkGynzAMwdryP_pA1xNA"},
  {name:"일산광림교회",pastor:"박동찬 목사",region:"경기 고양",denomination:"기독교대한감리회",channelId:"UCOenUFkUR2OIg1UMZQs0mKQ"},
  {name:"효성중앙교회",pastor:"정연수 목사",region:"인천 계양",denomination:"기독교대한감리회",channelId:"UCxIvngefJnr1Ogq9Yf3mpdA"},
  {name:"연동교회",pastor:"김주용 목사",region:"서울 종로",denomination:"대한예수교장로회 통합",channelId:"UCd5exyISA9wKSdz8z5403gQ"},
  {name:"포도원교회",pastor:"전남수 목사",region:"부산 북구",denomination:"대한예수교장로회 고신",channelId:"UC27RSfE21eJq27lQ7p84TaQ"},
  {name:"부산중앙교회",pastor:"최현범 목사",region:"부산 중구",denomination:"대한예수교장로회 고신",channelId:"UCpTEWDW7a-x_2ok-DIlvsHA"},
  {name:"구덕교회",pastor:"이종훈 목사",region:"부산 서구",denomination:"대한예수교장로회 고신",channelId:"UCGb2K1-6yjpyqHQOh3cZJcQ"},
  {name:"대구동부교회",pastor:"박성순 목사",region:"대구 동구",denomination:"대한예수교장로회 합동",channelId:"UCUQRcIxz5IO3oU4fJAtPtZw"},
  {name:"대구서문교회",pastor:"소문수 목사",region:"대구 중구",denomination:"대한예수교장로회 합동",channelId:"UCgASqJdMEOhf3hkiG7ofC4g"},
  {name:"대봉교회",pastor:"김은회 목사",region:"대구 중구",denomination:"대한예수교장로회 통합",channelId:"UCF9e19RQdGDyDGlhvNpYEjA"},
  {name:"광주벧엘교회",pastor:"리종빈 목사",region:"광주 남구",denomination:"대한예수교장로회 통합",channelId:"UCcStWmCMVlWIr2yUZD89gIw"},
  {name:"대전한빛교회",pastor:"백용현 목사",region:"대전 대덕",denomination:"기독교대한감리회",channelId:"UC5rJi-E3aMkb46vVHJArvYg"},
  {name:"대영교회",pastor:"박갈뫼 목사",region:"울산 북구",denomination:"대한예수교장로회 합동",channelId:"UCdRQmnRr_v417i4rxKlx3SQ"},
  {name:"우정교회",pastor:"예동열 목사",region:"울산 중구",denomination:"대한예수교장로회 통합",channelId:"UCkTo34KE2P39FgAvAbeIj3A"},
  {name:"울산교회",pastor:"이호상 목사",region:"울산 중구",denomination:"대한예수교장로회 고신",channelId:"UCOYQQQpv4M2dRRl5kezImiA"},
  {name:"세종꿈의교회",pastor:"안희묵 목사",region:"세종",denomination:"기독교한국침례회",channelId:"UC9QCApw5sHlKY3e5B7RSkXw"},
  {name:"세종샘솟는교회",pastor:"최병남 목사",region:"세종",denomination:"대한예수교장로회 통합",channelId:"UCbwyp1kq3mpDYCsvRj-7Xew"},
  {name:"춘천제일감리교회",pastor:"이용호 목사",region:"강원 춘천",denomination:"기독교대한감리회",channelId:"UCgmkb1Uzv7qhQg2kpo2N0oA"},
  {name:"원주중부교회",pastor:"김미열 목사",region:"강원 원주",denomination:"대한예수교장로회 합동",channelId:"UCaxJu7eIeLAI-p9QRuTR2DQ"},
  {name:"원주제일교회",pastor:"최헌영 목사",region:"강원 원주",denomination:"기독교대한감리회",channelId:"UC8RqV1okDmFVBwt2HLz7ecw"},
  {name:"상당교회",pastor:"안광복 목사",region:"충북 청주",denomination:"대한예수교장로회 통합",channelId:"UC7EmCHrdRg1wwuzS5VnAE3Q"},
  {name:"청주서문교회",pastor:"박명룡 목사",region:"충북 청주",denomination:"기독교대한성결교회",channelId:"UC0f7WbZZ3vtxAXTeJWWxF_Q"},
  {name:"청주순복음교회",pastor:"이동규 목사",region:"충북 청주",denomination:"기독교대한하나님의성회",channelId:"UC_GdNpJWZmFavR_tlZNPcKw"},
  {name:"청주금천교회",pastor:"신경민 목사",region:"충북 청주",denomination:"대한예수교장로회 통합",channelId:"UCptBPu-nwfP6eUK9KvS-8HQ"},
  {name:"천안하늘중앙교회",pastor:"유영완 목사",region:"충남 천안",denomination:"기독교대한감리회",channelId:"UCOd-S-sl6j8iyJz9bqZOkVg"},
  {name:"천안중앙교회",pastor:"강재원 목사",region:"충남 천안",denomination:"기독교대한감리회",channelId:"UCfKMQoIn3Sls5HjB2Ve4gyA"},
  {name:"온양제일교회",pastor:"김의중 목사",region:"충남 아산",denomination:"대한예수교장로회 통합",channelId:"UCS3TRSCP5PNGO2XTQjimW4Q"},
  {name:"공주중앙장로교회",pastor:"김진영 목사",region:"충남 공주",denomination:"대한예수교장로회 합동",channelId:"UCxFYex6oKCLF2-S9tVC8UrQ"},
  {name:"전주바울교회",pastor:"신현모 목사",region:"전북 전주",denomination:"기독교대한성결교회",channelId:"UCv_IZcd_9wVV9Ct-scNh0IQ"},
  {name:"전주안디옥교회",pastor:"박진구 목사",region:"전북 전주",denomination:"독립교회",channelId:"UCE3q1S1oUqBoBQn8OPZ85TA"},
  {name:"전주새중앙교회",pastor:"홍동필 목사",region:"전북 전주",denomination:"대한예수교장로회 합동",channelId:"UCng-cfZqggs3jqQzQ-e0Q-g"},
  {name:"목포사랑의교회",pastor:"백동조 목사",region:"전남 목포",denomination:"대한예수교장로회 합동",channelId:"UCd8A9MamNETNRXozW0Yjrlg"},
  {name:"순천중앙교회",pastor:"홍인식 목사",region:"전남 순천",denomination:"대한예수교장로회 통합",channelId:"UCWQlu1wJIIAxZqdWfanwkdw"},
  {name:"여수은파교회",pastor:"고만호 목사",region:"전남 여수",denomination:"독립교회",channelId:"UCqMG1OjNP1zkA-zUpxMfFCg"},
  {name:"향상교회",pastor:"김석홍 목사",region:"경기 용인",denomination:"대한예수교장로회 고신",handle:"@hyangsangchurch-2382"},
  {name:"포항기쁨의교회",pastor:"박진석 목사",region:"경북 포항",denomination:"대한예수교장로회 통합",channelId:"UC0vmi1mhBMndVy0n6kPZOJg"},
  {name:"포항중앙교회",pastor:"손병렬 목사",region:"경북 포항",denomination:"대한예수교장로회 통합",channelId:"UCIQjKnCZhRSSn0Sci7XmD_A"},
  {name:"경주제일교회",pastor:"정영택 목사",region:"경북 경주",denomination:"대한예수교장로회 통합",channelId:"UCZ27Owsi-yW_Ye1ojUE9hFg"},
  {name:"구미상모교회",pastor:"김승동 목사",region:"경북 구미",denomination:"대한예수교장로회 합동",channelId:"UCbKW1I4g6Bot4KBTs6o73HA"},
  {name:"양곡교회",pastor:"지용수 목사",region:"경남 창원",denomination:"대한예수교장로회 고신",channelId:"UCubeur9Ao1aC0S8MMktyRWw"},
  {name:"창원상남교회",pastor:"이창교 목사",region:"경남 창원",denomination:"대한예수교장로회 고신",channelId:"UCEFug8Nijd0qUKiRIdNXOng"},
  {name:"거제고현교회",pastor:"박정곤 목사",region:"경남 거제",denomination:"대한예수교장로회 고신",channelId:"UCaB9Fo6J0fC1xBcU9WLH9tw"},
  {name:"제주성안교회",pastor:"류정길 목사",region:"제주 제주",denomination:"대한예수교장로회 통합",channelId:"UCwxF003ice5d-ufS0wu_CrQ"},
  {name:"제주순복음교회",pastor:"표순호 목사",region:"제주 제주",denomination:"기독교대한하나님의성회 광화문총회",channelId:"UCkR0487FW1G7iC46Jmfodng"},
  {name:"광림교회",pastor:"김정석 목사",region:"서울 강남",denomination:"기독교대한감리회",channelId:"UCV1aWMg0Q5sXmpLiK4Rih6A"},
  {name:"금란교회",pastor:"김정민 목사",region:"서울 중랑",denomination:"기독교대한감리회",channelId:"UCRqUsmAoeQL9_o-mxOXeo6A"},
  {name:"오륜교회",pastor:"주경훈 목사",region:"서울 강동",denomination:"대한예수교장로회 합동",channelId:"UCCATFGVyXoa361VN6lELz3w"},
  {name:"새에덴교회",pastor:"소강석 목사",region:"경기 용인",denomination:"대한예수교장로회 합동",channelId:"UCapBxZyEfCAjx0udd3DWsgQ"},
  {name:"대전중앙교회",pastor:"고석찬 목사",region:"대전 중구",denomination:"대한예수교장로회 합동",channelId:"UCw9HD9N5O7ZkTxKS2RjyF2g"},
  {name:"경산중앙교회",pastor:"김종원 목사",region:"경북 경산",denomination:"대한예수교장로회 고신",channelId:"UCK3Q4MGiowIcDX8Y0vPI5HQ"},
  {name:"사직동교회",pastor:"복기훈 목사",region:"부산 동래",denomination:"대한예수교장로회 고신",channelId:"UCAXgvRIr3pfcA4axe5o6Wiw"},
  {name:"전주중부교회",pastor:"박종숙 목사",region:"전북 전주",denomination:"대한예수교장로회 통합",channelId:"UC8DFCt9vnYOjoTH5DNNtIjQ"},
  {name:"순천제일교회",pastor:"조주희 목사",region:"전남 순천",denomination:"대한예수교장로회 통합",channelId:"UCCrL0h5hhNCCXuNVSPKQ_OQ"},
  {name:"복된이웃교회",pastor:"이동현 목사",region:"경기 광주",denomination:"대한예수교장로회 백석",handle:"@복된이웃교회"},
  {name:"큰빛광성교회",pastor:"이대성 목사",region:"경기 고양",denomination:"대한예수교장로회 통합",handle:"@kbks8332"},
  {name:"은혜광성교회",pastor:"박재신 목사",region:"서울 강동",denomination:"대한예수교장로회 백석",handle:"@GraceKwangsung"},
  {name:"생명의빛광성교회",pastor:"이춘태 목사",region:"서울 서초",denomination:"대한예수교장로회 통합",handle:"@생명의빛광성교회"},
  {name:"덕양중앙교회",pastor:"이형기 목사",region:"경기 고양",denomination:"대한예수교장로회 통합",handle:"@덕양중앙교회"},
  {name:"물댄동산수림교회",pastor:"신종렬 목사",region:"경기 의정부",denomination:"대한예수교장로회 통합",handle:"@물댄동산수림교회신종"},
  {name:"주만교회",pastor:"이범주 목사",region:"인천 남동",denomination:"대한예수교장로회 통합",handle:"@jooman"},
  {name:"하늘빛광성교회",pastor:"박경수 목사",region:"경기 고양",denomination:"대한예수교장로회 통합",handle:"@hlkc2015"},
  {name:"밀알교회",pastor:"신동명 목사",region:"서울 강서",denomination:"대한예수교장로회 통합",handle:"@milalch"},
  {name:"불로교회",pastor:"한민수 목사",region:"인천 서구",denomination:"대한예수교장로회 통합",handle:"@불로교회"},
  {name:"거룩한빛시온교회",pastor:"서동훈 목사",region:"경기 고양",denomination:"대한예수교장로회 통합",handle:"@Sionchurch2019",verifiedSermonFeed:true},
  {name:"거룩한빛운정교회",pastor:"유정상 목사",region:"경기 파주",denomination:"대한예수교장로회 통합",handle:"@hlujch"},
  {name:"상도중앙교회",pastor:"박봉수 목사",region:"서울 동작",denomination:"대한예수교장로회 통합",handle:"@상도중앙교회"},
  {name:"은혜의빛광성교회",pastor:"장동훈 목사",region:"경기 고양",denomination:"대한예수교장로회 통합",handle:"@thelightofgracechurch"},
  {name:"주와길교회",pastor:"최병화 목사",region:"경기 양주",denomination:"대한예수교장로회 통합",handle:"@lordnroad_church"},
  {name:"거룩한빛등대교회",pastor:"문상원 목사",region:"경기 고양",denomination:"대한예수교장로회 통합",handle:"@ddchurchorg"},
  {name:"거룩한빛예안교회",pastor:"이병철 목사",region:"경기 파주",denomination:"대한예수교장로회 통합",handle:"@je-anchurch"},
  {name:"광주서림교회",pastor:"조용현 목사",region:"광주 북구",denomination:"대한예수교장로회 통합",channelId:"UC82QWyiYLB5NaRmEInZCfHg"},
  {name:"광주경신교회",pastor:"김판석 목사",region:"광주 북구",denomination:"대한예수교장로회 고신",channelId:"UCEnpM0PQsc8mmd4fkVnXX2w"},
  {name:"서귀포중앙교회",pastor:"김상현 목사",region:"제주 서귀포",denomination:"한국기독교장로회",handle:"@서귀포중앙"},
  {name:"강릉중앙감리교회",pastor:"박태환 목사",region:"강원 강릉",denomination:"기독교대한감리회",channelId:"UCL_nPtCzo6TeEW8UrkZTKcQ"},
  {name:"삼척제일교회",pastor:"박신진 목사",region:"강원 삼척",denomination:"기독교대한감리회",channelId:"UCX2s2h5PvNw_K5_I29Uu_rg"},
  {name:"동해교회",pastor:"이상수 목사",region:"강원 동해",denomination:"기독교대한감리회",channelId:"UCG2Yk4OT8pQ7O7ktHHdMHjA"},
  {name:"진주교회",pastor:"송영의 목사",region:"경남 진주",denomination:"대한예수교장로회 통합",channelId:"UCT8u-MbFMz55MHRvqhu18DQ"},
  {name:"통영교회",pastor:"김진성 목사",region:"경남 통영",denomination:"대한예수교장로회 통합",channelId:"UC1XwhbEmUkaPV8MW8qjp79Q"},
  {name:"모든민족교회",pastor:"박원일 목사",region:"경남 김해",denomination:"대한예수교장로회 고신",channelId:"UCwBrzFLFNseUFAHHCpZlBEg"},
  {name:"제주영락교회",pastor:"심상철 목사",region:"제주 제주",denomination:"대한예수교장로회 통합",channelId:"UCN00h-iuCithcXb8AxITs3g"},
  {name:"제주성지교회",pastor:"노경천 목사",region:"제주 제주",denomination:"대한예수교장로회 통합",channelId:"UCgzBhQOW5bZ3893ksZHeL8w"},
  {name:"제주중문교회",pastor:"김민호 목사",region:"제주 서귀포",denomination:"대한예수교장로회 통합",channelId:"UC78fZnbgh3aglJAEtq5h-yg"},
  {name:"군산개복교회",pastor:"여성헌 목사",region:"전북 군산",denomination:"대한예수교장로회 합동",channelId:"UC2nLj0_dmGgGESDuCsbLDSQ"},
  {name:"광양제일교회",pastor:"박재일 목사",region:"전남 광양",denomination:"대한예수교장로회 통합",channelId:"UCG3ZeC8hBykHnSCUY4GRn5Q"},
  {name:"제천제일감리교회",pastor:"안정균 목사",region:"충북 제천",denomination:"기독교대한감리회",channelId:"UC8joyyen3k1SeWRbhyanR8Q"},
  {name:"강릉교회",pastor:"이상천 목사",region:"강원 강릉",denomination:"대한예수교장로회 통합",channelId:"UCCsVCQSOgDuzaD40QqgewUA"},
  {name:"강릉소망교회",pastor:"김현동 목사",region:"강원 강릉",denomination:"대한예수교장로회 통합",channelId:"UChJPFhWhN5XIudsuq3XBsgg"},
  {name:"강릉양울교회",pastor:"최문린 목사",region:"강원 강릉",denomination:"대한예수교장로회 통합",channelId:"UCGnMO5fETy4uYv7vOdA-nrg"},
  {name:"동해사랑의교회",pastor:"이승준 목사",region:"강원 동해",denomination:"대한예수교장로회 통합",channelId:"UCpUWdoFrfjkXjE-c49ArizA"},
  {name:"동해창성교회",pastor:"황형봉 목사",region:"강원 동해",denomination:"대한예수교장로회 통합",channelId:"UCwsGIkWiL4kVERAgbDoQI0Q"},
  {name:"동상교회",pastor:"양근배 목사",region:"강원 양양",denomination:"대한예수교장로회 통합",channelId:"UC-TpGwF5vk6DsHISjb0l_nA"},
  {name:"새길교회",pastor:"김현곤 목사",region:"강원 춘천",denomination:"대한예수교장로회 통합",channelId:"UC6A4Fg-fMKKq8Nv_oN2Xnww"},
  {name:"광명교회",pastor:"박재학 목사",region:"경기 광명",denomination:"대한예수교장로회 통합",channelId:"UCPGdJbU69D2KghB8Lqf4cWg"},
  {name:"광야교회",pastor:"강석공 목사",region:"경기 광주",denomination:"대한예수교장로회 통합",channelId:"UCz7aDuieEMa1bNcGqCPeQ2w"},
  {name:"가현교회",pastor:"최승회 목사",region:"경기 김포",denomination:"대한예수교장로회 통합",channelId:"UC8kummJRYev7SznpTfJcw3Q"},
  {name:"고촌중앙교회",pastor:"이진섭 목사",region:"경기 김포",denomination:"대한예수교장로회 통합",channelId:"UCmWG4FD5TeqY2htNcN46Xjg"},
  {name:"1516교회",pastor:"이상준 목사",region:"경기 성남",denomination:"대한예수교장로회 통합",channelId:"UCu_c53KvgeWrngFsX6HkZ5Q"},
  {name:"고등제일교회",pastor:"이근욱 목사",region:"경기 성남",denomination:"대한예수교장로회 통합",channelId:"UC4A38Av50RUa3jTaMKxWBAA"},
  {name:"과림리교회",pastor:"최용석 목사",region:"경기 시흥",denomination:"대한예수교장로회 통합",channelId:"UCFy4ZJ67GFx44Fz-CXVBI-w"},
  {name:"공도교회",pastor:"이대희 목사",region:"경기 안성",denomination:"대한예수교장로회 통합",channelId:"UC__tva0i-k_y5k8ppECWNvQ"},
  {name:"가납교회",pastor:"유우정 목사",region:"경기 양주",denomination:"대한예수교장로회 통합",channelId:"UCI3mj_AOtGoCovxXXW2qWqQ"},
  {name:"강북제일교회",pastor:"이상대 목사",region:"경기 양주",denomination:"대한예수교장로회 통합",channelId:"UCehqZC0VoblyokfGLTA2pWQ"},
  {name:"강하중앙교회",pastor:"김재욱 목사",region:"경기 양평",denomination:"대한예수교장로회 통합",channelId:"UCTMiIXyR6JlrG1s8_5edQAg"},
  {name:"고기교회",pastor:"안홍택 목사",region:"경기 용인",denomination:"대한예수교장로회 통합",channelId:"UCeyl8qOukXhinG7hHhxY7iA"},
  {name:"교하영락교회",pastor:"이주철 목사",region:"경기 파주",denomination:"대한예수교장로회 통합",channelId:"UCqRxp2B3NC0kcg0KzcMSAjg"},
  {name:"광야의교회",pastor:"임창진 목사",region:"경기 하남",denomination:"대한예수교장로회 통합",channelId:"UCvzb8VvCT62bM-ZWh-nrDQw"},
  {name:"새장승포교회",pastor:"박태부 목사",region:"경남 거제",denomination:"대한예수교장로회 통합",channelId:"UCsKDOcqcQY5DlL9c6kX7k5Q"},
  {name:"김해소정교회",pastor:"김세웅 목사",region:"경남 김해",denomination:"대한예수교장로회 통합",channelId:"UCNsfKpgmoHhU7MaIXDos9Sg"},
  {name:"동행하는교회",pastor:"송민철 목사",region:"경남 김해",denomination:"대한예수교장로회 통합",channelId:"UCm1sL-yHKDR1GO7Ra8OSXnQ"},
  {name:"순전한교회",pastor:"김영숙 목사",region:"경남 양산",denomination:"대한예수교장로회 통합",channelId:"UCPRuc8yw-X3aVQ4XvBoc8xQ"},
  {name:"예수기쁨의교회",pastor:"김관혁 목사",region:"경남 양산",denomination:"대한예수교장로회 통합",channelId:"UCckrTlWrapBuxU94QB4a8uw"},
  {name:"대원교회",pastor:"주신웅 목사",region:"경남 창원",denomination:"대한예수교장로회 통합",channelId:"UCpzuaYjRUBQUE1ez7gie-VQ"},
  {name:"의창교회",pastor:"강동협 목사",region:"경남 창원",denomination:"대한예수교장로회 통합",channelId:"UCUWLRbUBMO7Q2YQTuwYavQw"},
  {name:"경주샤론교회",pastor:"박성종 목사",region:"경북 경주",denomination:"대한예수교장로회 통합",channelId:"UC9iNu-9jAo_07gp8e90Nxlg"},
  {name:"구미영광교회",pastor:"곽금배 목사",region:"경북 구미",denomination:"대한예수교장로회 통합",channelId:"UClAe8HZd3I0qYK1sVVWEjrA"},
  {name:"구미일상의교회",pastor:"용환필 목사",region:"경북 구미",denomination:"대한예수교장로회 통합",channelId:"UCwkSm5gzwoww2qQbUMMhiuw"},
  {name:"목자교회",pastor:"윤신율 목사",region:"경북 예천",denomination:"대한예수교장로회 통합",channelId:"UCyYA-eTbYP-tZSO5RPo3fQA"},
  {name:"샤론교회",pastor:"김병수 목사",region:"경북 포항",denomination:"대한예수교장로회 통합",channelId:"UCK8HvBywyoJpuNm84VuX10w"},
  {name:"포항늘사랑교회",pastor:"최득섭 목사",region:"경북 포항",denomination:"대한예수교장로회 통합",channelId:"UC0rO__xNIPoTzq-jsw_D-6A"},
  {name:"포항평화교회",pastor:"노승택 목사",region:"경북 포항",denomination:"대한예수교장로회 통합",channelId:"UCongiSksUV3TEqSlBgUT1aA"},
  {name:"광주희망교회",pastor:"송진영 목사",region:"광주 광산",denomination:"대한예수교장로회 통합",channelId:"UClbkksEGmo-t5D5y-okhFEA"},
  {name:"광주남문교회",pastor:"양원용 목사",region:"광주 남",denomination:"대한예수교장로회 통합",channelId:"UCq44UhPo0F3_gQk_kezDTsw"},
  {name:"광주산성교회",pastor:"이주열 목사",region:"광주 남",denomination:"대한예수교장로회 통합",channelId:"UCODJdGtxvFU6gYqsTHU0M-g"},
  {name:"광주유일교회",pastor:"남택률 목사",region:"광주 남",denomination:"대한예수교장로회 통합",channelId:"UCtKlHL5ngzvaGw1ydFoyewA"},
  {name:"광주동성교회",pastor:"남현우 목사",region:"광주 동",denomination:"대한예수교장로회 통합",channelId:"UCH5zlwwL94a76gwz75tKeSw"},
  {name:"광주영락교회",pastor:"김건태 목사",region:"광주 동",denomination:"대한예수교장로회 통합",channelId:"UCnvIAGaJa3IfTgWZQmjuH7g"},
  {name:"기쁨나무교회",pastor:"이상훈 목사",region:"광주 동",denomination:"대한예수교장로회 통합",channelId:"UCm8KYGjPmuGOh9NGFAwRX0g"},
  {name:"기억하는교회",pastor:"박재도 목사",region:"광주 동",denomination:"대한예수교장로회 통합",channelId:"UCP80ZNtGqGKmrRYzfoQAzKg"},
  {name:"광주동암교회",pastor:"박현덕 목사",region:"광주 북",denomination:"대한예수교장로회 통합",channelId:"UCjfZKrmfVveihqeZq-UMkXQ"},
  {name:"광주북문교회",pastor:"이혜춘 목사",region:"광주 북",denomination:"대한예수교장로회 통합",channelId:"UC2CCczYL7VkzDvcI2c5d1SA"},
  {name:"광주소망교회",pastor:"최정원 목사",region:"광주 북",denomination:"대한예수교장로회 통합",channelId:"UChBEhYLAV2wqFg3ITu1Nx4w"},
  {name:"그사랑교회",pastor:"김의진 목사",region:"광주 북",denomination:"대한예수교장로회 통합",channelId:"UCa065eFsDkz0jftlE8pLIEA"},
  {name:"광주다일교회",pastor:"김의신 목사",region:"광주 서",denomination:"대한예수교장로회 통합",channelId:"UCX-mXxNbXBbPBjUUENXXgag"},
  {name:"광주동광교회",pastor:"김성철 목사",region:"광주 서",denomination:"대한예수교장로회 통합",channelId:"UCJoOakj7sjhmo8eH6_VhZzQ"},
  {name:"광주무등교회",pastor:"오용선 목사",region:"광주 서",denomination:"대한예수교장로회 통합",channelId:"UCXYFNA290QsEwXWe44dseOQ"},
  {name:"광천교회",pastor:"이양수 목사",region:"광주 서",denomination:"대한예수교장로회 통합",channelId:"UCLkRkpgYQdnMlr5nALaTETA"},
  {name:"금호벧엘교회",pastor:"서순석 목사",region:"광주 서",denomination:"대한예수교장로회 통합",channelId:"UCl0sNexr3E8vNEo1cvhb8HQ"},
  {name:"남명교회",pastor:"강병일 목사",region:"대구 남",denomination:"대한예수교장로회 통합",channelId:"UCSzr-IRgfFWFdFwiqV26erw"},
  {name:"남신교회",pastor:"김광재 목사",region:"대구 남",denomination:"대한예수교장로회 통합",channelId:"UCGI2q9_UiZrzKSt1WM-LgBQ"},
  {name:"대구남광교회",pastor:"정용권 목사",region:"대구 남",denomination:"대한예수교장로회 통합",channelId:"UChAhZtkQ1cpU_ZnsS76YmLw"},
  {name:"내당교회",pastor:"조석원 목사",region:"대구 달서",denomination:"대한예수교장로회 통합",channelId:"UC3CUKsBmMSQlGC8k62ZpyFQ"},
  {name:"내당중앙교회",pastor:"김진수 목사",region:"대구 달서",denomination:"대한예수교장로회 통합",channelId:"UC8JfpYUYCHamYyqkABaIe9A"},
  {name:"대구서광교회",pastor:"이한석 목사",region:"대구 달서",denomination:"대한예수교장로회 통합",channelId:"UCYwKQj39K0bH4ROWqb8FIoA"},
  {name:"대구순종교회",pastor:"박진석 목사",region:"대구 달서",denomination:"대한예수교장로회 통합",channelId:"UC07DeHgfY6GKAxTXc0PxFqQ"},
  {name:"대구승리교회",pastor:"박광수 목사",region:"대구 달서",denomination:"대한예수교장로회 통합",channelId:"UCKDc9HOdbx3Kh9-w7z4CAzw"},
  {name:"달성제일교회",pastor:"성진호 목사",region:"대구 달성",denomination:"대한예수교장로회 통합",channelId:"UC5wP0Ieh-n9HSAUF1ThSqSA"},
  {name:"대구신성교회",pastor:"허관영 목사",region:"대구 동",denomination:"대한예수교장로회 통합",channelId:"UCwH0DL_DB30JI33z_Y-EGyQ"},
  {name:"대구신은교회",pastor:"노원석 목사",region:"대구 동",denomination:"대한예수교장로회 통합",channelId:"UCDD3IPDIgqb2I2wumEf0IGg"},
  {name:"대구영락교회",pastor:"서선종 목사",region:"대구 동",denomination:"대한예수교장로회 통합",channelId:"UCcRabJLbBSgAZoXZDurTATw"},
  {name:"대구새순교회",pastor:"김성근 목사",region:"대구 북",denomination:"대한예수교장로회 통합",channelId:"UCsHxcDiv4CQ0cst6jZXXT0g"},
  {name:"남성교회",pastor:"조성필 목사",region:"대구 서",denomination:"대한예수교장로회 통합",channelId:"UCS7bCbxmiM8igQ1CUwuFivA"},
  {name:"대구기쁨의교회",pastor:"이용원 목사",region:"대구 서",denomination:"대한예수교장로회 통합",channelId:"UCr4Rq1BAjZYNEOFc6Xvzt9w"},
  {name:"대구비산동교회",pastor:"박노택 목사",region:"대구 서",denomination:"대한예수교장로회 통합",channelId:"UCWmGNxrTtTpfDnMP_xqiQBA"},
  {name:"대구비전교회",pastor:"유재길 목사",region:"대구 서",denomination:"대한예수교장로회 통합",channelId:"UCGio51DlJnY232lTpcB3byg"},
  {name:"고산동부교회",pastor:"전진한 목사",region:"대구 수성",denomination:"대한예수교장로회 통합",channelId:"UCNcukI72QgAcd-Pr17_qCPg"},
  {name:"대구상동교회",pastor:"이삼우 목사",region:"대구 수성",denomination:"대한예수교장로회 통합",channelId:"UCh-Jub4cstk-UMiMw4-0GJA"},
  {name:"대구수성교회",pastor:"최경식 목사",region:"대구 수성",denomination:"대한예수교장로회 통합",channelId:"UCRsOcW9sA483-BxH4Uz9tFA"},
  {name:"대전영락교회",pastor:"김상수 목사",region:"대전 대덕",denomination:"대한예수교장로회 통합",channelId:"UCHBhH073cHbrxXI-mkg52HA"},
  {name:"낭월교회",pastor:"김기 목사",region:"대전 동",denomination:"대한예수교장로회 통합",channelId:"UC0ILhFzwGti67vWWWYnCATA"},
  {name:"동대전교회",pastor:"이기용 목사",region:"대전 동",denomination:"대한예수교장로회 통합",channelId:"UCYUaiPvJZoSnSULT-uSolYQ"},
  {name:"가장제일교회",pastor:"소종영 목사",region:"대전 서",denomination:"대한예수교장로회 통합",channelId:"UCVekxnHi8j8a0vOtXzM4DYg"},
  {name:"대전서부교회",pastor:"강형식 목사",region:"대전 서",denomination:"대한예수교장로회 통합",channelId:"UCLVK76YKQy2ne_lWVSOt1VA"},
  {name:"말씀교회",pastor:"박종은 목사",region:"대전 서",denomination:"대한예수교장로회 통합",channelId:"UCwwy2my26MnfhIm5ga6Ro9Q"},
  {name:"낮은동산교회",pastor:"김대영 목사",region:"대전 유성",denomination:"대한예수교장로회 통합",channelId:"UCKVgXqbku3mPa7ifRYst9Kg"},
  {name:"노은삼성교회",pastor:"김정곤 목사",region:"대전 유성",denomination:"대한예수교장로회 통합",channelId:"UCJ5qRvQ3kcL9MI8cgYS_KKw"},
  {name:"대덕한빛교회",pastor:"김은섭 목사",region:"대전 유성",denomination:"대한예수교장로회 통합",channelId:"UC85xIWxNrmi5BEyKuXcNxlw"},
  {name:"도안서부교회",pastor:"박민수 목사",region:"대전 유성",denomination:"대한예수교장로회 통합",channelId:"UCdRtzPJXEtiEfNeEwd49eLw"},
  {name:"미담교회",pastor:"김달회 목사",region:"대전 유성",denomination:"대한예수교장로회 통합",channelId:"UCPcy4_pqj2ddjYYwZLPW0pQ"},
  {name:"반석교회",pastor:"장승천 목사",region:"대전 유성",denomination:"대한예수교장로회 통합",channelId:"UCWljkeJeIOBEVN8Qpck7yGQ"},
  {name:"대전충신교회",pastor:"이세일 목사",region:"대전 중",denomination:"대한예수교장로회 통합",channelId:"UCAuvSzwe0rF2ZgVQap4J7XQ"},
  {name:"대저중앙교회",pastor:"성유한 목사",region:"부산 강서",denomination:"대한예수교장로회 통합",channelId:"UCB5PtW4AqVaXDToGyCpFVUg"},
  {name:"남문교회",pastor:"신성수 목사",region:"부산 남",denomination:"대한예수교장로회 통합",channelId:"UCCFN82ZLq8J3nDzzNDOAAQg"},
  {name:"남부산제일교회",pastor:"윤태홍 목사",region:"부산 남",denomination:"대한예수교장로회 통합",channelId:"UC0MTvmemNP4TiLzK11ZErTQ"},
  {name:"대연교회",pastor:"박종필 목사",region:"부산 남",denomination:"대한예수교장로회 통합",channelId:"UCVaYMOapHKPwJAVJpKAoO2w"},
  {name:"대연제일교회",pastor:"박성근 목사",region:"부산 남",denomination:"대한예수교장로회 통합",channelId:"UC7cWnTh0mhfVBO1loUw1gVQ"},
  {name:"명륜제일교회",pastor:"김명수 목사",region:"부산 동래",denomination:"대한예수교장로회 통합",channelId:"UCbBbACvHa9jo_Jn3Xov1uzw"},
  {name:"거양교회",pastor:"김기태 목사",region:"부산 부산진",denomination:"대한예수교장로회 통합",channelId:"UC_xxiyw5LCufvbyMXObihGA"},
  {name:"구남교회",pastor:"김지덕 목사",region:"부산 북",denomination:"대한예수교장로회 통합",channelId:"UCJIKXMLhehW6FKrB-pNgqbQ"},
  {name:"금곡성문교회",pastor:"이원서 목사",region:"부산 북",denomination:"대한예수교장로회 통합",channelId:"UCnY7XFdpLb3gXyX8l0_hCjA"},
  {name:"덕천교회",pastor:"김경년 목사",region:"부산 북",denomination:"대한예수교장로회 통합",channelId:"UCauoyWL-4iDrLcSF-Y_aqSw"},
  {name:"감천교회",pastor:"최구영 목사",region:"부산 사하",denomination:"대한예수교장로회 통합",channelId:"UCAdCkLhiL3RtF4EiZo5h8Sg"},
  {name:"다대중앙교회",pastor:"민경성 목사",region:"부산 사하",denomination:"대한예수교장로회 통합",channelId:"UCWGS_0s_MojdwSdWL7x7ttQ"},
  {name:"광안교회",pastor:"함영복 목사",region:"부산 수영",denomination:"대한예수교장로회 통합",channelId:"UCKmJX0udRK7EEffxZrALhhA"},
  {name:"로뎀교회",pastor:"장정규 목사",region:"부산 수영",denomination:"대한예수교장로회 통합",channelId:"UCV_KA6x9YYXJgj-BYtklzgQ"},
  {name:"거성교회",pastor:"김태준 목사",region:"부산 연제",denomination:"대한예수교장로회 통합",channelId:"UCEUwuiEG1qHabdNV0hxF5tA"},
  {name:"광진교회",pastor:"정명식 목사",region:"부산 영도",denomination:"대한예수교장로회 통합",channelId:"UCV3mxZUwRxFJlGrNm4-y19Q"},
  {name:"동광교회",pastor:"신재승 목사",region:"부산 중",denomination:"대한예수교장로회 통합",channelId:"UCGV8oNTHXzRj_eJskf4m87A"},
  {name:"강남동산교회",pastor:"고형진 목사",region:"서울 강남",denomination:"대한예수교장로회 통합",channelId:"UC3pLWBj_hqqamW3tr2dWcEQ"},
  {name:"강남제일교회",pastor:"함요한 목사",region:"서울 강남",denomination:"대한예수교장로회 통합",channelId:"UCtFoSFOC43MYHOFRCCSJuzg"},
  {name:"강성교회",pastor:"김영주 목사",region:"서울 강남",denomination:"대한예수교장로회 통합",channelId:"UCVNVLvpO7yocDjWa9BYhVHg"},
  {name:"강서갈릴리교회",pastor:"지대영 목사",region:"서울 강서",denomination:"대한예수교장로회 통합",channelId:"UC4mBj3LYpivQfj2D6doV5Aw"},
  {name:"강서교회",pastor:"마요한 목사",region:"서울 강서",denomination:"대한예수교장로회 통합",channelId:"UCIPEUFG0p6Dy9l1LvlDBDgA"},
  {name:"경천교회",pastor:"윤석안 목사",region:"서울 관악",denomination:"대한예수교장로회 통합",channelId:"UCdMAjAYmJqKDwi-gjrUnOfQ"},
  {name:"고향교회",pastor:"엄상일 목사",region:"서울 관악",denomination:"대한예수교장로회 통합",channelId:"UCD-bmt3UmqtL-tdhcoDeTWA"},
  {name:"관악중앙교회",pastor:"이제학 목사",region:"서울 관악",denomination:"대한예수교장로회 통합",channelId:"UC6k36uxeVqvipBAyt1Ou6kA"},
  {name:"꿈꾸는교회",pastor:"박종철 목사",region:"서울 관악",denomination:"대한예수교장로회 통합",channelId:"UCZP7TQ6-I-O6dIS3tKxyR2w"},
  {name:"광장교회",pastor:"김만 목사",region:"서울 광진",denomination:"대한예수교장로회 통합",channelId:"UCZ4BXoeOCA0paE9rW6OdXQQ"},
  {name:"구의교회",pastor:"류범호 목사",region:"서울 광진",denomination:"대한예수교장로회 통합",channelId:"UClkffgUp33JK_Eq4VEJPeoA"},
  {name:"고성교회",pastor:"홍충표 목사",region:"서울 구로",denomination:"대한예수교장로회 통합",channelId:"UC-9tNmZkm8BiOPLRyAsfGIQ"},
  {name:"고척교회",pastor:"차동혁 목사",region:"서울 구로",denomination:"대한예수교장로회 통합",channelId:"UCOk76nOPDuUar6VVQ1aGWnQ"},
  {name:"광진교회",pastor:"민경설 목사",region:"서울 구로",denomination:"대한예수교장로회 통합",channelId:"UCpcl92zHixXmsWZXXLIG08A"},
  {name:"구로동교회",pastor:"이재환 목사",region:"서울 구로",denomination:"대한예수교장로회 통합",channelId:"UCf-Cdp-R-k1d0guRMFlTZKA"},
  {name:"구로문교회",pastor:"조민선 목사",region:"서울 구로",denomination:"대한예수교장로회 통합",channelId:"UCpHSECIv7zDl0iKDgE-avvw"},
  {name:"구로제일교회",pastor:"이혁진 목사",region:"서울 구로",denomination:"대한예수교장로회 통합",channelId:"UC6SYR5I1Gs-CNmv7opcm1Ig"},
  {name:"길위에소리교회",pastor:"한인관 목사",region:"서울 동대문",denomination:"대한예수교장로회 통합",channelId:"UCa5rWE7zxk9ghMYLn7mk6hg"},
  {name:"거룩한세마포교회",pastor:"이재환 목사",region:"서울 마포",denomination:"대한예수교장로회 통합",channelId:"UCKw-TLg4ilsDAb-rnnsyFXA"},
  {name:"가재울중앙교회",pastor:"박기홍 목사",region:"서울 서대문",denomination:"대한예수교장로회 통합",channelId:"UCrR1S8U4rZrm_3fBhFQR8EQ"},
  {name:"그소망교회",pastor:"이택환 목사",region:"서울 서대문",denomination:"대한예수교장로회 통합",channelId:"UClntrGg2t4-gr052zFJYNKw"},
  {name:"금호교회",pastor:"김충섭 목사",region:"서울 성동",denomination:"대한예수교장로회 통합",channelId:"UCcsEWV92kSMjgWRy3Dby07Q"},
  {name:"금호중앙교회",pastor:"안광국 목사",region:"서울 성동",denomination:"대한예수교장로회 통합",channelId:"UC2iG4Th4tFwQ-9BvCU5Xd-w"},
  {name:"겨자씨마을교회",pastor:"강승태 목사",region:"서울 성북",denomination:"대한예수교장로회 통합",channelId:"UCV0GOcDDdI43TGgtI3-_Pfw"},
  {name:"감동교회",pastor:"허웅 목사",region:"서울 송파",denomination:"대한예수교장로회 통합",channelId:"UCUU6yXcSv9bUmYXxpD0iNfQ"},
  {name:"겨자나무교회",pastor:"송재찬 목사",region:"서울 송파",denomination:"대한예수교장로회 통합",channelId:"UCEkweloUcFRLbVsq1X7DQtA"},
  {name:"그교회",pastor:"최성열 목사",region:"서울 송파",denomination:"대한예수교장로회 통합",channelId:"UCyMxIu7MWH_R3gfrKMB_tOA"},
  {name:"광암교회",pastor:"박주일 목사",region:"서울 은평",denomination:"대한예수교장로회 통합",channelId:"UC05HEl5xx1VRdca6ngccCvw"},
  {name:"구산교회",pastor:"조성광 목사",region:"서울 은평",denomination:"대한예수교장로회 통합",channelId:"UCX0GE2vkGkZrGPgTFCVNhxQ"},
  {name:"기자촌교회",pastor:"김영범 목사",region:"서울 은평",denomination:"대한예수교장로회 통합",channelId:"UCPwllufOXRDl7N5fHjdhb2g"},
  {name:"금성교회",pastor:"김호성 목사",region:"서울 중",denomination:"대한예수교장로회 통합",channelId:"UChIXDoMeIoaj4J_DCw-qcGw"},
  {name:"경동제일교회",pastor:"안재홍 목사",region:"서울 중랑",denomination:"대한예수교장로회 통합",channelId:"UCCg9huSWrJig1dxqTi_tIoQ"},
  {name:"국일교회",pastor:"정판식 목사",region:"서울 중랑",denomination:"대한예수교장로회 통합",channelId:"UCS351X-x3eCAWs2NsF36mAw"},
  {name:"세종유일교회",pastor:"박종철 목사",region:"세종",denomination:"대한예수교장로회 통합",channelId:"UC_B_xNwySz9H_EvEPtey2Xw"},
  {name:"세종제일교회",pastor:"임충은 목사",region:"세종",denomination:"대한예수교장로회 통합",channelId:"UCZIYksw7OWZl6HdOaf8Mh3w"},
  {name:"세종주님의교회",pastor:"오경훈 목사",region:"세종",denomination:"대한예수교장로회 통합",channelId:"UCJIJFNwGxxvcVZf_XZjjp5Q"},
  {name:"세종한빛교회",pastor:"김완규 목사",region:"세종",denomination:"대한예수교장로회 통합",channelId:"UC6A-0xJmcKUS2hVkCmD8Ujg"},
  {name:"우리명성교회",pastor:"김태경 목사",region:"세종",denomination:"대한예수교장로회 통합",channelId:"UCMnZ79wS5cHeyZCDpz_687A"},
  {name:"함께교회",pastor:"박재호 목사",region:"세종",denomination:"대한예수교장로회 통합",channelId:"UCiPOsyd_-OQWgdw8V737mPA"},
  {name:"햇무리교회",pastor:"김치성 목사",region:"세종",denomination:"대한예수교장로회 통합",channelId:"UCV0gy25HLb8t3JeETfnencQ"},
  {name:"강남교회",pastor:"정병원 목사",region:"울산 남",denomination:"대한예수교장로회 통합",channelId:"UCMVrqNW7l0nrmLscqHZmT4w"},
  {name:"더리버처치교회",pastor:"김영욱 목사",region:"울산 남",denomination:"대한예수교장로회 통합",channelId:"UC0Qd1yUurpsmhE2SjvWXHiA"},
  {name:"만평교회",pastor:"김성철 목사",region:"울산 남",denomination:"대한예수교장로회 통합",channelId:"UCC2dTtUrwPLwI-MXlyYVCmg"},
  {name:"비전교회",pastor:"윤재덕 목사",region:"울산 남",denomination:"대한예수교장로회 통합",channelId:"UCmSpHOkOXpASPJJIPwMpJ_Q"},
  {name:"갈빛동산교회",pastor:"류태길 목사",region:"울산 동",denomination:"대한예수교장로회 통합",channelId:"UC95Fr2tn7Cd0RVcx60CozuA"},
  {name:"산돌교회",pastor:"박성도 목사",region:"울산 동",denomination:"대한예수교장로회 통합",channelId:"UCCpcWvSBfuaLDywSkk0uQaA"},
  {name:"세계비전교회",pastor:"조범준 목사",region:"울산 동",denomination:"대한예수교장로회 통합",channelId:"UCisviKtk6kx-tJA06VU0ppw"},
  {name:"울산남목교회",pastor:"백문흠 목사",region:"울산 동",denomination:"대한예수교장로회 통합",channelId:"UC6RQpezH78nQ217eYVVULMA"},
  {name:"더평강교회",pastor:"김성식 목사",region:"울산 북",denomination:"대한예수교장로회 통합",channelId:"UCscPqbTiW9zbHX3F4G3TU6g"},
  {name:"염포교회",pastor:"방수동 목사",region:"울산 북",denomination:"대한예수교장로회 통합",channelId:"UC8LlGpkQvd6HqjA95-DTRFQ"},
  {name:"덕신제일교회",pastor:"이신호 목사",region:"울산 울주",denomination:"대한예수교장로회 통합",channelId:"UCsxPhYTOHJUDqPNSTsh1vfw"},
  {name:"길촌자연교회",pastor:"김광이 목사",region:"울산 중",denomination:"대한예수교장로회 통합",channelId:"UCPZTGNePyZPTcdHA84nCPuw"},
  {name:"단비교회",pastor:"이영선 목사",region:"인천 계양",denomination:"대한예수교장로회 통합",channelId:"UCYNq24qkN-nOyYNjhbGMjzQ"},
  {name:"남촌교회",pastor:"김명우 목사",region:"인천 남동",denomination:"대한예수교장로회 통합",channelId:"UCWv1QrVg7ROnoSPcqtRp3CQ"},
  {name:"논현주안장로교회",pastor:"유헌형 목사",region:"인천 남동",denomination:"대한예수교장로회 통합",channelId:"UCnbe80npLLryRFYgU5bcJ5g"},
  {name:"말씀빛교회",pastor:"구자석 목사",region:"인천 미추홀",denomination:"대한예수교장로회 통합",channelId:"UCt8X2lrUvAqL5WhQ1MZtLZg"},
  {name:"부평우리교회",pastor:"정태호 목사",region:"인천 부평",denomination:"대한예수교장로회 통합",channelId:"UCDjPngTo5FNueyJE5_3XWpQ"},
  {name:"가좌제일교회",pastor:"김명서 목사",region:"인천 서",denomination:"대한예수교장로회 통합",channelId:"UCTMO3x-C2OR2FeaMIGBpiEQ"},
  {name:"검단목천교회",pastor:"이희섭 목사",region:"인천 서",denomination:"대한예수교장로회 통합",channelId:"UCSUvC66eO-zMMsqF-m10vvg"},
  {name:"광명교회",pastor:"신대호 목사",region:"인천 서",denomination:"대한예수교장로회 통합",channelId:"UC4NFf1DibtdGPg7KWbMdMzA"},
  {name:"꿈이있는교회",pastor:"윤태성 목사",region:"인천 서",denomination:"대한예수교장로회 통합",channelId:"UCtJ95jZPeMEvuSa5AuLxaVw"},
  {name:"마전제일교회",pastor:"황계하 목사",region:"인천 서",denomination:"대한예수교장로회 통합",channelId:"UC2b-02SYXc3wluf1bUV5SdQ"},
  {name:"빛과진리교회",pastor:"김승배 목사",region:"인천 서",denomination:"대한예수교장로회 통합",channelId:"UCSrKtuw2MoBhD_ikQuk9Asg"},
  {name:"더교회",pastor:"이현진 목사",region:"인천 연수",denomination:"대한예수교장로회 통합",channelId:"UCXd3n7uW5aRTsa_QeifedhQ"},
  {name:"동춘교회",pastor:"윤석호 목사",region:"인천 연수",denomination:"대한예수교장로회 통합",channelId:"UCumn1dnc_uOU6pkgBbfDiIw"},
  {name:"쉐마교회",pastor:"주철현 목사",region:"전남 담양",denomination:"대한예수교장로회 통합",channelId:"UCW1WJ25KgrwMZD6cGMwz7BQ"},
  {name:"목포새로운교회",pastor:"박정호 목사",region:"전남 목포",denomination:"대한예수교장로회 통합",channelId:"UC48oj_xzkNxNnV4T084lyzA"},
  {name:"우리좋은교회",pastor:"조옥순 목사",region:"전남 목포",denomination:"대한예수교장로회 통합",channelId:"UCWDA8IWlDQ1rfOQqt9kRGWg"},
  {name:"다찬교회",pastor:"천성광 목사",region:"전남 보성",denomination:"대한예수교장로회 통합",channelId:"UCkEWtWSkZHhWfc9RxBHHBvA"},
  {name:"가까운교회",pastor:"이정우 목사",region:"전남 순천",denomination:"대한예수교장로회 통합",channelId:"UCzy59WqF-NfGwGGqi-TWQGQ"},
  {name:"순천드림교회",pastor:"임광상 목사",region:"전남 순천",denomination:"대한예수교장로회 통합",channelId:"UCZXzkd5LDXdaY9xteDYzEpA"},
  {name:"순천리본교회",pastor:"강명구 목사",region:"전남 순천",denomination:"대한예수교장로회 통합",channelId:"UCqk_Tqb23StdT4EIrlJ1chw"},
  {name:"아름드리동신교회",pastor:"박정화 목사",region:"전남 순천",denomination:"대한예수교장로회 통합",channelId:"UCjzyDxZFzcjrT0gUkQ_xsdw"},
  {name:"예수님만나는교회",pastor:"탁국신 목사",region:"전남 순천",denomination:"대한예수교장로회 통합",channelId:"UCni3XHASETlSc4gnJSt_XZw"},
  {name:"기쁨있는교회",pastor:"류요한 목사",region:"전남 여수",denomination:"대한예수교장로회 통합",channelId:"UCf9oTWd38Iv-mRn36Oo-QEQ"},
  {name:"더좋은약속교회",pastor:"김광일 목사",region:"전남 여수",denomination:"대한예수교장로회 통합",channelId:"UCZ7w9fml4XsIPcCE1DLFFKw"},
  {name:"예수로사는교회",pastor:"나정현 목사",region:"전남 여수",denomination:"대한예수교장로회 통합",channelId:"UCU6jkH1lwdd-URlKxvDmAPg"},
  {name:"군산남부교회",pastor:"서상옥 목사",region:"전북 군산",denomination:"대한예수교장로회 통합",channelId:"UCynLgvEgOKShtnNDh6lpJAg"},
  {name:"군산지곡교회",pastor:"양성진 목사",region:"전북 군산",denomination:"대한예수교장로회 통합",channelId:"UCVSWXzj9k6CdYrnnCKbZQIg"},
  {name:"군산회복교회",pastor:"임경철 목사",region:"전북 군산",denomination:"대한예수교장로회 통합",channelId:"UCI1Tm1OGezcHLqEiX5eYd6w"},
  {name:"하나충신교회",pastor:"고승표 목사",region:"전북 군산",denomination:"대한예수교장로회 통합",channelId:"UCRYr4obzTwplQH7_sPHJJGQ"},
  {name:"삼봉시온성교회",pastor:"고우균 목사",region:"전북 완주",denomination:"대한예수교장로회 통합",channelId:"UCRNzQVQeG2P4u5-pH2LzMQw"},
  {name:"더평강교회",pastor:"진영자 목사",region:"전북 익산",denomination:"대한예수교장로회 통합",channelId:"UCE9Wtszv20Pj3DzcrmsataA"},
  {name:"동산숲교회",pastor:"임춘환 목사",region:"전북 전주",denomination:"대한예수교장로회 통합",channelId:"UChVdv-DKAO9nqoMDiyDs1tw"},
  {name:"전주동인교회",pastor:"안광찬 목사",region:"전북 전주",denomination:"대한예수교장로회 통합",channelId:"UCIAEh9cP2qhqj7p5XGaGiew"},
  {name:"전주바른길교회",pastor:"김현성 목사",region:"전북 전주",denomination:"대한예수교장로회 통합",channelId:"UChLIZEXIz0H0qaTjred0UEQ"},
  {name:"전주신일교회",pastor:"유정인 목사",region:"전북 전주",denomination:"대한예수교장로회 통합",channelId:"UCMHgOkWYjQ-M9DeXoB9LuzA"},
  {name:"충무교회",pastor:"황인성 목사",region:"전북 전주",denomination:"대한예수교장로회 통합",channelId:"UC8HB_G40bjtih9oYdxdlFzQ"},
  {name:"강정교회",pastor:"이정일 목사",region:"제주 서귀포",denomination:"대한예수교장로회 통합",channelId:"UCSsqnNU3A3zBeSoWvhdbThw"},
  {name:"남원교회",pastor:"김재옥 목사",region:"제주 서귀포",denomination:"대한예수교장로회 통합",channelId:"UCw5EdVUCPFKAO6BcioL0Rwg"},
  {name:"네가어디있느냐교회",pastor:"손은식 목사",region:"제주 서귀포",denomination:"대한예수교장로회 통합",channelId:"UCtplkhGWkMiTGPMXZH40PYw"},
  {name:"새동산교회",pastor:"이동기 목사",region:"제주 서귀포",denomination:"대한예수교장로회 통합",channelId:"UCfY5mmcEZV4bgGwaJ99Aqcw"},
  {name:"서귀포교회",pastor:"박동국 목사",region:"제주 서귀포",denomination:"대한예수교장로회 통합",channelId:"UCXTnPH_Y_UnMhgsfCAynjhA"},
  {name:"서귀포명성교회",pastor:"박희식 목사",region:"제주 서귀포",denomination:"대한예수교장로회 통합",channelId:"UCbtmVQXaLeVjhrOt23oKtJA"},
  {name:"서귀포제일교회",pastor:"이종찬 목사",region:"제주 서귀포",denomination:"대한예수교장로회 통합",channelId:"UCqYyGugJckpxO9R8Q9hYzsg"},
  {name:"서호교회",pastor:"이문순 목사",region:"제주 서귀포",denomination:"대한예수교장로회 통합",channelId:"UCucTMDja854xAvVNx79x0FQ"},
  {name:"안덕교회",pastor:"손범수 목사",region:"제주 서귀포",denomination:"대한예수교장로회 통합",channelId:"UCB1JKI4QM4ZHN2oRmnYGGrg"},
  {name:"위미교회",pastor:"강두성 목사",region:"제주 서귀포",denomination:"대한예수교장로회 통합",channelId:"UCcaH6DrIb0-fOaLGju2KIyA"},
  {name:"건강한교회",pastor:"김신국 목사",region:"제주 제주",denomination:"대한예수교장로회 통합",channelId:"UCQQ3u0CHLIaSeFAGAPFauhg"},
  {name:"구좌제일교회",pastor:"황호민 목사",region:"제주 제주",denomination:"대한예수교장로회 통합",channelId:"UC0dYk3LyEhkXFJpBH1Os4XQ"},
  {name:"김녕교회",pastor:"안수동 목사",region:"제주 제주",denomination:"대한예수교장로회 통합",channelId:"UCGGRloAPqYiqErwBGZ672IA"},
  {name:"삼양교회",pastor:"정석범 목사",region:"제주 제주",denomination:"대한예수교장로회 통합",channelId:"UCLhAQCZFdAhtr6W11Awz89w"},
  {name:"새미교회",pastor:"김미경 목사",region:"제주 제주",denomination:"대한예수교장로회 통합",channelId:"UCjNMvMOXuldRRHgY5S2mKFA"},
  {name:"아름다운교회",pastor:"이종한 목사",region:"제주 제주",denomination:"대한예수교장로회 통합",channelId:"UCemyMRqUOOEsnRJ9RYUVl2A"},
  {name:"열방제주교회",pastor:"이의룡 목사",region:"제주 제주",denomination:"대한예수교장로회 통합",channelId:"UCIKGWuSrPbNEdqFzhtvfQKQ"},
  {name:"온교회",pastor:"주성학 목사",region:"제주 제주",denomination:"대한예수교장로회 통합",channelId:"UCfSeCqowrqlV3oZ-RgOFmyg"},
  {name:"우리평강교회",pastor:"김동석 목사",region:"제주 제주",denomination:"대한예수교장로회 통합",channelId:"UC2Ecdk-miVKRIViAfxmuedw"},
  {name:"저청중앙교회",pastor:"이후재 목사",region:"제주 제주",denomination:"대한예수교장로회 통합",channelId:"UC5rOJOWNl1yq7UIMa79OoXw"},
  {name:"일선누림교회",pastor:"박순원 목사",region:"충남 아산",denomination:"대한예수교장로회 통합",channelId:"UCxAhAl_LQ5vgHMIBXfuwSjA"},
  {name:"높은뜻씨앗이되어교회",pastor:"이원석 목사",region:"충남 천안",denomination:"대한예수교장로회 통합",channelId:"UCjxNtHIALLsOyiVWu5XSFWw"},
  {name:"알곡교회",pastor:"김기원 목사",region:"충남 천안",denomination:"대한예수교장로회 통합",channelId:"UCA4_EBWYnpQME3xU_7Z_QWQ"},
  {name:"여기교회",pastor:"김기현 목사",region:"충남 천안",denomination:"대한예수교장로회 통합",channelId:"UCoqI4alT_Rprt2VzmaAjX_Q"},
  {name:"우리가교회",pastor:"정희성 목사",region:"충남 천안",denomination:"대한예수교장로회 통합",channelId:"UC2yO17O6Bc3aP3BXunnXMEQ"},
  {name:"이루어지는교회",pastor:"김상열 목사",region:"충남 천안",denomination:"대한예수교장로회 통합",channelId:"UC0L4lb6peA8I7JHiCLnbCNw"},
  {name:"하늘로고스교회",pastor:"이동성 목사",region:"충남 천안",denomination:"대한예수교장로회 통합",channelId:"UCFAaaRhn8aReXclS5fqaWaQ"},
  {name:"내수교회",pastor:"김영진 목사",region:"충북 청주",denomination:"대한예수교장로회 통합",channelId:"UCLMXYpg1iF6RH4m_WF20Urg"},
  {name:"물댄정원교회",pastor:"이성민 목사",region:"충북 청주",denomination:"대한예수교장로회 통합",channelId:"UCFF4eSBRtDTs84UrHLzp6_g"},
  {name:"청주성민교회",pastor:"양현락 목사",region:"충북 청주",denomination:"대한예수교장로회 통합",channelId:"UCfSmic4luCsQLdFHlXSDE9A"},
  {name:"함께가는교회",pastor:"이영규 목사",region:"충북 청주",denomination:"대한예수교장로회 통합",channelId:"UCiJ-BQBcqLscjwqtrl0ZCfw"},
  {name:"지구촌교회",pastor:"홍성신 목사",region:"경남 창원",denomination:"대한예수교장로회 통합",channelId:"UCdINTfeQhfG_lcV44PDSDLA"},
  {name:"광림교회",pastor:"이병효 목사",region:"광주 북",denomination:"대한예수교장로회 통합",channelId:"UCHYRdCf2DdPve2f0be8kDuQ"},
  {name:"밀알교회",pastor:"권하원 목사",region:"대전 대덕",denomination:"대한예수교장로회 통합",channelId:"UCdnOXASDGvrgt5B8h6NqS0g"},
  ...hapdongSources,
  ...kosinSources,
  ...prokSources,
  ...tonghapSources,
  ...kmcSources,
  ...salvationSources,
  ...publicRemainingSources,
];
const sourceIdentity=(source:Source)=>source.channelId?`channel:${source.channelId}`:source.handle?`handle:${source.handle.toLowerCase()}`:source.username?`username:${source.username.toLowerCase()}`:`church:${normalizeSearchValue(source.name)}:${normalizeSearchValue(source.region)}`;
const sources=[...new Map(sourceCandidates.map((source)=>[sourceIdentity(source),source] as const)).values()];

type ChannelResponse={items?:Array<{id:string;snippet?:{thumbnails?:{default?:{url:string};medium?:{url:string};high?:{url:string}}};contentDetails:{relatedPlaylists:{uploads:string}}}>};
type PlaylistResponse={nextPageToken?:string;items?:Array<{snippet:{title:string;publishedAt:string;thumbnails?:{medium?:{url:string};high?:{url:string}}};contentDetails:{videoId:string}}>};
type VideosResponse={items?:Array<{id:string;contentDetails?:{duration?:string}}>};
type DatabaseSourceRow={name:string;pastor:string;region:string;denomination:string;homepage:string|null;channelId:string;pastorNames?:string;primaryPastorNames?:string};
const fetchYouTube=(url:string)=>fetch(url,{signal:AbortSignal.timeout(10_000)}).catch(()=>null);

export async function POST(request:Request) {
  if(!internalTaskRequestAllowed(request))return Response.json({error:"Not found"},{status:404,headers:{"cache-control":"no-store"}});
  const key=(env as unknown as {YOUTUBE_API_KEY?:string}).YOUTUBE_API_KEY;
  if(!key) return Response.json({error:"YouTube API key not configured"},{status:503,headers:{"cache-control":"no-store"}});
  const db=database(); await ensureMediaCollectionTables(db); await seedHeldSources(db);
  const requestedScope=new URL(request.url).searchParams.get("scope");
  const scopedSources={hapdong:hapdongSources,kosin:kosinSources,prok:prokSources,tonghap:tonghapSources,kmc:kmcSources,salvation:salvationSources,public_remaining:publicRemainingSources} as const;
  const databaseResult=requestedScope==="database"?await db.prepare("SELECT name,pastor,region,denomination,homepage_url AS homepage,youtube_channel_id AS channelId FROM churches WHERE review_status='approved' AND youtube_channel_id IS NOT NULL ORDER BY id").all<DatabaseSourceRow>():requestedScope==="photo_pastors"?await db.prepare(`SELECT c.name,c.pastor,c.region,c.denomination,c.homepage_url AS homepage,c.youtube_channel_id AS channelId,GROUP_CONCAT(DISTINCT p.name) AS pastorNames,GROUP_CONCAT(DISTINCT CASE WHEN r.role_category='current_primary' OR ${sqlNormalized("p.name")}=replace(replace(${sqlNormalized("c.pastor")},'목사님',''),'목사','') THEN p.name END) AS primaryPastorNames FROM churches c JOIN pastor_church_roles r ON r.church_id=c.id AND r.review_status='approved' JOIN pastor_people p ON p.id=r.pastor_id AND p.review_status='approved' WHERE c.review_status='approved' AND c.youtube_channel_id IS NOT NULL AND ((p.photo_review_status='approved' AND p.photo_url IS NOT NULL AND trim(p.photo_url)<>'') OR ${sqlNormalized("p.name")} IN ('김민석','이일현','정성진','곽승현')) GROUP BY c.id ORDER BY MIN(CASE WHEN ${sqlNormalized("p.name")} IN ('김민석','이일현','정성진','곽승현') THEN 0 ELSE 1 END),c.id`).all<DatabaseSourceRow>():null;
  const databaseSources:Source[]=(databaseResult?.results||[]).map((source)=>({name:source.name,pastor:source.pastor,region:source.region,denomination:source.denomination,homepage:source.homepage||undefined,channelId:source.channelId,pastorNames:source.pastorNames,primaryPastorNames:source.primaryPastorNames}));
  const scope=requestedScope==="database"?"database":requestedScope==="photo_pastors"?"photo_pastors":requestedScope&&requestedScope in scopedSources?requestedScope as keyof typeof scopedSources:"all";
  const sourcePool:readonly Source[]=scope==="database"||scope==="photo_pastors"?databaseSources:scope==="all"?sources:scopedSources[scope];
  const syncKey=scope==="all"?"youtube-v9-regional-130":`youtube-v9-${scope}`;
  const cursorKey=`${syncKey}:cursor`;
  const explicitStart=new URL(request.url).searchParams.get("start");
  const cursor=explicitStart===null?await db.prepare("SELECT last_synced_at AS value FROM sync_state WHERE key=?").bind(cursorKey).first<{value:string}>():null;
  const requestedStart=Number(explicitStart??cursor?.value??"0");
  const start=Number.isInteger(requestedStart)&&requestedStart>=0?requestedStart:0;
  const requestedLimit=Number(new URL(request.url).searchParams.get("limit")??"20");
  const limit=Number.isInteger(requestedLimit)&&requestedLimit>0?Math.min(requestedLimit,20):20;
  const batch=sourcePool.slice(start,start+limit);
  const resetShorts=new URL(request.url).searchParams.get("resetShorts")==="medium"&&scope==="database"&&start===0;
  const resetShortsResult=resetShorts?await db.prepare("DELETE FROM church_shorts WHERE lower(title) NOT LIKE '%shorts%' AND title NOT LIKE '%쇼츠%'").run():null;
  // A missing or quiet YouTube channel is a collection gap, never evidence that
  // a church itself should be hidden. Holds require a separate human review.
  const removed=0;
  const state=await db.prepare("SELECT last_synced_at AS lastSyncedAt FROM sync_state WHERE key=?").bind(syncKey).first<{lastSyncedAt:string}>();
  if(explicitStart===null&&start===0&&state && Date.now()-Date.parse(state.lastSyncedAt)<60*60*1000) {
    const approved=await db.prepare("SELECT COUNT(*) AS count FROM churches WHERE review_status='approved' AND youtube_channel_id IS NOT NULL").first<{count:number}>();
    return Response.json({ok:true,approved:approved?.count??0,removed,imported:0,skipped:"fresh"});
  }
  const leaseKey=`${syncKey}:lease`;
  const leaseInsert=await db.prepare("INSERT OR IGNORE INTO sync_state (key,last_synced_at) VALUES (?,CURRENT_TIMESTAMP)").bind(leaseKey).run();
  const leaseUpdate=Number(leaseInsert.meta?.changes??0)===0?await db.prepare("UPDATE sync_state SET last_synced_at=CURRENT_TIMESTAMP WHERE key=? AND last_synced_at<datetime('now','-30 minutes')").bind(leaseKey).run():null;
  if(Number(leaseInsert.meta?.changes??0)===0&&Number(leaseUpdate?.meta?.changes??0)===0)return Response.json({ok:true,imported:0,skipped:"sync_in_progress"});
  await db.prepare("INSERT INTO sync_state (key,last_synced_at) VALUES ('youtube-sermon-last-attempt',CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET last_synced_at=excluded.last_synced_at").run();
  try {
  let imported=0;
  let verified=0;
  let checked=0;
  let failed=0;
  for(const source of batch) {
    const held=await db.prepare(`SELECT id FROM churches WHERE ((${sqlNormalized("name")}=? AND ${sqlNormalized("region")}=?) OR (?<>'' AND youtube_channel_id=?)) AND review_status IN ('removed','deleted') LIMIT 1`).bind(normalizeSearchValue(source.name),normalizeSearchValue(source.region),source.channelId??"",source.channelId??"").first();
    if(held)continue;
    const filter=source.channelId?`id=${encodeURIComponent(source.channelId)}`:source.handle?`forHandle=${encodeURIComponent(source.handle)}`:`forUsername=${encodeURIComponent(source.username||"")}`;
    const channelResponse=await fetchYouTube(`https://www.googleapis.com/youtube/v3/channels?part=snippet,contentDetails&${filter}&key=${encodeURIComponent(key)}`);
    if(!channelResponse?.ok) { failed++;continue; }
    const channel=await channelResponse.json() as ChannelResponse;
    const found=channel.items?.[0];
    if(!found) {
      failed++;
      continue;
    }
    const uploads=found.contentDetails.relatedPlaylists.uploads;
    const channelImageUrl=found.snippet?.thumbnails?.high?.url||found.snippet?.thumbnails?.medium?.url||found.snippet?.thumbnails?.default?.url||null;
    const playlistItems:NonNullable<PlaylistResponse["items"]>=[];
    let pageToken="";
    const pageCount=scope==="photo_pastors"?4:1;
    for(let page=0;page<pageCount;page++){
      const playlistResponse=await fetchYouTube(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${encodeURIComponent(uploads)}&maxResults=50${pageToken?`&pageToken=${encodeURIComponent(pageToken)}`:""}&key=${encodeURIComponent(key)}`);
      if(!playlistResponse?.ok){failed++;break;}
      const playlist=await playlistResponse.json() as PlaylistResponse;
      playlistItems.push(...(playlist.items||[]));
      pageToken=playlist.nextPageToken||"";
      if(!pageToken)break;
    }
    if(!playlistItems.length)continue;
    checked++;
    const activeSince=Date.now()-180*24*60*60*1000;
    const videoIds=playlistItems.map((item)=>item.contentDetails.videoId).filter(Boolean);
    const durations=new Map<string,number>();
    if(videoIds.length&&scope!=="photo_pastors") {
      const videosResponse=await fetchYouTube(`https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${encodeURIComponent(videoIds.join(","))}&key=${encodeURIComponent(key)}`);
      if(videosResponse?.ok) {
        const videos=await videosResponse.json() as VideosResponse;
        for(const video of videos.items||[]) durations.set(video.id,youtubeDurationSeconds(video.contentDetails?.duration||""));
      }
    }
    const pastorNames=(source.pastorNames||"").split(",").filter(Boolean),primaryPastorNames=new Set((source.primaryPastorNames||"").split(",").filter(Boolean));
    const personalizedSermons=pastorNames.flatMap((pastorName)=>playlistItems.filter((item)=>isSermonTitle(item.snippet.title)&&isSermonAttributedTo(item.snippet.title,pastorName,primaryPastorNames.has(pastorName))).slice(0,9));
    const recentSermons=scope==="photo_pastors"?[...new Map(personalizedSermons.map((item)=>[item.contentDetails.videoId,item])).values()]:playlistItems.filter((item)=>Date.parse(item.snippet.publishedAt)>=activeSince&&(source.verifiedSermonFeed||isSermonTitle(item.snippet.title)));
    const recentShorts=scope==="photo_pastors"?[]:playlistItems.filter((item)=>Date.parse(item.snippet.publishedAt)>=activeSince&&isShortTitle(item.snippet.title));
    const shortIds=new Set(recentShorts.map((item)=>item.contentDetails.videoId));
    for(const item of scope==="photo_pastors"?[]:playlistItems) {
      const videoId=item.contentDetails.videoId;
      if(Date.parse(item.snippet.publishedAt)>=activeSince&&!shortIds.has(videoId)&&isShortCandidate(item.snippet.title,durations.get(videoId)||0)) {
        recentShorts.push(item);
        shortIds.add(videoId);
      }
    }
    const recentPraises=scope==="photo_pastors"?[]:playlistItems.filter((item)=>Date.parse(item.snippet.publishedAt)>=activeSince&&isPraiseTitle(item.snippet.title));
    if(!recentSermons.length) {
      continue;
    }
    const existing=await db.prepare(`SELECT id,review_status FROM churches WHERE youtube_channel_id=? OR (${sqlNormalized("name")}=? AND ${sqlNormalized("region")}=?) ORDER BY CASE WHEN youtube_channel_id=? THEN 0 ELSE 1 END LIMIT 1`).bind(found.id,normalizeSearchValue(source.name),normalizeSearchValue(source.region),found.id).first<{id:number;review_status:string}>();
    if(existing&&existing.review_status!=="approved") continue;
    let churchId:number;
    if(existing) {
      // Collection can refresh metadata, but only an administrator may reverse a hold.
      // This protects copyright, privacy, and rights-holder takedowns from auto-republication.
      await db.prepare("UPDATE churches SET name=?,pastor=?,region=?,denomination=?,youtube_channel_id=?,channel_image_url=?,homepage_url=COALESCE(?,homepage_url) WHERE id=?").bind(source.name,source.pastor,source.region,source.denomination,found.id,channelImageUrl,source.homepage??null,existing.id).run();
      churchId=existing.id;
    } else {
      const inserted=await db.prepare("INSERT INTO churches (name,pastor,region,denomination,youtube_channel_id,channel_image_url,homepage_url,review_status) VALUES (?,?,?,?,?,?,?,'approved')").bind(source.name,source.pastor,source.region,source.denomination,found.id,channelImageUrl,source.homepage??null).run();
      churchId=Number(inserted.meta.last_row_id);
    }
    verified++;
    const sermonArchive=scope==="photo_pastors"?recentSermons:recentSermons.slice(0,18),shortArchive=recentShorts.slice(0,12),praiseArchive=recentPraises.slice(0,12);
    const mediaStatements=[
      ...sermonArchive.map((item)=>{const thumb=item.snippet.thumbnails?.high?.url||item.snippet.thumbnails?.medium?.url||`https://i.ytimg.com/vi/${item.contentDetails.videoId}/hqdefault.jpg`;return db.prepare("INSERT INTO sermons (church_id,youtube_id,title,thumbnail_url,published_at) VALUES (?,?,?,?,?) ON CONFLICT(youtube_id) DO UPDATE SET title=excluded.title,thumbnail_url=excluded.thumbnail_url,published_at=excluded.published_at").bind(churchId,item.contentDetails.videoId,item.snippet.title,thumb,item.snippet.publishedAt)}),
      ...shortArchive.map((item)=>{const thumb=item.snippet.thumbnails?.high?.url||item.snippet.thumbnails?.medium?.url||`https://i.ytimg.com/vi/${item.contentDetails.videoId}/hqdefault.jpg`;return db.prepare("INSERT INTO church_shorts (church_id,youtube_id,title,thumbnail_url,published_at) VALUES (?,?,?,?,?) ON CONFLICT(youtube_id) DO UPDATE SET title=excluded.title,thumbnail_url=excluded.thumbnail_url,published_at=excluded.published_at").bind(churchId,item.contentDetails.videoId,item.snippet.title,thumb,item.snippet.publishedAt)}),
      ...praiseArchive.map((item)=>{const thumb=item.snippet.thumbnails?.high?.url||item.snippet.thumbnails?.medium?.url||`https://i.ytimg.com/vi/${item.contentDetails.videoId}/hqdefault.jpg`;return db.prepare("INSERT INTO praise_videos (church_id,youtube_id,title,thumbnail_url,published_at) VALUES (?,?,?,?,?) ON CONFLICT(youtube_id) DO UPDATE SET title=excluded.title,thumbnail_url=excluded.thumbnail_url,published_at=excluded.published_at").bind(churchId,item.contentDetails.videoId,item.snippet.title,thumb,item.snippet.publishedAt)}),
    ];
    for(let offset=0;offset<mediaStatements.length;offset+=80)await db.batch(mediaStatements.slice(offset,offset+80));
    imported+=sermonArchive.length;
  }
  const nextStart=start+batch.length;
  const nextCursor=nextStart<sourcePool.length?nextStart:0;
  await db.prepare("INSERT INTO sync_state (key,last_synced_at) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET last_synced_at=excluded.last_synced_at").bind(cursorKey,String(nextCursor)).run();
  if(nextCursor===0&&checked>0) await db.prepare("INSERT INTO sync_state (key,last_synced_at) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET last_synced_at=excluded.last_synced_at").bind(syncKey,new Date().toISOString()).run();
  if(checked>0) await db.prepare("INSERT INTO sync_state (key,last_synced_at) VALUES ('youtube-sermon-last-success',?) ON CONFLICT(key) DO UPDATE SET last_synced_at=excluded.last_synced_at").bind(new Date().toISOString()).run();
  if(failed>0)await db.prepare("INSERT INTO sync_state (key,last_synced_at) VALUES ('youtube-sermon-last-failure',CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET last_synced_at=excluded.last_synced_at").run();
  const approved=await db.prepare("SELECT COUNT(*) AS count FROM churches WHERE review_status='approved' AND youtube_channel_id IS NOT NULL").first<{count:number}>();
  return Response.json({ok:true,scope,checked,failed,verified,approved:approved?.count??0,removed,imported,resetShorts:resetShortsResult?.meta.changes??0,nextStart:nextCursor||null});
  } catch(error) {
    await db.prepare("INSERT INTO sync_state (key,last_synced_at) VALUES ('youtube-sermon-last-failure',CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET last_synced_at=excluded.last_synced_at").run().catch(()=>undefined);
    throw error;
  } finally {
    // A failed network or D1 operation must not leave collection blocked until
    // the stale-lease timeout. Releasing here also covers unexpected throws.
    await db.prepare("DELETE FROM sync_state WHERE key=?").bind(leaseKey).run().catch(()=>undefined);
  }
}
