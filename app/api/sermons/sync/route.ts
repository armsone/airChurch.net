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
];

type ChannelResponse={items?:Array<{id:string;contentDetails:{relatedPlaylists:{uploads:string}}}>};
type PlaylistResponse={items?:Array<{snippet:{title:string;publishedAt:string;thumbnails?:{medium?:{url:string};high?:{url:string}}};contentDetails:{videoId:string}}>};

export async function POST() {
  const key=(env as unknown as {YOUTUBE_API_KEY?:string}).YOUTUBE_API_KEY;
  const db=database(); await ensureSermonTables(db);
  const syncKey="youtube-v4";
  const cleanup=await db.prepare("UPDATE churches SET review_status='removed' WHERE review_status='approved' AND youtube_channel_id IS NULL").run();
  const removed=cleanup.meta.changes;
  if(!key) return Response.json({error:"YouTube API key not configured",removed},{status:503});
  const state=await db.prepare("SELECT last_synced_at AS lastSyncedAt FROM sync_state WHERE key=?").bind(syncKey).first<{lastSyncedAt:string}>();
  if(state && Date.now()-Date.parse(state.lastSyncedAt)<60*60*1000) {
    const approved=await db.prepare("SELECT COUNT(*) AS count FROM churches WHERE review_status='approved' AND youtube_channel_id IS NOT NULL").first<{count:number}>();
    return Response.json({ok:true,approved:approved?.count??0,removed,imported:0,skipped:"fresh"});
  }
  let imported=0;
  let verified=0;
  for(const source of sources) {
    const filter=source.channelId?`id=${encodeURIComponent(source.channelId)}`:source.handle?`forHandle=${encodeURIComponent(source.handle)}`:`forUsername=${encodeURIComponent(source.username||"")}`;
    const channelResponse=await fetch(`https://www.googleapis.com/youtube/v3/channels?part=contentDetails&${filter}&key=${encodeURIComponent(key)}`);
    if(!channelResponse.ok) return Response.json({error:"YouTube channel verification failed",removed},{status:502});
    const channel=await channelResponse.json() as ChannelResponse;
    const found=channel.items?.[0];
    if(!found) {
      await db.prepare("UPDATE churches SET review_status='removed' WHERE name=? AND region=?").bind(source.name,source.region).run();
      continue;
    }
    const existing=await db.prepare("SELECT id FROM churches WHERE name=? AND region=?").bind(source.name,source.region).first<{id:number}>();
    let churchId:number;
    if(existing) {
      await db.prepare("UPDATE churches SET pastor=?,denomination=?,youtube_channel_id=? WHERE id=?").bind(source.pastor,source.denomination,found.id,existing.id).run();
      churchId=existing.id;
    } else {
      const inserted=await db.prepare("INSERT INTO churches (name,pastor,region,denomination,youtube_channel_id,review_status) VALUES (?,?,?,?,?,'approved')").bind(source.name,source.pastor,source.region,source.denomination,found.id).run();
      churchId=Number(inserted.meta.last_row_id);
    }
    verified++;
    const uploads=found.contentDetails.relatedPlaylists.uploads;
    const playlistResponse=await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${encodeURIComponent(uploads)}&maxResults=24&key=${encodeURIComponent(key)}`);
    if(!playlistResponse.ok) return Response.json({error:"YouTube upload verification failed",removed},{status:502});
    const playlist=await playlistResponse.json() as PlaylistResponse;
    const activeSince=Date.now()-180*24*60*60*1000;
    if(!(playlist.items||[]).some((item)=>Date.parse(item.snippet.publishedAt)>=activeSince)) {
      await db.prepare("UPDATE churches SET review_status='removed' WHERE id=?").bind(churchId).run();
      verified--;
      continue;
    }
    for(const item of (playlist.items||[]).filter((entry)=>isSermonTitle(entry.snippet.title)).slice(0,6)) { const thumb=item.snippet.thumbnails?.high?.url||item.snippet.thumbnails?.medium?.url||`https://i.ytimg.com/vi/${item.contentDetails.videoId}/hqdefault.jpg`; await db.prepare("INSERT INTO sermons (church_id,youtube_id,title,thumbnail_url,published_at) VALUES (?,?,?,?,?) ON CONFLICT(youtube_id) DO UPDATE SET title=excluded.title,thumbnail_url=excluded.thumbnail_url,published_at=excluded.published_at").bind(churchId,item.contentDetails.videoId,item.snippet.title,thumb,item.snippet.publishedAt).run(); imported++; }
  }
  await db.prepare("INSERT INTO sync_state (key,last_synced_at) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET last_synced_at=excluded.last_synced_at").bind(syncKey,new Date().toISOString()).run();
  return Response.json({ok:true,verified,removed,imported});
}
