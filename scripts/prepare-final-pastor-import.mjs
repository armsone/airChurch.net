#!/usr/bin/env node

import {execFileSync} from "node:child_process";

const node=process.execPath;
const run=(script,args=[])=>execFileSync(node,[script,...args],{stdio:"inherit"});

run("scripts/prepare-pastor-people-import.mjs");
run("scripts/prepare-collected-pastor-import.mjs",[
  "out/pastor-history/national-collection-v2/candidates.json",
  "out/pastor-history/nationwide-import-plan.json",
  "out/pastor-history/collected-pastor-import-plan.json",
  "out/pastor-history/collected-pastor-review-queue.json",
  "out/pastor-history/national-collection-v2/photos-strict/photos.json",
]);
run("scripts/combine-pastor-import-plans.mjs");
run("scripts/build-pastor-d1-import.mjs",[
  "out/pastor-history/combined-pastor-import-plan.json",
  "out/pastor-history/d1-import-combined",
  "100",
]);
run("scripts/verify-collected-ministry-integration.mjs");
run("scripts/verify-combined-pastor-import.mjs");
