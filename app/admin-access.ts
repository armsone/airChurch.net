import { env } from "cloudflare:workers";
import { headers } from "next/headers";

const COOKIE_NAME = "airchurch_admin_v2";
const SESSION_SECONDS = 12 * 60 * 60;

type AdminEnv = { ADMIN_USERNAME?: string; ADMIN_PASSWORD?: string; REVIEWER_USERNAME?: string; REVIEWER_PASSWORD?: string; ADMIN_SESSION_SECRET?: string };
export type AccessRole = "admin" | "reviewer";

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

function cookieValue(header: string | null) {
  return header?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE_NAME}=`))?.slice(COOKIE_NAME.length + 1) ?? null;
}

export async function verifyCredentials(username: string, password: string):Promise<AccessRole|null> {
  const { ADMIN_USERNAME, ADMIN_PASSWORD, REVIEWER_USERNAME, REVIEWER_PASSWORD, ADMIN_SESSION_SECRET } = adminEnv();
  if (!ADMIN_SESSION_SECRET) return null;
  const suppliedUsername=await signature(username.trim(),ADMIN_SESSION_SECRET),suppliedPassword=await signature(password,ADMIN_SESSION_SECRET);
  for(const [role,expectedUsername,expectedPassword] of [["admin",ADMIN_USERNAME,ADMIN_PASSWORD],["reviewer",REVIEWER_USERNAME,REVIEWER_PASSWORD]] as const) {
    if(!expectedUsername?.trim()||!expectedPassword) continue;
    const [usernameDigest,passwordDigest]=await Promise.all([signature(expectedUsername.trim(),ADMIN_SESSION_SECRET),signature(expectedPassword,ADMIN_SESSION_SECRET)]);
    if(constantTimeEqual(suppliedUsername,usernameDigest)&&constantTimeEqual(suppliedPassword,passwordDigest)) return role;
  }
  return null;
}

export async function createAccessToken(role:AccessRole) {
  const secret = adminEnv().ADMIN_SESSION_SECRET;
  if (!secret) throw new Error("Admin access is not configured");
  const issuedAt = Math.floor(Date.now() / 1000).toString();
  const payload=`${issuedAt}.${role}`;
  return `${payload}.${await signature(payload, secret)}`;
}

export async function accessRole(request?:Request):Promise<AccessRole|null> {
  const secret = adminEnv().ADMIN_SESSION_SECRET;
  if (!secret) return null;
  const requestHeaders = request ? request.headers : await headers();
  const token = cookieValue(requestHeaders.get("cookie"));
  if (!token) return null;
  const [issuedAt,role,suppliedSignature] = token.split(".");
  const issued = Number(issuedAt);
  const now = Math.floor(Date.now() / 1000);
  if (!issuedAt || !["admin","reviewer"].includes(role) || !suppliedSignature || !Number.isInteger(issued) || issued > now + 60 || now - issued > SESSION_SECONDS) return null;
  const payload=`${issuedAt}.${role}`;
  return constantTimeEqual(suppliedSignature, await signature(payload, secret)) ? role as AccessRole : null;
}

export async function hasAdminAccess(request?: Request) { return (await accessRole(request)) === "admin"; }
export async function hasChurchReviewAccess(request?:Request) { return (await accessRole(request)) !== null; }

export function adminCookie(token: string) {
  return `${COOKIE_NAME}=${token}; Path=/; Max-Age=${SESSION_SECONDS}; HttpOnly; Secure; SameSite=Strict`;
}

export function clearAdminCookie() {
  return `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`;
}
