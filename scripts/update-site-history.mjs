import { execFileSync } from "node:child_process";
import { readFile, rename, writeFile } from "node:fs/promises";

const historyFile = "data/site-history.json";
const automaticCommitPrefix = "chore(history):";
const command = (args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const changedFiles = (commit) => command(["diff-tree", "--no-commit-id", "--name-only", "-r", commit]).split("\n").filter(Boolean);
const isPublicChange = (files) => files.some((file) =>
  (file.startsWith("app/") && !file.startsWith("app/api/") && !file.startsWith("app/history/")) ||
  file.startsWith("public/") || file.startsWith("worker/")
);

function historyItem(subject) {
  const normalized = subject.toLowerCase();
  if (normalized.includes("short")) return "Shorts 화면과 재생 흐름을 더 편하게 다듬었습니다.";
  if (normalized.includes("event") || normalized.includes("news")) return "교회 일정과 소식 탐색을 보완했습니다.";
  if (normalized.includes("liturgical") || normalized.includes("season")) return "교회력에 맞춘 상세 화면을 추가했습니다.";
  if (normalized.includes("technology") || normalized.includes("tech")) return "airChurch의 기술 안내를 새로 마련했습니다.";
  if (normalized.includes("pastor") || normalized.includes("ministry")) return "목회자 정보와 탐색 경험을 보완했습니다.";
  if (normalized.includes("church")) return "교회 정보와 탐색 경험을 보완했습니다.";
  if (normalized.includes("search")) return "검색 경험을 보완했습니다.";
  return "공개 화면과 이용 경험을 보완했습니다.";
}

function koreaDate(timestamp) {
  return new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" })
    .format(new Date(timestamp * 1000))
    .replace(/\. /g, ". ")
    .replace(/\.$/, "");
}

async function writeJson(value) {
  const temporary = `${historyFile}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`);
  await rename(temporary, historyFile);
}

const history = JSON.parse(await readFile(historyFile, "utf8"));
const latestCommit = command(["rev-parse", "HEAD"]);
const revisions = command(["log", "--format=%H%x1f%ct%x1f%s%x1e", `${history.lastScannedCommit}..${latestCommit}`])
  .split("\x1e").map((record) => record.trim()).filter(Boolean).map((record) => {
    const [hash, timestamp, subject] = record.split("\x1f");
    return { hash, timestamp: Number(timestamp), subject };
  }).reverse();
const changes = revisions.filter(({ hash, subject }) => !subject.startsWith(automaticCommitPrefix) && isPublicChange(changedFiles(hash)));

if (!changes.length) process.exit(0);

const items = [...new Set(changes.map(({ subject }) => historyItem(subject)))].slice(0, 3);
history.entries.push({ date: koreaDate(changes.at(-1).timestamp), title: "새로운 기능과 화면을 더했습니다", items });
history.lastScannedCommit = latestCommit;
await writeJson(history);
