/** Isolated HTTP route integration. No production DB, credentials or network.
 * Executes transpiled application route/server/auth/crypto sources unchanged.
 * Runtime substitutes: SQLite D1 adapter, fixed test clock/env, YouTube oEmbed.
 * Run: node --test tests/praise-contest-http.test.mjs (Node >=22.13).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {createServer} from 'node:http';
import {DatabaseSync,backup} from 'node:sqlite';
import ts from 'typescript';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
test('praise contest real handlers over isolated local HTTP',async t=>{
 const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'airchurch-http-'));
 const RealDate=Date,realFetch=globalThis.fetch;
 let clock=RealDate.parse('2026-10-05T03:00:00.000Z');
 globalThis.Date=class extends RealDate{constructor(...args){super(...(args.length?args:[clock]));}static now(){return clock;}};
 const sqlite=new DatabaseSync(':memory:');sqlite.exec('PRAGMA foreign_keys=ON');
 for(const number of ['0023','0024','0025','0026','0027','0028','0029'])sqlite.exec(fs.readFileSync(path.join(root,'drizzle',fs.readdirSync(path.join(root,'drizzle')).find(f=>f.startsWith(number)&&f.endsWith('.sql'))),'utf8'));
 sqlite.function('date',{varargs:true},(value,modifier)=>{let time=value==='now'?clock:RealDate.parse(value);if(modifier==='+9 hours')time+=9*3600000;return new RealDate(time).toISOString().slice(0,10);});
 sqlite.function('strftime',{varargs:true},(format,value)=>{assert.equal(format,'%Y-%m-%dT%H:%M:%fZ');assert.equal(value,'now');return new RealDate(clock).toISOString();});
 const db={prepare(sql){const statement={args:[],bind(...args){this.args=args;return this;},sync(kind){const query=sqlite.prepare(sql);if(kind==='first')return query.get(...this.args)??null;if(kind==='all')return {results:query.all(...this.args),success:true};const r=query.run(...this.args);return {success:true,meta:{changes:Number(r.changes),last_row_id:Number(r.lastInsertRowid)}};},async first(){try{return this.sync('first');}catch(e){console.error('SQLite first:',e.message);throw e;}},async all(){try{return this.sync('all');}catch(e){console.error('SQLite all:',e.message);throw e;}},async run(){try{return this.sync('run');}catch(e){console.error('SQLite run:',e.message);throw e;}}};return statement;},async batch(statements){sqlite.exec('BEGIN');try{const results=statements.map(s=>s.sync('run'));sqlite.exec('COMMIT');return results;}catch(e){sqlite.exec('ROLLBACK');throw e;}}};
 const environmentName='__AIRCHURCH_HTTP_TEST_ENV__';
 globalThis[environmentName]={DB:db,ADMIN_SESSION_SECRET:'TEST-ONLY-NOT-REAL-ADMIN-SESSION-SECRET',FINGERPRINT_SECRET:'TEST-ONLY-NOT-REAL-FINGERPRINT-SECRET',ADMIN_USERNAME:'synthetic-admin',ADMIN_PASSWORD:'TEST-ONLY-NOT-A-REAL-PASSWORD'};
 fs.writeFileSync(path.join(temporary,'env.mjs'),`export const env=globalThis.${environmentName};`);
 fs.writeFileSync(path.join(temporary,'headers.mjs'),'export async function headers(){throw new Error("No ambient Next headers in HTTP harness");}');
 const copied=new Map();
 function compile(relative){
  const absolute=path.resolve(root,relative);if(copied.has(absolute))return copied.get(absolute);
  const destination=path.join(temporary,path.relative(root,absolute).replace(/\.tsx?$/,'.mjs'));copied.set(absolute,destination);fs.mkdirSync(path.dirname(destination),{recursive:true});
  let source=fs.readFileSync(absolute,'utf8');
  source=source.replace(/from\s+(["'])([^"']+)\1/g,(original,quote,specifier)=>{
   let target;if(specifier==='cloudflare:workers')target=path.join(temporary,'env.mjs');else if(specifier==='next/headers')target=path.join(temporary,'headers.mjs');else if(specifier.startsWith('.')){let dep=path.resolve(path.dirname(absolute),specifier);if(!path.extname(dep))dep+='.ts';target=compile(path.relative(root,dep));}else throw new Error('Unexpected import '+specifier);
   return `from ${JSON.stringify(pathToFileURL(target).href)}`;
  });
  fs.writeFileSync(destination,ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText);return destination;
 }
 const routes=new Map();
 for(const [url,file]of [['/api/praise-contest','app/api/praise-contest/route.ts'],['/api/praise-contest/like','app/api/praise-contest/like/route.ts'],['/api/admin/praise-contest/payout','app/api/admin/praise-contest/payout/route.ts'],['/api/admin/praise-contest','app/api/admin/praise-contest/route.ts'],['/api/admin/praise-contest/payments','app/api/admin/praise-contest/payments/route.ts']])routes.set(url,await import(pathToFileURL(compile(file)).href));
 globalThis.fetch=async (input,options)=>{const url=new URL(typeof input==='string'?input:input.url);if(url.hostname==='www.youtube.com'&&url.pathname==='/oembed')return Response.json({author_name:'SYNTHETIC TEST CHANNEL'});throw new Error('Unexpected external request '+url.origin);};
 const server=createServer(async(req,res)=>{try{const chunks=[];for await(const chunk of req)chunks.push(chunk);const request=new Request(`http://${req.headers.host}${req.url}`,{method:req.method,headers:req.headers,...(['GET','HEAD'].includes(req.method)?{}:{body:Buffer.concat(chunks)})});const route=routes.get(new URL(request.url).pathname);const result=await route[req.method](request);res.writeHead(result.status,Object.fromEntries(result.headers));res.end(Buffer.from(await result.arrayBuffer()));}catch(e){res.writeHead(500);res.end(String(e));}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin=`http://127.0.0.1:${server.address().port}`;
 async function request(url,method='GET',body,cookie,otherHeaders={}){const response=await realFetch(origin+url,{method,headers:{...(method==='GET'?{}:{origin,'content-type':'application/json'}),...(cookie?{cookie}:{}),...otherHeaders},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:response.status,headers:response.headers,body:await response.json()};}
 let cookie,entry1,entry2;
 try{
 await t.test('GET issues signed HttpOnly SameSite cookie; forged signatures cannot vote',async()=>{const r=await request('/api/praise-contest');assert.equal(r.status,200);const setCookie=r.headers.get('set-cookie');assert.match(setCookie,/HttpOnly/);assert.match(setCookie,/SameSite=Lax/);cookie=setCookie.split(';')[0];assert.match(cookie,/=[0-9a-f]{64}\.[0-9a-f]{64}$/);const forged=cookie.slice(0,-1)+(cookie.endsWith('a')?'b':'a');assert.equal((await request('/api/praise-contest/like','POST',{entryId:1},forged)).status,403);});
 const validEntry=i=>({performer:'TEST '+i,title:'SYNTHETIC SONG',youtubeUrl:'https://youtu.be/TESTVIDEO0'+i,contact:'fake'+i+'@example.invalid',phone:'00000000000',rightsConsent:true,privacyConsent:true,payoutConsent:true,ageConsent:true});
 await t.test('registration without financial fields encrypts phone only, ignores legacy fields and keeps the feed private',async()=>{
  for(let i=1;i<=6;i++){const payload=validEntry(i);if(i===6)Object.assign(payload,{bank:'TEST BANK',holder:'TEST HOLDER',account:'000000000000'});const result=await request('/api/praise-contest','POST',payload,cookie,{'cf-connecting-ip':'192.0.2.'+i});assert.equal(result.status,201,JSON.stringify(result.body));if(i===1)entry1=result.body.id;if(i===2)entry2=result.body.id;}
  const crypto=await import(pathToFileURL(compile('app/api/praise-contest/payout-private.ts')).href);
  for(const id of [entry1,6]){const row=sqlite.prepare('SELECT payout_ciphertext,consent_version,youtube_id FROM praise_contest_entries WHERE id=?').get(id);assert.match(row.payout_ciphertext,/^v1\./);assert.equal(row.consent_version,'2026-10-v4-contact');assert.deepEqual(await crypto.openPayout(row.payout_ciphertext,`praise-2026-10|${row.youtube_id}`),{phone:'00000000000'});}
  // Simulate an existing encrypted pre-change record in this isolated DB only.
  const legacy=await crypto.sealPayout({phone:'00000000000',bank:'TEST BANK',holder:'TEST HOLDER',account:'000000000000'},'praise-2026-10|TESTVIDEO02');
  sqlite.prepare('UPDATE praise_contest_entries SET payout_ciphertext=?,consent_version=? WHERE id=?').run(legacy,'2026-10-v3-payout',entry2);
  const feed=await request('/api/praise-contest','GET',undefined,cookie);assert.equal(feed.body.items.length,6);for(const item of feed.body.items)for(const field of ['contact','phone','bank','holder','account','payoutCiphertext','payout_ciphertext','browser_hash'])assert.equal(Object.hasOwn(item,field),false,field);
 });
 await t.test('video, contact, rights, guardian, privacy and phone consent validation remain required',async()=>{
  const invalid=[{performer:''},{title:''},{youtubeUrl:'https://untrusted.invalid/video'},{youtubeUrl:''},{contact:'invalid'},{contact:''},{phone:''},{phone:'123'},{rightsConsent:false},{rightsConsent:'true'},{privacyConsent:false},{privacyConsent:'true'},{ageConsent:false},{ageConsent:'true'},{payoutConsent:false},{payoutConsent:'true'}];
  for(const changes of invalid){const result=await request('/api/praise-contest','POST',{...validEntry(7),...changes},cookie);assert.equal(result.status,400,JSON.stringify({changes,result}));assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM praise_contest_entries').get().n,6);}
 });
 await t.test('cross-origin request refused',async()=>assert.equal((await request('/api/praise-contest/like','POST',{entryId:entry1},cookie,{origin:'https://untrusted.invalid'})).status,403));
 await t.test('POST accepts only a positive safe integer entryId without coercion',async()=>{
  const invalid=[true,false,'1','01','1.0','1e0',' 1 ',[1],[[1]],[],{},null,undefined,0,-1,1.5,Number.MAX_SAFE_INTEGER+1];
  for(const entryId of invalid){const response=await request('/api/praise-contest/like','POST',{entryId},cookie);assert.equal(response.status,400,JSON.stringify({entryId,response}));assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM praise_contest_votes').get().n,0);}
  assert.equal((await request('/api/praise-contest/like','POST',{entryId:entry1},cookie)).status,200);
 });
 await t.test('DELETE rejects coerced entryId without removing the current vote',async()=>{
  const invalid=[true,false,String(entry1),'01','1.0','1e0',' 1 ',[entry1],[[entry1]],[],{},null,undefined,0,-1,1.5,Number.MAX_SAFE_INTEGER+1];
  for(const entryId of invalid){const response=await request('/api/praise-contest/like','DELETE',{entryId},cookie);assert.equal(response.status,400,JSON.stringify({entryId,response}));assert.equal(sqlite.prepare('SELECT entry_id FROM praise_contest_votes').get().entry_id,entry1);}
  assert.equal((await request('/api/praise-contest/like','DELETE',{entryId:entry1},cookie)).status,200);
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM praise_contest_votes').get().n,0);
  assert.equal(sqlite.prepare('SELECT SUM(delta) AS n FROM praise_contest_vote_events').get().n,0);
 });
 await t.test('20 parallel HTTP votes by one browser persist exactly one vote',async()=>{const responses=await Promise.all(Array.from({length:20},(_,i)=>request('/api/praise-contest/like','POST',{entryId:i%2?entry1:entry2},cookie)));assert.ok(responses.some(r=>r.status===200));assert.ok(responses.every(r=>[200,409].includes(r.status)));assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM praise_contest_votes').get().n,1);assert.equal(sqlite.prepare('SELECT SUM(delta) AS n FROM praise_contest_vote_events').get().n,1);});
 await t.test('DELETE today vote then reselect other entry',async()=>{const before=await request('/api/praise-contest','GET',undefined,cookie);const old=before.body.votedEntryId;assert.ok(old);assert.equal((await request('/api/praise-contest/like','DELETE',{entryId:old},cookie)).status,200);assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM praise_contest_votes').get().n,0);const next=old===entry1?entry2:entry1;assert.equal((await request('/api/praise-contest/like','POST',{entryId:next},cookie)).status,200);assert.equal(sqlite.prepare('SELECT entry_id FROM praise_contest_votes').get().entry_id,next);});
 await t.test('unauthenticated admin payout and forged admin session both return 403',async()=>{assert.equal((await request('/api/admin/praise-contest/payout','POST',{id:entry1},cookie)).status,403);assert.equal((await request('/api/admin/praise-contest/payout','POST',{id:entry1},'__Host-airchurch_access=forged')).status,403);});
 await t.test('administrator reads phone-only and legacy financial records, preserving consent versions and audit',async()=>{
  const auth=await import(pathToFileURL(compile('app/admin-access.ts')).href);const token=await auth.createAccessToken({role:'admin',reviewerId:0});const adminCookie=auth.adminCookie(token).split(';')[0];
  for(const [id,expected] of [[entry1,{phone:'00000000000'}],[entry2,{phone:'00000000000',bank:'TEST BANK',holder:'TEST HOLDER',account:'000000000000'}]]){const response=await request('/api/admin/praise-contest/payout','POST',{id},adminCookie);assert.equal(response.status,200,JSON.stringify(response.body));assert.deepEqual(response.body.details,expected);assert.match(response.headers.get('cache-control'),/no-store/);}
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM praise_contest_audit WHERE action='payout-view'").get().n,2);
  const list=await request('/api/admin/praise-contest','GET',undefined,adminCookie);assert.equal(list.status,200);assert.equal(list.body.items.find(x=>x.id===entry1).consentVersion,'2026-10-v4-contact');assert.equal(list.body.items.find(x=>x.id===entry2).consentVersion,'2026-10-v3-payout');
  assert.equal((await request('/api/admin/praise-contest/payments','POST',{id:entry1,action:'reserve',note:'SYNTHETIC CHECKED',recipientChecked:true,accountChecked:true,issuesChecked:true},adminCookie)).status,409);
  await auth.revokeAccessSession(new Request(origin,{headers:{cookie:adminCookie}}));assert.equal((await request('/api/admin/praise-contest/payout','POST',{id:entry1},adminCookie)).status,403);
 });
 await t.test('six eligible entries continue after submission deadline',async()=>{clock=RealDate.parse('2026-10-15T15:00:00.000Z');const response=await request('/api/praise-contest','GET',undefined,cookie);assert.equal(response.status,200);assert.equal(response.body.phase,'voting');assert.deepEqual({...sqlite.prepare('SELECT eligible_count,cancelled FROM praise_contest_decisions').get()},{eligible_count:6,cancelled:0});assert.equal((await request('/api/praise-contest/like','POST',{entryId:entry1},cookie)).status,200);});
 await t.test('server schedule blocks late registration and vote/cancellation at exact close',async()=>{clock=RealDate.parse('2026-10-15T15:00:00.000Z');assert.equal((await request('/api/praise-contest','POST',{},cookie)).status,409);clock=RealDate.parse('2026-10-18T15:00:00.000Z');assert.equal((await request('/api/praise-contest/like','POST',{entryId:entry1},cookie)).status,409);assert.equal((await request('/api/praise-contest/like','DELETE',{entryId:entry1},cookie)).status,409);const feed=await request('/api/praise-contest','GET',undefined,cookie);assert.equal(feed.status,200,JSON.stringify(feed.body));assert.equal(feed.body.finalized,true);assert.equal(feed.body.phase,'finished');assert.equal(feed.body.items.length,6);});
 await t.test('final snapshot is idempotent across repeated GET',async()=>{const before=sqlite.prepare('SELECT snapshot,finalized_at FROM praise_contest_results').get();assert.ok(before);const first=await request('/api/praise-contest','GET',undefined,cookie);const second=await request('/api/praise-contest','GET',undefined,cookie);assert.equal(first.status,200);assert.equal(second.status,200);assert.deepEqual(first.body.items,second.body.items);assert.deepEqual(sqlite.prepare('SELECT snapshot,finalized_at FROM praise_contest_results').get(),before);assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM praise_contest_results').get().n,1);});
 await t.test('phone-only winner uses existing manual account checks and payment records after results close',async()=>{
  const auth=await import(pathToFileURL(compile('app/admin-access.ts')).href);const token=await auth.createAccessToken({role:'admin',reviewerId:0});const adminCookie=auth.adminCookie(token).split(';')[0];
  assert.equal((await request('/api/admin/praise-contest/payments','GET',undefined,cookie)).status,403);
  const list=await request('/api/admin/praise-contest/payments','GET',undefined,adminCookie);assert.equal(list.status,200);assert.ok(list.body.winners.some(x=>x.id===entry1&&x.prize>0));
  const input={id:entry1,action:'reserve',note:'SYNTHETIC MANUAL ACCOUNT CHECK',recipientChecked:true,accountChecked:true,issuesChecked:true};
  for(const field of ['recipientChecked','accountChecked','issuesChecked'])assert.equal((await request('/api/admin/praise-contest/payments','POST',{...input,[field]:false},adminCookie)).status,400,field);
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM praise_contest_payments').get().n,0);
  const reserved=await request('/api/admin/praise-contest/payments','POST',input,adminCookie);assert.equal(reserved.status,200,JSON.stringify(reserved.body));assert.equal(reserved.body.bankTransferExecuted,false);
  assert.equal((await request('/api/admin/praise-contest/payments','POST',input,adminCookie)).status,409);
  const record=sqlite.prepare('SELECT attempt_id FROM praise_contest_payments WHERE entry_id=?').get(entry1);
  const paid={id:entry1,action:'paid',attemptId:record.attempt_id,reference:'SYNTHETIC-REFERENCE',note:'SYNTHETIC BANK RESULT',bankConfirmed:true};
  assert.equal((await request('/api/admin/praise-contest/payments','POST',{...paid,bankConfirmed:false},adminCookie)).status,400);
  assert.equal((await request('/api/admin/praise-contest/payments','POST',paid,adminCookie)).status,200);
  assert.equal(sqlite.prepare('SELECT status FROM praise_contest_payments WHERE entry_id=?').get(entry1).status,'paid');
 });
 await t.test('last-day cancellation is excluded from final snapshot',async()=>{sqlite.exec('DELETE FROM praise_contest_results');clock=RealDate.parse('2026-10-18T14:59:59.000Z');const fresh=await request('/api/praise-contest');const freshCookie=fresh.headers.get('set-cookie').split(';')[0];assert.equal((await request('/api/praise-contest/like','POST',{entryId:entry2},freshCookie)).status,200);assert.equal((await request('/api/praise-contest/like','DELETE',{entryId:entry2},freshCookie)).status,200);const live=sqlite.prepare('SELECT entry_id,COUNT(*) AS n FROM praise_contest_votes GROUP BY entry_id').all();clock=RealDate.parse('2026-10-18T15:00:00.000Z');const final=await request('/api/praise-contest','GET',undefined,cookie);assert.equal(final.status,200);assert.equal(final.body.finalized,true);for(const entry of final.body.items)assert.equal(entry.likes,live.find(v=>v.entry_id===entry.id)?.n??0);assert.equal(sqlite.prepare("SELECT SUM(delta) AS n FROM praise_contest_vote_events WHERE vote_day='2026-10-18'").get().n,0);});
 await t.test('synthetic SQLite backup and restore preserve entries, votes, audit events and snapshot',async()=>{const destination=path.join(temporary,'synthetic-backup.sqlite');await backup(sqlite,destination);const restored=new DatabaseSync(destination,{readOnly:true});try{for(const table of ['praise_contest_entries','praise_contest_votes','praise_contest_vote_events','praise_contest_results','praise_contest_decisions'])assert.deepEqual(restored.prepare(`SELECT * FROM ${table}`).all(),sqlite.prepare(`SELECT * FROM ${table}`).all(),table);assert.equal(restored.prepare('PRAGMA integrity_check').get().integrity_check,'ok');assert.equal(restored.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='trigger' AND name IN ('praise_vote_added','praise_vote_removed')").get().n,2);}finally{restored.close();}});
 await t.test('five entries cancel at deadline, reject votes, remain cancelled and select no prize on 19th',async()=>{
  // Reset only synthetic scenario state; remove the unvoted sixth synthetic entry.
  sqlite.exec('DELETE FROM praise_contest_results; DELETE FROM praise_contest_decisions; DELETE FROM praise_contest_entries WHERE id=6');clock=RealDate.parse('2026-10-15T15:00:00.000Z');const cancelled=await request('/api/praise-contest','GET',undefined,cookie);assert.equal(cancelled.status,200);assert.equal(cancelled.body.phase,'cancelled');assert.deepEqual({...sqlite.prepare('SELECT eligible_count,cancelled FROM praise_contest_decisions').get()},{eligible_count:5,cancelled:1});assert.equal((await request('/api/praise-contest/like','POST',{entryId:entry1},cookie)).status,409);assert.equal((await request('/api/praise-contest/like','DELETE',{entryId:entry1},cookie)).status,409);clock=RealDate.parse('2026-10-18T15:00:00.000Z');const final=await request('/api/praise-contest','GET',undefined,cookie);assert.equal(final.status,200);assert.equal(final.body.phase,'cancelled');assert.equal(final.body.finalized,false);assert.equal(final.body.items.length,5);assert.ok(final.body.items.every(e=>e.prize===0&&e.rank===null));assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM praise_contest_results').get().n,0);
 });
 }finally{await new Promise(resolve=>server.close(resolve));sqlite.close();globalThis.Date=RealDate;globalThis.fetch=realFetch;delete globalThis[environmentName];fs.rmSync(temporary,{recursive:true,force:true});}
});
