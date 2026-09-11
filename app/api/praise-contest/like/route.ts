import { database, readLimitedJson } from "../../_shared";
import { CONTEST, contestPhase } from "../../../praise-contest/config";
import { browser, json, resolvedContestPhase, validMutation } from "../_server";
export async function POST(request:Request) {
  if(!validMutation(request))return json({error:"같은 사이트에서 다시 눌러 주세요."},403);
  if(!["open","voting"].includes(contestPhase()))return json({error:"좋아요는 10월 1일부터 18일까지 참여할 수 있습니다."},409);
  try {
    if(await resolvedContestPhase()==="cancelled")return json({error:"접수 작품이 5개 이하로 대회가 취소되어 좋아요가 종료되었습니다."},409);
    const identity=await browser(request);if(!identity)return json({error:"쿠키를 허용한 뒤 페이지를 새로 열어 주세요."},403);
    const body=await readLimitedJson(request,1024);if(body.tooLarge)return json({error:"요청을 확인해 주세요."},413);
    const id=Number(body.data.entryId);if(!Number.isSafeInteger(id)||id<1)return json({error:"참가 영상을 확인해 주세요."},400);
    const db=database();
    const previous=await db.prepare("SELECT entry_id AS entryId FROM praise_contest_votes WHERE contest_id=? AND browser_hash=? AND vote_day=date('now','+9 hours')").bind(CONTEST.id,identity.hash).first<{entryId:number}>();
    if(previous)return json({ok:previous.entryId===id,votedEntryId:previous.entryId,error:previous.entryId===id?undefined:"이 브라우저에서는 오늘 이미 좋아요에 참여했습니다."},previous.entryId===id?200:409);
    const inserted=await db.prepare(`INSERT OR IGNORE INTO praise_contest_votes(contest_id,entry_id,browser_hash,vote_day,created_at)
      SELECT ?,e.id,?,date('now','+9 hours'),strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM praise_contest_entries e
      WHERE e.id=? AND e.contest_id=? AND e.status='published' AND strftime('%Y-%m-%dT%H:%M:%fZ','now')>=? AND strftime('%Y-%m-%dT%H:%M:%fZ','now')<? AND (strftime('%Y-%m-%dT%H:%M:%fZ','now')<? OR EXISTS (SELECT 1 FROM praise_contest_decisions WHERE contest_id=e.contest_id AND cancelled=0))`).bind(CONTEST.id,identity.hash,id,CONTEST.id,CONTEST.startsAt,CONTEST.votingEndsAt,CONTEST.submissionEndsAt).run();
    if(!inserted.meta.changes){const vote=await db.prepare("SELECT entry_id AS entryId FROM praise_contest_votes WHERE contest_id=? AND browser_hash=? AND vote_day=date('now','+9 hours')").bind(CONTEST.id,identity.hash).first<{entryId:number}>();return json({error:vote?"이 브라우저에서는 오늘 이미 좋아요에 참여했습니다.":"마감되었거나 현재 참여할 수 없는 영상입니다.",votedEntryId:vote?.entryId??null},409);}
    return json({ok:true,votedEntryId:id});
  }catch{return json({error:"좋아요를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요."},503);}
}

export async function DELETE(request:Request) {
  if(!validMutation(request))return json({error:"같은 사이트에서 다시 눌러 주세요."},403);
  try {
    if(!["open","voting"].includes(await resolvedContestPhase()))return json({error:"투표가 종료되어 취소할 수 없습니다."},409);
    const identity=await browser(request);if(!identity)return json({error:"이 브라우저의 투표를 확인할 수 없습니다."},403);
    const body=await readLimitedJson(request,1024);if(body.tooLarge)return json({error:"요청을 확인해 주세요."},413);
    const id=Number(body.data.entryId);if(!Number.isSafeInteger(id)||id<1)return json({error:"참가 영상을 확인해 주세요."},400);
    const removed=await database().prepare(`DELETE FROM praise_contest_votes WHERE contest_id=? AND browser_hash=? AND entry_id=? AND vote_day=date('now','+9 hours')
      AND strftime('%Y-%m-%dT%H:%M:%fZ','now')>=? AND strftime('%Y-%m-%dT%H:%M:%fZ','now')<?
      AND (strftime('%Y-%m-%dT%H:%M:%fZ','now')<? OR EXISTS (SELECT 1 FROM praise_contest_decisions WHERE contest_id=? AND cancelled=0))`).bind(CONTEST.id,identity.hash,id,CONTEST.startsAt,CONTEST.votingEndsAt,CONTEST.submissionEndsAt,CONTEST.id).run();
    if(!removed.meta.changes)return json({error:"오늘 누른 좋아요만 투표 기간 안에 취소할 수 있습니다. 화면을 새로 확인해 주세요."},409);
    return json({ok:true,votedEntryId:null});
  }catch{return json({error:"좋아요를 취소하지 못했습니다. 잠시 후 다시 시도해 주세요."},503);}
}
