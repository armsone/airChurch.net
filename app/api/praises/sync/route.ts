import { database, ensureMediaTables } from "../../_shared";
import { isPraiseTitle } from "../../sermons/_selection";

type Church = { id: number; name: string; youtubeChannelId: string };
type Praise = { churchId: number; youtubeId: string; title: string; thumbnailUrl: string; publishedAt: string };

function decodeXml(value: string) {
  return value.replaceAll("&amp;", "&").replaceAll("&quot;", '"').replaceAll("&#39;", "'").replaceAll("&lt;", "<").replaceAll("&gt;", ">");
}

function parseFeed(xml: string, churchId: number): Praise[] {
  const items: Praise[] = [];
  for (const match of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    const entry = match[1];
    const youtubeId = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1];
    const title = decodeXml(entry.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.trim() || "");
    const publishedAt = entry.match(/<published>([^<]+)<\/published>/)?.[1];
    if (!youtubeId || !publishedAt || !isPraiseTitle(title)) continue;
    items.push({ churchId, youtubeId, title, publishedAt, thumbnailUrl: `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg` });
  }
  return items;
}

async function mapWithConcurrency<T,R>(items:T[],limit:number,task:(item:T)=>Promise<R>):Promise<R[]> {
  const results=new Array<R>(items.length);
  let next=0;
  await Promise.all(Array.from({length:Math.min(limit,items.length)},async()=>{
    while(true){const index=next++;if(index>=items.length)return;results[index]=await task(items[index]);}
  }));
  return results;
}

export async function POST(request?:Request) {
  if(request&&new URL(request.url).hostname!=="airchurch.internal")return Response.json({error:"Not found"},{status:404,headers:{"cache-control":"no-store"}});
  const db = database();
  await ensureMediaTables(db);
  const syncKey = "youtube-praise-v1";
  const state = await db.prepare("SELECT last_synced_at AS lastSyncedAt FROM sync_state WHERE key=?").bind(syncKey).first<{ lastSyncedAt: string }>();
  const current = await db.prepare("SELECT COUNT(*) AS count FROM praise_videos WHERE status='published'").first<{ count: number }>();
  if (state && Number(current?.count || 0) >= 12 && Date.now() - Date.parse(state.lastSyncedAt) < 6 * 60 * 60 * 1000) return Response.json({ ok: true, imported: 0, total: current?.count || 0, skipped: "fresh" });
  const leaseKey=`${syncKey}:lease`;
  const leaseInsert=await db.prepare("INSERT OR IGNORE INTO sync_state (key,last_synced_at) VALUES (?,CURRENT_TIMESTAMP)").bind(leaseKey).run();
  const leaseUpdate=Number(leaseInsert.meta?.changes??0)===0?await db.prepare("UPDATE sync_state SET last_synced_at=CURRENT_TIMESTAMP WHERE key=? AND last_synced_at<datetime('now','-30 minutes')").bind(leaseKey).run():null;
  if(Number(leaseInsert.meta?.changes??0)===0&&Number(leaseUpdate?.meta?.changes??0)===0)return Response.json({ok:true,imported:0,total:current?.count||0,skipped:"sync_in_progress"});
  await db.prepare("INSERT INTO sync_state (key,last_synced_at) VALUES ('youtube-praise-last-attempt',CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET last_synced_at=excluded.last_synced_at").run();
  try {
  const churches = await db.prepare("SELECT id,name,youtube_channel_id AS youtubeChannelId FROM churches WHERE review_status='approved' AND youtube_channel_id IS NOT NULL ORDER BY priority_weight DESC,name LIMIT 60").all<Church>();
  const feeds = await mapWithConcurrency(churches.results,6,async (church):Promise<Praise[]|null> => {
    const response = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(church.youtubeChannelId)}`,{signal:AbortSignal.timeout(10_000)}).catch(()=>null);
    if (!response?.ok) return null;
    const xml=await response.text().catch(()=>null);
    return xml===null?null:parseFeed(xml, church.id);
  });
  const successfulFeeds=feeds.filter((result):result is Praise[]=>result!==null);
  if(!successfulFeeds.length){await db.prepare("INSERT INTO sync_state (key,last_synced_at) VALUES ('youtube-praise-last-failure',CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET last_synced_at=excluded.last_synced_at").run();return Response.json({ok:false,error:"YouTube feeds temporarily unavailable"},{status:502,headers:{"cache-control":"no-store"}});}
  const found = successfulFeeds.flat().sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt)).slice(0, 60);
  if (found.length) await db.batch(found.map((item) => db.prepare("INSERT INTO praise_videos (church_id,youtube_id,title,thumbnail_url,published_at) VALUES (?,?,?,?,?) ON CONFLICT(youtube_id) DO UPDATE SET title=excluded.title,thumbnail_url=excluded.thumbnail_url,published_at=excluded.published_at").bind(item.churchId, item.youtubeId, item.title, item.thumbnailUrl, item.publishedAt)));
  await db.prepare("INSERT INTO sync_state (key,last_synced_at) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET last_synced_at=excluded.last_synced_at").bind(syncKey, new Date().toISOString()).run();
  await db.prepare("INSERT INTO sync_state (key,last_synced_at) VALUES ('youtube-praise-last-success',?) ON CONFLICT(key) DO UPDATE SET last_synced_at=excluded.last_synced_at").bind(new Date().toISOString()).run();
  return Response.json({ ok: true, imported: found.length, total: Math.max(Number(current?.count || 0), found.length) });
  } catch(error) {
    await db.prepare("INSERT INTO sync_state (key,last_synced_at) VALUES ('youtube-praise-last-failure',CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET last_synced_at=excluded.last_synced_at").run().catch(()=>undefined);
    throw error;
  } finally {
    await db.prepare("DELETE FROM sync_state WHERE key=?").bind(leaseKey).run().catch(()=>undefined);
  }
}
