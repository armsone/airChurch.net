import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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
  const html=await response.text(); assert.match(html,/<title>에어처치 \| 말씀과 선한 마음이 만나는 곳<\/title>/); assert.match(html,/좋은 말씀과/); assert.match(html,/착한나눔/); assert.match(html,/달란트 브릿지/); assert.match(html,/나와 맞는 교회를 찾아보세요/); assert.match(html,/AI가 찾고, 기준을 통과한 교회만 등록합니다\./); assert.match(html,/건강한 신앙 생태계/); assert.doesNotMatch(html,/codex-preview|SkeletonPreview|react-loading-skeleton/);
});

test("gives every managed church a clear management control", async () => {
  const controls = await readFile(new URL("../app/admin/admin-controls.tsx",import.meta.url),"utf8");
  assert.match(controls, /교회 정보 및 공개 상태 관리/);
  assert.match(controls, /관리 화면 닫기/);
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
  assert.match(review,/수정은 하나씩, 보류는 한 번에/);
  assert.match(review,/ChurchRequestManager/);
  assert.match(controls,/admin-church-details/);
  assert.match(manage,/role==="reviewer"&&kind!=="church-change-request"/);
  assert.match(access,/REVIEWER_USERNAME/);
  assert.match(access,/REVIEWER_PASSWORD/);
  assert.match(schema,/churchRecommendations = sqliteTable\("church_recommendations"/);
  assert.match(schema,/reviewerStatus: text\("reviewer_status"\)/);
  assert.match(schema,/churchChangeRequests = sqliteTable\("church_change_requests"/);
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
  assert.match(page,/visibleSermonCount,setVisibleSermonCount\]=useState\(6\)/);
  assert.match(page,/visibleSermons = filtered\.slice\(0,visibleSermonCount\)/);
  assert.match(page,/previewSermons = filtered\.slice\(visibleSermonCount,visibleSermonCount\+3\)/);
  assert.match(page,/눌러서 말씀 더 보기/);
  assert.match(page,/말씀 18개 더 보기/);
  assert.match(page,/setVisibleSermonCount\(\(count\)=>count\+18\)/);
  assert.doesNotMatch(page,/말씀 21개 더 보기/);
  assert.doesNotMatch(page,/setVisibleSermonCount\(\(count\)=>count\+21\)/);
  assert.match(page,/<LoadingCards count=\{6\} \/>/);
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
  for(const label of ["현재 접속자","시간별 방문","날짜별 방문","월별 방문"]) assert.match(admin,new RegExp(label));
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
  const [access,signup,login,admin,manage,shared,schema,controls,adminListSearch]=await Promise.all([
    readFile(new URL("../app/admin-access.ts",import.meta.url),"utf8"),
    readFile(new URL("../app/api/reviewer-signup/route.ts",import.meta.url),"utf8"),
    readFile(new URL("../app/admin/admin-login.tsx",import.meta.url),"utf8"),
    readFile(new URL("../app/admin/page.tsx",import.meta.url),"utf8"),
    readFile(new URL("../app/api/admin/manage/route.ts",import.meta.url),"utf8"),
    readFile(new URL("../app/api/_shared.ts",import.meta.url),"utf8"),
    readFile(new URL("../db/schema.ts",import.meta.url),"utf8"),
    readFile(new URL("../app/admin/admin-controls.tsx",import.meta.url),"utf8"),
    readFile(new URL("../app/admin/admin-list-search.tsx",import.meta.url),"utf8"),
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
  assert.match(admin,/목사님 요청 결정/);
  assert.match(admin,/ChurchRequestResolution/);
  assert.match(admin,/ChurchReferenceLinks/);
  assert.match(admin,/ChurchInfoEditControls/);
  assert.match(admin,/initialLimit=\{20\}/);
  assert.match(admin,/initialLimit=\{10\}/);
  assert.equal((admin.match(/initialLimit=\{20\}/g)??[]).length,1);
  assert.equal((admin.match(/initialLimit=\{10\}/g)??[]).length,1);
  assert.match(adminListSearch,/다른 \{initialLimit\}곳 보기/);
  assert.match(controls,/data-admin-preview/);
  assert.match(admin,/church_homepage_url/);
  assert.match(admin,/church_youtube_channel_id/);
  assert.match(admin,/문제가 제보된 교회/);
  assert.match(admin,/ReviewerResolutionControls/);
  const review=await readFile(new URL("../app/pastor/page.tsx",import.meta.url),"utf8");
  assert.match(review,/href="\/admin">전체 관리/);
});

test("gives pastors a searchable request desk and administrators a focused decision queue", async () => {
  const [admin,review,requestManager,requestResolution,resolutionControls,liveRefresh,manage,shared,schema,migration,styles]=await Promise.all([
    readFile(new URL("../app/admin/page.tsx",import.meta.url),"utf8"),
    readFile(new URL("../app/pastor/page.tsx",import.meta.url),"utf8"),
    readFile(new URL("../app/pastor/church-request-manager.tsx",import.meta.url),"utf8"),
    readFile(new URL("../app/admin/church-request-resolution.tsx",import.meta.url),"utf8"),
    readFile(new URL("../app/admin/reviewer-resolution-controls.tsx",import.meta.url),"utf8"),
    readFile(new URL("../app/admin/admin-live-refresh.tsx",import.meta.url),"utf8"),
    readFile(new URL("../app/api/admin/manage/route.ts",import.meta.url),"utf8"),
    readFile(new URL("../app/api/_shared.ts",import.meta.url),"utf8"),
    readFile(new URL("../db/schema.ts",import.meta.url),"utf8"),
    readFile(new URL("../drizzle/0009_church_change_requests.sql",import.meta.url),"utf8"),
    readFile(new URL("../app/globals.css",import.meta.url),"utf8"),
  ]);
  assert.match(shared,/CREATE TABLE IF NOT EXISTS church_change_requests/);
  assert.match(schema,/churchChangeRequests = sqliteTable\("church_change_requests"/);
  assert.match(migration,/CREATE TABLE IF NOT EXISTS `church_change_requests`/);
  assert.match(manage,/kind==="church-change-request"/);
  assert.match(manage,/kind==="church-change-request-resolution"/);
  assert.match(manage,/const kind = clean\(data\.kind, 40\)/);
  assert.match(manage,/kind==="church-info"/);
  assert.match(manage,/UPDATE praise_videos SET status='hidden'/);
  assert.match(admin,/id="reviewer-queue"/);
  assert.match(admin,/목사님 요청 결정/);
  assert.match(admin,/ChurchRequestResolution/);
  assert.doesNotMatch(admin,/목회자 미검토/);
  assert.doesNotMatch(admin,/수집 영상 긴급 관리/);
  assert.doesNotMatch(admin,/인기 페이지/);
  assert.match(admin,/최근 14일/);
  assert.match(admin,/WITH RECURSIVE dates/);
  assert.match(admin,/빠진 날짜 없이/);
  assert.match(admin,/LIMIT 2000/);
  assert.match(requestResolution,/그대로 승인/);
  assert.match(requestResolution,/>반려</);
  assert.match(requestResolution,/일단 보류/);
  assert.match(review,/ChurchRequestManager/);
  assert.match(review,/수정은 하나씩, 보류는 한 번에/);
  assert.match(requestManager,/교회명, 목사님, 지역, 교단 검색/);
  assert.match(review,/homepage_url,youtube_channel_id/);
  assert.match(review,/ORDER BY RANDOM\(\) LIMIT 20/);
  assert.match(requestManager,/featuredChurches/);
  assert.match(requestManager,/holdIds/);
  assert.match(requestManager,/한 번에 보류 제안/);
  assert.match(requestManager,/다른 교회 20곳 보기/);
  assert.match(requestManager,/showOtherChurches/);
  assert.match(requestManager,/홈페이지 ↗/);
  assert.match(requestManager,/YouTube ↗/);
  assert.match(requestManager,/등록된 확인 링크 없음/);
  assert.doesNotMatch(requestManager,/slice\(0,40\)/);
  assert.match(styles,/\.pastor-search-results\{max-height:none;overflow:visible\}/);
  assert.match(requestManager,/내용 수정하기/);
  assert.match(requestManager,/보류로 보내기/);
  assert.match(requestManager,/수정 이유/);
  assert.match(requestManager,/보류 이유/);
  assert.match(requestManager,/관리자 답변/);
  assert.match(resolutionControls,/>공개<\/button>/);
  assert.match(resolutionControls,/>보류<\/button>/);
  assert.match(resolutionControls,/>재검토<\/button>/);
  assert.match(resolutionControls,/>삭제<\/button>/);
  assert.match(manage,/"kept_public","held","needs_follow_up","deleted"/);
  assert.match(manage,/resolution==="deleted"/);
  assert.match(liveRefresh,/document\.visibilityState!=="visible"/);
  assert.match(liveRefresh,/active instanceof HTMLTextAreaElement/);
  assert.match(styles,/\.reviewer-queue/);
  assert.match(styles,/\.pastor-request-actions/);
});

test("applies every migration to a fresh database including reviewer workflow tables", async () => {
  const migrationFiles=["0000_public_joseph.sql","0001_condemned_toxin.sql","0002_thankful_storm.sql","0003_chilly_chamber.sql","0004_fuzzy_slayback.sql","0005_medical_shadowcat.sql","0006_legal_stranger.sql","0007_pinup_priority.sql","0008_fat_silverclaw.sql","0009_church_change_requests.sql","0010_church_shorts.sql"];
  const sql=(await Promise.all(migrationFiles.map((file)=>readFile(new URL(`../drizzle/${file}`,import.meta.url),"utf8")))).join("\n");
  const directory=await mkdtemp(join(tmpdir(),"airchurch-migrations-"));
  const databasePath=join(directory,"fresh.sqlite");
  try {
    const migrated=spawnSync("sqlite3",[databasePath],{input:sql,encoding:"utf8"});
    assert.equal(migrated.status,0,migrated.stderr);
    const checked=spawnSync("sqlite3",[databasePath,"SELECT name FROM sqlite_master WHERE type='table' AND name IN ('reviewer_accounts','reviewer_church_reviews','church_change_requests','church_shorts') ORDER BY name; PRAGMA table_info(reviewer_church_reviews); PRAGMA table_info(church_change_requests); PRAGMA table_info(churches); PRAGMA table_info(church_shorts);"],{encoding:"utf8"});
    assert.equal(checked.status,0,checked.stderr);
    assert.match(checked.stdout,/reviewer_accounts/);
    assert.match(checked.stdout,/reviewer_church_reviews/);
    assert.match(checked.stdout,/church_change_requests/);
    assert.match(checked.stdout,/church_shorts/);
    assert.match(checked.stdout,/request_type/);
    assert.match(checked.stdout,/admin_resolution/);
    assert.match(checked.stdout,/review_resolution_token/);
    assert.match(checked.stdout,/youtube_id/);
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

test("syncs every registered denomination without breaking existing scopes", async () => {
  const [route,kosinSources,prokSources]=await Promise.all([
    readFile(new URL("../app/api/sermons/sync/route.ts",import.meta.url),"utf8"),
    readFile(new URL("../app/api/sermons/kosin-sources.ts",import.meta.url),"utf8"),
    readFile(new URL("../app/api/sermons/prok-sources.ts",import.meta.url),"utf8"),
  ]);
  assert.match(route,/import \{ kosinSources \} from "\.\.\/kosin-sources";/);
  assert.match(route,/import \{ prokSources \} from "\.\.\/prok-sources";/);
  assert.match(route,/\.\.\.publicRemainingSources,\n\];/);
  assert.match(route,/const scopedSources=\{hapdong:hapdongSources,kosin:kosinSources,prok:prokSources,tonghap:tonghapSources,kmc:kmcSources,salvation:salvationSources,public_remaining:publicRemainingSources\}/);
  assert.match(route,/scope=requestedScope&&requestedScope in scopedSources\?requestedScope as keyof typeof scopedSources:"all"/);
  assert.match(route,/sourcePool:readonly Source\[\]=scope==="all"\?sources:scopedSources\[scope\]/);
  assert.match(route,/syncKey=scope==="all"\?"youtube-v9-regional-130":`youtube-v9-\$\{scope\}`/);
  assert.match(kosinSources,/export const kosinSources=\[/);
  assert.match(kosinSources,/\] as const;/);
  assert.match(prokSources,/export const prokSources=\[/);
  assert.match(prokSources,/\] as const;/);
});

test("generalizes the registration CLI for every supported scope", async () => {
  const cliPath=new URL("../scripts/register-verified-churches.mjs",import.meta.url);
  const cli=await readFile(cliPath,"utf8");
  assert.match(cli,/DEFAULT_SOURCES_BY_SCOPE = \{/);
  assert.match(cli,/hapdong: "app\/api\/sermons\/hapdong-sources\.ts"/);
  assert.match(cli,/kosin: "app\/api\/sermons\/kosin-sources\.ts"/);
  assert.match(cli,/prok: "app\/api\/sermons\/prok-sources\.ts"/);
  assert.match(cli,/const DEFAULT_SCOPE = "hapdong";/);
  assert.match(cli,/--scope <hapdong\|kosin\|prok\|tonghap\|kmc\|salvation\|anglican\|yehc\|nazarene\|bokum>/);
  assert.match(cli,/url\.searchParams\.set\("scope",SYNC_SCOPE_BY_SCOPE\[args\.scope\]\|\|args\.scope\)/);

  const help=spawnSync(process.execPath,[cliPath.pathname,"--help"],{encoding:"utf8"});
  assert.equal(help.status,0);
  assert.match(help.stdout,/--scope <hapdong\|kosin\|prok\|tonghap\|kmc\|salvation\|anglican\|yehc\|nazarene\|bokum>/);
  assert.match(help.stdout,/scope kosin --sync/);
  assert.match(help.stdout,/scope prok --sync/);

  const invalidScope=spawnSync(process.execPath,[cliPath.pathname,"--scope","bogus","--prepare","--input","missing.json"],{encoding:"utf8"});
  assert.notEqual(invalidScope.status,0);
  assert.match(invalidScope.stderr,/알 수 없는 --scope: bogus/);

  const directory=await mkdtemp(join(tmpdir(),"airchurch-register-"));
  try {
    const inputPath=join(directory,"kosin-verified.json");
    const sourcesPath=join(directory,"kosin-sources.ts");
    await writeFile(inputPath,JSON.stringify({approved:[{name:"테스트고신교회",pastor:"홍길동 목사",region:"서울 종로",denomination:"대한예수교장로회 고신",channelId:"UC12345678901234567890",status:"verified"},{name:"미승인고신교회",pastor:"이대기 목사",region:"서울 종로",denomination:"대한예수교장로회 고신",channelId:"UC00000000000000000000",status:"pending"}]}),"utf8");
    await writeFile(sourcesPath,"export const kosinSources=[\n] as const;\n","utf8");
    const kosinPrepare=spawnSync(process.execPath,[cliPath.pathname,"--scope","kosin","--sources",sourcesPath,"--input",inputPath,"--prepare"],{encoding:"utf8"});
    assert.equal(kosinPrepare.status,0,kosinPrepare.stderr);
    const kosinReport=JSON.parse(kosinPrepare.stdout);
    assert.equal(kosinReport.prepare.mode,"preview");
    assert.equal(kosinReport.prepare.added,1);

    const hapdongInputPath=join(directory,"hapdong-verified.json");
    const hapdongSourcesPath=join(directory,"hapdong-sources.ts");
    await writeFile(hapdongInputPath,JSON.stringify({approved:[{name:"테스트합동교회",pastor:"김철수 목사",region:"서울 강남",denomination:"대한예수교장로회 합동",channelId:"UC98765432109876543210",status:"verified"}]}),"utf8");
    await writeFile(hapdongSourcesPath,"export const hapdongSources=[\n] as const;\n","utf8");
    const defaultScopePrepare=spawnSync(process.execPath,[cliPath.pathname,"--sources",hapdongSourcesPath,"--input",hapdongInputPath,"--prepare"],{encoding:"utf8"});
    assert.equal(defaultScopePrepare.status,0,defaultScopePrepare.stderr);
    const defaultReport=JSON.parse(defaultScopePrepare.stdout);
    assert.equal(defaultReport.prepare.added,1);

    const explicitHapdongPrepare=spawnSync(process.execPath,[cliPath.pathname,"--scope","hapdong","--sources",hapdongSourcesPath,"--input",hapdongInputPath,"--prepare"],{encoding:"utf8"});
    assert.equal(explicitHapdongPrepare.status,0,explicitHapdongPrepare.stderr);
    const explicitReport=JSON.parse(explicitHapdongPrepare.stdout);
    assert.equal(explicitReport.prepare.added,1);

  } finally {
    await rm(directory,{recursive:true,force:true});
  }
});

test("links church directory cards to verified homepages and official YouTube channels", async () => {
  const [page,route,homepages,images,styles]=await Promise.all([readFile(new URL("../app/home-client.tsx",import.meta.url),"utf8"),readFile(new URL("../app/api/churches/route.ts",import.meta.url),"utf8"),readFile(new URL("../app/church-homepages.ts",import.meta.url),"utf8"),readFile(new URL("../app/church-images.ts",import.meta.url),"utf8"),readFile(new URL("../app/globals.css",import.meta.url),"utf8")]);
  assert.match(route,/youtube_channel_id AS youtubeChannelId/);
  assert.match(route,/homepage_url AS homepageUrl/);
  assert.match(route,/channel_image_url AS channelImageUrl/);
  assert.match(route,/const isSearch=Boolean\(query\)/);
  assert.match(route,/isSearch\?200:1000/);
  assert.match(route,/SELECT COUNT\(\*\) AS total/);
  assert.match(route,/const count=await db\.prepare/);
  assert.match(route,/\.bind\(\.\.\.bindings\)/);
  assert.match(page,/window\.setTimeout\(async\(\)=>\{/);
  assert.match(page,/\},300\)/);
  assert.match(page,/controller\.abort\(\)/);
  assert.match(page,/new URLSearchParams\(\{q:trimmed\}\)/);
  assert.match(page,/isUnfilteredChurchDirectory\?`전국/);
  assert.match(page,/setChurchTotal\(result\.total/);
  assert.match(page,/hasActiveChurchFilter\?\(showAllChurches\?filteredChurches/);
  assert.match(page,/교회 레이더/);
  assert.doesNotMatch(page,/현 위치 주변 교회/);
  assert.match(page,/지역으로 찾기/);
  assert.match(page,/교단으로 찾기/);
  assert.doesNotMatch(page,/교회·목사님 검색/);
  assert.match(page,/const radarChurches=useMemo/);
  assert.match(page,/churchRadarRefresh/);
  assert.match(page,/다른 교회 만나보기/);
  assert.match(page,/const prioritized=filteredChurches\.filter/);
  assert.match(page,/const standard=shuffled/);
  assert.match(page,/filteredChurches\.slice\(0,12\)\):radarChurches/);
  assert.doesNotMatch(page,/className="church-match-reason"/);
  assert.doesNotMatch(page,/전체 등록교회 보기/);
  assert.match(page,/id="church-radar-region"/);
  assert.doesNotMatch(page,/navigator\.geolocation/);
  assert.match(page,/church-directory-links/);
  assert.match(page,/className="church-directory-meta"/);
  assert.match(page,/const churchPrimaryUrl=church\.homepageUrl\|\|/);
  assert.match(page,/className="church-primary-link"/);
  assert.match(page,/\/api\/churches\?catalog=1000&count=full/);
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
  assert.match(styles,/\.church-radar-actions \{/);
  assert.match(styles,/\.church-radar-results-heading \{/);
  assert.match(styles,/\.church-primary-link:hover/);
  assert.match(styles,/\.homepage-visual img/);
  assert.match(page,/className="church-denomination-mark"/);
  assert.match(page,/aria-label="교단 선택"/);
  assert.match(page,/전체 교단/);
  assert.match(page,/s\.denomination === denomination/);
  assert.match(page,/\/denominations\/pck-tonghap\.png/);
  assert.match(page,/denomination === "대한예수교장로회 통합"/);
  assert.doesNotMatch(page,/denomination\.includes\("통합"\)/);
  for (const asset of [
    "pck-hapdong.svg", "kmc.ico", "pck-kosin.jpg", "kbch.png", "kehc.png",
    "pck-hapshin.png", "pck-baekseok.png", "agk.png", "agk-gwanghwamun.png",
    "prok.png", "kaicam.png",
  ]) assert.match(page,new RegExp(`/denominations/${asset.replace(".","\\.")}`));
  assert.match(page,/기독교대한하나님의성회 광화문총회/);
  assert.match(page,/<small>\{church\.denomination\}<\/small>/);
  assert.match(styles,/\.church-denomination-mark \{/);
  assert.match(styles,/\.church-denomination-mark \{ width:21px;height:21px;/);
});

test("discloses AI registration source criteria in a collapsed, accessible panel", async () => {
  const [page,styles]=await Promise.all([readFile(new URL("../app/home-client.tsx",import.meta.url),"utf8"),readFile(new URL("../app/globals.css",import.meta.url),"utf8")]);
  assert.match(page,/교단·노회와 교회가 일반에 공개한 공식 정보만 자동으로 확인합니다\. 로그인·비공개 영역과 개인 민감정보는 수집하지 않으며, 교회명·지역·담임목사와 공식 홈페이지 또는 YouTube 채널을 교차 검증합니다\. 홈페이지가 없어도 정보가 일치하고 최근 180일 이내 설교·예배 영상이 확인되면 자동으로 등록·공개됩니다\./);
  assert.match(page,/<details className="church-radar-sources"><summary>자료 확인 기준과 출처<\/summary>/);
  assert.doesNotMatch(page,/church-radar-sources"[^>]*\bopen\b/);
  assert.match(page,/로그인 없이 공개된 자료만 확인합니다\./);
  for(const label of ["교단명","공식 출처","공개/로그인 여부","마지막 확인일"]) assert.match(page,new RegExp(`<th scope="col">${label}</th>`));
  assert.match(page,/churchSourceRows = knownDenominations\.map/);
  assert.match(page,/access: "공개\(로그인 없이 열람 가능\)"/);
  assert.match(page,/lastChecked: "공개 자료 확인 시 갱신"/);
  assert.doesNotMatch(page,/\/api\/(?:sync|churches)\?[^"]*(?:token|secret|key)/i);
  for(const leak of ["D1","sqlite","fetch\\(","waitUntil","spawnSync","route\\.ts"]) assert.doesNotMatch(page.slice(page.indexOf("church-radar-sources"),page.indexOf("church-radar-sources")+2000),new RegExp(leak));
  assert.match(styles,/\.church-radar-sources \{/);
  assert.match(styles,/\.church-radar-sources-table \{/);
  assert.match(styles,/table-layout:fixed/);
  assert.match(styles,/word-break:keep-all/);
  assert.match(styles,/@media \(max-width:600px\) \{ \.church-radar-sources-table th,\.church-radar-sources-table td/);
});

test("ingests church shorts from the sermon sync without leaking them into sermons", async () => {
  const [selection,syncRoute,shortsRoute,shared,schema,styles]=await Promise.all([
    readFile(new URL("../app/api/sermons/_selection.ts",import.meta.url),"utf8"),
    readFile(new URL("../app/api/sermons/sync/route.ts",import.meta.url),"utf8"),
    readFile(new URL("../app/api/shorts/route.ts",import.meta.url),"utf8"),
    readFile(new URL("../app/api/_shared.ts",import.meta.url),"utf8"),
    readFile(new URL("../db/schema.ts",import.meta.url),"utf8"),
    readFile(new URL("../app/globals.css",import.meta.url),"utf8"),
  ]);
  assert.match(selection,/export function isShortTitle\(title:string\)/);
  assert.match(selection,/shortKeywords=\/\(#shorts\|#쇼츠\|\\bshorts\\b\|쇼츠\)\/i/);
  assert.match(syncRoute,/import \{ isSermonTitle, isShortTitle \} from "\.\.\/_selection";/);
  assert.match(syncRoute,/ensureShortsTables/);
  assert.match(syncRoute,/const recentShorts=\(playlist\.items\|\|\[\]\)\.filter\(\(item\)=>Date\.parse\(item\.snippet\.publishedAt\)>=activeSince&&isShortTitle\(item\.snippet\.title\)\)/);
  assert.match(syncRoute,/INSERT INTO church_shorts/);
  assert.doesNotMatch(shortsRoute,/ensureShortsTables/);
  assert.match(shortsRoute,/church_shorts s JOIN churches c ON c\.id=s\.church_id WHERE c\.review_status='approved' AND s\.status='published'/);
  assert.match(shortsRoute,/getRequestExecutionContext/);
  assert.match(shortsRoute,/context\.waitUntil\(pendingSync\)/);
  assert.match(shortsRoute,/stale-while-revalidate=3600/);
  assert.match(shared,/CREATE TABLE IF NOT EXISTS church_shorts/);
  assert.match(schema,/churchShorts = sqliteTable\("church_shorts"/);
  assert.match(styles,/\.shorts-grid\{/);
});

test("gives the shorts viewer a focused, keyboard-accessible experience without fake looping", async () => {
  const [page,styles]=await Promise.all([
    readFile(new URL("../app/home-client.tsx",import.meta.url),"utf8"),
    readFile(new URL("../app/globals.css",import.meta.url),"utf8"),
  ]);
  assert.match(page,/id="shorts"/);
  assert.match(page,/loadItems\("\/api\/shorts"\)\.then/);
  assert.match(page,/shorts: \(\)=>loadItems\("\/api\/shorts"\)/);
  assert.match(page,/const filteredShorts = useMemo/);
  assert.match(page,/조건에 맞는 \$\{filteredShorts\.length\}개 · 전체 \$\{shortItems\.length\}개/);
  assert.match(page,/short\.region\.startsWith\(region\)/);
  assert.match(page,/short\.denomination === denomination/);
  assert.match(page,/activeShortIndex,setActiveShortIndex\]=useState<number\|null>\(null\)/);
  assert.match(page,/youtube-nocookie\.com\/embed\/\$\{activeShort\.youtubeId\}\?autoplay=1&rel=0&playsinline=1/);
  assert.match(page,/aria-label="쇼츠 재생 닫기"/);
  assert.match(page,/aria-label="이전 쇼츠 보기"/);
  assert.match(page,/aria-label="다음 쇼츠 보기"/);
  assert.match(page,/disabled=\{activeShortIndex===0\}/);
  assert.match(page,/disabled=\{activeShortIndex===filteredShorts\.length-1\}/);
  assert.match(page,/if\(event\.key==="Escape"\) \{ setActiveShortIndex\(null\); return; \}/);
  assert.match(page,/if\(event\.key==="ArrowUp"\)/);
  assert.match(page,/if\(event\.key==="ArrowDown"\)/);
  assert.match(page,/current<filteredShorts\.length-1 \? current\+1 : current/);
  assert.match(page,/current>0 \? current-1 : current/);
  assert.match(page,/role="dialog" aria-modal="true"/);
  assert.match(styles,/\.shorts-viewer-overlay\{/);
  assert.match(styles,/\.shorts-viewer-prev\{left:-58px\}/);
  assert.match(styles,/\.shorts-viewer-next\{right:-58px\}/);
  assert.match(styles,/\.shorts-viewer-nav:disabled\{opacity:\.3;cursor:default\}/);
});

test("adds a safe RSS church-news reader and a direct YouTube praise search", async () => {
  const [page,newsRoute,styles]=await Promise.all([
    readFile(new URL("../app/home-client.tsx",import.meta.url),"utf8"),
    readFile(new URL("../app/api/church-news/route.ts",import.meta.url),"utf8"),
    readFile(new URL("../app/globals.css",import.meta.url),"utf8"),
  ]);
  assert.match(page,/id="church-news"/);
  assert.match(page,/"church-news": \(\)=>loadItems\("\/api\/church-news"\)/);
  assert.match(page,/공식 RSS로 공개된 제목과 짧은 내용만 소개/);
  assert.match(page,/현재 소식을 가져오는 곳/);
  assert.match(page,/churchNews\.slice\(0,visibleChurchNewsCount\)/);
  assert.match(page,/setVisibleChurchNewsCount\(\(count\)=>count\+8\)/);
  assert.match(page,/교계소식 8개 더 보기/);
  assert.match(page,/target="_blank" rel="noopener noreferrer"/);
  assert.match(page,/function searchYouTubePraise/);
  assert.match(page,/youtube\.com\/results\?search_query=/);
  assert.match(page,/window\.open\(url,"_blank","noopener,noreferrer"\)/);
  assert.doesNotMatch(page,/window\.location\.assign\(url\)/);
  assert.match(page,/YouTube에서 찾기/);
  assert.match(newsRoute,/https:\/\/www\.newsnjoy\.or\.kr\/rss\/allArticle\.xml/);
  assert.match(newsRoute,/https:\/\/www\.igoodnews\.net\/rss\/allArticle\.xml/);
  assert.match(newsRoute,/\.slice\(0,40\)/);
  assert.match(newsRoute,/rssUrl:url,homepage/);
  assert.match(newsRoute,/url\.hostname!==source\.allowedHost/);
  assert.match(newsRoute,/\.slice\(0,140\)/);
  assert.match(newsRoute,/stale-while-revalidate=21600/);
  assert.match(styles,/\.church-news-grid\{/);
  assert.match(styles,/\.church-news-sources\{/);
  assert.match(styles,/\.church-news-more\{/);
  assert.match(styles,/\.praise-youtube-search\{/);
});

test("keeps admin and pastor links visible in the top header on desktop and mobile", async () => {
  const [page,styles]=await Promise.all([readFile(new URL("../app/home-client.tsx",import.meta.url),"utf8"),readFile(new URL("../app/globals.css",import.meta.url),"utf8")]);
  assert.match(page,/headerAdminLinks = \[\["관리자","\/admin"\],\["목사님","\/pastor"\]\] as const;/);
  assert.match(page,/className="header-admin-links" aria-label="운영 메뉴"/);
  assert.match(page,/className="mobile-menu-admin"/);
  assert.match(page,/<nav aria-label="주요 메뉴">.*<\/nav>\s*<nav className="header-admin-links"/s);
  assert.match(page,/mobile-menu-panel.*<div className="mobile-menu-admin">/s);
  assert.match(styles,/\.header-admin-links \{/);
  assert.match(styles,/\.mobile-menu-admin\{grid-column:1\/-1/);
});
