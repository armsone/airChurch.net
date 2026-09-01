import assert from "node:assert/strict";
import test from "node:test";
import {classifyGapckCandidate} from "../scripts/discover-gapck-pastor-review-candidates.mjs";

const task={subject_id:"p1",pastor_name:"김한명",church_name:"한교회",denomination:"대한예수교장로회 합동",region:"서울 양천"};
test("requires one exact church-pastor-region tuple in both GAPCK directories",()=>{
  const church={list:[{org_nm:"한교회",pastor:"김한명",adrs:"서울 양천구 길 1"},{org_nm:"한교회",pastor:"다른목사",adrs:"부산"}]},minister={list:[{mber_nm:"김한명",ch_nm:"한교회",ch_adrs:"서울 양천구 길 1"}]};
  assert.equal(classifyGapckCandidate(task,church,minister).status,"ready_candidate");
  assert.equal(classifyGapckCandidate(task,church,{list:[]}).status,"ambiguous");
  assert.equal(classifyGapckCandidate(task,{list:[]},{list:[]}).status,"not_found");
});
