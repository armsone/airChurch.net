import assert from "node:assert/strict";
import test from "node:test";

import { collectPastorHistory } from "../scripts/collect-pastor-history.mjs";
import { buildPastorRoster } from "../scripts/build-pastor-history-roster.mjs";
import { buildApprovalTemplate, buildImportPlan } from "../scripts/dry-run-pastor-history-import.mjs";
import {
  evaluateOfficialSource,
  finalizeSubject,
  officialYouTubeChannelUrls,
  parseRobots,
  validateNoSensitiveData,
  validateSourceUrl,
} from "../scripts/pastor-history-core.mjs";

const subject = {
  id: "official-church-pastor",
  churchId: 10,
  identity: { pastorName: "김공개", churchName: "공식교회", denomination: "공식교단", region: "서울 종로구" },
  role: { category: "current_primary", title: "담임목사", status: "current" },
  minimumIdentitySources: 2,
};
const source = (url) => ({
  type: "official_church",
  url,
  identityEvidence: { pastor: ["김공개"], church: ["공식교회"], denomination: ["공식교단"], region: ["서울", "종로구"], role: ["담임목사"] },
  assertions: [{
    eventType: "position", role: "담임목사", organization: "공식교회", startDate: "2020-01-01", endDate: null,
    factSummary: "공식교회 담임목사로 공식 소개되어 있다.", evidenceAll: ["김공개", "담임목사"], isPrimaryRole: true,
  }],
});
const officialHtml = `<html><body><h1>공식교회</h1><p>공식교단 · 서울 종로구</p><p>김공개 담임목사</p></body></html>`;
const selectionPolicy = {
  version: 1,
  policyId: "approved-church-all-official-pastors-v3",
  phase: "all_official_church_pastors",
  roleCategories: {
    current_primary: ["담임목사", "위임목사", "대표목사"],
    associate: ["부목사", "수석부목사", "행정목사", "목양목사"], education: ["교육목사", "강도사", "전임전도사", "교육전도사", "전도사"], cooperating: ["협동목사"], emeritus: ["원로목사"], retired: ["은퇴목사"],
  },
  requiredIdentityAxes: ["pastor", "church", "denomination", "region", "role"],
  allowedRegionPrefixes: ["서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종", "경기", "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주"],
  minimumOfficialIdentitySources: 1,
  allowsPublicHttpRead: true,
  visibilityPriorityPolicy: "equal_across_role_categories",
  publicationDefault: false,
};

test("builds non-public pastor candidates only from explicitly approved churches", () => {
  const roster = buildPastorRoster({
    metadata: { approvedOnly: true },
    items: [
      {
        id: 10, name: "공식교회", pastor: "김공개 목사", denomination: "공식교단", region: "서울 종로구",
        homepageUrl: "https://official.example/church/", youtubeChannelId: "UC1234567890123456789012",
        phone: "02-000-0000", email: "private@example.com", address: "상세 주소",
      },
      {
        id: 10, name: "공식교회", pastor: "김공개목사", denomination: "공식교단", region: "서울 종로구",
        homepageUrl: "https://official.example/church/", youtubeChannelId: "UC1234567890123456789012",
      },
      {
        id: 11, name: "보류교회", pastor: "이보류 목사", denomination: "공식교단", region: "서울 강남구",
        homepageUrl: "https://hold.example/church/", reviewStatus: "pending",
      },
    ],
  }, selectionPolicy, "2026-09-01T00:00:00.000Z");
  assert.equal(roster.metadata.inputRecords, 3);
  assert.equal(roster.metadata.candidates, 1, "same church and pastor must deduplicate");
  assert.equal(roster.metadata.roleDiscoveryQueue, 1, "same church must have one follow-up role discovery task");
  assert.equal(roster.metadata.held, 1);
  assert.equal(roster.metadata.published, false);
  assert.equal(roster.metadata.httpSourceCount, 0);
  assert.equal(roster.metadata.transportReview.status, "passed");
  assert.deepEqual(roster.metadata.privacyScan, {
    status: "passed", sourceTextStored: false, factSummariesScanned: 0, sensitiveFindings: 0, copiedContactFields: 0,
    adminOnlyContactCandidates: 0, publicContactFields: 0,
  });
  assert.equal(roster.candidates[0].identity.pastorName, "김공개");
  assert.equal(roster.candidates[0].reviewStatus, "needs_source_curation");
  assert.equal(roster.candidates[0].confidence, "unverified");
  assert.equal(roster.candidates[0].publicationEligible, false);
  assert.equal(roster.candidates[0].requiredOfficialIdentitySources, 1);
  assert.equal(roster.candidates[0].roleCategory, "current_primary");
  assert.deepEqual(roster.candidates[0].eligibleRoleTitles, ["담임목사", "위임목사", "대표목사"]);
  assert.equal(roster.candidates[0].searchPriorityWeight, 1);
  assert.equal(roster.candidates[0].publicationPriorityWeight, 1);
  assert.equal(roster.candidates[0].youtubeChannelCandidateUrl, "https://www.youtube.com/channel/UC1234567890123456789012");
  assert.equal(JSON.stringify(roster).includes("02-000-0000"), false);
  assert.equal(JSON.stringify(roster).includes("private@example.com"), false);
  assert.equal(roster.holds[0].reason, "church_not_approved");
  assert.deepEqual(roster.roleDiscoveryQueue[0].roleCategoriesToDiscover, ["associate", "education", "cooperating", "emeritus", "retired"]);
  assert.equal(roster.roleDiscoveryQueue[0].searchPriorityWeight, 1);
});

test("keeps primary and associate roles separate while retaining public HTTP homepages for review", () => {
  const records = [
    { name: "부교역교회", pastor: "이사역 부목사", denomination: "공식교단", region: "부산", homepageUrl: "https://assistant.example/", reviewStatus: "approved" },
    { name: "복수교회", pastor: "김하나·이둘 목사", denomination: "공식교단", region: "대전", homepageUrl: "https://multiple.example/", reviewStatus: "approved" },
    { name: "비보안교회", pastor: "박보안 목사", denomination: "공식교단", region: "광주", homepageUrl: "http://unsafe.example/", reviewStatus: "approved" },
    { name: "위임교회", pastor: "정확인 위임목사", denomination: "공식교단", region: "인천", homepageUrl: "https://confirmed.example/", reviewStatus: "approved" },
  ];
  const roster = buildPastorRoster({ records }, selectionPolicy, "2026-09-01T00:00:00.000Z");
  assert.equal(roster.candidates.length, 3);
  const delegated = roster.candidates.find((candidate) => candidate.identity.pastorName === "정확인");
  assert.equal(delegated.roleTitleClaim, "위임목사");
  const associate = roster.candidates.find((candidate) => candidate.identity.pastorName === "이사역");
  assert.equal(associate.roleCategory, "associate");
  assert.equal(associate.roleTitleClaim, "부목사");
  assert.equal(associate.searchPriorityWeight, delegated.searchPriorityWeight);
  const httpCandidate = roster.candidates.find((candidate) => candidate.identity.pastorName === "박보안");
  assert.equal(httpCandidate.transportWarning, "unencrypted_transport");
  assert.equal(httpCandidate.transportReview, "required");
  assert.equal(roster.metadata.httpSourceCount, 1);
  assert.equal(roster.metadata.transportReview.status, "required");
  assert.deepEqual(new Set(roster.holds.map((item) => item.reason)), new Set([
    "multiple_pastors_require_manual_split",
  ]));
});

test("creates separate equal-priority candidates for every supported official pastor role", () => {
  const church = {
    name: "함께교회", pastor: "김담임 목사", denomination: "공식교단", region: "서울", homepageUrl: "https://together.example/", reviewStatus: "approved",
    pastors: [
      { name: "김담임", role: "담임목사", status: "current" },
      { name: "이교육", role: "교육목사", status: "current", startDate: "2024" },
      { name: "박협동", role: "협동목사", status: "current" },
      { name: "최원로", role: "원로목사", status: "current" },
      { name: "정은퇴", role: "은퇴목사", status: "former", endDate: "2020-12-31" },
    ],
  };
  const roster = buildPastorRoster({ items: [church] }, selectionPolicy, "2026-09-01T00:00:00.000Z");
  assert.equal(roster.candidates.length, 5);
  assert.deepEqual(new Set(roster.candidates.map((candidate) => candidate.roleCategory)), new Set(["current_primary", "education", "cooperating", "emeritus", "retired"]));
  assert.deepEqual(new Set(roster.candidates.map((candidate) => candidate.searchPriorityWeight)), new Set([1]));
  assert.deepEqual(new Set(roster.candidates.map((candidate) => candidate.publicationPriorityWeight)), new Set([1]));
  assert.ok(roster.candidates.every((candidate) => candidate.fairnessPolicy === "equal_across_role_categories"));
  const retired=roster.candidates.find((candidate)=>candidate.identity.pastorName==="정은퇴");
  assert.deepEqual(retired.discoveryQueries.map((item)=>item.purpose),["official_identity","ministry_transition","guest_ministry","denomination_history"]);
  assert.match(retired.discoveryQueries[1].query,/은퇴 원로 이임 설립 개척/);
  assert.match(retired.discoveryQueries[2].query,/초청설교 특별집회 세미나/);
  assert.ok(retired.discoveryQueries.every((item)=>item.acceptedSources.every((source)=>source.startsWith("official_"))));
});

test("does not trust a status-free church list unless the export declares approved-only scope", () => {
  const church = { name: "공식교회", pastor: "김공개 목사", denomination: "공식교단", region: "서울", homepageUrl: "https://official.example/" };
  const roster = buildPastorRoster({ items: [church] }, selectionPolicy, "2026-09-01T00:00:00.000Z");
  assert.equal(roster.candidates.length, 0);
  assert.equal(roster.holds[0].reason, "church_not_approved");
});

test("accepts the nationwide approved churches export shape", () => {
  const roster=buildPastorRoster({metadata:{approved_only:true},churches:[{
    church_id:10,church_name:"공식교회",pastor:"김공개 목사",denomination:"공식교단",region:"서울 종로구",homepage_url:"https://official.example/church/",
  }]},selectionPolicy,"2026-09-01T00:00:00.000Z");
  assert.equal(roster.metadata.inputRecords,1);
  assert.equal(roster.metadata.candidates,1);
});

test("keeps a basic equal-priority candidate when an approved church has no homepage", () => {
  const roster=buildPastorRoster({metadata:{approved_only:true},churches:[{
    church_id:12,church_name:"정보대기교회",pastor:"이응원 목사",denomination:"공식교단",region:"경기 수원",
  }]},selectionPolicy,"2026-09-01T00:00:00.000Z");
  assert.equal(roster.metadata.candidates,1);
  assert.equal(roster.metadata.held,0);
  assert.equal(roster.candidates[0].officialHomepageUrl,null);
  assert.equal(roster.candidates[0].transportReview,"source_discovery_required");
  assert.equal(roster.candidates[0].searchPriorityWeight,1);
  assert.equal(roster.candidates[0].publicationEligible,false);
});

test("rejects a social or YouTube homepage as evidence without dropping the church candidate",()=>{
  const roster=buildPastorRoster({metadata:{approved_only:true},churches:[{
    church_id:13,church_name:"출처대기교회",pastor:"박기다 목사",denomination:"공식교단",region:"부산 수영",homepage_url:"https://www.youtube.com/@ExampleChurch",
  }]},selectionPolicy,"2026-09-01T00:00:00.000Z");
  assert.equal(roster.metadata.candidates,1);
  assert.equal(roster.metadata.held,0);
  assert.equal(roster.candidates[0].officialHomepageUrl,null);
  assert.equal(roster.candidates[0].homepageSourceIssue,"source_type_host_mismatch");
});

test("keeps overseas churches outside the first nationwide Korea scope", () => {
  const church = { name: "해외교회", pastor: "김해외 목사", denomination: "공식교단", region: "미국 뉴욕", homepageUrl: "https://overseas.example/", reviewStatus: "approved" };
  const roster = buildPastorRoster({ items: [church] }, selectionPolicy, "2026-09-01T00:00:00.000Z");
  assert.equal(roster.candidates.length, 0);
  assert.equal(roster.holds[0].reason, "outside_korea_region_scope");
});

test("accepts public HTTP or HTTPS official-source URLs while blocking unsafe schemes and locations", () => {
  assert.equal(validateSourceUrl("https://official.example/church/pastor", "official_church").hostname, "official.example");
  assert.equal(validateSourceUrl("http://official.example/church/pastor", "official_church").protocol, "http:");
  assert.throws(() => validateSourceUrl("ftp://official.example/church/pastor", "official_church"), /http_or_https_required/);
  assert.throws(() => validateSourceUrl("https://official.example/member/login", "official_church"), /login_or_private/);
  assert.throws(() => validateSourceUrl("https://instagram.com/pastor", "official_church"), /personal_social/);
  assert.throws(() => validateSourceUrl("https://pf.kakao.com/pastor", "official_church"), /personal_social/);
  assert.throws(() => validateSourceUrl("https://www.youtube.com/watch?v=private", "official_youtube"), /youtube_channel_url_required/);
  assert.throws(() => validateSourceUrl("https://127.0.0.1/church", "official_church"), /private_host/);
});

test("honors robots longest-match rules and crawl delay", () => {
  const robots = parseRobots(`User-agent: *\nDisallow: /private/\nAllow: /private/public$\nCrawl-delay: 3`);
  assert.equal(robots.isAllowed("https://official.example/public"), true);
  assert.equal(robots.isAllowed("https://official.example/private/record"), false);
  assert.equal(robots.isAllowed("https://official.example/private/public"), true);
  assert.equal(robots.crawlDelayMs, 3000);
});

test("extracts only manifest-authored facts after five-axis identity and role verification", () => {
  const evaluated = evaluateOfficialSource({ subject, source: source("https://official.example/church/a"), html: `${officialHtml}<p>전화 02-000-0000</p>`, checkedAt: "2026-09-01T00:00:00.000Z" });
  assert.equal(evaluated.identityMatched, true);
  assert.equal(evaluated.events.length, 1);
  assert.equal(evaluated.events[0].factSummary, "공식교회 담임목사로 공식 소개되어 있다.");
  assert.equal(JSON.stringify(evaluated).includes("02-000-0000"), false, "source contact data must never enter output");

  const mismatch = evaluateOfficialSource({ subject, source: source("https://official.example/church/b"), html: officialHtml.replace("종로구", "강남구"), checkedAt: "2026-09-01T00:00:00.000Z" });
  assert.equal(mismatch.identityMatched, false);
  assert.deepEqual(mismatch.events, []);
  assert.equal(mismatch.holds[0].reason, "identity_evidence_missing");

  const copied = source("https://official.example/church/copied");
  copied.assertions[0].factSummary = "김공개 담임목사";
  assert.throws(() => evaluateOfficialSource({ subject, source: copied, html: officialHtml, checkedAt: "2026-09-01T00:00:00.000Z" }), /fact_summary_must_be_paraphrased/);
});

test("allows two official pages to complement identity axes without weakening assertion identity", () => {
  const complementarySubject={...subject,identityEvidenceMode:"complementary"};
  const roleSource=source("https://official.example/church/appointment");
  roleSource.identityContribution=["pastor","church","role"];
  roleSource.identityEvidence={pastor:["김공개"],church:["공식교회"],role:["담임목사"]};
  const contextSource={
    type:"official_church",url:"https://official.example/church/about",identityContribution:["church","denomination","region"],
    identityEvidence:{church:["공식교회"],denomination:["공식교단"],region:["서울","종로구"]},assertions:[],
  };
  const role=evaluateOfficialSource({subject:complementarySubject,source:roleSource,html:"<p>김공개 공식교회 담임목사</p>",checkedAt:"2026-09-01T00:00:00.000Z"});
  const context=evaluateOfficialSource({subject:complementarySubject,source:contextSource,html:"<p>공식교회 공식교단 서울 종로구</p>",checkedAt:"2026-09-01T00:00:00.000Z"});
  const verified=finalizeSubject(complementarySubject,[role,context]);
  assert.equal(verified.identityStatus,"verified");
  assert.equal(verified.events.length,1);

  const incompleteContext=evaluateOfficialSource({subject:complementarySubject,source:contextSource,html:"<p>공식교회 공식교단</p>",checkedAt:"2026-09-01T00:00:00.000Z"});
  const held=finalizeSubject(complementarySubject,[role,incompleteContext]);
  assert.equal(held.identityStatus,"hold");
  assert.equal(held.holds.at(-1).reason,"incomplete_complementary_identity");
  assert.throws(()=>evaluateOfficialSource({subject:complementarySubject,source:{...roleSource,identityContribution:["church"]},html:officialHtml,checkedAt:"2026-09-01T00:00:00.000Z"}),/assertion_source_requires_person_church_role_identity/);
});

test("separates official contact candidates from history as masked admin-only review data", () => {
  const contactSource = source("https://official.example/church/contact");
  contactSource.contactCandidates = [
    { type: "email", value: "office@official.example", scope: "official_role", evidenceAll: ["공식교회", "office@official.example"] },
    { type: "phone", value: "02-1234-5678", scope: "official_role", evidenceAll: ["공식교회", "02-1234-5678"] },
    { type: "account", value: "123-456-789012", scope: "official_role", officialRole: "재정부", evidenceAll: ["공식교회", "123-456-789012"] },
  ];
  const html = `${officialHtml}<p>office@official.example</p><p>02-1234-5678</p><p>123-456-789012</p>`;
  const evaluated = evaluateOfficialSource({ subject, source: contactSource, html, checkedAt: "2026-09-01T00:00:00.000Z" });
  assert.equal(evaluated.adminContactCandidates.length, 3);
  assert.ok(evaluated.adminContactCandidates.every((contact) => contact.churchId === 10));
  assert.ok(evaluated.adminContactCandidates.every((contact) => contact.scope === "official_role"));
  assert.ok(evaluated.adminContactCandidates.every((contact) => contact.reviewStatus === "pending"));
  assert.ok(evaluated.adminContactCandidates.every((contact) => contact.visibility === "admin_only"));
  assert.ok(evaluated.adminContactCandidates.every((contact) => contact.revealPolicy === "masked_audited"));
  assert.ok(evaluated.adminContactCandidates.every((contact) => contact.publicationEligible === false));
  assert.equal(JSON.stringify(evaluated.events).includes("@official.example"), false);
  assert.equal(JSON.stringify(evaluated.events).includes("02-1234-5678"), false);
  assert.equal(JSON.stringify(evaluated.events).includes("123-456-789012"), false);
});

test("writes verified official contacts only to a separate admin-input artifact", async () => {
  const firstSource = source("https://official.example/church/contact");
  firstSource.contactCandidates = [{
    type: "phone", value: "02-1234-5678", scope: "official_role",
    evidenceAll: ["공식교회", "02-1234-5678"],
  }];
  const manifest = {
    version: 1,
    policy: { pilotOnly: true, minimumDelayMs: 1500 },
    sites: [{
      host: "official.example", collectionAllowed: true, sourceTypes: ["official_church"], allowedPathPrefixes: ["/church/"],
      minimumDelayMs: 1500, policyReviewedAt: "2026-09-01", policyUrl: "https://official.example/policy",
    }],
    subjects: [{ ...subject, sources: [firstSource, source("https://official.example/church/about")] }],
  };
  const collected = await collectPastorHistory(manifest, {
    fetchImpl: async (url) => new URL(url).pathname === "/robots.txt"
      ? new Response("User-agent: *\nAllow: /church/", { status: 200, headers: { "content-type": "text/plain" } })
      : new Response(`${officialHtml}<p>02-1234-5678</p>`, { status: 200, headers: { "content-type": "text/html" } }),
    sleep: async () => {},
    now: () => new Date("2026-09-01T00:00:00.000Z"),
    logger: () => {},
  });
  assert.equal(collected.adminContactArtifact.candidates.length, 1);
  assert.deepEqual(
    Object.fromEntries(["churchId", "type", "value", "scope", "sourceUrl"].map((key) => [key, collected.adminContactArtifact.candidates[0][key]])),
    { churchId: 10, type: "phone", value: "02-1234-5678", scope: "official_role", sourceUrl: "https://official.example/church/contact" },
  );
  assert.equal(collected.adminContactArtifact.metadata.requiresTeamLeadApproval, true);
  assert.equal(collected.adminContactArtifact.metadata.encrypted, false);
  assert.equal(collected.adminContactArtifact.metadata.databaseWrites, 0);
  assert.equal(collected.result.metadata.separatedAdminContactCandidates, 1);
  assert.equal(collected.result.metadata.privacyScan.separatedAdminContactCandidates, 1);
  assert.equal(collected.result.metadata.privacyScan.publicContactFields, 0);
  assert.equal(Object.hasOwn(collected.result, "officialContacts"), false);
  assert.equal(Object.hasOwn(collected.result, "adminContactCandidates"), false);
  assert.equal(JSON.stringify(collected.result).includes("02-1234-5678"), false);
  assert.equal(JSON.stringify(collected.cache).includes("02-1234-5678"), false);
});

test("requires cross-verification, deduplicates corroborating events, and never auto-approves", () => {
  const first = evaluateOfficialSource({ subject, source: source("https://official.example/church/a"), html: officialHtml, checkedAt: "2026-09-01T00:00:00.000Z" });
  const second = evaluateOfficialSource({ subject, source: source("https://official.example/church/b"), html: officialHtml, checkedAt: "2026-09-01T00:00:00.000Z" });
  const held = finalizeSubject(subject, [first]);
  assert.equal(held.identityStatus, "hold");
  assert.deepEqual(held.events, []);
  assert.equal(held.holds.at(-1).reviewStatus, "hold");
  assert.equal(held.holds.at(-1).confidence, "low");

  const verified = finalizeSubject(subject, [first, second]);
  assert.equal(verified.identityStatus, "verified");
  assert.equal(verified.events.length, 1);
  assert.equal(verified.events[0].sourceUrls.length, 2);
  assert.equal(verified.events[0].reviewStatus, "pending");
});

test("recognizes a YouTube channel only when an official page links it", () => {
  const urls = officialYouTubeChannelUrls(`<a href="https://www.youtube.com/@OfficialChurch/videos">영상</a><a href="https://youtube.com/watch?v=x">개별 영상</a>`, "https://official.example/");
  assert.deepEqual(urls, ["https://www.youtube.com/@OfficialChurch"]);
});

test("does not request a YouTube channel without an ownership link from an official source", async () => {
  let requests = 0;
  const manifest = {
    version: 1,
    policy: { pilotOnly: true },
    sites: [{
      host: "www.youtube.com", collectionAllowed: true, sourceTypes: ["official_youtube"], allowedPathPrefixes: ["/@"],
      minimumDelayMs: 1500, policyReviewedAt: "2026-09-01", policyUrl: "https://www.youtube.com/",
    }],
    subjects: [{
      ...subject,
      minimumIdentitySources: 1,
      sources: [{
        ...source("https://www.youtube.com/@OfficialChurch"),
        type: "official_youtube",
        ownershipEvidenceUrl: "https://official.example/church/a",
      }],
    }],
  };
  const collected = await collectPastorHistory(manifest, { fetchImpl: async () => { requests += 1; throw new Error("must not fetch"); }, logger: () => {} });
  assert.equal(requests, 0);
  assert.equal(collected.result.subjects[0].identityStatus, "hold");
  assert.ok(collected.result.subjects[0].holds.some((hold) => hold.reason === "official_youtube_ownership_unverified"));
});

test("collector is sequential, obeys site policy, and reuses fact-only cache", async () => {
  const requested = [];
  const sleeps = [];
  const manifest = {
    version: 1,
    policy: { pilotOnly: true, minimumDelayMs: 1500, defaultRecrawlDays: 30 },
    sites: [{
      host: "official.example", collectionAllowed: true, sourceTypes: ["official_church"], allowedPathPrefixes: ["/church/"],
      minimumDelayMs: 1500, policyReviewedAt: "2026-09-01", policyUrl: "https://official.example/policy",
    }],
    subjects: [{ ...subject, sources: [source("https://official.example/church/a"), source("https://official.example/church/b")] }],
  };
  const fetchImpl = async (url) => {
    requested.push(String(url));
    if (new URL(url).pathname === "/robots.txt") return new Response("User-agent: *\nAllow: /church/", { status: 200, headers: { "content-type": "text/plain" } });
    return new Response(officialHtml, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });
  };
  const options = { fetchImpl, now: () => new Date("2026-09-01T00:00:00.000Z"), sleep: async (ms) => sleeps.push(ms), logger: () => {} };
  const first = await collectPastorHistory(manifest, options);
  assert.deepEqual(requested, ["https://official.example/robots.txt", "https://official.example/church/a", "https://official.example/church/b"]);
  assert.ok(sleeps.length >= 2);
  assert.equal(first.result.metadata.pendingEvents, 1);
  assert.equal(first.result.metadata.published, false);
  assert.equal(first.result.metadata.selectionMode, "official_sample_pilot");
  assert.equal(first.result.metadata.httpSourceCount, 0);
  assert.equal(first.result.metadata.transportReview.status, "passed");
  assert.equal(first.result.metadata.privacyScan.status, "passed");
  assert.equal(first.result.metadata.privacyScan.factSummariesScanned, 1);
  assert.equal(first.result.metadata.privacyScan.sourceTextStored, false);
  assert.equal(JSON.stringify(first.cache).includes("<html>"), false, "cache must not retain source HTML");

  requested.length = 0;
  const second = await collectPastorHistory(manifest, { ...options, cache: first.cache });
  assert.deepEqual(requested, [], "fresh cache must prevent recrawl, including robots requests");
  assert.equal(second.result.metadata.pendingEvents, 1);
});

test("retains verified HTTP facts with an unencrypted transport review warning", async () => {
  const manifest = {
    version: 1,
    policy: { pilotOnly: true, minimumDelayMs: 1500 },
    sites: [{
      host: "legacy.example", collectionAllowed: true, sourceTypes: ["official_church"], allowedPathPrefixes: ["/church/"],
      minimumDelayMs: 1500, policyReviewedAt: "2026-09-01", policyUrl: "http://legacy.example/policy",
    }],
    subjects: [{ ...subject, sources: [source("http://legacy.example/church/a"), source("http://legacy.example/church/b")] }],
  };
  const collected = await collectPastorHistory(manifest, {
    fetchImpl: async (url) => new URL(url).pathname === "/robots.txt"
      ? new Response("User-agent: *\nAllow: /church/", { status: 200, headers: { "content-type": "text/plain" } })
      : new Response(officialHtml, { status: 200, headers: { "content-type": "text/html" } }),
    sleep: async () => {},
    now: () => new Date("2026-09-01T00:00:00.000Z"),
    logger: () => {},
  });
  assert.equal(collected.result.subjects[0].identityStatus, "verified");
  assert.equal(collected.result.subjects[0].events[0].transportWarning, "unencrypted_transport");
  assert.equal(collected.result.subjects[0].events[0].transportReview, "required");
  assert.equal(collected.result.metadata.httpSourceCount, 2);
  assert.equal(collected.result.metadata.transportReview.status, "required");
});

test("requires a matching approved-church roster for non-pilot collection", async () => {
  const roster = buildPastorRoster({
    metadata: { approvedOnly: true },
    items: [{
      id: 10, name: "공식교회", pastor: "김공개 목사", denomination: "공식교단", region: "서울 종로구",
      homepageUrl: "https://official.example/church/",
    }],
  }, selectionPolicy, "2026-09-01T00:00:00.000Z");
  const candidate = roster.candidates[0];
  const manifest = {
    version: 1,
    policy: { selectionPolicyId: selectionPolicy.policyId, minimumDelayMs: 1500 },
    sites: [{
      host: "official.example", collectionAllowed: true, sourceTypes: ["official_church"], allowedPathPrefixes: ["/church/"],
      minimumDelayMs: 1500, policyReviewedAt: "2026-09-01", policyUrl: "https://official.example/policy",
    }],
    subjects: [{
      ...subject,
      id: candidate.subjectId,
      identity: candidate.identity,
      minimumIdentitySources: 1,
      sources: [source("https://official.example/church/a"), source("https://official.example/church/b")],
    }],
  };
  await assert.rejects(() => collectPastorHistory(manifest, { logger: () => {} }), /approved_church_roster_required/);
  const collected = await collectPastorHistory(manifest, {
    roster,
    fetchImpl: async (url) => new URL(url).pathname === "/robots.txt"
      ? new Response("User-agent: *\nAllow: /church/", { status: 200, headers: { "content-type": "text/plain" } })
      : new Response(officialHtml, { status: 200, headers: { "content-type": "text/html" } }),
    sleep: async () => {},
    now: () => new Date("2026-09-01T00:00:00.000Z"),
    logger: () => {},
  });
  assert.equal(collected.result.metadata.selectionMode, "approved_church_roster");
  assert.equal(collected.result.metadata.selectionPolicyId, selectionPolicy.policyId);
  assert.equal(collected.result.subjects[0].identityStatus, "verified");
});

test("dry-run importer requires an exact human approval artifact and never writes", () => {
  const first = evaluateOfficialSource({ subject, source: source("https://official.example/church/a"), html: officialHtml, checkedAt: "2026-09-01T00:00:00.000Z" });
  const second = evaluateOfficialSource({ subject, source: source("https://official.example/church/b"), html: officialHtml, checkedAt: "2026-09-01T00:00:00.000Z" });
  const collected = {
    metadata: { dryRun: true, published: false, generatedAt: "2026-09-01T00:00:00.000Z" },
    subjects: [finalizeSubject(subject, [first, second])],
  };
  const unapproved = buildImportPlan(collected);
  assert.equal(unapproved.metadata.approvalVerified, false);
  assert.equal(unapproved.metadata.reviewComplete, false);
  assert.equal(unapproved.metadata.databaseWrites, 0);
  assert.equal(unapproved.metadata.privacyScan.sensitiveFindings, 0);
  assert.equal(unapproved.metadata.httpSourceCount, 0);
  assert.equal(unapproved.metadata.adminContactArtifactIncluded, false);
  assert.equal(unapproved.metadata.requires_separate_apply_authorization,true);
  assert.equal(unapproved.operations[0].action,"upsert_reviewed_ministry_profile");
  assert.equal(unapproved.operations[0].values.review_status,"pending");
  assert.equal(unapproved.actions[0].publicationEligible, false);

  const approval = buildApprovalTemplate(unapproved);
  approval.decision = "approved";
  approval.approvedBy = "human-reviewer";
  approval.approvedAt = new Date().toISOString();
  const approvedPreview = buildImportPlan(collected, approval);
  assert.equal(approvedPreview.metadata.approvalVerified, true);
  assert.equal(approvedPreview.metadata.reviewComplete, true);
  assert.equal(approvedPreview.metadata.databaseWrites, 0);
  assert.equal(approvedPreview.metadata.published, false);
  assert.match(approvedPreview.metadata.sha256,/^[0-9a-f]{64}$/);
  assert.equal(approvedPreview.operations[0].values.review_status,"approved");
  assert.equal(approvedPreview.operations[0].values.church_id,10);
  assert.equal(approvedPreview.actions[0].publicationEligible, true);
});

test("rejects sensitive fields from staged artifacts", () => {
  assert.throws(() => validateNoSensitiveData({ pastorName: "김공개", phone: "02-000-0000" }), /forbidden_field/);
  assert.throws(() => validateNoSensitiveData({ factSummary: "배우자와 자녀 정보" }), /sensitive_text/);
  assert.throws(() => validateNoSensitiveData({ factSummary: "문의 02-1234-5678" }), /sensitive_text/);
  assert.throws(() => validateNoSensitiveData({ factSummary: "후원 123-456-789012" }), /sensitive_text/);
});

test("does not mistake an official church name containing family or health words for private data",()=>{
  assert.doesNotThrow(()=>validateNoSensitiveData({organization:"청라예수가족교회",role:"담임목사"}));
  assert.doesNotThrow(()=>validateNoSensitiveData({organization:"건강한교회",role:"담임목사"}));
  assert.throws(()=>validateNoSensitiveData({organization:"공식교회 010-1234-5678",role:"담임목사"}),/sensitive_text/);
});
