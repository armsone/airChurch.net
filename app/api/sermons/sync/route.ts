import { env } from "cloudflare:workers";
import { database, ensureSermonTables } from "../../_shared";
import { isSermonTitle } from "../_selection";

type Source={name:string;pastor:string;region:string;denomination:string;channelId?:string;handle?:string;username?:string};

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
  {name:"새문안교회",pastor:"이상학 목사",region:"서울 종로",denomination:"대한예수교장로회 통합"},
  {name:"충현교회",pastor:"한규삼 목사",region:"서울 강남",denomination:"대한예수교장로회 합동"},
  {name:"남포교회",pastor:"최태준 목사",region:"서울 송파",denomination:"대한예수교장로회 합신"},
  {name:"남서울은혜교회",pastor:"박완철 목사",region:"서울 강남",denomination:"대한예수교장로회 합신"},
  {name:"동안교회",pastor:"김형준 목사",region:"서울 동대문",denomination:"대한예수교장로회 통합"},
  {name:"삼일교회",pastor:"송태근 목사",region:"서울 용산",denomination:"대한예수교장로회 합동"},
  {name:"한성교회",pastor:"도원욱 목사",region:"서울 성북",denomination:"대한예수교장로회 합동"},
  {name:"중앙성결교회",pastor:"한기채 목사",region:"서울 종로",denomination:"기독교대한성결교회"},
  {name:"신촌성결교회",pastor:"박노훈 목사",region:"서울 마포",denomination:"기독교대한성결교회"},
  {name:"성락성결교회",pastor:"지형은 목사",region:"서울 성동",denomination:"기독교대한성결교회"},
  {name:"강남중앙침례교회",pastor:"최병락 목사",region:"서울 강남",denomination:"기독교한국침례회"},
  {name:"여의도침례교회",pastor:"국명호 목사",region:"서울 영등포",denomination:"기독교한국침례회"},
  {name:"서울영동교회",pastor:"정현구 목사",region:"서울 강남",denomination:"대한예수교장로회 고신"},
  {name:"신반포교회",pastor:"홍문수 목사",region:"서울 서초",denomination:"대한예수교장로회 합동"},
  {name:"더사랑의교회",pastor:"이인호 목사",region:"경기 수원",denomination:"대한예수교장로회 합동"},
  {name:"안산동산교회",pastor:"김성겸 목사",region:"경기 안산",denomination:"대한예수교장로회 통합"},
  {name:"안산제일교회",pastor:"허요환 목사",region:"경기 안산",denomination:"대한예수교장로회 통합"},
  {name:"수원중앙침례교회",pastor:"고명진 목사",region:"경기 수원",denomination:"기독교한국침례회"},
  {name:"꿈의교회",pastor:"김학중 목사",region:"경기 안산",denomination:"기독교대한감리회"},
  {name:"군포제일교회",pastor:"권태진 목사",region:"경기 군포",denomination:"대한예수교장로회 합신"},
  {name:"은혜샘물교회",pastor:"윤만선 목사",region:"경기 용인",denomination:"대한예수교장로회 합신"},
  {name:"갈보리교회",pastor:"이웅조 목사",region:"경기 성남",denomination:"한국독립교회선교단체연합회"},
  {name:"새중앙교회",pastor:"황덕영 목사",region:"경기 안양",denomination:"대한예수교장로회 백석"},
  {name:"용인기쁨의교회",pastor:"정의호 목사",region:"경기 용인",denomination:"대한예수교장로회 합동"},
  {name:"일산광림교회",pastor:"박동찬 목사",region:"경기 고양",denomination:"기독교대한감리회"},
  {name:"효성중앙교회",pastor:"정연수 목사",region:"인천 계양",denomination:"기독교대한감리회"},
  {name:"숭의교회",pastor:"이선목 목사",region:"인천 미추홀",denomination:"기독교대한감리회"},
  {name:"포도원교회",pastor:"김문훈 목사",region:"부산 북구",denomination:"대한예수교장로회 고신"},
  {name:"부산중앙교회",pastor:"최현범 목사",region:"부산 중구",denomination:"대한예수교장로회 고신"},
  {name:"구덕교회",pastor:"이종훈 목사",region:"부산 서구",denomination:"대한예수교장로회 고신"},
  {name:"대구동부교회",pastor:"박성순 목사",region:"대구 동구",denomination:"대한예수교장로회 합동"},
  {name:"대구서문교회",pastor:"이상민 목사",region:"대구 중구",denomination:"대한예수교장로회 합동"},
  {name:"대봉교회",pastor:"박희종 목사",region:"대구 중구",denomination:"대한예수교장로회 통합"},
  {name:"광주벧엘교회",pastor:"리종빈 목사",region:"광주 서구",denomination:"대한예수교장로회 통합"},
  {name:"광주겨자씨교회",pastor:"나학수 목사",region:"광주 북구",denomination:"대한예수교장로회 통합"},
  {name:"대전한빛교회",pastor:"백용현 목사",region:"대전 대덕",denomination:"기독교대한감리회"},
  {name:"둔산제일교회",pastor:"문상욱 목사",region:"대전 서구",denomination:"기독교대한감리회"},
  {name:"대영교회",pastor:"조운 목사",region:"울산 북구",denomination:"대한예수교장로회 합동"},
  {name:"우정교회",pastor:"예동열 목사",region:"울산 중구",denomination:"대한예수교장로회 통합"},
  {name:"울산교회",pastor:"이호상 목사",region:"울산 중구",denomination:"대한예수교장로회 고신"},
  {name:"세종꿈의교회",pastor:"안희묵 목사",region:"세종",denomination:"기독교한국침례회"},
  {name:"세종샘솟는교회",pastor:"최병남 목사",region:"세종",denomination:"대한예수교장로회 통합"},
  {name:"춘천한마음교회",pastor:"김성로 목사",region:"강원 춘천",denomination:"기독교한국침례회"},
  {name:"춘천제일감리교회",pastor:"이용호 목사",region:"강원 춘천",denomination:"기독교대한감리회"},
  {name:"원주중부교회",pastor:"김미열 목사",region:"강원 원주",denomination:"대한예수교장로회 합동"},
  {name:"원주제일교회",pastor:"김은일 목사",region:"강원 원주",denomination:"대한예수교장로회 통합"},
  {name:"강릉중앙교회",pastor:"박태환 목사",region:"강원 강릉",denomination:"기독교대한감리회"},
  {name:"상당교회",pastor:"안광복 목사",region:"충북 청주",denomination:"대한예수교장로회 통합"},
  {name:"청주서문교회",pastor:"박명룡 목사",region:"충북 청주",denomination:"기독교대한성결교회"},
  {name:"청주순복음교회",pastor:"이동규 목사",region:"충북 청주",denomination:"기독교대한하나님의성회"},
  {name:"청주금천교회",pastor:"신경민 목사",region:"충북 청주",denomination:"대한예수교장로회 통합"},
  {name:"천안하늘중앙교회",pastor:"유영완 목사",region:"충남 천안",denomination:"기독교대한감리회"},
  {name:"천안중앙교회",pastor:"강재원 목사",region:"충남 천안",denomination:"기독교대한감리회"},
  {name:"천안서부교회",pastor:"윤마태 목사",region:"충남 천안",denomination:"대한예수교장로회 합동"},
  {name:"온양제일교회",pastor:"김의중 목사",region:"충남 아산",denomination:"대한예수교장로회 통합"},
  {name:"공주중앙장로교회",pastor:"김진영 목사",region:"충남 공주",denomination:"대한예수교장로회 합동"},
  {name:"전주바울교회",pastor:"신현모 목사",region:"전북 전주",denomination:"기독교대한하나님의성회"},
  {name:"전주동신교회",pastor:"신정호 목사",region:"전북 전주",denomination:"대한예수교장로회 통합"},
  {name:"전주안디옥교회",pastor:"박진구 목사",region:"전북 전주",denomination:"대한예수교장로회 통합"},
  {name:"전주새중앙교회",pastor:"홍동필 목사",region:"전북 전주",denomination:"대한예수교장로회 합동"},
  {name:"군산드림교회",pastor:"임만호 목사",region:"전북 군산",denomination:"대한예수교장로회 합동"},
  {name:"목포사랑의교회",pastor:"백동조 목사",region:"전남 목포",denomination:"대한예수교장로회 합동"},
  {name:"순천중앙교회",pastor:"홍인식 목사",region:"전남 순천",denomination:"대한예수교장로회 통합"},
  {name:"여수은파교회",pastor:"고만호 목사",region:"전남 여수",denomination:"대한예수교장로회 통합"},
  {name:"광양대광교회",pastor:"신정 목사",region:"전남 광양",denomination:"대한예수교장로회 통합"},
  {name:"포항기쁨의교회",pastor:"박진석 목사",region:"경북 포항",denomination:"대한예수교장로회 통합"},
  {name:"포항중앙교회",pastor:"손병렬 목사",region:"경북 포항",denomination:"대한예수교장로회 통합"},
  {name:"경주제일교회",pastor:"정영택 목사",region:"경북 경주",denomination:"대한예수교장로회 통합"},
  {name:"구미상모교회",pastor:"김승동 목사",region:"경북 구미",denomination:"대한예수교장로회 합동"},
  {name:"양곡교회",pastor:"지용수 목사",region:"경남 창원",denomination:"대한예수교장로회 고신"},
  {name:"창원상남교회",pastor:"이창교 목사",region:"경남 창원",denomination:"대한예수교장로회 고신"},
  {name:"진주초대교회",pastor:"이경은 목사",region:"경남 진주",denomination:"기독교대한하나님의성회"},
  {name:"거제고현교회",pastor:"박정곤 목사",region:"경남 거제",denomination:"대한예수교장로회 고신"},
  {name:"제주성안교회",pastor:"류정길 목사",region:"제주 제주",denomination:"대한예수교장로회 통합"},
  {name:"제주순복음교회",pastor:"표순호 목사",region:"제주 제주",denomination:"기독교대한하나님의성회"},
  {name:"제주영락교회",pastor:"심상철 목사",region:"제주 제주",denomination:"대한예수교장로회 통합"},
];

type ChannelResponse={items?:Array<{id:string;contentDetails:{relatedPlaylists:{uploads:string}}}>};
type PlaylistResponse={items?:Array<{snippet:{title:string;publishedAt:string;thumbnails?:{medium?:{url:string};high?:{url:string}}};contentDetails:{videoId:string}}>};

export async function POST() {
  const key=(env as unknown as {YOUTUBE_API_KEY?:string}).YOUTUBE_API_KEY;
  const db=database(); await ensureSermonTables(db);
  const syncKey="youtube-v4";
  let registered=0;
  for(const source of sources) {
    const existing=await db.prepare("SELECT id FROM churches WHERE name=? AND region=?").bind(source.name,source.region).first<{id:number}>();
    if(existing) {
      await db.prepare("UPDATE churches SET pastor=?,denomination=? WHERE id=?").bind(source.pastor,source.denomination,existing.id).run();
    } else {
      await db.prepare("INSERT INTO churches (name,pastor,region,denomination,review_status) VALUES (?,?,?,?,'approved')").bind(source.name,source.pastor,source.region,source.denomination).run();
    }
    registered++;
  }
  if(!key) return Response.json({ok:true,registered,imported:0,channelSyncSkipped:"YouTube API key not configured"});
  const state=await db.prepare("SELECT last_synced_at AS lastSyncedAt FROM sync_state WHERE key=?").bind(syncKey).first<{lastSyncedAt:string}>();
  if(state && Date.now()-Date.parse(state.lastSyncedAt)<60*60*1000) return Response.json({ok:true,registered,imported:0,skipped:"fresh"});
  let imported=0;
  for(const source of sources) {
    if(!source.channelId&&!source.handle&&!source.username) continue;
    const filter=source.channelId?`id=${encodeURIComponent(source.channelId)}`:source.handle?`forHandle=${encodeURIComponent(source.handle)}`:`forUsername=${encodeURIComponent(source.username||"")}`;
    const channel=await fetch(`https://www.googleapis.com/youtube/v3/channels?part=contentDetails&${filter}&key=${encodeURIComponent(key)}`).then((r)=>r.json() as Promise<ChannelResponse>);
    const found=channel.items?.[0]; if(!found) continue;
    const church=await db.prepare("SELECT id FROM churches WHERE name=? AND region=?").bind(source.name,source.region).first<{id:number}>(); if(!church) continue;
    await db.prepare("UPDATE churches SET youtube_channel_id=? WHERE id=?").bind(found.id,church.id).run();
    const uploads=found.contentDetails.relatedPlaylists.uploads;
    const playlist=await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${encodeURIComponent(uploads)}&maxResults=24&key=${encodeURIComponent(key)}`).then((r)=>r.json() as Promise<PlaylistResponse>);
    for(const item of (playlist.items||[]).filter((entry)=>isSermonTitle(entry.snippet.title)).slice(0,6)) { const thumb=item.snippet.thumbnails?.high?.url||item.snippet.thumbnails?.medium?.url||`https://i.ytimg.com/vi/${item.contentDetails.videoId}/hqdefault.jpg`; await db.prepare("INSERT INTO sermons (church_id,youtube_id,title,thumbnail_url,published_at) VALUES (?,?,?,?,?) ON CONFLICT(youtube_id) DO UPDATE SET title=excluded.title,thumbnail_url=excluded.thumbnail_url,published_at=excluded.published_at").bind(church.id,item.contentDetails.videoId,item.snippet.title,thumb,item.snippet.publishedAt).run(); imported++; }
  }
  await db.prepare("INSERT INTO sync_state (key,last_synced_at) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET last_synced_at=excluded.last_synced_at").bind(syncKey,new Date().toISOString()).run();
  return Response.json({ok:true,registered,imported});
}
