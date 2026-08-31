import { env } from "cloudflare:workers";
import { accessSession } from "../../../../admin-access";
import { clean, database, ensureSermonTables, requestBodyTooLarge, requestOriginIsInvalid } from "../../../_shared";
import { isSermonTitle } from "../../../sermons/_selection";
import { safeHttpUrl } from "../../../../safe-url";

type ImportRecord={name?:unknown;pastor?:unknown;region?:unknown;denomination?:unknown;channelId?:unknown;homepage?:unknown};
type ChannelResponse={items?:Array<{id:string;snippet?:{thumbnails?:{default?:{url:string};medium?:{url:string};high?:{url:string}}};contentDetails:{relatedPlaylists:{uploads:string}}}>};
type PlaylistResponse={items?:Array<{snippet:{title:string;publishedAt:string;thumbnails?:{medium?:{url:string};high?:{url:string}}};contentDetails:{videoId:string}}>};
const CHANNEL_ID=/^UC[\w-]{20,}$/;

export async function POST(request:Request) {
  if(requestBodyTooLarge(request,65_536))return Response.json({error:"요청 내용이 너무 큽니다."},{status:413,headers:{"cache-control":"no-store"}});
  if(requestOriginIsInvalid(request))return Response.json({error:"요청을 확인할 수 없습니다."},{status:403,headers:{"cache-control":"no-store"}});
  const session=await accessSession(request);
  if(!session||session.role!=="admin")return Response.json({error:"관리자 권한이 필요합니다."},{status:403});
  const key=(env as unknown as {YOUTUBE_API_KEY?:string}).YOUTUBE_API_KEY;
  if(!key)return Response.json({error:"YouTube API key not configured"},{status:503});
  const data=await request.json().catch(()=>({})) as {records?:unknown};
  if(!Array.isArray(data.records)||data.records.length<1||data.records.length>20)return Response.json({error:"한 번에 1~20곳을 등록할 수 있습니다."},{status:400});
  const records=data.records as ImportRecord[];
  const db=database();await ensureSermonTables(db);
  let verified=0,imported=0;const skipped:Array<{name:string;reason:string}>=[];
  for(const raw of records) {
    const source={name:clean(raw.name,100),pastor:clean(raw.pastor,80),region:clean(raw.region,80),denomination:clean(raw.denomination,120),channelId:clean(raw.channelId,80),homepage:safeHttpUrl(clean(raw.homepage,500))};
    if(!source.name||!source.pastor||!source.region||!source.denomination||!CHANNEL_ID.test(source.channelId)){skipped.push({name:source.name||"이름 없음",reason:"invalid_record"});continue;}
    const channelResponse=await fetch(`https://www.googleapis.com/youtube/v3/channels?part=snippet,contentDetails&id=${encodeURIComponent(source.channelId)}&key=${encodeURIComponent(key)}`);
    if(!channelResponse.ok){skipped.push({name:source.name,reason:"channel_verification_failed"});continue;}
    const found=((await channelResponse.json()) as ChannelResponse).items?.[0];
    if(!found){skipped.push({name:source.name,reason:"channel_not_found"});continue;}
    const uploads=found.contentDetails.relatedPlaylists.uploads;
    const playlistResponse=await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${encodeURIComponent(uploads)}&maxResults=24&key=${encodeURIComponent(key)}`);
    if(!playlistResponse.ok){skipped.push({name:source.name,reason:"uploads_unavailable"});continue;}
    const activeSince=Date.now()-180*24*60*60*1000;
    const recent=((await playlistResponse.json()) as PlaylistResponse).items?.filter((item)=>Date.parse(item.snippet.publishedAt)>=activeSince&&isSermonTitle(item.snippet.title))??[];
    if(!recent.length){skipped.push({name:source.name,reason:"no_recent_sermon"});continue;}
    const image=found.snippet?.thumbnails?.high?.url||found.snippet?.thumbnails?.medium?.url||found.snippet?.thumbnails?.default?.url||null;
    const existing=await db.prepare("SELECT id,review_status FROM churches WHERE youtube_channel_id=? OR (name=? AND region=?) ORDER BY CASE WHEN youtube_channel_id=? THEN 0 ELSE 1 END LIMIT 1").bind(found.id,source.name,source.region,found.id).first<{id:number;review_status:string}>();
    if(existing?.review_status==="deleted"){skipped.push({name:source.name,reason:"deleted_by_admin"});continue;}
    let churchId:number;
    if(existing){await db.prepare("UPDATE churches SET name=?,pastor=?,region=?,denomination=?,youtube_channel_id=?,channel_image_url=?,homepage_url=COALESCE(?,homepage_url),review_status='approved',hold_reason=NULL,hold_note=NULL,held_at=NULL WHERE id=?").bind(source.name,source.pastor,source.region,source.denomination,found.id,image,source.homepage||null,existing.id).run();churchId=existing.id;}
    else {const inserted=await db.prepare("INSERT INTO churches (name,pastor,region,denomination,youtube_channel_id,channel_image_url,homepage_url,review_status) VALUES (?,?,?,?,?,?,?,'approved')").bind(source.name,source.pastor,source.region,source.denomination,found.id,image,source.homepage||null).run();churchId=Number(inserted.meta.last_row_id);}
    verified++;
    for(const item of recent.slice(0,6)){const thumb=item.snippet.thumbnails?.high?.url||item.snippet.thumbnails?.medium?.url||`https://i.ytimg.com/vi/${item.contentDetails.videoId}/hqdefault.jpg`;await db.prepare("INSERT INTO sermons (church_id,youtube_id,title,thumbnail_url,published_at) VALUES (?,?,?,?,?) ON CONFLICT(youtube_id) DO UPDATE SET title=excluded.title,thumbnail_url=excluded.thumbnail_url,published_at=excluded.published_at").bind(churchId,item.contentDetails.videoId,item.snippet.title,thumb,item.snippet.publishedAt).run();imported++;}
  }
  const approved=await db.prepare("SELECT COUNT(*) AS count FROM churches WHERE review_status='approved' AND youtube_channel_id IS NOT NULL").first<{count:number}>();
  return Response.json({ok:true,processed:records.length,verified,skipped,imported,approved:approved?.count??0},{headers:{"cache-control":"no-store"}});
}
