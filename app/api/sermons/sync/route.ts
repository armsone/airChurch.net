import { env } from "cloudflare:workers";
import { database, ensureSermonTables } from "../../_shared";

const sources=[
  {name:"온누리교회",pastor:"이재훈 목사",region:"서울 용산",denomination:"대한예수교장로회 통합",handle:"@Onnuriservice"},
  {name:"분당우리교회",pastor:"이찬수 목사",region:"경기 성남",denomination:"대한예수교장로회 합동",handle:"@BundangWooriChurch"},
  {name:"거룩한빛광성교회",pastor:"곽승현 목사",region:"경기 고양",denomination:"대한예수교장로회 통합",channelId:"UCpRPXBwj33S73e3SFDD9_-Q"},
];

type ChannelResponse={items?:Array<{id:string;contentDetails:{relatedPlaylists:{uploads:string}}}>};
type PlaylistResponse={items?:Array<{snippet:{title:string;publishedAt:string;thumbnails?:{medium?:{url:string};high?:{url:string}}};contentDetails:{videoId:string}}>};

export async function POST() {
  const key=(env as unknown as {YOUTUBE_API_KEY?:string}).YOUTUBE_API_KEY;
  if(!key) return Response.json({error:"YouTube API key not configured"},{status:503});
  const db=database(); await ensureSermonTables(db);
  const state=await db.prepare("SELECT last_synced_at AS lastSyncedAt FROM sync_state WHERE key='youtube'").first<{lastSyncedAt:string}>();
  if(state && Date.now()-Date.parse(state.lastSyncedAt)<60*60*1000) return Response.json({ok:true,skipped:"fresh"});
  let imported=0;
  for(const source of sources) {
    const filter=source.channelId?`id=${encodeURIComponent(source.channelId)}`:`forHandle=${encodeURIComponent(source.handle||"")}`;
    const channel=await fetch(`https://www.googleapis.com/youtube/v3/channels?part=contentDetails&${filter}&key=${encodeURIComponent(key)}`).then((r)=>r.json() as Promise<ChannelResponse>);
    const found=channel.items?.[0]; if(!found) continue;
    await db.prepare("INSERT INTO churches (name,pastor,region,denomination,youtube_channel_id,review_status) VALUES (?,?,?,?,?,'approved') ON CONFLICT(youtube_channel_id) DO UPDATE SET name=excluded.name,pastor=excluded.pastor,region=excluded.region,denomination=excluded.denomination,review_status='approved'").bind(source.name,source.pastor,source.region,source.denomination,found.id).run();
    const church=await db.prepare("SELECT id FROM churches WHERE youtube_channel_id=?").bind(found.id).first<{id:number}>(); if(!church) continue;
    const uploads=found.contentDetails.relatedPlaylists.uploads;
    const playlist=await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${encodeURIComponent(uploads)}&maxResults=6&key=${encodeURIComponent(key)}`).then((r)=>r.json() as Promise<PlaylistResponse>);
    for(const item of playlist.items||[]) { const thumb=item.snippet.thumbnails?.high?.url||item.snippet.thumbnails?.medium?.url||`https://i.ytimg.com/vi/${item.contentDetails.videoId}/hqdefault.jpg`; await db.prepare("INSERT INTO sermons (church_id,youtube_id,title,thumbnail_url,published_at) VALUES (?,?,?,?,?) ON CONFLICT(youtube_id) DO UPDATE SET title=excluded.title,thumbnail_url=excluded.thumbnail_url,published_at=excluded.published_at").bind(church.id,item.contentDetails.videoId,item.snippet.title,thumb,item.snippet.publishedAt).run(); imported++; }
  }
  await db.prepare("INSERT INTO sync_state (key,last_synced_at) VALUES ('youtube',?) ON CONFLICT(key) DO UPDATE SET last_synced_at=excluded.last_synced_at").bind(new Date().toISOString()).run();
  return Response.json({ok:true,imported});
}
