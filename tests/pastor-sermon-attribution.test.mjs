import assert from "node:assert/strict";
import test from "node:test";
import {isSermonAttributedTo,namedPastorsInTitle} from "../app/pastor-sermon-attribution.ts";

test("uses the church feed as the primary pastor default but excludes a named guest",()=>{
  assert.equal(isSermonAttributedTo("주일예배 | 믿음으로 걷는 길","곽승현",true),true);
  assert.equal(isSermonAttributedTo("초청설교 | 내가 죽어야 교회가 산다 | 정성진 목사","곽승현",true),false);
  assert.equal(isSermonAttributedTo("말씀 | 곽승현 위임목사 | 사랑의 길","곽승현",true),true);
});

test("requires an explicit title match for non-primary and retired ministers",()=>{
  assert.equal(isSermonAttributedTo("주일예배 | 믿음으로 걷는 길","정성진",false),false);
  assert.equal(isSermonAttributedTo("특별집회 설교자: 정성진 은퇴목사","정성진",false),true);
  assert.deepEqual(namedPastorsInTitle("정성진 목사 · 곽승현 위임목사 대담"),["정성진","곽승현"]);
});
