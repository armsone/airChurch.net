import { sourceDateReviewReason } from "./source-date-review";
import { extractParticipation, verifiedParticipationAudience } from "./participation";
import { verifiedEventChurchPublicId } from "./church-source";
import { boundedFetch as fetchSource, robotsAllowed, robotsDelay, discover, nextListing, isDetail } from "./source-reader";
import { database } from "../api/_shared";
import { sources as newsSources } from "../news/feed";
import { officialEventSources, additionalDiscoverySources, type SourceConfig } from "./sources";
import { eventWords, eventPriority, extractEvent, extractScheduleEntries, links, noticeStatus, plain } from "./extract";
import { koreaDate } from "./types";

const COLLECTOR_VERSION=24;
export const collectionSources:SourceConfig[]=[...officialEventSources,...additionalDiscoverySources,...newsSources.map((s,i)=>({id:`news-${i}`,name:s.name,homepage:s.homepage,url:s.url,kind:"rss" as const,detailPattern:""})).filter(s=>!additionalDiscoverySources.some(other=>other.homepage.replace(/\/$/,"")===s.homepage.replace(/\/$/,"")))];
const host=(url:string)=>new URL(url).hostname.replace(/^www\./,"");
export async function digest(value:string){return [...new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value)))].map(x=>x.toString(16).padStart(2,"0")).join("");}
function after(hours:number){return new Date(Date.now()+hours*3600000).toISOString();}
async function pool<T>(items:T[],limit:number,fn:(x:T)=>Promise<void>){let at=0;await Promise.all(Array.from({length:Math.min(limit,items.length)},async()=>{while(at<items.length)await fn(items[at++]);}));}
async function enqueue(source:SourceConfig,items:Array<{url:string;title:string}>,now:string){
  const db=database();const statements=await Promise.all(items.slice(0,150).map(async item=>db.prepare("INSERT INTO event_candidates(id,source_id,url,title,evidence,content_hash,status,first_seen_at,last_seen_at) VALUES(?,?,?,?,?,'','discovered',?,?) ON CONFLICT(id) DO UPDATE SET last_seen_at=excluded.last_seen_at,title=CASE WHEN length(excluded.title)>2 THEN excluded.title ELSE event_candidates.title END").bind((await digest(`${source.id}|${item.url}`)).slice(0,32),source.id,item.url,item.title.slice(0,180),"",now,now)));
  for(let i=0;i<statements.length;i+=40)await db.batch(statements.slice(i,i+40));
}
async function processSource(source:SourceConfig){
  const db=database(),now=new Date().toISOString(),token=crypto.randomUUID(),started=Date.now();
  const claim=await db.prepare("UPDATE event_sources SET lease_token=?,lease_until=?,status='running',last_checked_at=? WHERE id=? AND enabled=1 AND next_check_at<=? AND (lease_until IS NULL OR lease_until<?)").bind(token,after(0.25),now,source.id,now,now).run();
  if(Number(claim.meta.changes)!==1)return;
  // One retry per source, not per URL. Keep the same crawler, permissions and
  // 22-second batch budget; denied responses and parser failures are not retried.
  let retries=1;
  const boundedFetch=async(...args:Parameters<typeof fetchSource>):ReturnType<typeof fetchSource>=>{
    try{return await fetchSource(...args);}catch(error){
      if(!retries||Date.now()-started>=14_000||!(error instanceof Error)||!(error.name==="TimeoutError"||(error instanceof TypeError&&error.message==="fetch failed")))throw error;
      retries--;await new Promise(resolve=>setTimeout(resolve,1000));return fetchSource(...args);
    }
  };
  try{
    const robots=await boundedFetch(new URL("/robots.txt",source.url).href,source);
    if(robots.status!==404&&robots.status!==200)throw Error("robots_unavailable");
    if(!robotsAllowed(robots.text,source.url))throw Error("robots_disallowed");
    // Only rules addressed to our crawler (or *) apply; Bing's delay is not ours.
    let delay=robotsDelay(robots.text);
    if(!Number.isFinite(delay)||delay>10000)throw Error("crawl_delay_requires_separate_schedule");
    let previous=Date.now();const pace=async()=>{await new Promise(resolve=>setTimeout(resolve,Math.max(0,delay-(Date.now()-previous))));previous=Date.now();};
    const page=await boundedFetch(source.url,source,pace,robots.text);if(page.status!==200)throw Error(`source_http_${page.status}`);
    if(source.kind==="rss"&&!source.detailPattern&&!/<(?:rss|feed|rdf:RDF)\b/i.test(page.text))throw Error("rss_document_required");
    const found=await discover(source,page.text,page.finalUrl);
    // Keep bounded public-response diagnostics when a listing yields no links.
    // This distinguishes a changed board from an empty or substituted response.
    const listingDiagnostics=(html:string)=>`${html.length}c/${links(html,source.url).length}a/${plain(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]||"").slice(0,35)}`;
    const listingChecks=[listingDiagnostics(page.text)];
    let nextScan=nextListing(source,page.text,page.finalUrl);
    const state=await db.prepare("SELECT scan_url AS scanUrl FROM event_sources WHERE id=?").bind(source.id).first<{scanUrl:string|null}>();
    const extraPages=[...(source.listingUrls||[]),...(state?.scanUrl?[state.scanUrl]:[])];
    for(const url of [...new Set(extraPages)].slice(0,3)){try{if(Date.now()-started>25000)break;const extra=await boundedFetch(url,source,pace,robots.text);listingChecks.push(extra.status===200?listingDiagnostics(extra.text):`http_${extra.status}`);if(extra.status!==200)continue;found.push(...await discover(source,extra.text,extra.finalUrl));if(url===state?.scanUrl)nextScan=nextListing(source,extra.text,extra.finalUrl);}catch(error){listingChecks.push(String(error).slice(0,45));/* First-page discovery still proceeds when an older page is unavailable. */}}
    await enqueue(source,found,now);
    // Oldest checked candidates first: subsequent batches cover the queue, not just the latest few posts.
    const queue=await db.prepare("SELECT id,url,title,event_id AS eventId,checked_at AS checkedAt FROM event_candidates WHERE source_id=? AND (checked_at IS NULL OR checked_at<CASE WHEN status IN ('ignored','ended') THEN ? ELSE ? END) AND (last_seen_at>? OR event_id IS NOT NULL) ORDER BY COALESCE(checked_at,''),first_seen_at DESC LIMIT 500").bind(source.id,after(-168),after(-4),after(-24*30)).all<{id:string;url:string;title:string;eventId:string|null;checkedAt:string|null}>();
    const position=new Map(found.map((item,index)=>[item.url,index]));
    const score=(candidate:typeof queue.results[number])=>candidate.eventId&&source.id==="jiguchon"&&new URL(candidate.url).searchParams.get("wr_id")==="1164"?-2000000:candidate.eventId?-1000000:(3-eventPriority(candidate.title))*1000+(position.get(candidate.url)??500);
    queue.results.sort((a,b)=>score(a)-score(b)||(a.checkedAt||"").localeCompare(b.checkedAt||""));
    let failed=0,blocked=0,processed=0,fetched=0,parseIssues=0;
    let articleRobots=robots.text;
    if(source.kind==="rss"&&host(source.homepage)!==host(source.url)){
      const rules=await boundedFetch(new URL("/robots.txt",source.homepage).href,source,pace);
      if(rules.status!==200&&rules.status!==404)throw Error("article_robots_unavailable");
      articleRobots=rules.text;
      delay=Math.max(delay,robotsDelay(articleRobots));
      if(!Number.isFinite(delay)||delay>5000)throw Error("article_crawl_delay_requires_separate_schedule");
    }
    const documentCache=new Map<string,{text:string;status:number}>();
    for(const candidate of queue.results){
      // The remote scheduler's gateway closes long-lived requests at roughly 45
      // seconds. Stop this source early; the next 15-minute batch resumes its
      // remaining queue from the saved checkpoint.
      const canonical=new URL(candidate.url);canonical.hash="";
      if(source.id==="sarang")canonical.pathname="/info/notice_view.asp";
      // Sessions from one already-read notice add no upstream requests. Finish
      // those together while retaining the request and wall-clock budgets.
      if(processed>=20||Date.now()-started>22_000||(!documentCache.has(canonical.href)&&fetched>=(delay>5000?1:5)))break;
      if(source.kind==="official"&&!isDetail(source,candidate.url)){await db.prepare("UPDATE event_candidates SET status='ignored',reason='outside_event_board',checked_at=? WHERE id=?").bind(now,candidate.id).run();continue;}
      processed++;
      if(!robotsAllowed(articleRobots,candidate.url)){blocked++;await db.prepare("UPDATE event_candidates SET status='blocked',reason=CASE WHEN reason LIKE 'event_parse_review:%' OR reason='official_date_conflict' THEN reason ELSE 'robots_disallowed' END,checked_at=? WHERE id=?").bind(now,candidate.id).run();continue;}
      let doc;try{
        // This is the same public fragment loaded by the notice viewer. Both
        // the permalink above and this fetch must pass the source's robots rules.
        const requestUrl=new URL(candidate.url);
        if(source.id==="sarang")requestUrl.pathname="/info/notice_view.asp";
        requestUrl.hash="";
        doc=documentCache.get(requestUrl.href);if(!doc){fetched++;doc=await boundedFetch(requestUrl.href,source,pace,articleRobots);}if(doc.status!==200)throw Error(`detail_http_${doc.status}`);
        documentCache.set(requestUrl.href,doc);
      }catch(error){failed++;await db.prepare("UPDATE event_candidates SET status='failed',reason=CASE WHEN reason LIKE 'event_parse_review:%' OR reason='official_date_conflict' THEN reason ELSE ? END,checked_at=? WHERE id=?").bind(String(error).slice(0,180),now,candidate.id).run();continue;}
      if(source.kind==="rss"){
        for(const official of officialEventSources){const references=links(doc.text,candidate.url).filter(x=>isDetail(official,x.url));if(references.length)await enqueue(official,references,now);}
        await db.prepare("UPDATE event_candidates SET status='discovery_only',checked_at=? WHERE id=?").bind(now,candidate.id).run();continue;
      }
      const entries=extractScheduleEntries(doc.text,source),occurrence=new URL(candidate.url).hash.replace(/^#occurrence=/,"");
      if(entries.length&&!occurrence){
        const children=entries.map(entry=>({url:`${candidate.url}#occurrence=${entry.key}`,title:entry.title}));
        await enqueue(source,children,now);
        await db.prepare("UPDATE event_candidates SET status='discovery_only',checked_at=? WHERE id=?").bind(now,candidate.id).run();
        // Process newly discovered sessions in this bounded batch using the same
        // document, instead of waiting for another scheduler tick or refetching it.
        const saved=await db.prepare("SELECT id,url,title,event_id AS eventId,checked_at AS checkedAt FROM event_candidates WHERE source_id=? AND url IN (SELECT value FROM json_each(?))").bind(source.id,JSON.stringify(children.map(item=>item.url))).all<typeof queue.results[number]>();
        const fresh=saved.results.filter(item=>!queue.results.some(row=>row.url===item.url));
        queue.results.splice(queue.results.indexOf(candidate)+1,0,...fresh);continue;
      }
      const extracted=occurrence?(entries.find(entry=>entry.key===occurrence)||{event:null,title:candidate.title,evidence:"",reason:"occurrence_removed_or_changed"}):extractEvent(doc.text,candidate.url,source,candidate.title);
      const value=extracted.event?{...extracted.event,participation:extractParticipation(doc.text,source.id,candidate.url)}:null;
      if(value&&value.audience==="대상 확인 필요"){
        const audience=verifiedParticipationAudience(source.id,candidate.url,value.participation);
        if(audience)value.audience=audience;
      }
      const verifiedPublicId=value?verifiedEventChurchPublicId(source,candidate.url,value.organizer):null;
      if(value&&verifiedPublicId&&value.organizer==="주최 확인 필요")value.organizer=source.churchName!;
      const reviewedConflict=sourceDateReviewReason(doc.text,source.id,candidate.url);
      if(reviewedConflict)parseIssues++;
      const hash=await digest(JSON.stringify(value??extracted.evidence));
      const notice=noticeStatus(`${extracted.title}\n${extracted.evidence}`);
      if(notice&&candidate.eventId)await db.prepare("UPDATE events SET status=?,updated_at=?,checked_at=? WHERE id=? AND source_url=?").bind(notice,now,now,candidate.eventId,candidate.url).run();
      if(!value){
        const requiresReview=Boolean(candidate.eventId&&!notice&&extracted.reason!=="not_an_upcoming_event");
        if(requiresReview)parseIssues++;
        await db.batch([
        db.prepare("UPDATE event_candidates SET evidence=?,content_hash=?,status=?,reason=?,checked_at=? WHERE id=?").bind(extracted.evidence,hash,extracted.reason==="not_an_upcoming_event"?"ignored":"checking",requiresReview?`event_parse_review:${extracted.reason}`:extracted.reason,now,candidate.id),
        db.prepare("UPDATE events SET status='checking',updated_at=? WHERE id=? AND source_url=? AND status!='cancelled'").bind(now,candidate.eventId,candidate.url),
      ]);continue;}
      if(value.startDate>koreaDate(new Date(Date.now()+366*86400000))){await db.prepare("UPDATE event_candidates SET status='checking',reason='outside_collection_window',checked_at=? WHERE id=?").bind(now,candidate.id).run();continue;}
      const identity=[value.title,value.startDate,value.organizer,value.venue,...(occurrence?[value.startTime||""]:[])].map(x=>x.normalize("NFKC").replace(/\s+/g,"").toLowerCase()).join("|");
      const eventId=candidate.eventId||(await digest(identity)).slice(0,32);
      const church=verifiedPublicId?await db.prepare("SELECT id FROM churches WHERE public_id=? AND name=? AND review_status='approved' LIMIT 2").bind(verifiedPublicId,source.churchName).all<{id:number}>():!source.churchPublicId&&source.churchName&&value.organizer.replace(/\s/g,"")===source.churchName.replace(/\s/g,"")?await db.prepare("SELECT id FROM churches WHERE name=? AND review_status='approved' LIMIT 2").bind(source.churchName).all<{id:number}>():null;
      const churchId=church?.results.length===1?church.results[0].id:null;
      const existing=await db.prepare("SELECT source_url AS url,content_hash AS hash FROM events WHERE id=?").bind(eventId).first<{url:string;hash:string}>();
      // A secondary source never rewrites the primary source's facts or provenance.
      if(existing&&existing.url!==candidate.url){const conflict=existing.hash!==hash;await db.prepare("UPDATE event_candidates SET event_id=?,evidence=?,content_hash=?,payload=?,status=?,reason=?,checked_at=? WHERE id=?").bind(eventId,extracted.evidence,hash,JSON.stringify(value),conflict?"checking":"corroborated",conflict?"conflicting_official_sources":null,now,candidate.id).run();if(conflict)await db.prepare("UPDATE events SET status='checking',updated_at=? WHERE id=? AND status!='cancelled'").bind(now,eventId).run();continue;}
      const conflict=await db.prepare("SELECT id FROM event_candidates WHERE event_id=? AND id!=? AND reason='conflicting_official_sources' AND content_hash!=? LIMIT 1").bind(eventId,candidate.id,hash).first();
      const status=value.status==="cancelled"?"cancelled":value.status==="checking"||conflict||reviewedConflict?"checking":value.endDate<koreaDate()?"ended":value.status;
      if(!existing&&status!=="published"){await db.prepare("UPDATE event_candidates SET evidence=?,content_hash=?,payload=?,status=?,reason='not_public',checked_at=? WHERE id=?").bind(extracted.evidence,hash,JSON.stringify(value),status,now,candidate.id).run();continue;}
      await db.batch([
        db.prepare("INSERT INTO events(id,source_id,church_id,title,start_date,end_date,start_time,venue,region,attendance,organizer,audience,category,source_url,registration_url,status,checked_at,valid_until,content_hash,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET church_id=excluded.church_id,title=excluded.title,start_date=excluded.start_date,end_date=excluded.end_date,start_time=excluded.start_time,venue=excluded.venue,region=excluded.region,attendance=excluded.attendance,organizer=excluded.organizer,audience=excluded.audience,category=excluded.category,registration_url=excluded.registration_url,status=excluded.status,checked_at=excluded.checked_at,valid_until=excluded.valid_until,content_hash=excluded.content_hash,updated_at=excluded.updated_at").bind(eventId,source.id,churchId,value.title,value.startDate,value.endDate,value.startTime,value.venue,value.region,value.attendance,value.organizer,value.audience,value.category,candidate.url,value.registrationUrl,status,now,after(24),hash,now),
        db.prepare("UPDATE event_candidates SET event_id=?,title=?,evidence=?,content_hash=?,payload=?,status=?,reason=?,checked_at=? WHERE id=?").bind(eventId,value.title,extracted.evidence,hash,JSON.stringify(value),status,reviewedConflict||(conflict?"conflicting_official_sources":null),now,candidate.id),
      ]);
    }
    // A later healthy batch must not erase unresolved findings from an earlier one.
    const unresolved=await db.prepare("SELECT COUNT(*) AS n FROM event_candidates WHERE source_id=? AND event_id IS NOT NULL AND status IN ('checking','failed','blocked') AND (reason LIKE 'event_parse_review:%' OR reason='official_date_conflict')").bind(source.id).first<{n:number}>();
    parseIssues=Math.max(parseIssues,Number(unresolved?.n||0));
    const remaining=await db.prepare("SELECT COUNT(*) AS n FROM event_candidates WHERE source_id=? AND (checked_at IS NULL OR checked_at<CASE WHEN status IN ('ignored','ended') THEN ? ELSE ? END)").bind(source.id,after(-168),after(-4)).first<{n:number}>();
    await db.prepare("UPDATE event_sources SET status=?,last_success_at=CASE WHEN ?=0 THEN ? ELSE last_success_at END,next_check_at=?,lease_until=NULL,lease_token=NULL,failures=?,candidate_count=?,last_error=?,scan_url=? WHERE id=? AND lease_token=?").bind(failed?"failed":blocked?"blocked":parseIssues?"checking":found.length||source.kind==="rss"?"ok":"empty",failed+blocked+parseIssues,now,after(failed||blocked?4:remaining?.n?0.25:4),failed,new Set(found.map(item=>item.url)).size,failed?"detail_fetch_failed":blocked?"robots_disallowed":parseIssues?"event_details_require_review":!found.length&&source.kind==="official"?`listing_no_matches:${listingChecks.join(";")}`.slice(0,180):null,nextScan,source.id,token).run();
  }catch(error){console.warn("event_source_failed",source.id,String(error).slice(0,180));const state=await db.prepare("SELECT failures FROM event_sources WHERE id=?").bind(source.id).first<{failures:number}>();await db.prepare("UPDATE event_sources SET status=?,next_check_at=?,lease_until=NULL,lease_token=NULL,failures=failures+1,last_error=? WHERE id=? AND lease_token=?").bind(/robots_disallowed|access_challenge/.test(String(error))?"blocked":"failed",after(Math.min(24,2**Math.min(5,(state?.failures||0)+1))),String(error).slice(0,180),source.id,token).run();}
}
export async function syncEvents(requestedSource?:string){
  if(requestedSource&&!collectionSources.some(source=>source.id===requestedSource))throw Error("unknown_event_source");
  const db=database(),now=new Date().toISOString();
  const seeds=collectionSources.map(s=>db.prepare("INSERT INTO event_sources(id,name,homepage,url,kind) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,homepage=excluded.homepage,url=excluded.url,kind=excluded.kind").bind(s.id,s.name,s.homepage,s.url,s.kind));
  await db.batch(seeds);
  // Version 9 retries SJS once through its verified public HTTP board.
  // Preserve earlier upgrades for deployments that have not received them yet.
  // Healthy schedules, denied paths and rejected event facts stay untouched.
  await db.batch([
    // Reclassify the reviewed faculty recruitment notice as non-event.
    db.prepare("UPDATE event_candidates SET checked_at=NULL WHERE source_id='acts' AND id='0a6e59e53aab5f66d308dbe409444597' AND status='checking' AND reason='explicit_event_date_required' AND source_id IN (SELECT id FROM event_sources WHERE collector_version<24 AND (lease_until IS NULL OR lease_until<?))").bind(now),
    // Retry the exact complete ACTS notice after its measured inline-image size fix.
    db.prepare("UPDATE event_candidates SET checked_at=NULL WHERE source_id='acts' AND url='https://www.acts.ac.kr/modules/board/bd_view.asp?ListBlock=&Pagecount=153&ca_no=&gotopage=1&id=board_notice&left=unilife4_1&lnb_id=&mncode=&no=3113&sk=&sleft=&sv=&title=' AND source_id IN (SELECT id FROM event_sources WHERE collector_version<23 AND (lease_until IS NULL OR lease_until<?))").bind(now),
    // Re-read only the inspected climate film notice for its explicit admission fee.
    db.prepare("UPDATE event_candidates SET checked_at=NULL WHERE source_id='cemk' AND event_id='a38af389edce7859399707a4b498600c' AND url='https://cemk.org/46091/' AND source_id IN (SELECT id FROM event_sources WHERE collector_version<22 AND (lease_until IS NULL OR lease_until<?))").bind(now),
    // Recheck only the seminar whose confirmed venue address supplies its region.
    db.prepare("UPDATE event_candidates SET checked_at=NULL WHERE source_id='onnuri' AND event_id='1f0b346c9b4310228123d09218612cda' AND url='https://www.onnuri.org/festival/140%EA%B8%B0-%ED%95%98%EB%82%98%EB%8B%98%EC%9D%98%EA%B0%80%EC%A0%95%ED%9B%88%EB%A0%A8%ED%95%99%EA%B5%90/' AND source_id IN (SELECT id FROM event_sources WHERE collector_version<21 AND (lease_until IS NULL OR lease_until<?))").bind(now),
    db.prepare("UPDATE event_candidates SET checked_at=NULL WHERE source_id='duranno-college' AND event_id='67036ed578b39eab6008bc027f137ea2' AND url='https://biblecollege.duranno.com/biblecollege/view/seminar_detail.asp?smrnum=4197' AND source_id IN (SELECT id FROM event_sources WHERE collector_version<20 AND (lease_until IS NULL OR lease_until<?))").bind(now),
    // Refresh only the inspected early-bird product, without changing sale status.
    db.prepare("UPDATE event_candidates SET checked_at=NULL WHERE source_id='melon' AND event_id='c816aa47a21a876517f44f126a69be75' AND url='https://ticket.melon.com/performance/index.htm?prodId=213769' AND source_id IN (SELECT id FROM event_sources WHERE collector_version<19 AND (lease_until IS NULL OR lease_until<?))").bind(now),
    // Refresh only the reviewed Resistance performance participation table.
    db.prepare("UPDATE event_candidates SET checked_at=NULL WHERE source_id='gwangya' AND event_id='857eda870d1c0b3b9acae042ef276a58' AND url='https://gwangya.art/Resistance' AND source_id IN (SELECT id FROM event_sources WHERE collector_version<18 AND (lease_until IS NULL OR lease_until<?))").bind(now),
    // Reconcile list filters with the two reviewed official audience statements.
    db.prepare("UPDATE event_candidates SET checked_at=NULL WHERE ((source_id='duranno-college' AND event_id='67036ed578b39eab6008bc027f137ea2' AND url='https://biblecollege.duranno.com/biblecollege/view/seminar_detail.asp?smrnum=4197') OR (source_id='jiguchon' AND event_id='19f60be947c79e0fee01c4508bbf8065' AND url='https://www.jiguchon.or.kr/bbs/board.php?bo_table=G02&wr_id=1170')) AND source_id IN (SELECT id FROM event_sources WHERE collector_version<17 AND (lease_until IS NULL OR lease_until<?))").bind(now),
    // Refresh only the existing seminar whose official participation fields were reviewed.
    db.prepare("UPDATE event_candidates SET checked_at=NULL WHERE source_id='duranno-college' AND event_id='67036ed578b39eab6008bc027f137ea2' AND url='https://biblecollege.duranno.com/biblecollege/view/seminar_detail.asp?smrnum=4197' AND source_id IN (SELECT id FROM event_sources WHERE collector_version<16 AND (lease_until IS NULL OR lease_until<?))").bind(now),
    db.prepare("UPDATE event_candidates SET checked_at=NULL WHERE source_id='jiguchon' AND event_id IS NOT NULL AND source_id IN (SELECT id FROM event_sources WHERE collector_version<15 AND (lease_until IS NULL OR lease_until<?))").bind(now),
    db.prepare("UPDATE event_candidates SET checked_at=NULL WHERE source_id IN ('sorrygom','jiguchon') AND event_id IS NOT NULL AND source_id IN (SELECT id FROM event_sources WHERE collector_version<14 AND (lease_until IS NULL OR lease_until<?))").bind(now),
    db.prepare("UPDATE event_candidates SET checked_at=NULL WHERE source_id='worldteach' AND reason='venue_required' AND source_id IN (SELECT id FROM event_sources WHERE collector_version<13 AND (lease_until IS NULL OR lease_until<?))").bind(now),
    db.prepare("UPDATE event_candidates SET checked_at=NULL WHERE source_id='paidion' AND reason='explicit_event_date_required' AND source_id IN (SELECT id FROM event_sources WHERE collector_version<12 AND (lease_until IS NULL OR lease_until<?))").bind(now),
    db.prepare("UPDATE event_candidates SET checked_at=NULL WHERE source_id='uofnjeju' AND reason='outside_event_board' AND source_id IN (SELECT id FROM event_sources WHERE collector_version<8 AND (lease_until IS NULL OR lease_until<?))").bind(now),
    db.prepare("UPDATE event_candidates SET checked_at=NULL WHERE source_id IN (SELECT id FROM event_sources WHERE collector_version<4 AND (lease_until IS NULL OR lease_until<?)) AND status='failed'").bind(now),
    db.prepare("UPDATE event_sources SET collector_version=?,next_check_at=CASE WHEN (status='empty' AND (collector_version<5 OR (collector_version<6 AND id='sarang'))) OR (status='failed' AND (collector_version<4 OR (collector_version<7 AND id='news-10'))) OR (collector_version<8 AND id IN ('uofnjeju','nics','acts','sjs')) OR (collector_version<9 AND id='sjs') OR (collector_version<10 AND id IN ('krim','juba','interserve')) OR (collector_version<11 AND id='bpu') OR (collector_version<12 AND (id='paidion' OR (status='failed' AND last_error LIKE '%TimeoutError%'))) OR (collector_version<13 AND id='worldteach') OR (collector_version<14 AND id IN ('sorrygom','jiguchon')) OR (collector_version<15 AND id='jiguchon') OR (collector_version<16 AND id='duranno-college') OR (collector_version<17 AND id IN ('duranno-college','jiguchon')) OR (collector_version<18 AND id='gwangya') OR (collector_version<19 AND id='melon') OR (collector_version<20 AND id='duranno-college') OR (collector_version<21 AND id='onnuri') OR (collector_version<22 AND id='cemk') OR (collector_version<23 AND id='acts') OR (collector_version<24 AND id='acts') THEN ? ELSE next_check_at END WHERE collector_version<? AND (lease_until IS NULL OR lease_until<?)").bind(COLLECTOR_VERSION,now,COLLECTOR_VERSION,now),
  ]);
  const due=await db.prepare("SELECT id FROM event_sources WHERE enabled=1 AND next_check_at<=? AND (lease_until IS NULL OR lease_until<?) AND id IN (SELECT value FROM json_each(?)) ORDER BY next_check_at,CASE kind WHEN 'official' THEN 0 ELSE 1 END LIMIT 1").bind(now,now,JSON.stringify(requestedSource?[requestedSource]:collectionSources.map(s=>s.id))).all<{id:string}>();
  await pool(due.results,1,async row=>{const source=collectionSources.find(s=>s.id===row.id);if(source)await processSource(source);});
  await db.batch([
    db.prepare("UPDATE events SET status='ended',updated_at=? WHERE end_date<? AND status='published'").bind(now,koreaDate()),
    db.prepare("UPDATE events SET status='checking',updated_at=? WHERE valid_until<? AND status='published'").bind(now,now),
  ]);
  const counts=await db.prepare("SELECT COUNT(*) AS discovered,SUM(CASE WHEN checked_at IS NULL THEN 1 ELSE 0 END) AS pending FROM event_candidates").first<{discovered:number;pending:number}>();
  const published=await db.prepare("SELECT COUNT(*) AS n FROM events WHERE status='published' AND end_date>=? AND valid_until>?").bind(koreaDate(),now).first<{n:number}>();
  return {ok:true,sourcesProcessed:due.results.length,discovered:counts?.discovered||0,pending:counts?.pending||0,published:published?.n||0};
}
