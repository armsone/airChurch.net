import { env } from "cloudflare:workers";
import { database } from "../_shared";
import { CONTEST, contestPhase, type ContestEntry } from "../../praise-contest/config";
export const noStore = { "cache-control": "private, no-store", "vary": "Cookie" };
export function json(data: unknown, status = 200, cookie?: string) {
  return Response.json(data, { status, headers: { ...noStore, ...(cookie ? { "set-cookie": cookie } : {}) } });
}
export function validMutation(request: Request) {
  return request.headers.get("origin") === new URL(request.url).origin && request.headers.get("content-type")?.split(";")[0].trim() === "application/json";
}
async function sign(value: string) {
  const secrets = env as unknown as { FINGERPRINT_SECRET?: string; ADMIN_SESSION_SECRET?: string };
  const secret = secrets.FINGERPRINT_SECRET || secrets.ADMIN_SESSION_SECRET;
  if (!secret) throw new Error("Contest browser signing is not configured");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), {name:"HMAC",hash:"SHA-256"}, false,["sign"]);
  return Array.from(new Uint8Array(await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(`praise-contest|${value}`)))).map(b=>b.toString(16).padStart(2,"0")).join("");
}
function cookieName(request: Request) { return new URL(request.url).protocol === "https:" ? "__Host-airchurch_contest" : "airchurch_contest_local"; }
export async function browser(request: Request, issue = false): Promise<{hash:string;cookie?:string} | null> {
  const name = cookieName(request);
  const token = request.headers.get("cookie")?.split(";").map(p=>p.trim()).find(p=>p.startsWith(`${name}=`))?.slice(name.length+1);
  if (token && /^[0-9a-f]{64}\.[0-9a-f]{64}$/.test(token)) {
    const [id, supplied] = token.split(".");
    const expected = await sign(id); let difference = 0;
    for (let i=0;i<expected.length;i++) difference |= expected.charCodeAt(i)^supplied.charCodeAt(i);
    if (!difference) return {hash:await sign(`identity|${id}`)};
  }
  if (!issue) return null;
  const id = Array.from(crypto.getRandomValues(new Uint8Array(32))).map(b=>b.toString(16).padStart(2,"0")).join("");
  return {hash:await sign(`identity|${id}`),cookie:`${name}=${id}.${await sign(id)}; Path=/; Max-Age=15552000; HttpOnly; SameSite=Lax${new URL(request.url).protocol==="https:"?"; Secure":""}`};
}
// Freeze the entry threshold once, before any post-deadline moderation changes.
export async function resolvedContestPhase() {
  const phase=contestPhase();
  if(phase==="upcoming"||phase==="open")return phase;
  const db=database();
  await db.prepare(`INSERT OR IGNORE INTO praise_contest_decisions(contest_id,eligible_count,cancelled,decided_at)
    SELECT ?,COUNT(*),CASE WHEN COUNT(*)<? THEN 1 ELSE 0 END,strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM praise_contest_entries
    WHERE contest_id=? AND status='published' AND created_at<?`).bind(CONTEST.id,CONTEST.minimumEntries,CONTEST.id,CONTEST.submissionEndsAt).run();
  const decision=await db.prepare("SELECT cancelled FROM praise_contest_decisions WHERE contest_id=?").bind(CONTEST.id).first<{cancelled:number}>();
  if(!decision)throw new Error("Contest decision missing");
  return decision.cancelled?"cancelled" as const:phase;
}
const rankedSql = `SELECT e.id,e.performer,e.title,e.youtube_id AS youtubeId,e.channel_name AS channelName,e.created_at AS createdAt,e.reupload_url AS reuploadUrl,COUNT(v.id) AS likes
 FROM praise_contest_entries e LEFT JOIN praise_contest_votes v ON v.entry_id=e.id AND v.contest_id=e.contest_id AND v.created_at < ?
 WHERE e.contest_id=? AND e.status='published' AND e.created_at < ?
 GROUP BY e.id ORDER BY COUNT(v.id) DESC,e.created_at ASC,e.id ASC`;
export async function entriesWithRanks(final: boolean): Promise<ContestEntry[]> {
  const db = database();
  if (final) {
    const saved = await db.prepare("SELECT snapshot FROM praise_contest_results WHERE contest_id=?").bind(CONTEST.id).first<{snapshot:string}>();
    if (saved) return visibleFinal(JSON.parse(saved.snapshot) as ContestEntry[]);
    // One atomic INSERT...SELECT freezes the whole ranking; UNIQUE contest_id makes concurrent finalization idempotent.
    await db.prepare(`INSERT OR IGNORE INTO praise_contest_results(contest_id,snapshot,finalized_at)
      SELECT ?,COALESCE(json_group_array(json_object('id',id,'performer',performer,'title',title,'youtubeId',youtubeId,'channelName',channelName,'createdAt',createdAt,'reuploadUrl',reuploadUrl,'likes',likes))),'[]'),strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM (${rankedSql})`).bind(CONTEST.id,CONTEST.votingEndsAt,CONTEST.id,CONTEST.submissionEndsAt).run();
    const result = await db.prepare("SELECT snapshot FROM praise_contest_results WHERE contest_id=?").bind(CONTEST.id).first<{snapshot:string}>();
    if (!result) throw new Error("Finalization missing");
    return visibleFinal(JSON.parse(result.snapshot) as ContestEntry[]);
  }
  const result = await db.prepare(rankedSql).bind(CONTEST.votingEndsAt,CONTEST.id,CONTEST.submissionEndsAt).all<ContestEntry>();
  return decorate(result.results,false);
}
async function visibleFinal(rows: ContestEntry[]) {
  const current=await database().prepare("SELECT id FROM praise_contest_entries WHERE contest_id=? AND status='published'").bind(CONTEST.id).all<{id:number}>();
  const visible=new Set(current.results.map(row=>Number(row.id)));
  // Keep the frozen positions even when a rights request removes a video from public display.
  return decorate(rows,true).filter(row=>visible.has(row.id));
}
function decorate(rows: ContestEntry[], final:boolean) {
  return rows.map((row,index)=>({...row,likes:Number(row.likes),rank:final||Number(row.likes)>0?index+1:null,prize:final?(CONTEST.prizes[index]??0):0}));
}

export async function maintainContest() {
  const phase=await resolvedContestPhase();
  if(phase!=="cancelled"&&phase!=="finished")return;
  if(phase==="finished")await entriesWithRanks(true);
  if (Date.now() < Date.parse(CONTEST.resultsAt) + 180 * 86400000) return;
  const db=database();
  await db.batch([
    db.prepare("UPDATE praise_contest_entries SET contact='',source_file_url=NULL,browser_hash='',admin_note=NULL WHERE contest_id=? AND (contact<>'' OR source_file_url IS NOT NULL OR browser_hash<>'' OR admin_note IS NOT NULL)").bind(CONTEST.id),
    db.prepare("DELETE FROM praise_contest_votes WHERE contest_id=?").bind(CONTEST.id),
    db.prepare("DELETE FROM praise_contest_audit WHERE entry_id IN (SELECT id FROM praise_contest_entries WHERE contest_id=?)").bind(CONTEST.id),
  ]);
}
