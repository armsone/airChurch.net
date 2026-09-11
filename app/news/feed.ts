import { newsLogoUrl } from "./news-logo";
import qualifiedSources from "../../data/qualified-content-sources.json";
export type FeedSource={name:string;url:string;homepage:string;allowedHost:string;tone:string;markUrl:string;kind?:"rss"};
export type NewsItem={title:string;summary:string;url:string;publishedAt:string;source:string;tone:string;markUrl:string};
export type FeedState={items:NewsItem[];checkedAt:string;lastSuccessAt?:string;nextCheckAt:string;failures:number;etag?:string;modified?:string;version?:number;lastError?:string};
export type NewsPayload={items:NewsItem[];sources:Array<{name:string;rssUrl:string;homepage:string;status:string;lastSuccessAt?:string}>;refreshedAt?:string;sourcesProcessed?:number;target:number};
export type SnapshotRow={payload:string;refreshedAt:string};

export const sources:FeedSource[]=[
  {name:"뉴스앤조이",url:"https://www.newsnjoy.or.kr/rss/allArticle.xml",homepage:"https://www.newsnjoy.or.kr/",allowedHost:"www.newsnjoy.or.kr",tone:"newsnjoy",markUrl:"https://cdn.newsnjoy.or.kr/image/logo/toplogo_20250820092205.png"},
  {name:"아이굿뉴스",url:"https://www.igoodnews.net/rss/allArticle.xml",homepage:"https://www.igoodnews.net/",allowedHost:"www.igoodnews.net",tone:"igoodnews",markUrl:"https://www.igoodnews.net/image/logo/toplogo_20190425034423.png"},
  {name:"기독신문",url:"https://www.kidok.com/rss/allArticle.xml",homepage:"https://www.kidok.com/",allowedHost:"www.kidok.com",tone:"kidok",markUrl:"/news/kidok-logo.png"},
  {name:"기독공보",url:"https://www.pckworld.com/rss/allArticle.xml",homepage:"https://www.pckworld.com/",allowedHost:"www.pckworld.com",tone:"pckworld",markUrl:"https://www.pckworld.com/upimages/logo3.png"},
  {name:"데일리굿뉴스",url:"https://www.goodnews1.com/rss/allArticle.xml",homepage:"https://www.goodnews1.com/",allowedHost:"www.goodnews1.com",tone:"goodnews",markUrl:"https://cdn.goodnews1.com/image/logo/toplogo_20250721110801.png"},
  {name:"주간기독교",url:"https://www.cnews.or.kr/rss/allArticle.xml",homepage:"https://www.cnews.or.kr/",allowedHost:"www.cnews.or.kr",tone:"cnews",markUrl:"https://www.cnews.or.kr/image/logo/toplogo_20211228113810.png"},
  {name:"한국성결신문",url:"https://www.kehcnews.co.kr/rss/allArticle.xml",homepage:"https://www.kehcnews.co.kr/",allowedHost:"www.kehcnews.co.kr",tone:"kehcnews",markUrl:"https://cdn.kehcnews.co.kr/image/logo/toplogo_20200423023741.png"},
  {name:"당당뉴스",url:"https://www.dangdangnews.com/rss/allArticle.xml",homepage:"https://www.dangdangnews.com/",allowedHost:"www.dangdangnews.com",tone:"dangdang",markUrl:"https://cdn.dangdangnews.com/image/logo/toplogo_20250520034357.png"},
  {name:"교회와신앙",url:"https://www.amennews.com/rss/allArticle.xml",homepage:"https://www.amennews.com/",allowedHost:"www.amennews.com",tone:"amennews",markUrl:"https://cdn.amennews.com/image/logo/toplogo_20250731115309.png"},
  {name:"뉴스M",url:"https://www.newsm.com/rss/allArticle.xml",homepage:"https://www.newsm.com/",allowedHost:"www.newsm.com",tone:"newsm",markUrl:"https://cdn.newsm.com/image/logo/toplogo_20240520113228.png"},
  {name:"교회갱신협의회",url:"https://www.churchr.or.kr/rss/gns_allArticle.xml",homepage:"https://www.churchr.or.kr/",allowedHost:"www.churchr.or.kr",tone:"churchr",markUrl:"https://cdn.churchr.or.kr/image/logo/toplogo_20230515040240.png"},
  {name:"기독교타임즈",url:"https://www.kmctimes.com/rss/allArticle.xml",homepage:"https://www.kmctimes.com/",allowedHost:"www.kmctimes.com",tone:"kmctimes",markUrl:"https://cdn.kmctimes.com/image/logo/toplogo_20260622021901.png"},
  {name:"고신뉴스",url:"https://www.kosinnews.com/rss/allArticle.xml",homepage:"https://www.kosinnews.com/",allowedHost:"www.kosinnews.com",tone:"kosinnews",markUrl:"https://cdn.kosinnews.com/image/logo/toplogo_20210104091958.png"},
  {name:"미션투데이",url:"https://www.missiontoday.co.kr/rss/allArticle.xml",homepage:"https://www.missiontoday.co.kr/",allowedHost:"www.missiontoday.co.kr",tone:"missiontoday",markUrl:"https://cdn.missiontoday.co.kr/image/logo/toplogo_20220117022538.png"},
  {name:"성공회신문",url:"https://www.skhnews.or.kr/rss/allArticle.xml",homepage:"https://www.skhnews.or.kr/",allowedHost:"www.skhnews.or.kr",tone:"skhnews",markUrl:"https://cdn.skhnews.or.kr/image/logo/toplogo_20220721104037.png"},
  {name:"기독교한국신문",url:"https://www.cknews.co.kr/rss/allArticle.xml",homepage:"https://www.cknews.co.kr/",allowedHost:"www.cknews.co.kr",tone:"cknews",markUrl:"https://cdn.cknews.co.kr/image/logo/toplogo_20210623113617.png"},
  {name:"기독교종합신문",url:"https://www.potalnews.com/rss/allArticle.xml",homepage:"https://www.potalnews.com/",allowedHost:"www.potalnews.com",tone:"potalnews",markUrl:"https://cdn.potalnews.com/image/logo/toplogo_20220506094923.png"},
  {name:"기독교포털뉴스",url:"https://www.kportalnews.co.kr/rss/allArticle.xml",homepage:"https://www.kportalnews.co.kr/",allowedHost:"www.kportalnews.co.kr",tone:"kportalnews",markUrl:"https://www.kportalnews.co.kr/image/logo/toplogo_20210924014455.png"},
  {name:"기독교개혁신보",url:"https://www.repress.kr/rss/allArticle.xml",homepage:"https://www.repress.kr/",allowedHost:"www.repress.kr",tone:"repress",markUrl:"https://cdn.repress.kr/image/logo/toplogo_20260223011521.png"},
  {name:"복음기도신문",url:"https://gpnews.org/feed",homepage:"https://gpnews.org/",allowedHost:"gpnews.org",tone:"gpnews",markUrl:"https://gpnews.org/wp/wp-content/uploads/2024/08/AppIcon_gon_512.jpg"},
  {name:"GOODTV",url:"https://news.goodtv.co.kr/rss/allArticle.xml",homepage:"https://news.goodtv.co.kr/",allowedHost:"news.goodtv.co.kr",tone:"goodtv",markUrl:"https://cdn.news.goodtv.co.kr/image/logo/toplogo_20241007095843.png"},
  {name:"베리타스",url:"https://veritas.kr/rss/articles/topnews/all.rss",homepage:"https://veritas.kr/",allowedHost:"veritas.kr",tone:"veritas",markUrl:"/news/veritas-logo.png"},
  {name:"기독일보",url:"https://www.christiandaily.co.kr/rss/articles/topnews/all.rss",homepage:"https://www.christiandaily.co.kr/",allowedHost:"www.christiandaily.co.kr",tone:"christiandaily",markUrl:"https://www.christiandaily.co.kr/views/images/aboutus/logo.png"},
  {name:"크리스찬저널",url:"https://www.kcjlogos.org/rss/allArticle.xml",homepage:"https://www.kcjlogos.org/",allowedHost:"www.kcjlogos.org",tone:"kcjlogos",markUrl:"https://cdn.kcjlogos.org/image/logo/toplogo_20210726090555.png"},
  {name:"뉴스제이",url:"https://www.newsjesus.net/rss/allArticle.xml",homepage:"https://www.newsjesus.net/",allowedHost:"www.newsjesus.net",tone:"newsjesus",markUrl:"https://www.newsjesus.net/image/logo/toplogo_20240104032146.gif"},
  ...[
    ["침례신문","https://www.baptistnews.co.kr","https://www.baptistnews.co.kr/data/rss/news.xml"],
    ["에큐메니안","https://www.ecumenian.com","https://cdn.ecumenian.com/rss/gn_rss_allArticle.xml"],
    ["한국장로신문","https://jangro.kr","https://jangro.kr/feed/"],
    ["컵뉴스","https://www.cupnews.kr","https://www.cupnews.kr/rss/gns_allArticle.xml"],
    ["복음in","https://www.ingn.net","https://cdn.ingn.net/rss/gn_rss_allArticle.xml"],
    ["한국기독신문","https://www.kcnp.com","https://www.kcnp.com/rss/"],
    ["KMC뉴스","https://www.kmcnews.kr","https://cdn.kmcnews.kr/rss/gn_rss_allArticle.xml"],
    ["뉴스앤넷","https://www.newsnnet.com","https://cdn.newsnnet.com/rss/gn_rss_allArticle.xml"],
    ["그신문 월드리뷰","https://www.christianwr.com","https://cdn.christianwr.com/rss/gn_rss_allArticle.xml"],
    ["국제기독교뉴스","https://www.christiannews.co.kr","https://www.christiannews.co.kr/rss/rss_news.php"],
    ["뉴스파워","https://www.newspower.co.kr","https://www.newspower.co.kr/rss/rss_news.php"],
    ["i기독타임즈","https://www.kidoktimes.co.kr","https://www.kidoktimes.co.kr/rss/rss_news.php"],
    ["미주뉴스앤조이","https://www.newsnjoy.us","https://cdn.newsnjoy.us/rss/gns_allArticle.xml"],
    ["크리스찬투데이·미주","https://www.christiantoday.us","https://www.christiantoday.us/rss/rss_news.php"],
    ["웨슬리안타임즈","https://www.kmcdaily.com","http://www.kmcdaily.com/rss/allArticle.xml"],
    ["가스펠투데이","https://www.gospeltoday.co.kr","http://www.gospeltoday.co.kr/rss/allArticle.xml"],
    ["한국기독저널","https://www.christian-journal.com","https://cdn.christian-journal.com/rss/gns_allArticle.xml"],
    ["리폼드뉴스","https://www.reformednews.co.kr","https://www.reformednews.co.kr/rss/rss_news.php"],
    ["기독교라인","https://www.kidokline.com","https://www.kidokline.com/rss/allArticle.xml"],
    ["평화나무","https://www.logosian.com","https://www.logosian.com/rss/allArticle.xml"],
    ["크리스천비전","https://www.christianvision.net","https://www.christianvision.net/rss/rss_news.php"],
    ["코람데오닷컴","https://www.kscoramdeo.com","https://www.kscoramdeo.com/rss/allArticle.xml"],
    ["리폼드투데이","https://www.reformedtoday.net","https://www.reformedtoday.net/rss/allArticle.xml"],
    ["국민일보 더미션","https://www.themission.co.kr","https://www.themission.co.kr/rss/allArticle.xml"],
    ["크리스천투데이","https://www.christiantoday.co.kr","https://www.christiantoday.co.kr/rss/"],
    ["기독교헤럴드","http://www.cherald.co.kr","http://www.cherald.co.kr/rss/allArticle.xml"],
    ["크리스찬리뷰·호주","https://www.christianreview.com.au","https://www.christianreview.com.au/rss/rss_news.php"],
    ["크리스천라이프·뉴질랜드","https://christianlife.nz","https://christianlife.nz/feed"],
    ["크리스찬타임스·미주 베이","https://www.kchristian.com","https://www.kchristian.com/blog-feed.xml"],
  ].map(([name,homepage,url])=>({name,homepage,url,allowedHost:new URL(homepage).hostname,tone:"newsnjoy",markUrl:""})),
  ...qualifiedSources.news as FeedSource[],
].map(source=>({...source,markUrl:newsLogoUrl(source.name,source.markUrl)}));

function decodeXml(value:string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,"$1")
    .replaceAll("&amp;","&").replaceAll("&quot;",'"').replaceAll("&#39;", "'")
    .replaceAll("&lt;","<").replaceAll("&gt;",">").replaceAll("&nbsp;"," ");
}

export function plainText(value:string) {
  return decodeXml(value).replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim();
}

export function tag(item:string,name:string) {
  const match=item.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`,"i"));
  return match?.[1]?.trim()||"";
}

export function parseFeed(xml:string,source:FeedSource):NewsItem[] {
  const items:NewsItem[]=[];
  for(const match of xml.matchAll(/<(?:item|entry)(?:\s[^>]*)?>([\s\S]*?)<\/(?:item|entry)>/gi)) {
    const item=match[1];
    const title=plainText(tag(item,"title"));
    const rawUrl=plainText(tag(item,"link")||item.match(/<link\b[^>]*href=["']([^"']+)["']/i)?.[1]||"");
    const rawDate=plainText(tag(item,"pubDate")||tag(item,"dc:date")||tag(item,"atom:published")||tag(item,"atom:updated")||tag(item,"published")||tag(item,"updated"));
    const timestamp=Date.parse(/^\d{4}-\d\d-\d\d \d\d:\d\d(?::\d\d)?$/.test(rawDate)?rawDate.replace(" ","T")+"+09:00":rawDate.replace(/\bKST\b/,"+0900"));
    if(!Number.isFinite(timestamp)||timestamp>Date.now()+3600000)continue;
    const publishedAt=new Date(timestamp).toISOString();
    const summary=plainText(tag(item,"description")).slice(0,140);
    try {
      const url=new URL(rawUrl);
      if(url.hostname.replace(/^www\./,"")!==source.allowedHost.replace(/^www\./,"")||!title||!/^https?:$/.test(url.protocol)||url.username||url.password) continue;
      items.push({title,summary:summary ? `${summary}${summary.length===140?"…":""}` : "원문에서 자세한 소식을 확인해 보세요.",url:url.toString(),publishedAt,source:source.name,tone:source.tone,markUrl:source.markUrl});
    } catch { /* 형식이 잘못된 외부 링크는 뉴스 목록에서 제외합니다. */ }
  }
  return items;
}

// Large full feeds are read only up to the byte budget. Parsers consume complete
// item/entry elements only, so the unfinished tail can never become an article.
export async function readFeedText(response:Response,maxBytes=1_000_000) {
  if(!response.body)return {text:"",truncated:false};
  const reader=response.body.getReader(),chunks:Uint8Array[]=[];let size=0,truncated=false;
  while(true){const {done,value}=await reader.read();if(done)break;const chunk=value.subarray(0,maxBytes-size);chunks.push(chunk);size+=chunk.byteLength;if(size>=maxBytes){truncated=true;void reader.cancel().catch(()=>{});break;}}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  const encoding=response.headers.get("content-type")?.match(/charset=["']?([^;,\s"']+)/i)?.[1]||new TextDecoder().decode(bytes.slice(0,200)).match(/encoding=["']([^"']+)/i)?.[1]||"utf-8";
  return {text:new TextDecoder(encoding).decode(bytes),truncated};
}
