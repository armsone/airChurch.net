import assert from "node:assert/strict";
import test from "node:test";
import {upgradeGapckReviewQueryLimits} from "../scripts/upgrade-gapck-review-query-limits.mjs";

test("upgrades only ready GAPCK API review sources to a stable bounded result window",()=>{
  const batch={tasks:[
    {decision:"ready",official_sources:[{url:"https://gapck.org/api/v1/list?limit=10&q=x"},{url:"https://gapck.org/history?limit=10"}]},
    {decision:"pending",official_sources:[{url:"https://gapck.org/api/v1/list?limit=10"}]},
  ]};
  assert.equal(upgradeGapckReviewQueryLimits(batch),1);
  assert.match(batch.tasks[0].official_sources[0].url,/limit=100/);
  assert.match(batch.tasks[0].official_sources[1].url,/limit=10/);
  assert.match(batch.tasks[1].official_sources[0].url,/limit=10/);
  assert.equal(upgradeGapckReviewQueryLimits(batch),0);
});
