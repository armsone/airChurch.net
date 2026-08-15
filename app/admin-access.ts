import { env } from "cloudflare:workers";
import { headers } from "next/headers";

const COOKIE_NAME = "airchurch_admin_v2";
const SESSION_SECONDS = 12 * 60 * 60;

type AdminEnv = { ADMIN_USERNAME?: string; ADMIN_PASSWORD?: string; ADMIN_SESSION_SECRET?: string };

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

export async function verifyAdminCredentials(username: string, password: string) {
  const { ADMIN_USERNAME, ADMIN_PASSWORD, ADMIN_SESSION_SECRET } = adminEnv();
  const expectedUsername = ADMIN_USERNAME?.trim();
  if (!expectedUsername || !ADMIN_PASSWORD || !ADMIN_SESSION_SECRET) return false;
  const [actualUsername, expectedUsernameDigest, actualPassword, expectedPassword] = await Promise.all([
    signature(username.trim(), ADMIN_SESSION_SECRET),
    signature(expectedUsername, ADMIN_SESSION_SECRET),
    signature(password, ADMIN_SESSION_SECRET),
    signature(ADMIN_PASSWORD, ADMIN_SESSION_SECRET),
  ]);
  return constantTimeEqual(actualUsername, expectedUsernameDigest) && constantTimeEqual(actualPassword, expectedPassword);
}

export async function createAdminToken() {
  const secret = adminEnv().ADMIN_SESSION_SECRET;
  if (!secret) throw new Error("Admin access is not configured");
  const issuedAt = Math.floor(Date.now() / 1000).toString();
  return `${issuedAt}.${await signature(issuedAt, secret)}`;
}

export async function hasAdminAccess(request?: Request) {
  const secret = adminEnv().ADMIN_SESSION_SECRET;
  if (!secret) return false;
  const requestHeaders = request ? request.headers : await headers();
  const token = cookieValue(requestHeaders.get("cookie"));
  if (!token) return false;
  const [issuedAt, suppliedSignature] = token.split(".");
  const issued = Number(issuedAt);
  const now = Math.floor(Date.now() / 1000);
  if (!issuedAt || !suppliedSignature || !Number.isInteger(issued) || issued > now + 60 || now - issued > SESSION_SECONDS) return false;
  return constantTimeEqual(suppliedSignature, await signature(issuedAt, secret));
}

export function adminCookie(token: string) {
  return `${COOKIE_NAME}=${token}; Path=/; Max-Age=${SESSION_SECONDS}; HttpOnly; Secure; SameSite=Strict`;
}

export function clearAdminCookie() {
  return `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`;
}
