import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { extractChurchProfileCandidate, extractScheduleCandidates, normalizeTime, parseDays, robotsAllows, validateBundle, validateProfiles } from "../scripts/worship-schedules/core.mjs";

test("normalizes Korean day and time expressions", () => {
  assert.equal(normalizeTime("오후", "2", "30"), "14:30");
  assert.deepEqual(parseDays("월~토 오전 5시"), ["MON", "TUE", "WED", "THU", "FRI", "SAT"]);
  assert.deepEqual(parseDays("매주 주일 오후 5시"), ["SUN"]);
});

test("extracts candidates while holding ambiguous weekdays", () => {
  const html = `<h3>주일예배</h3><p>1부</p><p>주일 오전 7시 30분, 대예배실</p><h3>새벽기도회</h3><p>오전 5시, 기도실</p>`;
  const records = extractScheduleCandidates({ church: { church_id: 9, church_name: "테스트교회" }, sourceUrl: "https://church.example/worship", html, collectedAt: "2026-09-01T00:00:00.000Z" });
  assert.equal(records.length, 2);
  assert.equal(records[0].start_time, "07:30");
  assert.deepEqual(records[0].day_of_week, ["SUN"]);
  assert.equal(records[0].review_status, "pending");
  assert.equal(records[1].review_status, "hold");
  assert.ok(records[1].flags.includes("ambiguous_day"));
});

test("uses the longest robots rule and never overrides a disallow casually", () => {
  const robots = `User-agent: *\nDisallow: /private\nAllow: /private/public\n`;
  assert.equal(robotsAllows("https://church.example/private/schedule", robots, "AirChurchWorshipCollector"), false);
  assert.equal(robotsAllows("https://church.example/private/public/worship", robots, "AirChurchWorshipCollector"), true);
});

test("requires explicit human approval before an import candidate exists", () => {
  const record = extractScheduleCandidates({ church: { church_id: 9, church_name: "테스트교회" }, sourceUrl: "https://church.example/worship", html: "<h3>주일예배</h3><p>주일 오전 11시, 본당</p>", collectedAt: "2026-09-01T00:00:00.000Z" })[0];
  const withoutReview = validateBundle({ candidates: [record] });
  assert.equal(withoutReview.approved.length, 0);
  assert.equal(withoutReview.held.length, 1);
  const withReview = validateBundle({ candidates: [record] }, { [record.record_id]: { decision: "approve", reviewed_at: "2026-09-01T01:00:00.000Z" } });
  assert.equal(withReview.approved.length, 1);
  assert.equal(withReview.approved[0].review_status, "approved");
});

test("extracts church slogan, vision, and public profile fields for review", () => {
  const html = `<meta name="description" content="지역과 이웃을 섬기는 교회"><h2>교회 표어</h2><p>말씀으로 세상을 밝히는 공동체</p><h2>비전</h2><p>다음 세대를 세우고 이웃을 섬깁니다</p><p>서울특별시 종로구 새문안로 79</p><p>02-732-1009</p>`;
  const profile = extractChurchProfileCandidate({ church: { church_id: 9, church_name: "테스트교회" }, sourceUrl: "https://church.example/", html, collectedAt: "2026-09-01T00:00:00.000Z" });
  assert.equal(profile.slogan, "말씀으로 세상을 밝히는 공동체");
  assert.equal(profile.vision, "다음 세대를 세우고 이웃을 섬깁니다");
  assert.match(profile.address, /서울특별시/);
  assert.equal(Object.hasOwn(profile,"phone"),false);
  assert.doesNotMatch(profile.source_text,/02-732-1009/);
  assert.equal(profile.review_status, "pending");
  const held = validateProfiles({ profiles: [profile] });
  assert.equal(held.approved.length, 0);
  const approved = validateProfiles({ profiles: [profile] }, { [profile.profile_id]: { decision: "approve", reviewed_at: "2026-09-01T01:00:00.000Z" } });
  assert.equal(approved.approved.length, 1);
});

test("church pages expose only approved profile and schedule rows", async () => {
  const page = await readFile(new URL("../app/church/[id]/page.tsx", import.meta.url), "utf8");
  assert.match(page, /FROM church_profiles WHERE church_id=\? AND review_status='approved'/);
  assert.match(page, /FROM worship_schedules WHERE church_id=\? AND review_status='approved'/);
  assert.match(page, /profile\.slogan/);
  assert.match(page, /profile\.vision/);
  assert.match(page, /예배시간/);
  assert.doesNotMatch(page,/SELECT[^\n]*phone[^\n]*FROM church_profiles/);
  assert.match(page, /\(profile\|\|hasSchedules\)&&<section/);
  assert.doesNotMatch(page, /검토가 끝난 예배시간이 아직 없습니다/);
  assert.doesNotMatch(page, /장소는 공식 안내 확인/);
  assert.doesNotMatch(page, /현재 연결된 말씀이 없습니다/);
  assert.doesNotMatch(page, /현재 연결된 찬양이 없습니다/);
  assert.doesNotMatch(page, /연결해 보여드릴 다른 공개 교회가 없습니다/);
});
