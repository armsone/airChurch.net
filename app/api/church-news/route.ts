type FeedSource={name:string;url:string;homepage:string;allowedHost:string;tone:string;markUrl:string};
type NewsItem={title:string;summary:string;url:string;publishedAt:string;source:string;tone:string;markUrl:string};

const sources:FeedSource[]=[
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
  {name:"교회갱신협의회",url:"https://www.churchr.or.kr/rss/allArticle.xml",homepage:"https://www.churchr.or.kr/",allowedHost:"www.churchr.or.kr",tone:"churchr",markUrl:"https://cdn.churchr.or.kr/image/logo/toplogo_20230515040240.png"},
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
];

function decodeXml(value:string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,"$1")
    .replaceAll("&amp;","&").replaceAll("&quot;",'"').replaceAll("&#39;", "'")
    .replaceAll("&lt;","<").replaceAll("&gt;",">").replaceAll("&nbsp;"," ");
}

function plainText(value:string) {
  return decodeXml(value).replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim();
}

function tag(item:string,name:string) {
  const match=item.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`,"i"));
  return match?.[1]?.trim()||"";
}

function parseFeed(xml:string,source:FeedSource):NewsItem[] {
  const items:NewsItem[]=[];
  for(const match of xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)) {
    const item=match[1];
    const title=plainText(tag(item,"title"));
    const rawUrl=plainText(tag(item,"link"));
    const publishedAt=plainText(tag(item,"pubDate")||tag(item,"dc:date"));
    const summary=plainText(tag(item,"description")).slice(0,140);
    try {
      const url=new URL(rawUrl);
      if(url.hostname!==source.allowedHost||!title) continue;
      if(url.protocol==="http:") url.protocol="https:";
      items.push({title,summary:summary ? `${summary}${summary.length===140?"…":""}` : "원문에서 자세한 소식을 확인해 보세요.",url:url.toString(),publishedAt,source:source.name,tone:source.tone,markUrl:source.markUrl});
    } catch {}
  }
  return items;
}

async function limitedText(response:Response,maxBytes=1_000_000) {
  const declared=Number(response.headers.get("content-length"));
  if(Number.isFinite(declared)&&declared>maxBytes)return null;
  if(!response.body)return "";
  const reader=response.body.getReader(),chunks:Uint8Array[]=[];let size=0;
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxBytes){void reader.cancel().catch(()=>{});return null;}chunks.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  return new TextDecoder().decode(bytes);
}

async function loadSource(source:FeedSource) {
  const response=await fetch(source.url,{headers:{accept:"application/rss+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.1"},signal:AbortSignal.timeout(8_000)}).catch(()=>null);
  if(!response?.ok) return [];
  const xml=await limitedText(response);return xml===null?[]:parseFeed(xml,source);
}

const MAX_PER_SOURCE=2;

function capPerSource(items:NewsItem[],limit:number) {
  const counts=new Map<string,number>();
  const result:NewsItem[]=[];
  for(const item of items) {
    const count=counts.get(item.source)||0;
    if(count>=limit) continue;
    counts.set(item.source,count+1);
    result.push(item);
  }
  return result;
}

export async function GET() {
  const settled=await Promise.allSettled(sources.map(loadSource));
  const items=capPerSource(
    settled.flatMap((result)=>result.status==="fulfilled"?result.value:[])
      .sort((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt)),
    MAX_PER_SOURCE,
  ).slice(0,50);
  const cacheControl=items.length?"public, max-age=300, s-maxage=900, stale-while-revalidate=21600":"no-store";
  return Response.json({items,sources:sources.map(({name,url,homepage})=>({name,rssUrl:url,homepage}))},{headers:{"cache-control":cacheControl}});
}
