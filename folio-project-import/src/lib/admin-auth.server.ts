import { deleteCookie, getCookie, setCookie } from "@tanstack/react-start/server";

import type { PortfolioRow, ProfileRow } from "@/integrations/supabase/types";

const ADMIN_EMAIL = "admin@folio.com";
const ADMIN_PASSWORD = "Admin@123";
const ADMIN_COOKIE = "folio_admin_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 8;

// This secret and the credentials intentionally live in this server-only module.
// They are never included in the browser bundle.
const SESSION_SIGNING_SECRET = "folio-hardcoded-admin-session-v1-7c1a4c9e";

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sign(value: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(SESSION_SIGNING_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return bytesToHex(new Uint8Array(signature));
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

export async function createHardcodedAdminSession(email: string, password: string) {
  const validEmail = constantTimeEqual(email.trim().toLowerCase(), ADMIN_EMAIL);
  const validPassword = constantTimeEqual(password, ADMIN_PASSWORD);
  if (!validEmail || !validPassword) return false;

  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_DURATION_SECONDS;
  const payload = `${ADMIN_EMAIL}:${expiresAt}`;
  const signature = await sign(payload);
  setCookie(ADMIN_COOKIE, `${expiresAt}.${signature}`, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env["NODE_ENV"] === "production",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  });
  return true;
}

export async function hasHardcodedAdminSession() {
  const token = getCookie(ADMIN_COOKIE);
  if (!token) return false;

  const [expiresAtText, receivedSignature, ...extra] = token.split(".");
  if (!expiresAtText || !receivedSignature || extra.length > 0) return false;
  const expiresAt = Number(expiresAtText);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= Math.floor(Date.now() / 1000)) {
    deleteCookie(ADMIN_COOKIE, { path: "/" });
    return false;
  }

  const expectedSignature = await sign(`${ADMIN_EMAIL}:${expiresAt}`);
  return constantTimeEqual(receivedSignature, expectedSignature);
}

export function clearHardcodedAdminSession() {
  deleteCookie(ADMIN_COOKIE, { path: "/" });
}

export type AdminDashboardData = {
  configured: boolean;
  profiles: ProfileRow[];
  portfolios: PortfolioRow[];
};

export async function getAdminDashboardData(): Promise<AdminDashboardData> {
  if (!(await hasHardcodedAdminSession())) throw new Error("UNAUTHORIZED");

  if (!process.env["SUPABASE_URL"] || !process.env["SUPABASE_SERVICE_ROLE_KEY"]) {
    return { configured: false, profiles: [], portfolios: [] };
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [profileResult, portfolioResult] = await Promise.all([
    supabaseAdmin.from("profiles").select("*").order("created_at", { ascending: false }).limit(100),
    supabaseAdmin
      .from("portfolios")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(100),
  ]);
  if (profileResult.error) throw profileResult.error;
  if (portfolioResult.error) throw portfolioResult.error;

  return {
    configured: true,
    profiles: profileResult.data ?? [],
    portfolios: portfolioResult.data ?? [],
  };
}

export async function unpublishPortfolioAsAdmin(portfolioId: string) {
  if (!(await hasHardcodedAdminSession())) throw new Error("UNAUTHORIZED");
  if (!process.env["SUPABASE_URL"] || !process.env["SUPABASE_SERVICE_ROLE_KEY"]) {
    throw new Error("Connect Supabase before managing portfolios.");
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const result = await supabaseAdmin
    .from("portfolios")
    .update({ status: "unpublished" })
    .eq("id", portfolioId);
  if (result.error) throw result.error;
  return true;
}
