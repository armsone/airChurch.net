import { env } from "cloudflare:workers";

const playlistId="PLqiTHwLF3DbYx6zQfpFbPPLjpRGSVn7s9";
const channelName="BibleMusic.co.kr_바이블뮤직";

type PlaylistResponse={items?:Array<{contentDetails?:{videoId?:string};snippet?:{title?:string}}> ;nextPageToken?:string;pageInfo?:{totalResults?:number}};

export async function GET(request:Request) {
  const key=(env as unknown as {YOUTUBE_API_KEY?:string}).YOUTUBE_API_KEY;
  if(!key)return Response.json({error:"바이블뮤직 목록을 준비하지 못했습니다. 잠시 후 다시 시도해 주세요."},{status:503,headers:{"cache-control":"no-store"}});
  const params=new URL(request.url).searchParams;
  const pageToken=(params.get("pageToken")||"").slice(0,200);
  const playlistResponse=await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${encodeURIComponent(playlistId)}&maxResults=50${pageToken?`&pageToken=${encodeURIComponent(pageToken)}`:""}&key=${encodeURIComponent(key)}`,{signal:AbortSignal.timeout(10_000)}).catch(()=>null);
  if(!playlistResponse?.ok)return Response.json({error:"바이블뮤직 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."},{status:502,headers:{"cache-control":"no-store"}});
  const playlist=await playlistResponse.json() as PlaylistResponse;
  const items=(playlist.items||[]).flatMap((item)=>{const id=item.contentDetails?.videoId,title=item.snippet?.title?.trim();return id&&title?[{id,title,channel:channelName,duration:0}]:[];});
  const total=Number(playlist.pageInfo?.totalResults||items.length);
  return Response.json({items,total,nextCursor:playlist.nextPageToken||null},{headers:{"cache-control":"public, max-age=60, s-maxage=300, stale-while-revalidate=600"}});
}
