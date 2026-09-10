import { env } from "cloudflare:workers";

const playlistId="PLqiTHwLF3Dbb4LSoWz6NfzG8UbprRH4fE";
const playlistName="[Holy Verse] 홀리 벌스";

type PlaylistResponse={items?:Array<{contentDetails?:{videoId?:string};snippet?:{title?:string}}> ;nextPageToken?:string;pageInfo?:{totalResults?:number}};

export async function GET(request:Request) {
  const key=(env as unknown as {YOUTUBE_API_KEY?:string}).YOUTUBE_API_KEY;
  if(!key)return Response.json({error:"홀리 벌스 목록을 준비하지 못했습니다. 잠시 후 다시 시도해 주세요."},{status:503,headers:{"cache-control":"no-store"}});
  const pageToken=(new URL(request.url).searchParams.get("pageToken")||"").slice(0,200);
  const playlistResponse=await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${encodeURIComponent(playlistId)}&maxResults=50${pageToken?`&pageToken=${encodeURIComponent(pageToken)}`:""}&key=${encodeURIComponent(key)}`,{signal:AbortSignal.timeout(10_000)}).catch(()=>null);
  if(!playlistResponse?.ok)return Response.json({error:"홀리 벌스 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."},{status:502,headers:{"cache-control":"no-store"}});
  const playlist=await playlistResponse.json() as PlaylistResponse;
  const items=(playlist.items||[]).flatMap((item)=>{const id=item.contentDetails?.videoId,title=item.snippet?.title?.trim();return id&&title?[{id,title,channel:playlistName,duration:0}]:[];});
  return Response.json({items,total:Number(playlist.pageInfo?.totalResults||items.length),nextCursor:playlist.nextPageToken||null},{headers:{"cache-control":"public, max-age=60, s-maxage=300, stale-while-revalidate=600"}});
}
