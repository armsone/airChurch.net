type FeedSource={name:string;url:string;homepage:string;allowedHost:string;tone:string};
type NewsItem={title:string;summary:string;url:string;publishedAt:string;source:string;tone:string};

const sources:FeedSource[]=[
  {name:"뉴스앤조이",url:"https://www.newsnjoy.or.kr/rss/allArticle.xml",homepage:"https://www.newsnjoy.or.kr/",allowedHost:"www.newsnjoy.or.kr",tone:"forest"},
  {name:"아이굿뉴스",url:"https://www.igoodnews.net/rss/allArticle.xml",homepage:"https://www.igoodnews.net/",allowedHost:"www.igoodnews.net",tone:"clay"},
  {name:"기독신문",url:"https://www.kidok.com/rss/allArticle.xml",homepage:"https://www.kidok.com/",allowedHost:"www.kidok.com",tone:"sky"},
  {name:"기독공보",url:"https://www.pckworld.com/rss/allArticle.xml",homepage:"https://www.pckworld.com/",allowedHost:"www.pckworld.com",tone:"lavender"},
  {name:"데일리굿뉴스",url:"https://www.goodnews1.com/rss/allArticle.xml",homepage:"https://www.goodnews1.com/",allowedHost:"www.goodnews1.com",tone:"forest"},
  {name:"주간기독교",url:"https://www.cnews.or.kr/rss/allArticle.xml",homepage:"https://www.cnews.or.kr/",allowedHost:"www.cnews.or.kr",tone:"clay"},
  {name:"한국성결신문",url:"https://www.kehcnews.co.kr/rss/allArticle.xml",homepage:"https://www.kehcnews.co.kr/",allowedHost:"www.kehcnews.co.kr",tone:"sky"},
  {name:"당당뉴스",url:"https://www.dangdangnews.com/rss/allArticle.xml",homepage:"https://www.dangdangnews.com/",allowedHost:"www.dangdangnews.com",tone:"lavender"},
  {name:"교회와신앙",url:"https://www.amennews.com/rss/allArticle.xml",homepage:"https://www.amennews.com/",allowedHost:"www.amennews.com",tone:"forest"},
  {name:"뉴스M",url:"https://www.newsm.com/rss/allArticle.xml",homepage:"https://www.newsm.com/",allowedHost:"www.newsm.com",tone:"clay"},
  {name:"교회갱신협의회",url:"https://www.churchr.or.kr/rss/allArticle.xml",homepage:"https://www.churchr.or.kr/",allowedHost:"www.churchr.or.kr",tone:"sky"},
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
      items.push({title,summary:summary ? `${summary}${summary.length===140?"…":""}` : "원문에서 자세한 소식을 확인해 보세요.",url:url.toString(),publishedAt,source:source.name,tone:source.tone});
    } catch {}
  }
  return items;
}

async function loadSource(source:FeedSource) {
  const response=await fetch(source.url,{headers:{accept:"application/rss+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.1"}});
  if(!response.ok) return [];
  return parseFeed(await response.text(),source);
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
  ).slice(0,40);
  return Response.json({items,sources:sources.map(({name,url,homepage})=>({name,rssUrl:url,homepage}))},{headers:{"cache-control":"public, max-age=300, s-maxage=900, stale-while-revalidate=21600"}});
}
