import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(new Request("http://localhost/", { headers:{accept:"text/html"} }), { ASSETS:{fetch:async()=>new Response("Not found",{status:404})} }, { waitUntil(){}, passThroughOnException(){} });
}

test("server-renders the Airchurch portal", async () => {
  const response=await render(); assert.equal(response.status,200); assert.match(response.headers.get("content-type")??"",/^text\/html\b/i);
  const html=await response.text(); assert.match(html,/<title>에어처치 \| 말씀과 선한 마음이 만나는 곳<\/title>/); assert.match(html,/좋은 말씀과/); assert.match(html,/착한나눔/); assert.match(html,/달란트 브릿지/); assert.match(html,/등록 교회 목록/); assert.match(html,/AI에 의해 자동 검색되고 등록된 리스트입니다/); assert.match(html,/건강한 신앙 생태계/); assert.doesNotMatch(html,/codex-preview|SkeletonPreview|react-loading-skeleton/);
});

test("restores a reviewed church directory and restricted pastor workflow", async () => {
  const [page,recommendations,churches,admin,review,controls,manage,access,schema,envExample]=await Promise.all([
    readFile(new URL("../app/home-client.tsx",import.meta.url),"utf8"),
    readFile(new URL("../app/api/church-recommendations/route.ts",import.meta.url),"utf8"),
    readFile(new URL("../app/api/churches/route.ts",import.meta.url),"utf8"),
    readFile(new URL("../app/admin/page.tsx",import.meta.url),"utf8"),
    readFile(new URL("../app/review/page.tsx",import.meta.url),"utf8"),
    readFile(new URL("../app/admin/admin-controls.tsx",import.meta.url),"utf8"),
    readFile(new URL("../app/api/admin/manage/route.ts",import.meta.url),"utf8"),
    readFile(new URL("../app/admin-access.ts",import.meta.url),"utf8"),
    readFile(new URL("../db/schema.ts",import.meta.url),"utf8"),
    readFile(new URL("../.env.example",import.meta.url),"utf8"),
  ]);
  for(const phrase of ["AI에 의해 자동 검색되고 등록된 리스트입니다","교회 추천 보내기","관리자가 교단과 공식 채널"]) assert.match(page,new RegExp(phrase));
  assert.match(churches,/review_status='approved'/);
  assert.match(recommendations,/status:"pending"/);
  assert.match(admin,/교회 추천 검토/);
  assert.match(review,/교회 목록 검토/);
  assert.match(controls,/kind:"church-review"/);
  assert.match(controls,/admin-church-details/);
  assert.match(manage,/role==="reviewer"&&kind!=="church-review"/);
  assert.match(access,/REVIEWER_USERNAME/);
  assert.match(access,/REVIEWER_PASSWORD/);
  assert.match(schema,/churchRecommendations = sqliteTable\("church_recommendations"/);
  assert.match(schema,/reviewerStatus: text\("reviewer_status"\)/);
  assert.match(envExample,/REVIEWER_USERNAME=/);
});

test("keeps safety and discovery requirements in the product source", async () => {
  const [page,layout,hosting,selection]=await Promise.all([readFile(new URL("../app/home-client.tsx",import.meta.url),"utf8"),readFile(new URL("../app/layout.tsx",import.meta.url),"utf8"),readFile(new URL("../.openai/hosting.json",import.meta.url),"utf8"),readFile(new URL("../app/api/sermons/_selection.ts",import.meta.url),"utf8")]);
  for(const phrase of ["교회명, 목사님, 지역","작은 교회 살리기","은퇴 목회자 동행","내 달란트","소속 확인","이의제기"]) assert.match(page,new RegExp(phrase));
  for(const region of ["서울","부산","대구","인천","광주","대전","울산","세종","경기","강원","충북","충남","전북","전남","경북","경남","제주"]) assert.match(page,new RegExp(`"${region}"`));
  for(const excluded of ["찬양","광고","성경통독","쇼츠"]) assert.match(selection,new RegExp(excluded));
  assert.match(layout,/og\.png/); assert.equal(JSON.parse(hosting).d1,"DB");
});

test("does not block initial content on YouTube synchronization", async () => {
  const [page,sermonRoute,praiseRoute]=await Promise.all([
    readFile(new URL("../app/home-client.tsx",import.meta.url),"utf8"),
    readFile(new URL("../app/api/sermons/route.ts",import.meta.url),"utf8"),
    readFile(new URL("../app/api/praises/route.ts",import.meta.url),"utf8"),
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
  assert.match(page,/말씀 20개 더 보기/);
  assert.match(page,/setVisibleSermonCount\(\(count\)=>count\+20\)/);
  assert.match(page,/className="thumbnail-image"/);
  assert.match(page,/loading="lazy" decoding="async"/);
  assert.match(page,/fetchPriority="low"/);
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
  const [access,signup,login,admin,manage,shared,schema]=await Promise.all([
    readFile(new URL("../app/admin-access.ts",import.meta.url),"utf8"),
    readFile(new URL("../app/api/reviewer-signup/route.ts",import.meta.url),"utf8"),
    readFile(new URL("../app/admin/admin-login.tsx",import.meta.url),"utf8"),
    readFile(new URL("../app/admin/page.tsx",import.meta.url),"utf8"),
    readFile(new URL("../app/api/admin/manage/route.ts",import.meta.url),"utf8"),
    readFile(new URL("../app/api/_shared.ts",import.meta.url),"utf8"),
    readFile(new URL("../db/schema.ts",import.meta.url),"utf8"),
  ]);
  assert.match(access,/PBKDF2/);
  assert.match(access,/reviewer_accounts WHERE username=\? AND status='approved'/);
  assert.match(signup,/status,fingerprint\) VALUES \(\?,\?,\?,\?,\?,'pending',\?\)/);
  assert.match(login,/\/review\/join/);
  assert.match(admin,/목회자 검토자 가입/);
  assert.match(manage,/kind==="reviewer-account"/);
  assert.match(shared,/CREATE TABLE IF NOT EXISTS reviewer_accounts/);
  assert.match(schema,/reviewerAccounts = sqliteTable\("reviewer_accounts"/);
  assert.match(schema,/reviewerChurchReviews = sqliteTable\("reviewer_church_reviews"/);
  assert.match(access,/reviewerId/);
  assert.match(manage,/INSERT INTO reviewer_church_reviews/);
  assert.match(admin,/href="\/review">목사님 페이지/);
  assert.match(admin,/관리자가 최종 결정/);
  assert.match(admin,/opinionsByChurch/);
  const review=await readFile(new URL("../app/review/page.tsx",import.meta.url),"utf8");
  assert.match(review,/href="\/admin">전체 관리/);
});

test("shows reviewer decisions as one-tap choices with a right-aligned save", async () => {
  const [controls,styles]=await Promise.all([readFile(new URL("../app/admin/admin-controls.tsx",import.meta.url),"utf8"),readFile(new URL("../app/globals.css",import.meta.url),"utf8")]);
  assert.match(controls,/className="review-result-options"/);
  assert.match(controls,/type="radio" name="status"/);
  assert.match(controls,/className="review-save-row"/);
  assert.match(styles,/\.church-review-control \.review-save-row \{ justify-content:flex-end; \}/);
});

test("right-aligns the login return links", async () => {
  const [login,signup,styles]=await Promise.all([readFile(new URL("../app/admin/admin-login.tsx",import.meta.url),"utf8"),readFile(new URL("../app/review/join/reviewer-signup.tsx",import.meta.url),"utf8"),readFile(new URL("../app/globals.css",import.meta.url),"utf8")]);
  assert.match(login,/className="admin-login-links"/);
  assert.match(signup,/className="admin-login-links single"/);
  assert.match(signup,/관리자가 승인해야 교회 목록 검토 작업이 가능합니다/);
  assert.match(styles,/\.admin-login-links\.single \{ justify-content:flex-end; \}/);
});

test("links church directory cards to verified homepages and official YouTube channels", async () => {
  const [page,route,homepages,images,styles]=await Promise.all([readFile(new URL("../app/home-client.tsx",import.meta.url),"utf8"),readFile(new URL("../app/api/churches/route.ts",import.meta.url),"utf8"),readFile(new URL("../app/church-homepages.ts",import.meta.url),"utf8"),readFile(new URL("../app/church-images.ts",import.meta.url),"utf8"),readFile(new URL("../app/globals.css",import.meta.url),"utf8")]);
  assert.match(route,/youtube_channel_id AS youtubeChannelId/);
  assert.match(route,/homepage_url AS homepageUrl/);
  assert.match(route,/channel_image_url AS channelImageUrl/);
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
  assert.doesNotMatch(route,/new URL\("\/favicon\.ico",homepageUrl\)/);
  assert.match(homepages,/"온누리교회": "https:\/\/www\.onnuri\.org\/"/);
  assert.match(images,/"거룩한빛광성교회": "https:\/\/kwangsung\.org\/UserData/);
  assert.match(page,/className="homepage-visual"/);
  assert.match(page,/⛪/);
  assert.match(styles,/\.church-directory-links/);
  assert.match(styles,/\.church-directory-meta \{/);
  assert.match(styles,/\.church-primary-link:hover/);
  assert.match(styles,/\.homepage-visual img/);
});
