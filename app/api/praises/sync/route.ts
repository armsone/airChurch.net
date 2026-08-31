import { database, ensurePraiseTables, ensureSermonTables } from "../../_shared";
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

export async function POST(request?:Request) {
  if(request)return Response.json({error:"Not found"},{status:404,headers:{"cache-control":"no-store"}});
  const db = database();
  await Promise.all([ensureSermonTables(db), ensurePraiseTables(db)]);
  const syncKey = "youtube-praise-v1";
  const state = await db.prepare("SELECT last_synced_at AS lastSyncedAt FROM sync_state WHERE key=?").bind(syncKey).first<{ lastSyncedAt: string }>();
  const current = await db.prepare("SELECT COUNT(*) AS count FROM praise_videos WHERE status='published'").first<{ count: number }>();
  if (state && Number(current?.count || 0) >= 12 && Date.now() - Date.parse(state.lastSyncedAt) < 6 * 60 * 60 * 1000) return Response.json({ ok: true, imported: 0, total: current?.count || 0, skipped: "fresh" });

  const churches = await db.prepare("SELECT id,name,youtube_channel_id AS youtubeChannelId FROM churches WHERE review_status='approved' AND youtube_channel_id IS NOT NULL ORDER BY priority_weight DESC,name LIMIT 60").all<Church>();
  const feeds = await Promise.allSettled(churches.results.map(async (church) => {
    const response = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(church.youtubeChannelId)}`,{signal:AbortSignal.timeout(10_000)}).catch(()=>null);
    if (!response?.ok) return null;
    return parseFeed(await response.text(), church.id);
  }));
  const successfulFeeds=feeds.filter((result):result is PromiseFulfilledResult<Praise[]>=>result.status==="fulfilled"&&result.value!==null);
  if(!successfulFeeds.length)return Response.json({ok:false,error:"YouTube feeds temporarily unavailable"},{status:502,headers:{"cache-control":"no-store"}});
  const found = successfulFeeds.flatMap((result) => result.value).sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt)).slice(0, 60);
  if (found.length) await db.batch(found.map((item) => db.prepare("INSERT INTO praise_videos (church_id,youtube_id,title,thumbnail_url,published_at) VALUES (?,?,?,?,?) ON CONFLICT(youtube_id) DO UPDATE SET title=excluded.title,thumbnail_url=excluded.thumbnail_url,published_at=excluded.published_at").bind(item.churchId, item.youtubeId, item.title, item.thumbnailUrl, item.publishedAt)));
  await db.prepare("INSERT INTO sync_state (key,last_synced_at) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET last_synced_at=excluded.last_synced_at").bind(syncKey, new Date().toISOString()).run();
  return Response.json({ ok: true, imported: found.length, total: Math.max(Number(current?.count || 0), found.length) });
}
