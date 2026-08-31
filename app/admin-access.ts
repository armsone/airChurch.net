import { env } from "cloudflare:workers";
import { headers } from "next/headers";
import { database, ensureAccessTables, ensureReviewerTables } from "./api/_shared";

// __Host- prevents subdomain/domain cookie shadowing and requires Secure + Path=/.
const COOKIE_NAME = "__Host-airchurch_access";
const SESSION_SECONDS = 12 * 60 * 60;
// Cloudflare Workers rejects PBKDF2 iteration counts above 100,000.
const PBKDF2_ITERATIONS = 100_000;

type AdminEnv = { ADMIN_USERNAME?: string; ADMIN_PASSWORD?: string; ADMIN_SESSION_SECRET?: string };
export type AccessRole = "admin" | "reviewer";
export type AccessSession = { role:AccessRole; reviewerId:number };

function adminEnv() { return env as unknown as AdminEnv; }

async function signature(value: string, secret: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const bytes = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)));
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index++) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

function base64url(bytes:Uint8Array) { return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, ""); }

async function passwordDigest(password:string,salt:string) {
  const material=await crypto.subtle.importKey("raw",new TextEncoder().encode(password),"PBKDF2",false,["deriveBits"]);
  const bits=await crypto.subtle.deriveBits({name:"PBKDF2",hash:"SHA-256",salt:new TextEncoder().encode(salt),iterations:PBKDF2_ITERATIONS},material,256);
  return base64url(new Uint8Array(bits));
}

export async function hashReviewerPassword(password:string) {
  const salt=base64url(crypto.getRandomValues(new Uint8Array(18)));
  return {salt,hash:await passwordDigest(password,salt)};
}

function cookieValue(header: string | null) {
  return header?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE_NAME}=`))?.slice(COOKIE_NAME.length + 1) ?? null;
}

export async function verifyCredentials(username: string, password: string):Promise<AccessSession|null> {
  const { ADMIN_USERNAME, ADMIN_PASSWORD, ADMIN_SESSION_SECRET } = adminEnv();
  if (!ADMIN_SESSION_SECRET) return null;
  const suppliedUsername=await signature(username.trim(),ADMIN_SESSION_SECRET),suppliedPassword=await signature(password,ADMIN_SESSION_SECRET);
  for(const [role,expectedUsername,expectedPassword] of [["admin",ADMIN_USERNAME,ADMIN_PASSWORD]] as const) {
    if(!expectedUsername?.trim()||!expectedPassword) continue;
    const [usernameDigest,passwordDigest]=await Promise.all([signature(expectedUsername.trim(),ADMIN_SESSION_SECRET),signature(expectedPassword,ADMIN_SESSION_SECRET)]);
    if(constantTimeEqual(suppliedUsername,usernameDigest)&&constantTimeEqual(suppliedPassword,passwordDigest)) return {role,reviewerId:0};
  }
  const db=database();
  await ensureReviewerTables(db);
  const reviewer=await db.prepare("SELECT id,password_hash,password_salt FROM reviewer_accounts WHERE username=? AND status='approved' LIMIT 1").bind(username.trim().toLowerCase()).first<{id:number;password_hash:string;password_salt:string}>();
  if(reviewer&&constantTimeEqual(await passwordDigest(password,reviewer.password_salt),reviewer.password_hash)) return {role:"reviewer",reviewerId:reviewer.id};
  return null;
}

export async function createAccessToken(session:AccessSession) {
  const secret = adminEnv().ADMIN_SESSION_SECRET;
  if (!secret) throw new Error("Admin access is not configured");
  const issuedAt = Math.floor(Date.now() / 1000).toString();
  const sessionId=crypto.randomUUID();
  const db=database();await ensureAccessTables(db);
  let credentialMaterial="";
  if(session.role==="admin") {
    const current=adminEnv();credentialMaterial=`${current.ADMIN_USERNAME??""}\u0000${current.ADMIN_PASSWORD??""}`;
  } else {
    await ensureReviewerTables(db);
    const reviewer=await db.prepare("SELECT password_hash FROM reviewer_accounts WHERE id=? AND status='approved' LIMIT 1").bind(session.reviewerId).first<{password_hash:string}>();
    if(!reviewer)throw new Error("Reviewer access is no longer active");
    credentialMaterial=reviewer.password_hash;
  }
  const credentialVersion=(await signature(`${session.role}|${session.reviewerId}|${credentialMaterial}`,secret)).slice(0,22);
  await db.prepare("INSERT INTO access_sessions (id,role,reviewer_id,expires_at) VALUES (?,?,?,datetime('now',?))").bind(sessionId,session.role,session.reviewerId,`+${SESSION_SECONDS} seconds`).run();
  const payload=`${issuedAt}.${session.role}.${session.reviewerId}.${credentialVersion}.${sessionId}`;
  return `${payload}.${await signature(payload, secret)}`;
}

export async function accessSession(request?:Request):Promise<AccessSession|null> {
  const secret = adminEnv().ADMIN_SESSION_SECRET;
  if (!secret) return null;
  const requestHeaders = request ? request.headers : await headers();
  const token = cookieValue(requestHeaders.get("cookie"));
  if (!token) return null;
  const [issuedAt,role,reviewerIdValue,credentialVersion,sessionId,suppliedSignature] = token.split(".");
  const issued = Number(issuedAt);
  const reviewerId=Number(reviewerIdValue);
  const now = Math.floor(Date.now() / 1000);
  if (!issuedAt || !["admin","reviewer"].includes(role) || !Number.isInteger(reviewerId) || reviewerId<0 || !credentialVersion || !sessionId || !suppliedSignature || !Number.isInteger(issued) || issued > now + 60 || now - issued > SESSION_SECONDS) return null;
  const payload=`${issuedAt}.${role}.${reviewerId}.${credentialVersion}.${sessionId}`;
  if(!constantTimeEqual(suppliedSignature,await signature(payload,secret))) return null;
  const db=database();await ensureAccessTables(db);
  const active=await db.prepare("SELECT id FROM access_sessions WHERE id=? AND role=? AND reviewer_id=? AND revoked_at IS NULL AND expires_at>CURRENT_TIMESTAMP LIMIT 1").bind(sessionId,role,reviewerId).first<{id:string}>();
  if(!active)return null;
  let credentialMaterial="";
  if(role==="reviewer"&&reviewerId>0) {
    await ensureReviewerTables(db);
    const reviewer=await db.prepare("SELECT id,password_hash FROM reviewer_accounts WHERE id=? AND status='approved' LIMIT 1").bind(reviewerId).first<{id:number;password_hash:string}>();
    if(!reviewer) return null;
    credentialMaterial=reviewer.password_hash;
  } else if(role==="admin") {
    const current=adminEnv();credentialMaterial=`${current.ADMIN_USERNAME??""}\u0000${current.ADMIN_PASSWORD??""}`;
  }
  const expectedCredentialVersion=(await signature(`${role}|${reviewerId}|${credentialMaterial}`,secret)).slice(0,22);
  if(!constantTimeEqual(credentialVersion,expectedCredentialVersion))return null;
  return {role:role as AccessRole,reviewerId};
}

export async function revokeAccessSession(request:Request){
  const token=cookieValue(request.headers.get("cookie"));
  const sessionId=token?.split(".")[4];
  if(!sessionId)return;
  const db=database();await ensureAccessTables(db);
  await db.prepare("UPDATE access_sessions SET revoked_at=CURRENT_TIMESTAMP WHERE id=? AND revoked_at IS NULL").bind(sessionId).run();
}

export async function accessRole(request?:Request):Promise<AccessRole|null> { return (await accessSession(request))?.role??null; }

export async function hasAdminAccess(request?: Request) { return (await accessRole(request)) === "admin"; }
export async function hasChurchReviewAccess(request?:Request) { return (await accessRole(request)) !== null; }

export function adminCookie(token: string) {
  return `${COOKIE_NAME}=${token}; Path=/; Max-Age=${SESSION_SECONDS}; HttpOnly; Secure; SameSite=Strict`;
}

export function clearAdminCookie() {
  return `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`;
}
