#!/usr/bin/env node

/**
 * airchurch-denomination-catalog.mjs
 *
 * 흩어져 있던 교단별 수집·검증·등록 프로그램(batch-register-remaining-denominations.mjs,
 * collect-five-denomination-directories.mjs, discover-pck-hapdong.mjs 등)을 하나의
 * 카탈로그로 묶어, 앱이 읽을 수 있는 교단별 상태(state)와 실행 가능 여부를 알려준다.
 * 이 파일은 직접 수집을 실행하지 않는다 — 상태 정의와 out/ 기존 결과 요약만 담당한다.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();

// uiState 값: auto(자동 실행 가능) | login_required(로그인 필요) | no_directory(공개 전체 명부 없음)
export const CATALOG = [
  {
    id: "hapdong",
    name: "대한예수교장로회 합동",
    uiState: "auto",
    reason: "총회 공식 명부 API로 전 교회를 자동으로 모을 수 있어요.",
    collectGroup: "hapdong",
  },
  {
    id: "tonghap",
    name: "대한예수교장로회 통합",
    uiState: "auto",
    reason: "총회 공식 주소록 검색으로 전 교회를 자동으로 모을 수 있어요.",
    collectGroup: "public",
  },
  {
    id: "kosin",
    name: "대한예수교장로회 고신",
    uiState: "auto",
    reason: "공식 지도(KML)로 전 교회를 자동으로 모을 수 있어요.",
    collectGroup: "five",
  },
  {
    id: "prok",
    name: "한국기독교장로회",
    uiState: "auto",
    reason: "공식 지도 API로 전 교회를 자동으로 모을 수 있어요.",
    collectGroup: "five",
  },
  {
    id: "kmc",
    name: "기독교대한감리회",
    uiState: "auto",
    reason: "본부 공식 주소록으로 전 교회를 자동으로 모을 수 있어요.",
    collectGroup: "remaining",
  },
  {
    id: "salvation",
    name: "구세군대한본영",
    uiState: "auto",
    reason: "공식 조직 API로 전 교회를 자동으로 모을 수 있어요.",
    collectGroup: "remaining",
  },
  {
    id: "anglican",
    name: "대한성공회",
    uiState: "auto",
    reason: "공식 홈페이지의 3개 교구 공개 명부로 수집할 수 있어요.",
    collectGroup: "public",
  },
  {
    id: "kehc",
    name: "기독교대한성결교회",
    uiState: "login_required",
    reason: "공식 명부를 보려면 교단 전산망 로그인이 필요해요.",
    collectGroup: null,
  },
  {
    id: "kbch",
    name: "기독교한국침례회",
    uiState: "login_required",
    reason: "공식 명부를 보려면 총회 로그인이 필요해요.",
    collectGroup: null,
  },
  {
    id: "agk",
    name: "기독교대한하나님의성회",
    uiState: "login_required",
    reason: "공식 명부를 보려면 총회 인트라넷 로그인이 필요해요.",
    collectGroup: null,
  },
  {
    id: "baekseok",
    name: "대한예수교장로회 백석",
    uiState: "login_required",
    reason: "공식 명부를 보려면 로그인이 필요해요.",
    collectGroup: null,
  },
  {
    id: "hapshin",
    name: "대한예수교장로회 합신",
    uiState: "no_directory",
    reason: "전 교회를 담은 공개 명부를 아직 찾지 못했어요.",
    collectGroup: null,
  },
  {
    id: "daeshin",
    name: "대한예수교장로회 대신",
    uiState: "no_directory",
    reason: "전 교회를 담은 공개 명부를 아직 찾지 못했어요.",
    collectGroup: null,
  },
  {
    id: "yehc",
    name: "예수교대한성결교회",
    uiState: "auto",
    reason: "총회가 공개한 지교회 홈페이지 목록으로 수집할 수 있어요.",
    collectGroup: "public",
  },
  {
    id: "nazarene",
    name: "대한기독교나사렛성결회",
    uiState: "auto",
    reason: "총회 공식 지방회·개교회 명부로 전 교회를 수집할 수 있어요.",
    collectGroup: "public",
  },
  {
    id: "bokum",
    name: "기독교대한복음교회",
    uiState: "auto",
    reason: "총회가 공개한 복음가족 공식 홈페이지 목록으로 수집할 수 있어요.",
    collectGroup: "public",
  },
];

export const CATALOG_BY_ID = Object.fromEntries(CATALOG.map((item) => [item.id, item]));
export const EXECUTABLE_IDS = CATALOG.filter((item) => item.uiState === "auto").map((item) => (item.id));

async function readJsonSafe(relativePath) {
  try {
    return JSON.parse(await readFile(path.join(ROOT, relativePath), "utf8"));
  } catch {
    return null;
  }
}

/** out/ 폴더에 남은 과거 실행 결과를 읽어 "완료 자료 있음" 요약을 만든다 (읽기 전용, 네트워크 없음). */
export async function readCompletedSummaries() {
  const summaries = {};

  const remaining = await readJsonSafe("out/remaining-denominations-report.json");
  if (remaining?.denominations) {
    for (const item of remaining.denominations) {
      if (item.status === "completed" && item.recordCount > 0) {
        summaries[item.id] = { collected: item.recordCount };
      }
    }
  }

  const hapdongValidated = await readJsonSafe("out/pck-hapdong-validated.json");
  if (hapdongValidated?.metadata?.verified > 0) {
    summaries.hapdong = {
      ...(summaries.hapdong || {}),
      collected: hapdongValidated.metadata.sourceRecords || undefined,
      verified: hapdongValidated.metadata.verified,
    };
  }

  const kosinReport = await readJsonSafe("out/kosin-register-report.json");
  if (kosinReport?.sync?.verified > 0) {
    summaries.kosin = { ...(summaries.kosin || {}), registered: kosinReport.sync.verified };
  }

  const prokReport = await readJsonSafe("out/prok-registration-report.json");
  if (prokReport?.sync?.verified > 0) {
    summaries.prok = { ...(summaries.prok || {}), registered: prokReport.sync.verified };
  }

  return summaries;
}

export async function buildCatalogPayload() {
  const summaries = await readCompletedSummaries();
  return CATALOG.map((item) => ({
    ...item,
    executable: item.uiState === "auto",
    completed: summaries[item.id] || null,
  }));
}

async function main() {
  const payload = await buildCatalogPayload();
  console.log(JSON.stringify(payload, null, 2));
}

import { fileURLToPath } from "node:url";
const isDirectExecution =
  Boolean(process.argv[1]) && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isDirectExecution) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
