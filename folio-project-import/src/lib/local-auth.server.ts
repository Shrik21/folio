import { deleteCookie, getCookie, setCookie } from "@tanstack/react-start/server";

const ACCOUNT_COOKIE = "folio_local_account";
const SESSION_COOKIE = "folio_local_user_session";
const ACCOUNT_DURATION_SECONDS = 60 * 60 * 24 * 30;
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7;
const LOCAL_SIGNING_SECRET = "folio-local-preview-session-v1-2b66f28d";

type LocalAccount = {
  email: string;
  userId: string;
  salt: string;
  passwordHash: string;
};

export type LocalUserSession = {
  email: string;
  userId: string;
  expiresAt: number;
};

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/") + padding);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function encodeJson(value: unknown) {
  return bytesToBase64Url(new TextEncoder().encode(JSON.stringify(value)));
}

function decodeJson<T>(value: string): T | null {
  try {
    return JSON.parse(new TextDecoder().decode(base64UrlToBytes(value))) as T;
  } catch {
    return null;
  }
}

async function sign(value: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(LOCAL_SIGNING_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return bytesToHex(new Uint8Array(signature));
}

async function passwordHash(password: string, salt: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${salt}:${password}`),
  );
  return bytesToHex(new Uint8Array(digest));
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

async function createSignedToken(value: unknown) {
  const payload = encodeJson(value);
  return `${payload}.${await sign(payload)}`;
}

async function readSignedToken<T>(token: string | undefined) {
  if (!token) return null;
  const [payload, receivedSignature, ...extra] = token.split(".");
  if (!payload || !receivedSignature || extra.length) return null;
  const expectedSignature = await sign(payload);
  if (!constantTimeEqual(receivedSignature, expectedSignature)) return null;
  return decodeJson<T>(payload);
}

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "strict" as const,
    secure: process.env["NODE_ENV"] === "production",
    path: "/",
    maxAge,
  };
}

async function setSession(account: Pick<LocalAccount, "email" | "userId">) {
  const session: LocalUserSession = {
    email: account.email,
    userId: account.userId,
    expiresAt: Math.floor(Date.now() / 1000) + SESSION_DURATION_SECONDS,
  };
  setCookie(
    SESSION_COOKIE,
    await createSignedToken(session),
    cookieOptions(SESSION_DURATION_SECONDS),
  );
  return session;
}

export function isSupabaseConfigured() {
  return Boolean(process.env["SUPABASE_URL"] && process.env["SUPABASE_PUBLISHABLE_KEY"]);
}

export async function createLocalAccount(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const salt = bytesToHex(crypto.getRandomValues(new Uint8Array(16)));
  const account: LocalAccount = {
    email: normalizedEmail,
    userId: crypto.randomUUID(),
    salt,
    passwordHash: await passwordHash(password, salt),
  };
  setCookie(
    ACCOUNT_COOKIE,
    await createSignedToken(account),
    cookieOptions(ACCOUNT_DURATION_SECONDS),
  );
  return setSession(account);
}

export async function loginLocalAccount(email: string, password: string) {
  const account = await readSignedToken<LocalAccount>(getCookie(ACCOUNT_COOKIE));
  if (!account) return null;
  const normalizedEmail = email.trim().toLowerCase();
  const suppliedHash = await passwordHash(password, account.salt);
  if (
    !constantTimeEqual(normalizedEmail, account.email) ||
    !constantTimeEqual(suppliedHash, account.passwordHash)
  ) {
    return null;
  }
  return setSession(account);
}

export async function getLocalUserSession() {
  const session = await readSignedToken<LocalUserSession>(getCookie(SESSION_COOKIE));
  if (!session) return null;
  if (session.expiresAt <= Math.floor(Date.now() / 1000)) {
    deleteCookie(SESSION_COOKIE, { path: "/" });
    return null;
  }
  return session;
}

export function clearLocalUserSession() {
  deleteCookie(SESSION_COOKIE, { path: "/" });
}
