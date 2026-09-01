#!/usr/bin/env node

import {execFileSync} from "node:child_process";

const node=process.execPath;
const run=(script,args=[])=>execFileSync(node,[script,...args],{stdio:"inherit"});

run("scripts/prepare-collected-pastor-import.mjs",[
  "out/pastor-history/national-collection-v2/candidates.json",
  "out/pastor-history/nationwide-import-plan.json",
  "out/pastor-history/collected-pastor-import-plan.json",
  "out/pastor-history/collected-pastor-review-queue.json",
  "out/pastor-history/national-collection-v2/photos-strict/photos.json",
  "out/pastor-history/national-collection-v2/photos-strict/identity-links.json",
]);
run("scripts/build-pastor-d1-import.mjs",[
  "out/pastor-history/collected-pastor-import-plan.json",
  "out/pastor-history/d1-import-collected",
  "100",
]);
run("scripts/verify-collected-ministry-integration.mjs");
