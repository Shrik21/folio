import { createHash, randomBytes } from "node:crypto";
import type { CookieOptions, Request, RequestHandler } from "express";

export type Provider = "google" | "github";
export type AuthUser = { id: string; name: string; email: string | null; avatarUrl: string | null; provider: string };
export type Identity = Omit<AuthUser, "id"> & { provider: Provider; providerUserId: string };
export type OAuthState = { stateHash: string; browserHash: string; provider: string; verifier: string; nonce: string; returnTo: string; expiresAt: Date };
export interface AuthStore {
  saveState(state: OAuthState): Promise<void>;
  consumeState(stateHash: string, browserHash: string, provider: Provider, now: Date): Promise<OAuthState | undefined>;
  upsertUser(identity: Identity): Promise<AuthUser>;
  saveSession(tokenHash: string, userId: string, expiresAt: Date): Promise<void>;
  getSession(tokenHash: string, now: Date): Promise<AuthUser | undefined>;
  deleteSession(tokenHash: string): Promise<void>;
  cleanup(now: Date): Promise<void>;
}
export type AuthConfig = {
  appOrigin: string | null;
  ready: boolean;
  secure: boolean;
  sessionSecret?: string;
  providers: Record<Provider, { clientId: string; clientSecret: string }>;
};
export const SESSION_COOKIE = "folio_session";
export const STATE_COOKIE = "folio_oauth_browser";
export const SESSION_TTL = 7 * 24 * 60 * 60 * 1000;
export const STATE_TTL = 10 * 60 * 1000;
export const randomToken = () => randomBytes(32).toString("base64url");
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
export const pkceChallenge = (verifier: string) => createHash("sha256").update(verifier).digest("base64url");
export const validToken = (token: unknown): token is string => typeof token === "string" && /^[A-Za-z0-9_-]{43}$/.test(token);
export const isProvider = (value: string): value is Provider => value === "google" || value === "github";

export function readAuthConfig(env: NodeJS.ProcessEnv = process.env): AuthConfig {
  let appOrigin: string | null = null;
  if (env.APP_URL) {
    const url = new URL(env.APP_URL);
    if (url.username || url.password || url.search || url.hash || url.pathname !== "/") throw new Error("APP_URL must be an origin without a path, credentials, query, or fragment.");
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (url.protocol !== "https:" && !(env.NODE_ENV !== "production" && local && url.protocol === "http:")) throw new Error("APP_URL requires HTTPS, except for localhost development.");
    appOrigin = url.origin;
  }
  const sessionSecret = env.SESSION_SECRET && env.SESSION_SECRET.length >= 32 && !env.SESSION_SECRET.startsWith("replace-") ? env.SESSION_SECRET : undefined;
  return {
    appOrigin,
    ready: Boolean(appOrigin && sessionSecret && (env.DATABASE_PROVIDER?.toLowerCase() === "mongo" ? env.MONGODB_URI : env.DATABASE_URL)),
    secure: appOrigin?.startsWith("https:") ?? env.NODE_ENV === "production",
    sessionSecret,
    providers: {
      google: { clientId: env.GOOGLE_CLIENT_ID || "", clientSecret: env.GOOGLE_CLIENT_SECRET || "" },
      github: { clientId: env.GITHUB_CLIENT_ID || "", clientSecret: env.GITHUB_CLIENT_SECRET || "" },
    },
  };
}

export const providerAvailable = (config: AuthConfig, provider: Provider) => Boolean(config.ready && config.providers[provider].clientId && config.providers[provider].clientSecret);
export const callbackUrl = (config: AuthConfig, provider: Provider) => `${config.appOrigin}/api/auth/${provider}/callback`;
export const sessionCookieOptions = (config: AuthConfig): CookieOptions => ({ httpOnly: true, secure: config.secure, sameSite: "lax", signed: true, path: "/", maxAge: SESSION_TTL });
export const stateCookieOptions = (config: AuthConfig): CookieOptions => ({ httpOnly: true, secure: config.secure, sameSite: "lax", signed: true, path: "/api/auth", maxAge: STATE_TTL });

// Only application destinations are accepted: never protocol-relative, encoded, API, or external URLs.
export function safeReturnTo(value: unknown): string {
  if (typeof value !== "string" || value.length > 500 || /[\\%\x00-\x20]/.test(value) || /(?:^|\/)\.\.?(?:\/|$)/.test(value.split(/[?#]/)[0])) return "/dashboard";
  return /^\/(dashboard|create|onboarding|templates)(\/[^?#]*)?(\?[^#]*)?(#.*)?$/.test(value) ? value : "/dashboard";
}

export function requireSameOrigin(config: AuthConfig): RequestHandler {
  return (req, res, next) => {
    if (!config.appOrigin) return void res.status(503).json({ message: "Authentication is not configured." });
    if (req.get("origin") !== config.appOrigin || req.get("sec-fetch-site") === "cross-site") return void res.status(403).json({ message: "Request origin is not allowed." });
    next();
  };
}

export async function sessionUser(req: Request, config: AuthConfig, store: AuthStore): Promise<AuthUser | undefined> {
  const token = req.signedCookies?.[SESSION_COOKIE];
  if (!config.ready || !validToken(token)) return undefined;
  return store.getSession(hashToken(token), new Date());
}

export function requireUser(config: AuthConfig, store: AuthStore): RequestHandler {
  return async (req, res, next) => {
    if (!config.ready) return void res.status(503).json({ message: "Sign-in is not configured yet." });
    const user = await sessionUser(req, config, store);
    if (!user) return void res.status(401).json({ message: "Sign in to manage your portfolio." });
    res.locals.user = user;
    res.setHeader("Cache-Control", "no-store");
    next();
  };
}
