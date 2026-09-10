import { env } from "cloudflare:workers";

const channelId="UC1SYh8LIMLjzzADMwRp8cJw";
const channelName="BibleMusic.co.kr_바이블뮤직";

type ChannelResponse={items?:Array<{contentDetails?:{relatedPlaylists?:{uploads?:string}};statistics?:{videoCount?:string}}>};
type PlaylistResponse={items?:Array<{contentDetails?:{videoId?:string};snippet?:{title?:string}}> ;nextPageToken?:string};

export async function GET(request:Request) {
  const key=(env as unknown as {YOUTUBE_API_KEY?:string}).YOUTUBE_API_KEY;
  if(!key)return Response.json({error:"바이블뮤직 목록을 준비하지 못했습니다. 잠시 후 다시 시도해 주세요."},{status:503,headers:{"cache-control":"no-store"}});
  const params=new URL(request.url).searchParams;
  const pageToken=(params.get("pageToken")||"").slice(0,200);
  const channelResponse=await fetch(`https://www.googleapis.com/youtube/v3/channels?part=contentDetails,statistics&id=${channelId}&key=${encodeURIComponent(key)}`,{signal:AbortSignal.timeout(10_000)}).catch(()=>null);
  if(!channelResponse?.ok)return Response.json({error:"바이블뮤직 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."},{status:502,headers:{"cache-control":"no-store"}});
  const channel=await channelResponse.json() as ChannelResponse;
  const uploads=channel.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if(!uploads)return Response.json({error:"바이블뮤직 업로드 목록을 찾지 못했습니다."},{status:502,headers:{"cache-control":"no-store"}});
  const playlistResponse=await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${encodeURIComponent(uploads)}&maxResults=50${pageToken?`&pageToken=${encodeURIComponent(pageToken)}`:""}&key=${encodeURIComponent(key)}`,{signal:AbortSignal.timeout(10_000)}).catch(()=>null);
  if(!playlistResponse?.ok)return Response.json({error:"바이블뮤직 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."},{status:502,headers:{"cache-control":"no-store"}});
  const playlist=await playlistResponse.json() as PlaylistResponse;
  const items=(playlist.items||[]).flatMap((item)=>{const id=item.contentDetails?.videoId,title=item.snippet?.title?.trim();return id&&title?[{id,title,channel:channelName,duration:0}]:[];});
  const total=Number(channel.items?.[0]?.statistics?.videoCount||0);
  return Response.json({items,total,nextCursor:playlist.nextPageToken||null},{headers:{"cache-control":"public, max-age=60, s-maxage=300, stale-while-revalidate=600"}});
}
