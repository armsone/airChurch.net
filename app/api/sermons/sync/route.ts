import { env } from "cloudflare:workers";
import { database, ensureSermonTables } from "../../_shared";
import { isSermonTitle } from "../_selection";

type SourceBase={name:string;pastor:string;region:string;denomination:string};
type Source=SourceBase&({channelId:string;handle?:never;username?:never}|{channelId?:never;handle:string;username?:never}|{channelId?:never;handle?:never;username:string});

const sources:Source[]=[
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
  {name:"제주순복음교회",pastor:"표순호 목사",region:"제주 제주",denomination:"기독교대한하나님의성회",channelId:"UCkR0487FW1G7iC46Jmfodng"},
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
];

type ChannelResponse={items?:Array<{id:string;contentDetails:{relatedPlaylists:{uploads:string}}}>};
type PlaylistResponse={items?:Array<{snippet:{title:string;publishedAt:string;thumbnails?:{medium?:{url:string};high?:{url:string}}};contentDetails:{videoId:string}}>};

export async function POST(request:Request) {
  const key=(env as unknown as {YOUTUBE_API_KEY?:string}).YOUTUBE_API_KEY;
  const db=database(); await ensureSermonTables(db);
  const syncKey="youtube-v6-verified-100";
  const requestedStart=Number(new URL(request.url).searchParams.get("start")||"0");
  const start=Number.isInteger(requestedStart)&&requestedStart>=0?requestedStart:0;
  const batch=sources.slice(start,start+20);
  const cleanup=await db.prepare("UPDATE churches SET review_status='removed',hold_reason='youtube_unavailable',hold_note='공식 YouTube 채널 식별값이 없어 자동 보류했습니다.',held_at=CURRENT_TIMESTAMP WHERE review_status='approved' AND youtube_channel_id IS NULL").run();
  const removed=cleanup.meta.changes;
  if(!key) return Response.json({error:"YouTube API key not configured",removed},{status:503});
  const state=await db.prepare("SELECT last_synced_at AS lastSyncedAt FROM sync_state WHERE key=?").bind(syncKey).first<{lastSyncedAt:string}>();
  if(start===0&&state && Date.now()-Date.parse(state.lastSyncedAt)<60*60*1000) {
    const approved=await db.prepare("SELECT COUNT(*) AS count FROM churches WHERE review_status='approved' AND youtube_channel_id IS NOT NULL").first<{count:number}>();
    return Response.json({ok:true,approved:approved?.count??0,removed,imported:0,skipped:"fresh"});
  }
  let imported=0;
  let verified=0;
  for(const source of batch) {
    const filter=source.channelId?`id=${encodeURIComponent(source.channelId)}`:source.handle?`forHandle=${encodeURIComponent(source.handle)}`:`forUsername=${encodeURIComponent(source.username||"")}`;
    const channelResponse=await fetch(`https://www.googleapis.com/youtube/v3/channels?part=contentDetails&${filter}&key=${encodeURIComponent(key)}`);
    if(!channelResponse.ok) return Response.json({error:"YouTube channel verification failed",removed},{status:502});
    const channel=await channelResponse.json() as ChannelResponse;
    const found=channel.items?.[0];
    if(!found) {
      await db.prepare("UPDATE churches SET review_status='removed',hold_reason='youtube_unavailable',hold_note='공식 YouTube 채널을 확인하지 못해 자동 보류했습니다.',held_at=CURRENT_TIMESTAMP WHERE name=? AND region=?").bind(source.name,source.region).run();
      continue;
    }
    const uploads=found.contentDetails.relatedPlaylists.uploads;
    const playlistResponse=await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${encodeURIComponent(uploads)}&maxResults=24&key=${encodeURIComponent(key)}`);
    if(!playlistResponse.ok) return Response.json({error:"YouTube upload verification failed",removed},{status:502});
    const playlist=await playlistResponse.json() as PlaylistResponse;
    const activeSince=Date.now()-180*24*60*60*1000;
    const recentSermons=(playlist.items||[]).filter((item)=>Date.parse(item.snippet.publishedAt)>=activeSince&&isSermonTitle(item.snippet.title));
    if(!recentSermons.length) {
      await db.prepare("UPDATE churches SET review_status='removed',hold_reason='inactive',hold_note='최근 180일 내 검증 가능한 설교·예배 업로드를 확인하지 못해 자동 보류했습니다.',held_at=CURRENT_TIMESTAMP WHERE name=? AND region=?").bind(source.name,source.region).run();
      continue;
    }
    const existing=await db.prepare("SELECT id FROM churches WHERE name=? AND region=?").bind(source.name,source.region).first<{id:number}>();
    let churchId:number;
    if(existing) {
      await db.prepare("UPDATE churches SET pastor=?,denomination=?,youtube_channel_id=?,review_status=CASE WHEN youtube_channel_id IS NULL THEN 'approved' ELSE review_status END WHERE id=?").bind(source.pastor,source.denomination,found.id,existing.id).run();
      churchId=existing.id;
    } else {
      const inserted=await db.prepare("INSERT INTO churches (name,pastor,region,denomination,youtube_channel_id,review_status) VALUES (?,?,?,?,?,'approved')").bind(source.name,source.pastor,source.region,source.denomination,found.id).run();
      churchId=Number(inserted.meta.last_row_id);
    }
    verified++;
    for(const item of recentSermons.slice(0,6)) { const thumb=item.snippet.thumbnails?.high?.url||item.snippet.thumbnails?.medium?.url||`https://i.ytimg.com/vi/${item.contentDetails.videoId}/hqdefault.jpg`; await db.prepare("INSERT INTO sermons (church_id,youtube_id,title,thumbnail_url,published_at) VALUES (?,?,?,?,?) ON CONFLICT(youtube_id) DO UPDATE SET title=excluded.title,thumbnail_url=excluded.thumbnail_url,published_at=excluded.published_at").bind(churchId,item.contentDetails.videoId,item.snippet.title,thumb,item.snippet.publishedAt).run(); imported++; }
  }
  const nextStart=start+batch.length;
  if(nextStart>=sources.length) await db.prepare("INSERT INTO sync_state (key,last_synced_at) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET last_synced_at=excluded.last_synced_at").bind(syncKey,new Date().toISOString()).run();
  const approved=await db.prepare("SELECT COUNT(*) AS count FROM churches WHERE review_status='approved' AND youtube_channel_id IS NOT NULL").first<{count:number}>();
  return Response.json({ok:true,verified,approved:approved?.count??0,removed,imported,nextStart:nextStart<sources.length?nextStart:null});
}
