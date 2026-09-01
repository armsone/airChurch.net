import assert from "node:assert/strict";
import test from "node:test";
import {hasSavedItemNewSermon,isSavedItem} from "../app/saved-items.ts";

test("accepts safe local pastor bookmarks and rejects unsafe URLs",()=>{
  assert.equal(isSavedItem({id:"pastor:12:primary",kind:"pastor",title:"김목회 목사",subtitle:"한교회",url:"/pastors/12",savedAt:"2026-09-01T00:00:00Z"}),true);
  assert.equal(isSavedItem({id:"pastor:12:primary",kind:"pastor",title:"김목회 목사",subtitle:"한교회",url:"javascript:alert(1)"}),false);
});

test("shows NEW only for a matching pastor or church sermon published after saving",()=>{
  const sermons=[{church:"한교회",pastor:"김목회 목사",publishedAt:"2026-09-02T00:00:00Z"}];
  assert.equal(hasSavedItemNewSermon({id:"pastor:12:primary",kind:"pastor",title:"김목회 목사",subtitle:"한교회",url:"/pastors/12",savedAt:"2026-09-01T00:00:00Z"},sermons),true);
  assert.equal(hasSavedItemNewSermon({id:"church:12",kind:"church",title:"한교회",subtitle:"김목회 목사",url:"/church/12",savedAt:"2026-09-03T00:00:00Z"},sermons),false);
});
