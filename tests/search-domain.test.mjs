import assert from "node:assert/strict";
import test from "node:test";
import {matchesSearchTerms,tokenizeSearchQuery} from "../app/search-domain.ts";

test("understands polite Korean pastor and sermon searches without filler tokens",()=>{
  assert.deepEqual(tokenizeSearchQuery("정성진 목사님의 설교 찾아주세요"),["정성진"]);
  assert.equal(matchesSearchTerms("정성진거룩한빛광성교회서울통합","정성진 목사님의 설교 찾아주세요"),true);
});

test("splits joined region and denomination phrases while ignoring connectors",()=>{
  assert.deepEqual(tokenizeSearchQuery("서울에있는감리교회"),["서울","감리교회"]);
  assert.equal(matchesSearchTerms("창민교회서울기독교대한감리회","서울에있는감리교회 창민"),true);
});
