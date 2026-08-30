type FeedSource={name:string;url:string;allowedHost:string;tone:string};
type NewsItem={title:string;summary:string;url:string;publishedAt:string;source:string;tone:string};

const sources:FeedSource[]=[
  {name:"뉴스앤조이",url:"https://www.newsnjoy.or.kr/rss/allArticle.xml",allowedHost:"www.newsnjoy.or.kr",tone:"forest"},
  {name:"아이굿뉴스",url:"https://www.igoodnews.net/rss/allArticle.xml",allowedHost:"www.igoodnews.net",tone:"clay"},
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
    const publishedAt=plainText(tag(item,"pubDate"));
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
  const response=await fetch(source.url,{headers:{accept:"application/rss+xml, application/xml;q=0.9, text/xml;q=0.8"}});
  if(!response.ok) return [];
  return parseFeed(await response.text(),source);
}

export async function GET() {
  const settled=await Promise.allSettled(sources.map(loadSource));
  const items=settled.flatMap((result)=>result.status==="fulfilled"?result.value:[])
    .sort((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt))
    .slice(0,8);
  return Response.json({items},{headers:{"cache-control":"public, max-age=300, s-maxage=900, stale-while-revalidate=21600"}});
}
