// One-shot public source qualification using the production parsers.
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=new Set(process.argv.slice(2)),output=path.join(root,'outputs/source-expansion');
await mkdir(output,{recursive:true});
const compiled=await build({stdin:{contents:`export * from './app/events/source-reader'; export * from './app/events/extract'; export {officialEventSources,eventSourceCandidates} from './app/events/sources'; export {sources as newsSources,parseFeed} from './app/news/feed';`,resolveDir:root,loader:'ts'},bundle:true,write:false,platform:'node',format:'esm',logLevel:'silent'});
const api=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'));
const seeds=args.has('--leads-only')?(JSON.parse(await readFile(path.join(output,'discovered-links.json'),'utf8')).leads||[]).map(lead=>({type:'event',source:{id:'lead-'+createHash('sha256').update(api.host(lead.url)).digest('hex').slice(0,12),name:lead.name,homepage:new URL(lead.url).origin+'/',url:lead.url,detailPattern:''}})):JSON.parse(await readFile(path.join(root,'data/content-source-candidates.json'),'utf8'));
if(!args.has('--leads-only'))for(const candidate of api.eventSourceCandidates)if(!seeds.some(s=>api.host(s.source.homepage)===api.host(candidate.url)))seeds.push({type:'event',source:{id:'candidate-'+createHash('sha256').update(candidate.url).digest('hex').slice(0,12),name:candidate.name,homepage:new URL(candidate.url).origin+'/',url:candidate.url,detailPattern:''}});
const generatedPath=path.join(root,'data/qualified-content-sources.json');
const generated=JSON.parse(await readFile(generatedPath,'utf8'));
const registered=new Set([...api.officialEventSources,...api.newsSources].map(s=>api.host(s.homepage)));
const only=process.argv.find(x=>x.startsWith('--only='))?.slice(7).split(',');
const includeExisting=!args.has('--candidates-only')&&!args.has('--leads-only');
const jobs=[...(includeExisting?api.officialEventSources.map(source=>({type:'event',source,existing:true})):[]),...(includeExisting?api.newsSources.map(source=>({type:'news',source,existing:true})):[]),...seeds.filter(s=>!registered.has(api.host(s.source.homepage)))].filter(job=>!only||only.includes(job.source.id)||only.includes(job.source.name));
const report={startedAt:new Date().toISOString(),finishedAt:null,concurrency:6,apply:args.has('--apply'),total:jobs.length,results:[]};
let previous={results:[]};try{previous=JSON.parse(await readFile(path.join(output,'checkpoint.json'),'utf8'));}catch{try{previous=JSON.parse(await readFile(path.join(output,'report.json'),'utf8'));}catch{}}
const policyHash=createHash('sha256').update((await Promise.all(['scripts/expand-content-sources.mjs','app/events/source-reader.ts','app/events/extract.ts','app/news/feed.ts'].map(p=>readFile(path.join(root,p),'utf8')))).join('\n')).digest('hex');
const fingerprint=job=>createHash('sha256').update(policyHash+JSON.stringify(job)).digest('hex');
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const hostLocks=new Map(),rulesCache=new Map(),lastRequests=new Map();let writeQueue=Promise.resolve();
function save(){const body=JSON.stringify(report,null,2),checkpoint=JSON.stringify({results:[...new Map([...previous.results,...report.results].map(r=>[r.key,r])).values()]});writeQueue=writeQueue.then(async()=>{await writeFile(path.join(output,'report.tmp'),body);await rename(path.join(output,'report.tmp'),path.join(output,'report.json'));await writeFile(path.join(output,'checkpoint.tmp'),checkpoint);await rename(path.join(output,'checkpoint.tmp'),path.join(output,'checkpoint.json'));});return writeQueue;}
function assertPublic(raw){const u=new URL(raw);if(!/^https?:$/.test(u.protocol)||u.username||u.password||u.port||!u.hostname.includes('.')||/^[\d.:\[\]]+$/.test(u.hostname)||/(?:^|\.)(localhost|local|internal|test)$/.test(u.hostname))throw Error('public_source_required');}
function inferPattern(url){const u=new URL(url);for(const key of ['wr_id','idx','idxno','vid','uid','seq','no','bbs_num'])if(/^\d+$/.test(u.searchParams.get(key)||''))return u.pathname.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\?(?=[^#]*'+key+'=\\d+)';if(/\/(?:Board\/Detail|seminar\/post|bbs\/bbsView)\//i.test(u.pathname))return u.pathname.replace(/\d+$/,'\\d+')+'(?:[/?#]|$)';return null;}
async function inspect(job){
  const source={...job.source,kind:job.type==='news'?'rss':'official'};assertPublic(source.url);assertPublic(source.homepage);
  const details=[],requests=[],resolved=new Map();let delay=1000;
  const pace=async()=>{const domain=api.host(source.homepage);await wait(Math.max(0,delay-(Date.now()-(lastRequests.get(domain)||0))));lastRequests.set(domain,Date.now());};
  async function get(url){
    assertPublic(url);const origin=new URL(url).origin;let rules=rulesCache.get(origin);
    if(!rules){const r=await api.boundedFetch(new URL('/robots.txt',origin).href,source,pace);if(![200,404].includes(r.status))throw Error('robots_http_'+r.status);rules={text:r.text,status:r.status};rulesCache.set(origin,rules);}
    delay=Math.max(delay,api.robotsDelay(rules.text));if(delay>60000)throw Error('crawl_delay_over_batch_limit');
    if(!api.robotsAllowed(rules.text,url))throw Error('robots_disallowed');
    const r=await api.boundedFetch(url,source,pace,rules.text);resolved.set(url,r.finalUrl);requests.push({url,status:r.status,bytes:r.text.length});
    if(r.status!==200)throw Error('http_'+r.status);
    const title=api.plain(r.text.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||'');
    if(/^(?:access denied|forbidden|just a moment|보안 확인)/i.test(title)||(r.text.length<10000&&/document\.cookie|captcha.*(?:verify|challenge)|접근이?\s*(?:제한|차단)/i.test(r.text)))throw Error('access_challenge');
    return r.text;
  }
  try{
    const html=await get(source.url);
    if(job.type==='news'){
      const items=api.parseFeed(html,source);if(!items.length)throw Error('feed_no_valid_articles');
      const latest=items.map(x=>x.publishedAt).sort().at(-1);if(Date.now()-Date.parse(latest)>90*86400000)throw Error('feed_stale_over_90_days');
      if(!job.existing){let home=await get(source.homepage);if(job.identityEvidence&&api.host(job.identityEvidence)===api.host(source.homepage)&&job.identityEvidence!==source.homepage)home+='\n'+await get(job.identityEvidence);const channelTitle=api.plain(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||'');if(!home.includes(source.url)&&!home.includes(new URL(source.url).pathname)&&!(channelTitle.includes(source.name)&&api.host(source.url)===api.host(source.homepage)))throw Error('official_feed_link_unconfirmed');}
      return {status:job.existing?'healthy':delay>10000?'adapter_review':job.identityEvidence?'qualified':'identity_review',articleCount:items.length,latest,config:source,requests,delay};
    }
    if(!job.existing&&job.identityEvidence){
      if(api.host(job.identityEvidence)!==api.host(source.homepage))throw Error('identity_source_mismatch');
      const identity=job.identityEvidence===source.url?html:await get(job.identityEvidence);
      if(api.plain(identity).length<100)throw Error('identity_document_unconfirmed');
    }
    let found=source.detailPattern?await api.discover(source,html,resolved.get(source.url)):api.links(html,resolved.get(source.url)||source.url).filter(x=>api.host(x.url)===api.host(source.url)&&api.eventWords.test(x.title));
    if(args.has('--leads-only')&&!source.detailPattern){
      source.listingUrls=api.links(html,resolved.get(source.url)||source.url).filter(x=>api.host(x.url)===api.host(source.url)&&/^(?:공지사항|공지|소식|행사|행사안내|교육안내|세미나|주요행사|새소식|알림마당)$/.test(x.title)&&x.url!==source.url).slice(0,2).map(x=>x.url);
    }
    for(const url of (source.listingUrls||[]).slice(0,2)){try{const doc=await get(url),base=resolved.get(url)||url;found.push(...(source.detailPattern?await api.discover(source,doc,base):api.links(doc,base).filter(x=>api.host(x.url)===api.host(source.url)&&api.eventWords.test(x.title))));}catch(error){details.push({url,reason:String(error.message)});}}
    const score=item=>api.eventPriority(item.title)+(/20\d{2}/.test(item.title)?2:0);
    found=[...new Map(found.map(x=>[x.url,x])).values()].sort((a,b)=>score(b)-score(a));
    if(!found.length)throw Error('listing_no_matches');let verified=null;
    for(const item of found.slice(0,job.existing?2:5)){
      try{
        const request=new URL(item.url);if(source.id==='sarang')request.pathname='/info/notice_view.asp';
        const doc=source.singlePage?html:await get(request.href),entries=api.extractScheduleEntries(doc,source);
        const extracted=entries.length?entries[0]:api.extractEvent(doc,item.url,source,item.title);
        details.push({url:item.url,title:extracted.title,reason:extracted.reason,event:extracted.event});
        if(extracted.event){verified={url:item.url,event:extracted.event};if(!source.detailPattern)source.detailPattern=inferPattern(item.url);break;}
      }catch(error){details.push({url:item.url,reason:String(error.message)});}
    }
    return {status:verified?(job.existing?'verified':job.identityEvidence&&source.detailPattern&&delay<=10000?'qualified':'adapter_review'):'facts_review',listingCount:found.length,verified,details,config:source,requests,delay};
  }catch(error){return {status:/robots_disallowed|access_challenge/.test(error.message)?'excluded':'failed',reason:error.message,requests,details,delay};}
}
let at=0;
await Promise.all(Array.from({length:6},async()=>{while(at<jobs.length){const job=jobs[at++],key=fingerprint(job),domain=api.host(job.source.homepage);const cached=previous.results.find(r=>r.key===key&&Date.now()-Date.parse(r.checkedAt)<4*3600000&&r.reason!=='access_challenge'&&(!args.has('--retry-failed')||!['failed','facts_review','adapter_review'].includes(r.status)));
  const earlier=hostLocks.get(domain)||Promise.resolve();let release;hostLocks.set(domain,new Promise(r=>{release=r;}));await earlier;
  let result;try{result=cached?{...cached,cached:true}:{...await inspect(job),key,checkedAt:new Date().toISOString(),name:job.source.name,type:job.type,existing:!!job.existing,identityEvidence:job.identityEvidence||null};}finally{release();}
  report.results.push(result);console.log(`[${report.results.length}/${jobs.length}] ${job.source.name}: ${result.status}${result.reason?' — '+result.reason:''}${result.cached?' (cached)':''}`);await save();
}}));
if(args.has('--apply')){
  for(const row of report.results.filter(r=>r.status==='qualified'&&!r.existing)){
    const list=row.type==='news'?generated.news:generated.events;
    if([...api.officialEventSources,...api.newsSources,...generated.news,...generated.events].some(s=>api.host(s.homepage)===api.host(row.config.homepage)))continue;
    list.push(row.config);
  }
  // Only the generated registry is writable; existing configuration is preserved.
  const temporary=generatedPath+'.tmp';
  await writeFile(temporary,JSON.stringify(generated,null,2)+'\n');
  await rename(temporary,generatedPath);
}
report.finishedAt=new Date().toISOString();report.summary=report.results.reduce((a,r)=>(a[r.status]=(a[r.status]||0)+1,a),{});await save();
console.log(JSON.stringify({finishedAt:report.finishedAt,summary:report.summary,registeredEvents:generated.events.length,registeredNews:generated.news.length,report:'outputs/source-expansion/report.json'}));
