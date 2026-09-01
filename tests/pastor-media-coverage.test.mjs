import assert from "node:assert/strict";
import test from "node:test";
import {buildPastorMediaCoverage} from "../scripts/report-pastor-media-coverage.mjs";

test("measures person coverage without assigning a named guest to the primary pastor",()=>{
  const report=buildPastorMediaCoverage({
    churches:[{id:1,name:"빛교회",pastor:"김담임 목사",review_status:"approved"}],
    ministryProfiles:[{id:7,church_id:1,name:"박은퇴",role_title:"은퇴목사",role_category:"retired",review_status:"approved"}],
    sermons:[
      {church_id:1,youtube_id:"regular",title:"주일예배 | 은혜의 길",status:"published"},
      {church_id:1,youtube_id:"guest",title:"초청설교 | 박은퇴 은퇴목사",status:"published"},
    ],
  });
  assert.deepEqual(report.summary,{approved_ministers:2,with_verified_video:2,without_verified_video:0,coverage_percent:100});
  assert.equal(report.ministers.find((item)=>item.name==="김담임").verified_video_count,1);
  assert.equal(report.ministers.find((item)=>item.name==="박은퇴").verified_video_count,1);
});

test("counts only approved external appearances with a video and queues missing people",()=>{
  const report=buildPastorMediaCoverage({
    churches:[{id:2,name:"소망교회",pastor:"이담임",review_status:"approved"}],
    ministryProfiles:[{id:8,church_id:2,name:"최협동",role_title:"협동목사",role_category:"cooperating",review_status:"approved"}],
    ministryAppearances:[
      {church_id:2,minister_name:"최협동",video_id:"verified",review_status:"approved"},
      {church_id:2,minister_name:"이담임",video_id:"pending",review_status:"pending"},
    ],
  });
  assert.equal(report.summary.with_verified_video,1);
  assert.deepEqual(report.missing_review_queue,[{church_id:2,church_name:"소망교회",name:"이담임",role_title:"담임목사",reason:"verified_video_not_connected"}]);
});
