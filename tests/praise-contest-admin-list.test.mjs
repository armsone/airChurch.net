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
test('administrator global search-filter-order-pagination HTTP',async t=>{
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
 const auth=await import(pathToFileURL(compile('app/admin-access.ts')).href);const token=await auth.createAccessToken({role:'admin',reviewerId:0});const adminCookie=auth.adminCookie(token).split(';')[0];
 const insert=sqlite.prepare("INSERT INTO praise_contest_entries(contest_id,youtube_id,performer,title,channel_name,contact,browser_hash,consent_version,consent_at,created_at,status,reupload_status) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)");
 for(let i=1;i<=53;i++){const n=String(i).padStart(2,'0'),at=new RealDate(clock+i*1000).toISOString();insert.run('praise-2026-10','TESTVIDEO'+n,'TEAM '+n,i===2?'SPECIAL_% SONG':i===3?'slash\\token':'SONG '+n,'TEST CHANNEL','test@example.invalid','TEST-BROWSER-'+n,'2026-10-v4-contact',at,at,i%2?'published':'held','not_requested');}
 insert.run('other-contest','OTHERVIDEO1','OUTSIDE TEAM','OUTSIDE SONG','TEST CHANNEL','test@example.invalid','OUTSIDE','TEST',new Date().toISOString(),new Date().toISOString(),'published','not_requested');
 const list=(query='')=>request('/api/admin/praise-contest'+query,'GET',undefined,adminCookie);
 await t.test('admin authorization and fixed SQL page bound',async()=>{
  assert.equal((await request('/api/admin/praise-contest')).status,403);assert.equal((await request('/api/admin/praise-contest','GET',undefined,'__Host-airchurch_access=forged')).status,403);
  const r=await list('?pageSize=999999');assert.equal(r.status,200);assert.equal(r.body.items.length,20);assert.deepEqual(r.body.counts,{total:53,published:27,held:26});assert.deepEqual(r.body.pagination,{page:1,pageSize:20,total:53,totalPages:3});assert.equal(Object.hasOwn(r.body.items[0],'payout_ciphertext'),false);
 });
 await t.test('multiple pages use stable global order without duplicates',async()=>{
  const pages=await Promise.all([1,2,3].map(page=>list('?page='+page)));assert.deepEqual(pages.map(r=>r.body.items.length),[20,20,13]);assert.deepEqual(pages.flatMap(r=>r.body.items.map(x=>x.id)),Array.from({length:53},(_,i)=>53-i));
  assert.deepEqual((await list('?sort=oldest')).body.items.map(x=>x.id),Array.from({length:20},(_,i)=>i+1));assert.deepEqual((await list('?sort=name')).body.items.map(x=>x.id),Array.from({length:20},(_,i)=>i+1));
 });
 await t.test('global search combines status and literal wildcard handling',async()=>{
  const held=await list('?status=held&page=2');assert.equal(held.body.pagination.total,26);assert.equal(held.body.items.length,6);assert.ok(held.body.items.every(x=>x.status==='held'));
  const found=await list('?q=TEAM%204&status=published&sort=oldest');assert.deepEqual(found.body.items.map(x=>x.id),[41,43,45,47,49]);assert.equal(found.body.pagination.total,5);assert.equal(found.body.counts.total,53);
  assert.deepEqual((await list('?q=53')).body.items.map(x=>x.id),[53]);assert.deepEqual((await list('?q='+encodeURIComponent('_%'))).body.items.map(x=>x.id),[2]);assert.deepEqual((await list('?q='+encodeURIComponent('slash\\token'))).body.items.map(x=>x.id),[3]);assert.equal((await list('?q='+encodeURIComponent("%' OR 1=1 --"))).body.pagination.total,0);assert.equal((await list('?q=OUTSIDE')).body.pagination.total,0);
 });
 await t.test('empty results, invalid parameters and last-page clamping',async()=>{
  const empty=await list('?q=NO-MATCH&page=99');assert.deepEqual(empty.body.items,[]);assert.deepEqual(empty.body.pagination,{page:1,pageSize:20,total:0,totalPages:1});assert.equal((await list('?page=999')).body.pagination.page,3);
  for(const query of ['?page=0','?page=-1','?page=1.2','?page=abc','?page=9007199254740992','?sort=__proto__','?sort='+encodeURIComponent('id DESC; DROP TABLE x'),'?status=private','?q='+('X'.repeat(81))])assert.equal((await list(query)).status,400,query);
 });
 await t.test('edit refreshes global search membership',async()=>{
  const r=await request('/api/admin/praise-contest','PATCH',{id:53,performer:'RENAMED TEAM',title:'EDITED SONG',status:'published',reuploadStatus:'not_requested',note:'SYNTHETIC EDIT'},adminCookie);assert.equal(r.status,200);
  assert.equal((await list('?q=TEAM%2053')).body.pagination.total,0);assert.deepEqual((await list('?q=RENAMED')).body.items.map(x=>x.id),[53]);
 });
 await t.test('hide/restore updates filtered pages and preserves votes',async()=>{
  sqlite.prepare("UPDATE praise_contest_entries SET status=CASE WHEN id<=21 THEN 'published' ELSE 'held' END WHERE contest_id='praise-2026-10'").run();
  sqlite.prepare('INSERT INTO praise_contest_votes(contest_id,entry_id,browser_hash,created_at,vote_day) VALUES(?,?,?,?,?)').run('praise-2026-10',1,'TEST-VOTER',new Date().toISOString(),'2026-10-05');
  const last=await list('?status=published&page=2');assert.deepEqual(last.body.items.map(x=>x.id),[1]);
  assert.equal((await request('/api/admin/praise-contest','PATCH',{id:1,action:'hide',note:'SYNTHETIC HIDE'},adminCookie)).status,200);
  const clamped=await list('?status=published&page=2');assert.equal(clamped.body.pagination.page,1);assert.equal(clamped.body.pagination.total,20);assert.ok(!clamped.body.items.some(x=>x.id===1));assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM praise_contest_votes').get().n,1);
  assert.equal((await request('/api/admin/praise-contest','PATCH',{id:1,status:'published',reuploadStatus:'not_requested',note:'SYNTHETIC RESTORE'},adminCookie)).status,200);
  assert.deepEqual((await list('?status=published&page=2')).body.items.map(x=>x.id),[1]);const publicFeed=await request('/api/praise-contest');assert.equal(publicFeed.body.items.find(x=>x.id===1).likes,1);assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM praise_contest_entries WHERE contest_id='praise-2026-10'").get().n,53);
 });
 }finally{await new Promise(resolve=>server.close(resolve));sqlite.close();globalThis.Date=RealDate;globalThis.fetch=realFetch;delete globalThis[environmentName];fs.rmSync(temporary,{recursive:true,force:true});}
});
