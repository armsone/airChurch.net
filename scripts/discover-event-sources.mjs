// Discover public leads from known official sites; never auto-register a lead.
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {build} from 'esbuild';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.join(root,'outputs/source-expansion');
await mkdir(output,{recursive:true});
const compiled=await build({stdin:{contents:`export * from './app/events/source-reader'; export {links} from './app/events/extract'; export {officialEventSources} from './app/events/sources'; export {sources as newsSources} from './app/news/feed';`,resolveDir:root},bundle:true,write:false,platform:'node',format:'esm',logLevel:'silent'});
const api=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'));
const known=new Set([...api.officialEventSources,...api.newsSources].flatMap(x=>[api.host(x.homepage),api.host(x.url)]));
const file=path.join(output,'discovered-links.json');
let previous={pages:[]};try{previous=JSON.parse(await readFile(file,'utf8'));}catch{}
const limit=Math.min(100,Math.max(1,Number(process.argv.find(x=>x.startsWith('--limit='))?.slice(8))||60));
const sources=[...new Map(api.officialEventSources.map(s=>[api.host(s.homepage),s])).values()].slice(0,limit);
const report={startedAt:new Date().toISOString(),finishedAt:null,pages:[],leads:[]};
const isPublic=url=>{try{const u=new URL(url);return /^https?:$/.test(u.protocol)&&!u.username&&!u.password&&!u.port&&u.hostname.includes('.')&&!/^[\d.:\[\]]+$/.test(u.hostname)&&!/(?:^|\.)(localhost|local|internal|test)$/.test(u.hostname);}catch{return false;}};
const relevant=/선교|신학|기독|성서|성경|연합|협회|연구원|교육원|출판|문화원|아트|공연|세미나|캠프|훈련|센터|운동|청년|청소년|복음|교단|노회/;
const excluded=/(?:^|\.)(?:google\.[a-z.]+|naver\.com|daum\.net|kakao\.com|youtube\.com|youtu\.be|facebook\.com|instagram\.com|twitter\.com|x\.com|tistory\.com|cafe24\.com|imweb\.me|onmam\.com)$/;
let at=0;
await Promise.all(Array.from({length:3},async()=>{while(at<sources.length){
  const source=sources[at++],cached=previous.pages.find(x=>x.url===source.homepage&&Date.now()-Date.parse(x.checkedAt)<4*3600000);
  if(cached){report.pages.push({...cached,cached:true});continue;}
  const row={name:source.name,url:source.homepage,checkedAt:new Date().toISOString(),status:'pending',leads:[]};
  try{
    if(!isPublic(source.homepage))throw Error('public_source_required');
    const config={...source,url:source.homepage,kind:'official'};
    const rules=await api.boundedFetch(new URL('/robots.txt',source.homepage).href,config);
    if(![200,404].includes(rules.status))throw Error('robots_unavailable');
    if(!api.robotsAllowed(rules.text,source.homepage))throw Error('robots_disallowed');
    const delay=api.robotsDelay(rules.text);if(delay>10000)throw Error('crawl_delay_over_limit');
    const page=await api.boundedFetch(source.homepage,config,()=>new Promise(resolve=>setTimeout(resolve,delay)),rules.text);
    if(page.status!==200)throw Error('http_'+page.status);
    row.leads=api.links(page.text,page.finalUrl).filter(x=>isPublic(x.url)&&relevant.test(x.title)&&!known.has(api.host(x.url))&&!excluded.test(api.host(x.url))).map(x=>({name:x.title.slice(0,180),url:x.url,discoveredFrom:source.homepage,reviewStatus:'unverified'}));
    row.leads=[...new Map(row.leads.map(x=>[api.host(x.url),x])).values()].slice(0,40);
    row.status='read';
  }catch(error){row.status='unavailable';row.reason=String(error.message).slice(0,180);}
  report.pages.push(row);console.log(`[${report.pages.length}/${sources.length}] ${row.name}: ${row.status}, ${row.leads.length} leads`);
}}));
report.leads=[...new Map(report.pages.flatMap(x=>x.leads).map(x=>[api.host(x.url),x])).values()];
report.finishedAt=new Date().toISOString();
await writeFile(file+'.tmp',JSON.stringify(report,null,2)+'\n');await rename(file+'.tmp',file);
console.log(JSON.stringify({pages:report.pages.length,unverifiedLeads:report.leads.length,report:'outputs/source-expansion/discovered-links.json'}));
