import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(new Request("http://localhost/", { headers:{accept:"text/html"} }), { ASSETS:{fetch:async()=>new Response("Not found",{status:404})} }, { waitUntil(){}, passThroughOnException(){} });
}

test("server-renders the Airchurch portal", async () => {
  const response=await render(); assert.equal(response.status,200); assert.match(response.headers.get("content-type")??"",/^text\/html\b/i);
  const html=await response.text(); assert.match(html,/<title>에어처치 \| 말씀과 선한 마음이 만나는 곳<\/title>/); assert.match(html,/좋은 말씀과/); assert.match(html,/착한나눔/); assert.match(html,/달란트 브릿지/); assert.match(html,/등록 교회 목록/); assert.match(html,/AI가 찾고, 기준을 통과한 교회만 등록합니다\./); assert.match(html,/건강한 신앙 생태계/); assert.doesNotMatch(html,/codex-preview|SkeletonPreview|react-loading-skeleton/);
});

test("restores a reviewed church directory and restricted pastor workflow", async () => {
  const [page,recommendations,churches,admin,review,controls,manage,access,schema,envExample,signupRoute,signupForm]=await Promise.all([
    readFile(new URL("../app/home-client.tsx",import.meta.url),"utf8"),
    readFile(new URL("../app/api/church-recommendations/route.ts",import.meta.url),"utf8"),
    readFile(new URL("../app/api/churches/route.ts",import.meta.url),"utf8"),
    readFile(new URL("../app/admin/page.tsx",import.meta.url),"utf8"),
    readFile(new URL("../app/pastor/page.tsx",import.meta.url),"utf8"),
    readFile(new URL("../app/admin/admin-controls.tsx",import.meta.url),"utf8"),
    readFile(new URL("../app/api/admin/manage/route.ts",import.meta.url),"utf8"),
    readFile(new URL("../app/admin-access.ts",import.meta.url),"utf8"),
    readFile(new URL("../db/schema.ts",import.meta.url),"utf8"),
    readFile(new URL("../.env.example",import.meta.url),"utf8"),
    readFile(new URL("../app/api/reviewer-signup/route.ts",import.meta.url),"utf8"),
    readFile(new URL("../app/pastor/join/reviewer-signup.tsx",import.meta.url),"utf8"),
  ]);
  for(const phrase of ["AI가 찾고, 기준을 통과한 교회만 등록합니다\\.","교회 추천 보내기","관리자가 교단과 공식 채널"]) assert.match(page,new RegExp(phrase));
  assert.match(churches,/review_status='approved'/);
  assert.match(recommendations,/status:"pending"/);
  assert.match(admin,/교회 추천 검토/);
  assert.match(review,/한 곳씩 살펴봐 주세요/);
  assert.match(controls,/kind:"church-review"/);
  assert.match(controls,/admin-church-details/);
  assert.match(manage,/role==="reviewer"&&kind!=="church-review"/);
  assert.match(access,/REVIEWER_USERNAME/);
  assert.match(access,/REVIEWER_PASSWORD/);
  assert.match(schema,/churchRecommendations = sqliteTable\("church_recommendations"/);
  assert.match(schema,/reviewerStatus: text\("reviewer_status"\)/);
  assert.match(envExample,/REVIEWER_USERNAME=/);
  assert.match(signupRoute,/\|\|!password\)/);
  assert.doesNotMatch(signupRoute,/password\.length/);
  assert.doesNotMatch(signupForm,/name="password"[^>]*(?:minLength|maxLength|pattern)/);
  assert.match(signupForm,/name="password"[^>]*required/);
  assert.doesNotMatch(signupRoute,/8자/);
  assert.doesNotMatch(signupRoute,/password\.length|password\.match|test\(password\)/);
});

test("keeps safety and discovery requirements in the product source", async () => {
  const [page,layout,hosting,selection]=await Promise.all([readFile(new URL("../app/home-client.tsx",import.meta.url),"utf8"),readFile(new URL("../app/layout.tsx",import.meta.url),"utf8"),readFile(new URL("../.openai/hosting.json",import.meta.url),"utf8"),readFile(new URL("../app/api/sermons/_selection.ts",import.meta.url),"utf8")]);
  for(const phrase of ["교회명, 목사님, 지역","작은 교회 살리기","은퇴 목회자 동행","내 달란트","소속 확인","이의제기"]) assert.match(page,new RegExp(phrase));
  for(const region of ["서울","부산","대구","인천","광주","대전","울산","세종","경기","강원","충북","충남","전북","전남","경북","경남","제주"]) assert.match(page,new RegExp(`"${region}"`));
  for(const excluded of ["찬양","광고","성경통독","쇼츠"]) assert.match(selection,new RegExp(excluded));
  assert.match(layout,/og\.png/); assert.equal(JSON.parse(hosting).d1,"DB");
});

test("does not block initial content on YouTube synchronization", async () => {
  const [page,sermonRoute,praiseRoute,weighted]=await Promise.all([
    readFile(new URL("../app/home-client.tsx",import.meta.url),"utf8"),
    readFile(new URL("../app/api/sermons/route.ts",import.meta.url),"utf8"),
    readFile(new URL("../app/api/praises/route.ts",import.meta.url),"utf8"),
    readFile(new URL("../app/api/_weighted-content.ts",import.meta.url),"utf8"),
  ]);
  assert.doesNotMatch(page,/\/api\/(?:sermons|praises)\/sync/);
  assert.doesNotMatch(page,/Promise\.all\(\[\s*loadItems\("\/api\/sermons"\)/);
  assert.match(page,/loadItems\("\/api\/sermons"\)\.then/);
  assert.match(page,/IntersectionObserver/);
  assert.match(page,/rootMargin:"800px 0px"/);
  assert.match(page,/sermonLoading/);
  assert.match(page,/praiseLoading/);
  assert.match(page,/skeleton-card/);
  assert.doesNotMatch(sermonRoute,/ensureSermonTables/);
  assert.doesNotMatch(praiseRoute,/ensure(?:Sermon|Praise)Tables/);
  assert.match(sermonRoute,/getRequestExecutionContext/);
  assert.match(sermonRoute,/context\.waitUntil\(pendingSync\)/);
  assert.match(praiseRoute,/getRequestExecutionContext/);
  assert.match(praiseRoute,/context\.waitUntil\(pendingSync\)/);
  assert.match(weighted,/for \(const item of pinPriorityChurch\(items\)\)/);
  assert.match(praiseRoute,/selectWeightedRecent\(rows\.results as PraiseRow\[\], 12\)/);
  assert.match(page,/items\.filter\(\(item\)=>item\.pinned\).*shuffled\(items\.filter\(\(item\)=>!item\.pinned\)\)/s);
  assert.match(sermonRoute,/stale-while-revalidate=3600/);
  assert.match(praiseRoute,/stale-while-revalidate=3600/);
});

test("loads a larger sermon catalog in batches", async () => {
  const [page,sermonRoute]=await Promise.all([
    readFile(new URL("../app/home-client.tsx",import.meta.url),"utf8"),
    readFile(new URL("../app/api/sermons/route.ts",import.meta.url),"utf8"),
  ]);
  assert.match(sermonRoute,/selectWeightedRecent\([^;]+,120\)/);
  assert.match(page,/visibleSermonCount,setVisibleSermonCount\]=useState\(12\)/);
  assert.match(page,/visibleSermons = filtered\.slice\(0,visibleSermonCount\)/);
  assert.match(page,/previewSermons = filtered\.slice\(visibleSermonCount,visibleSermonCount\+3\)/);
  assert.match(page,/눌러서 말씀 더 보기/);
  assert.match(page,/말씀 21개 더 보기/);
  assert.match(page,/setVisibleSermonCount\(\(count\)=>count\+21\)/);
  assert.match(page,/className="thumbnail-image"/);
  assert.match(page,/loading="lazy" decoding="async"/);
  assert.match(page,/fetchPriority="low"/);
  assert.equal((page.match(/\{sermon\.church\} · \{sermon\.pastor\} · \{sermon\.region\}/g)??[]).length,2);
  assert.match(sermonRoute,/mqdefault\.jpg/);
});

test("reports live traffic safely and plays videos in place", async () => {
  const [page,admin,tracker,analytics,shared,styles,schema]=await Promise.all([
    readFile(new URL("../app/home-client.tsx",import.meta.url),"utf8"),
    readFile(new URL("../app/admin/page.tsx",import.meta.url),"utf8"),
    readFile(new URL("../app/visitor-tracker.tsx",import.meta.url),"utf8"),
    readFile(new URL("../app/api/analytics/track/route.ts",import.meta.url),"utf8"),
    readFile(new URL("../app/api/_shared.ts",import.meta.url),"utf8"),
    readFile(new URL("../app/globals.css",import.meta.url),"utf8"),
    readFile(new URL("../db/schema.ts",import.meta.url),"utf8"),
  ]);
  for(const label of ["현재 접속자","시간별 방문","일별 방문","월별 방문"]) assert.match(admin,new RegExp(label));
  assert.match(admin,/last_seen >= datetime\('now','-5 minutes'\)/);
  assert.match(tracker,/setInterval\(reportActivity, 120_000\)/);
  assert.match(analytics,/INSERT INTO visitor_activity/);
  assert.match(shared,/CREATE TABLE IF NOT EXISTS visitor_activity/);
  assert.match(schema,/visitorActivity = sqliteTable\("visitor_activity"/);
  assert.match(page,/youtube-nocookie\.com\/embed/);
  assert.match(page,/className="video-frame"/);
  assert.match(styles,/\.sermon-thumb \.play \{ background:rgba\(255,255,255,\.5\)/);
});

test("shows a complete mobile header menu instead of the talent button", async () => {
  const [page,styles]=await Promise.all([readFile(new URL("../app/home-client.tsx",import.meta.url),"utf8"),readFile(new URL("../app/globals.css",import.meta.url),"utf8")]);
  assert.match(page,/mobile-menu-button/);
  assert.match(page,/mobile-menu-panel/);
  assert.match(page,/aria-expanded=\{mobileMenuOpen\}/);
  assert.match(page,/\["등록교회","#church-directory"\]/);
  assert.doesNotMatch(page,/className="support-button"/);
  assert.match(styles,/\.mobile-menu-panel\.is-open\{display:grid\}/);
});

test("collapses the church list to its heading and reveals recommendations on demand", async () => {
  const page=await readFile(new URL("../app/home-client.tsx",import.meta.url),"utf8");
  assert.match(page,/function toggleChurchDirectory/);
  assert.match(page,/querySelector\("#church-directory"\)\?\.scrollIntoView/);
  assert.match(page,/showRecommendationForm/);
  assert.match(page,/aria-controls="church-recommendation-form"/);
  assert.match(page,/showRecommendationForm&&<form/);
});

test("supports multiple approved church reviewer accounts", async () => {
  const [access,signup,login,admin,manage,shared,schema,controls]=await Promise.all([
    readFile(new URL("../app/admin-access.ts",import.meta.url),"utf8"),
    readFile(new URL("../app/api/reviewer-signup/route.ts",import.meta.url),"utf8"),
    readFile(new URL("../app/admin/admin-login.tsx",import.meta.url),"utf8"),
    readFile(new URL("../app/admin/page.tsx",import.meta.url),"utf8"),
    readFile(new URL("../app/api/admin/manage/route.ts",import.meta.url),"utf8"),
    readFile(new URL("../app/api/_shared.ts",import.meta.url),"utf8"),
    readFile(new URL("../db/schema.ts",import.meta.url),"utf8"),
    readFile(new URL("../app/admin/admin-controls.tsx",import.meta.url),"utf8"),
  ]);
  assert.match(access,/PBKDF2/);
  assert.match(access,/const PBKDF2_ITERATIONS = 100_000;/);
  assert.match(access,/iterations:PBKDF2_ITERATIONS\}/);
  assert.doesNotMatch(access,/iterations:\d/);
  assert.match(access,/reviewer_accounts WHERE username=\? AND status='approved'/);
  assert.match(access,/role==="reviewer"&&reviewerId>0/);
  assert.match(access,/reviewer_accounts WHERE id=\? AND status='approved'/);
  assert.match(signup,/status,fingerprint\) VALUES \(\?,\?,\?,\?,\?,'pending',\?\)/);
  assert.match(login,/\/pastor\/join/);
  assert.match(admin,/목회자 검토 참여 신청/);
  assert.match(manage,/kind==="reviewer-account"/);
  assert.match(shared,/CREATE TABLE IF NOT EXISTS reviewer_accounts/);
  assert.match(schema,/reviewerAccounts = sqliteTable\("reviewer_accounts"/);
  assert.match(schema,/reviewerChurchReviews = sqliteTable\("reviewer_church_reviews"/);
  assert.match(access,/reviewerId/);
  assert.match(manage,/INSERT INTO reviewer_church_reviews/);
  assert.match(manage,/DELETE FROM reviewer_church_reviews WHERE reviewer_id=\?/);
  assert.match(manage,/DELETE FROM reviewer_accounts WHERE id=\?/);
  assert.match(manage,/DELETE FROM church_recommendations WHERE id=\?/);
  assert.match(manage,/DELETE FROM \$\{table\} WHERE id=\?/);
  assert.match(controls,/이 목회자 계정과 검토 기록을 모두 삭제할까요/);
  for(const label of ["교회 추천","익명 글","달란트"]) assert.match(controls,new RegExp(label));
  assert.match(admin,/href="\/pastor">목사님 페이지/);
  assert.match(admin,/관리자가 최종 결정/);
  assert.match(admin,/opinionsByChurch/);
  const review=await readFile(new URL("../app/pastor/page.tsx",import.meta.url),"utf8");
  assert.match(review,/href="\/admin">전체 관리/);
});

test("shows reviewer decisions as one-tap choices with a right-aligned save", async () => {
  const [controls,styles]=await Promise.all([readFile(new URL("../app/admin/admin-controls.tsx",import.meta.url),"utf8"),readFile(new URL("../app/globals.css",import.meta.url),"utf8")]);
  assert.match(controls,/useState\(props\.holdReason \|\| "review_needed"\)/);
  assert.match(controls,/className="review-result-options"/);
  assert.match(controls,/type="radio" name="status"/);
  assert.match(controls,/className="review-save-row"/);
  assert.match(styles,/\.church-review-control \.review-save-row \{ justify-content:flex-end; \}/);
});

test("gives pastors a focused queue and groups concern resolution safely for administrators", async () => {
  const [admin,review,quickQueue,resolutionControls,liveRefresh,manage,shared,schema,migration,styles]=await Promise.all([
    readFile(new URL("../app/admin/page.tsx",import.meta.url),"utf8"),
    readFile(new URL("../app/pastor/page.tsx",import.meta.url),"utf8"),
    readFile(new URL("../app/pastor/quick-review-queue.tsx",import.meta.url),"utf8"),
    readFile(new URL("../app/admin/reviewer-resolution-controls.tsx",import.meta.url),"utf8"),
    readFile(new URL("../app/admin/admin-live-refresh.tsx",import.meta.url),"utf8"),
    readFile(new URL("../app/api/admin/manage/route.ts",import.meta.url),"utf8"),
    readFile(new URL("../app/api/_shared.ts",import.meta.url),"utf8"),
    readFile(new URL("../db/schema.ts",import.meta.url),"utf8"),
    readFile(new URL("../drizzle/0008_fat_silverclaw.sql",import.meta.url),"utf8"),
    readFile(new URL("../app/globals.css",import.meta.url),"utf8"),
  ]);
  assert.match(shared,/ALTER TABLE reviewer_church_reviews ADD COLUMN handled_at TEXT/);
  assert.match(shared,/ALTER TABLE reviewer_church_reviews ADD COLUMN admin_resolution TEXT/);
  assert.match(schema,/handledAt:text\("handled_at"\)/);
  assert.match(schema,/adminResolution:text\("admin_resolution"\)/);
  assert.match(manage,/kind==="church-review-resolution"/);
  assert.match(manage,/reviewed_at=\?/);
  assert.match(manage,/claimToken=`processing:\$\{crypto\.randomUUID\(\)\}`/);
  assert.match(manage,/review_resolution_token/);
  assert.match(manage,/claimResults\.slice\(1\)\.some/);
  assert.match(manage,/review_status IN \('approved','removed'\) LIMIT 1/);
  assert.match(admin,/id="reviewer-queue"/);
  assert.match(admin,/목사님이 확인을 요청한 교회/);
  assert.match(admin,/pendingConcernGroups/);
  assert.match(admin,/ReviewerResolutionControls/);
  assert.doesNotMatch(admin,/pendingOpinions/);
  assert.match(resolutionControls,/공개 유지하고 완료/);
  assert.match(resolutionControls,/보류하고 완료/);
  assert.match(resolutionControls,/추가 확인 필요/);
  assert.match(resolutionControls,/existingHoldReason/);
  assert.match(review,/id="review-todo"/);
  assert.match(review,/QuickReviewQueue[^>]*todo=\{todo\}[^>]*total=/);
  assert.match(review,/id="review-concern"/);
  assert.match(review,/id="review-done"/);
  assert.match(review,/운영팀이 의견을 살펴보고 있습니다/);
  assert.match(review,/r\.reviewer_id=\?/);
  assert.match(quickQueue,/특이사항 없습니다/);
  assert.match(quickQueue,/검토 의견 보내기/);
  assert.match(quickQueue,/setQueue\(next\)/);
  assert.doesNotMatch(quickQueue,/window\.location\.reload/);
  assert.match(quickQueue,/router\.refresh\(\)/);
  assert.match(quickQueue,/공식 홈페이지 확인/);
  assert.doesNotMatch(quickQueue,/disabled=\{busy\|\|!hasReference\}/);
  assert.match(quickQueue,/아직 살펴볼 교회 전체 목록/);
  assert.match(quickQueue,/살펴볼 교회 검색/);
  assert.match(quickQueue,/selectChurch\(church\.id\)/);
  assert.match(quickQueue,/upcoming\.map\(\(church\) => <li key=\{church\.id\}><button type="button" onClick=\{\(\)=>selectChurch\(church\.id\)\}/);
  assert.match(quickQueue,/이단성·교리 검토 필요/);
  assert.match(quickQueue,/목회자 관련 우려/);
  assert.match(quickQueue,/교회 운영·윤리 문제/);
  assert.doesNotMatch(quickQueue,/공식 채널 아님|최근 활동 없음/);
  assert.match(quickQueue,/알고 계신 내용 또는 확인 근거 <small>· 선택<\/small>/);
  assert.doesNotMatch(quickQueue,/note\.trim\(\)\.length < 3/);
  assert.match(review,/COALESCE\(r\.status,'unreviewed'\)='unreviewed' ORDER BY c\.name/);
  assert.match(review,/SUM\(CASE WHEN c\.review_status='approved'/);
  assert.match(migration,/CREATE TABLE IF NOT EXISTS `reviewer_church_reviews`/);
  assert.match(migration,/`admin_resolution` text/);
  assert.match(migration,/ADD `review_resolution_token` text/);
  assert.match(liveRefresh,/document\.visibilityState!=="visible"/);
  assert.match(liveRefresh,/active instanceof HTMLTextAreaElement/);
  assert.match(styles,/\.reviewer-queue/);
  assert.match(styles,/\.quick-review-actions/);
});

test("applies every migration to a fresh database including reviewer workflow tables", async () => {
  const migrationFiles=["0000_public_joseph.sql","0001_condemned_toxin.sql","0002_thankful_storm.sql","0003_chilly_chamber.sql","0004_fuzzy_slayback.sql","0005_medical_shadowcat.sql","0006_legal_stranger.sql","0007_pinup_priority.sql","0008_fat_silverclaw.sql"];
  const sql=(await Promise.all(migrationFiles.map((file)=>readFile(new URL(`../drizzle/${file}`,import.meta.url),"utf8")))).join("\n");
  const directory=await mkdtemp(join(tmpdir(),"airchurch-migrations-"));
  const databasePath=join(directory,"fresh.sqlite");
  try {
    const migrated=spawnSync("sqlite3",[databasePath],{input:sql,encoding:"utf8"});
    assert.equal(migrated.status,0,migrated.stderr);
    const checked=spawnSync("sqlite3",[databasePath,"SELECT name FROM sqlite_master WHERE type='table' AND name IN ('reviewer_accounts','reviewer_church_reviews') ORDER BY name; PRAGMA table_info(reviewer_church_reviews); PRAGMA table_info(churches);"],{encoding:"utf8"});
    assert.equal(checked.status,0,checked.stderr);
    assert.match(checked.stdout,/reviewer_accounts/);
    assert.match(checked.stdout,/reviewer_church_reviews/);
    assert.match(checked.stdout,/admin_resolution/);
    assert.match(checked.stdout,/review_resolution_token/);
  } finally {
    await rm(directory,{recursive:true,force:true});
  }
});

test("upgrades the legacy reviewer table without losing existing opinions", async () => {
  const migration=await readFile(new URL("../drizzle/0008_fat_silverclaw.sql",import.meta.url),"utf8");
  const legacy="CREATE TABLE churches (id INTEGER PRIMARY KEY); CREATE TABLE reviewer_church_reviews (id INTEGER PRIMARY KEY AUTOINCREMENT,reviewer_id INTEGER NOT NULL,church_id INTEGER NOT NULL,status TEXT NOT NULL DEFAULT 'unreviewed',note TEXT,reviewed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,handled_at TEXT,UNIQUE(reviewer_id,church_id)); INSERT INTO reviewer_church_reviews (reviewer_id,church_id,status,note,handled_at) VALUES (7,11,'concern','기존 의견',NULL);";
  const directory=await mkdtemp(join(tmpdir(),"airchurch-legacy-migration-"));
  const databasePath=join(directory,"legacy.sqlite");
  try {
    const migrated=spawnSync("sqlite3",[databasePath],{input:`${legacy}\n${migration}`,encoding:"utf8"});
    assert.equal(migrated.status,0,migrated.stderr);
    const checked=spawnSync("sqlite3",[databasePath,"SELECT reviewer_id,church_id,status,note FROM reviewer_church_reviews; PRAGMA table_info(reviewer_church_reviews);"],{encoding:"utf8"});
    assert.equal(checked.status,0,checked.stderr);
    assert.match(checked.stdout,/7\|11\|concern\|기존 의견/);
    assert.match(checked.stdout,/admin_resolution/);
    assert.match(checked.stdout,/admin_note/);
    assert.match(checked.stdout,/resolved_by/);
  } finally {
    await rm(directory,{recursive:true,force:true});
  }
});

test("adapts administrator and pastor screens for tablet and phone without clipping titles", async () => {
  const styles=await readFile(new URL("../app/globals.css",import.meta.url),"utf8");
  assert.match(styles,/@media \(min-width:601px\) and \(max-width:999px\) \{[\s\S]*?\.admin-metrics\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}[\s\S]*?\.admin-operations\{grid-template-columns:repeat\(3,minmax\(0,1fr\)\)\}[\s\S]*?\.reviewer-church-list\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}/);
  assert.match(styles,/@media \(max-width:600px\) \{[\s\S]*?\.admin-metrics,[^}]*\.reviewer-metrics,[^}]*\.reviewer-queue-list\{grid-template-columns:1fr\}/);
  const titleRule=styles.match(/\.admin-title h1,\.admin-panel-title h2,[^{]+\{([^}]*)\}/)?.[1]??"";
  assert.match(titleRule,/overflow:visible/);
  assert.match(titleRule,/text-overflow:clip/);
  assert.match(titleRule,/white-space:normal/);
  assert.match(titleRule,/word-break:keep-all/);
  assert.match(styles,/\.path-list span\{overflow:visible;text-overflow:clip;white-space:normal/);
  assert.match(styles,/\.sermon-copy h3\{display:block;min-height:0;overflow:visible;-webkit-line-clamp:unset\}/);
  assert.match(styles,/\.quick-review-all ul\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(styles,/@media \(max-width:999px\)\{[\s\S]*?\.admin-title p\{font-size:15px;line-height:1\.65\}[\s\S]*?\.reviewer-opinion-copy p\{font-size:14px;line-height:1\.7\}/);
  assert.match(styles,/\.quick-review-concern>label\{[^}]*font-size:17px!important;[^}]*font-weight:900!important/);
  assert.match(styles,/\.quick-review-concern>label small\{[^}]*color:#526a62!important;[^}]*font-size:16px!important/);
  assert.match(styles,/\.quick-review-concern textarea\{[^}]*font-size:17px!important/);
  assert.match(styles,/\.admin-shell :where\(p,small,span,strong,b,label,legend,button,a,input,textarea,select,time,em\),\.admin-login-shell :where\(p,small,span,strong,b,label,button,a,input\)\{font-size:14px!important;line-height:1\.55\}/);
  assert.match(styles,/\.reviewer-shell \.quick-review-actions button,[^{]+\{min-height:52px!important/);
  assert.match(styles,/@media \(max-width:760px\)\{[\s\S]*?\.reviewer-shell \.quick-review-reasons\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}/);
});

test("keeps the home footer labels intact and gives edge panels responsive gutters", async () => {
  const [page,styles]=await Promise.all([readFile(new URL("../app/home-client.tsx",import.meta.url),"utf8"),readFile(new URL("../app/globals.css",import.meta.url),"utf8")]);
  assert.match(page,/className="footer-links"/);
  assert.match(styles,/\.footer-links a \{ flex:none;white-space:nowrap; \}/);
  assert.match(styles,/@media \(max-width:1000px\) \{ footer\{grid-template-columns:auto 1fr/);
  assert.match(styles,/\.community-section \{ max-width:1180px;margin:auto;padding:100px 24px/);
  assert.match(styles,/\.safety-section \{ max-width:1180px;margin:auto;padding:100px 24px/);
  assert.match(styles,/\.approved-section \{ max-width:1180px;margin:auto;padding:0 24px 90px/);
});

test("right-aligns the login return links", async () => {
  const [login,signup,styles]=await Promise.all([readFile(new URL("../app/admin/admin-login.tsx",import.meta.url),"utf8"),readFile(new URL("../app/pastor/join/reviewer-signup.tsx",import.meta.url),"utf8"),readFile(new URL("../app/globals.css",import.meta.url),"utf8")]);
  assert.match(login,/className="admin-login-links"/);
  assert.match(signup,/className="admin-login-links single"/);
  assert.match(signup,/운영팀 승인 후 교회 검토에 참여하실 수 있습니다/);
  assert.match(styles,/\.admin-login-links\.single \{ justify-content:flex-end; \}/);
});

test("uses pastor as the public ministry route and preserves legacy review links", async () => {
  const [legacyPage,legacyJoin,login,footer]=await Promise.all([
    readFile(new URL("../app/review/page.tsx",import.meta.url),"utf8"),
    readFile(new URL("../app/review/join/page.tsx",import.meta.url),"utf8"),
    readFile(new URL("../app/admin/admin-login.tsx",import.meta.url),"utf8"),
    readFile(new URL("../app/home-client.tsx",import.meta.url),"utf8"),
  ]);
  assert.match(legacyPage,/redirect\("\/pastor"\)/);
  assert.match(legacyJoin,/redirect\("\/pastor\/join"\)/);
  assert.match(login,/result\.role === "reviewer" \? "\/pastor"/);
  assert.match(footer,/href="\/pastor">목사님/);
});

test("links church directory cards to verified homepages and official YouTube channels", async () => {
  const [page,route,homepages,images,styles]=await Promise.all([readFile(new URL("../app/home-client.tsx",import.meta.url),"utf8"),readFile(new URL("../app/api/churches/route.ts",import.meta.url),"utf8"),readFile(new URL("../app/church-homepages.ts",import.meta.url),"utf8"),readFile(new URL("../app/church-images.ts",import.meta.url),"utf8"),readFile(new URL("../app/globals.css",import.meta.url),"utf8")]);
  assert.match(route,/youtube_channel_id AS youtubeChannelId/);
  assert.match(route,/homepage_url AS homepageUrl/);
  assert.match(route,/channel_image_url AS channelImageUrl/);
  assert.match(route,/LIMIT 1000/);
  assert.match(page,/church-directory-links/);
  assert.match(page,/className="church-directory-meta"/);
  assert.match(page,/const churchPrimaryUrl=church\.homepageUrl\|\|/);
  assert.match(page,/className="church-primary-link"/);
  assert.match(page,/\/api\/churches\?catalog=60/);
  assert.match(page,/church\.homepageUrl/);
  assert.doesNotMatch(page,/search\.naver\.com/);
  assert.match(page,/youtube\.com\/channel/);
  assert.match(page,/homepage-link/);
  assert.match(page,/youtube-icon/);
  assert.match(page,/channelImageUrl/);
  assert.match(route,/churchHomepageUrls\[church\.name\]/);
  assert.match(route,/churchImageUrls\[church\.name\]/);
  assert.match(route,/churchImageUrls\[church\.name\]\|\|church\.channelImageUrl\|\|null/);
  assert.match(homepages,/"선한목자교회": "https:\/\/www\.gsmch\.org\/"/);
  assert.match(homepages,/"대구동부교회": "https:\/\/dongbu\.org\/"/);
  assert.doesNotMatch(homepages,/ycmc\.church/);
  assert.doesNotMatch(images,/ycmc\.church/);
  assert.doesNotMatch(route,/new URL\("\/favicon\.ico",homepageUrl\)/);
  assert.match(homepages,/"온누리교회": "https:\/\/www\.onnuri\.org\/"/);
  assert.match(images,/"거룩한빛광성교회": "https:\/\/kwangsung\.org\/UserData/);
  assert.match(page,/className="homepage-visual"/);
  assert.match(page,/⛪/);
  assert.match(styles,/\.church-directory-links/);
  assert.match(styles,/\.church-directory-meta \{/);
  assert.match(styles,/\.church-primary-link:hover/);
  assert.match(styles,/\.homepage-visual img/);
  assert.match(page,/className="church-denomination-mark"/);
  assert.match(page,/\/denominations\/pck-tonghap\.png/);
  assert.match(page,/<small>\{church\.denomination\}<\/small>/);
  assert.match(styles,/\.church-denomination-mark \{/);
  assert.match(styles,/\.church-denomination-mark \{ width:9px;height:12px;/);
});
