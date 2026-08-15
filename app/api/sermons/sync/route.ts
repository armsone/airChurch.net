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
  {name:"대구동신교회",pastor:"김성일 목사",region:"대구 수성",denomination:"대한예수교장로회 합동",channelId:"UCuWebi6hqVRFsvb6UmWr9Qg"},
  {name:"광주동명교회",pastor:"이상복 목사",region:"광주 동구",denomination:"대한예수교장로회",handle:"@cocho7406"},
  {name:"인천제일교회",pastor:"이제일 목사",region:"인천 남동",denomination:"기독교대한감리회",handle:"@인천제일교회"},
  {name:"소망교회",pastor:"김경진 목사",region:"서울 강남",denomination:"대한예수교장로회 통합",channelId:"UCIItIEnZPjKo0eqvq9qIJAg"},
  {name:"새로남교회",pastor:"오정호 목사",region:"대전 서구",denomination:"대한예수교장로회 합동",username:"srnchurch"},
  {name:"우리들교회",pastor:"김양재 목사",region:"경기 성남",denomination:"대한예수교장로회 통합",username:"wooridlechurch"},
  {name:"영락교회",pastor:"김운성 목사",region:"서울 중구",denomination:"대한예수교장로회 통합",handle:"@youngnakchurch"},
  {name:"사랑의교회",pastor:"오정현 목사",region:"서울 서초",denomination:"대한예수교장로회 합동",handle:"@sarangchurch121"},
  {name:"서머나교회",pastor:"배성현 목사",region:"경남 창원",denomination:"대한예수교장로회 합동",handle:"@서머나교회"},
];

type ChannelResponse={items?:Array<{id:string;contentDetails:{relatedPlaylists:{uploads:string}}}>};
type PlaylistResponse={items?:Array<{snippet:{title:string;publishedAt:string;thumbnails?:{medium?:{url:string};high?:{url:string}}};contentDetails:{videoId:string}}>};

export async function POST() {
  const key=(env as unknown as {YOUTUBE_API_KEY?:string}).YOUTUBE_API_KEY;
  if(!key) return Response.json({error:"YouTube API key not configured"},{status:503});
  const db=database(); await ensureSermonTables(db);
  const syncKey="youtube-v2";
  const state=await db.prepare("SELECT last_synced_at AS lastSyncedAt FROM sync_state WHERE key=?").bind(syncKey).first<{lastSyncedAt:string}>();
  if(state && Date.now()-Date.parse(state.lastSyncedAt)<60*60*1000) return Response.json({ok:true,skipped:"fresh"});
  let imported=0;
  for(const source of sources) {
    const filter=source.channelId?`id=${encodeURIComponent(source.channelId)}`:source.handle?`forHandle=${encodeURIComponent(source.handle)}`:`forUsername=${encodeURIComponent(source.username||"")}`;
    const channel=await fetch(`https://www.googleapis.com/youtube/v3/channels?part=contentDetails&${filter}&key=${encodeURIComponent(key)}`).then((r)=>r.json() as Promise<ChannelResponse>);
    const found=channel.items?.[0]; if(!found) continue;
    await db.prepare("INSERT INTO churches (name,pastor,region,denomination,youtube_channel_id,review_status) VALUES (?,?,?,?,?,'approved') ON CONFLICT(youtube_channel_id) DO UPDATE SET name=excluded.name,pastor=excluded.pastor,region=excluded.region,denomination=excluded.denomination").bind(source.name,source.pastor,source.region,source.denomination,found.id).run();
    const church=await db.prepare("SELECT id FROM churches WHERE youtube_channel_id=?").bind(found.id).first<{id:number}>(); if(!church) continue;
    const uploads=found.contentDetails.relatedPlaylists.uploads;
    const playlist=await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${encodeURIComponent(uploads)}&maxResults=24&key=${encodeURIComponent(key)}`).then((r)=>r.json() as Promise<PlaylistResponse>);
    for(const item of (playlist.items||[]).filter((entry)=>isSermonTitle(entry.snippet.title)).slice(0,6)) { const thumb=item.snippet.thumbnails?.high?.url||item.snippet.thumbnails?.medium?.url||`https://i.ytimg.com/vi/${item.contentDetails.videoId}/hqdefault.jpg`; await db.prepare("INSERT INTO sermons (church_id,youtube_id,title,thumbnail_url,published_at) VALUES (?,?,?,?,?) ON CONFLICT(youtube_id) DO UPDATE SET title=excluded.title,thumbnail_url=excluded.thumbnail_url,published_at=excluded.published_at").bind(church.id,item.contentDetails.videoId,item.snippet.title,thumb,item.snippet.publishedAt).run(); imported++; }
  }
  await db.prepare("INSERT INTO sync_state (key,last_synced_at) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET last_synced_at=excluded.last_synced_at").bind(syncKey,new Date().toISOString()).run();
  return Response.json({ok:true,imported});
}
