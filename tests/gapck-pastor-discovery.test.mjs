import assert from "node:assert/strict";
import test from "node:test";
import {classifyGapckCandidate,selectGapckTasks} from "../scripts/discover-gapck-pastor-review-candidates.mjs";

const task={subject_id:"p1",pastor_name:"김한명",church_name:"한교회",denomination:"대한예수교장로회 합동",region:"서울 양천"};
test("requires one exact church-pastor-region tuple in both GAPCK directories",()=>{
  const church={list:[{org_nm:"한교회",pastor:"김한명",adrs:"서울 양천구 길 1"},{org_nm:"한교회",pastor:"다른목사",adrs:"부산"}]},minister={list:[{mber_nm:"김한명",ch_nm:"한교회",ch_adrs:"서울 양천구 길 1"}]};
  const result=classifyGapckCandidate(task,church,minister);
  assert.equal(result.status,"ready_candidate");
  assert.equal(result.church_name_matches,2);
  assert.equal(result.minister_name_matches,1);
  assert.equal(classifyGapckCandidate(task,church,{list:[]}).status,"ambiguous");
  assert.equal(classifyGapckCandidate(task,{list:[]},{list:[]}).status,"not_found");
});

test("selectGapckTasks skips subjects already inspected in earlier discovery outputs",()=>{
  const eligible={subject_id:"new",decision:"pending",denomination:"대한예수교장로회 합동",role_category:"current_primary"};
  const prior={...eligible,subject_id:"prior"};
  assert.deepEqual(selectGapckTasks([prior,eligible],new Set(["prior"]),10).map((task)=>task.subject_id),["new"]);
});
