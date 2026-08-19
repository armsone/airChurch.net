import { database, ensureSermonTables } from "../_shared";
import { churchHomepageUrls } from "../../church-homepages";
import { churchImageUrls } from "../../church-images";

type ChurchRow={id:number;name:string;pastor:string;region:string;denomination:string;youtubeChannelId:string|null;channelImageUrl:string|null;homepageUrl:string|null};

export async function GET() {
  const db=database();
  await ensureSermonTables(db);
  const result=await db.prepare("SELECT id,name,pastor,region,denomination,youtube_channel_id AS youtubeChannelId,channel_image_url AS channelImageUrl,homepage_url AS homepageUrl FROM churches WHERE review_status='approved' ORDER BY priority_weight DESC,name LIMIT 300").all<ChurchRow>();
  const items=result.results.map((church)=>{
    const homepageUrl=church.homepageUrl||churchHomepageUrls[church.name]||null;
    return {...church,homepageUrl,channelImageUrl:church.channelImageUrl||churchImageUrls[church.name]||null};
  });
  return Response.json({items},{headers:{"cache-control":"public, max-age=300, s-maxage=300, stale-while-revalidate=1800"}});
}
