import assert from "node:assert/strict";
import { test } from "node:test";
import express from "express";
import cookieParser from "cookie-parser";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { PgDialect } from "drizzle-orm/pg-core";
import { createAuthRouter } from "../src/lib/auth-router";
import { hashToken, readAuthConfig, requireSameOrigin, requireUser, safeReturnTo, sessionCookieOptions, SESSION_COOKIE, type AuthStore, type AuthUser, type OAuthState } from "../src/lib/auth-core";
import { verifyGoogleIdentity } from "../src/lib/auth-provider";
import { ownerScope, publicationError } from "../src/lib/portfolio-access";

const config = readAuthConfig({ NODE_ENV: "development", APP_URL: "http://localhost:5173", DATABASE_URL: "test-only", SESSION_SECRET: "test-only-secret-that-has-at-least-32-characters", GOOGLE_CLIENT_ID: "google-client", GOOGLE_CLIENT_SECRET: "secret", GITHUB_CLIENT_ID: "github-client", GITHUB_CLIENT_SECRET: "secret" });
function memoryStore() {
  const states = new Map<string, OAuthState>();
  const sessions = new Map<string, { userId: string; expiresAt: Date }>();
  const users = new Map<string, AuthUser>();
  const identities = new Map<string, string>();
  const store: AuthStore = {
    async saveState(state) { states.set(state.stateHash, state); },
    async consumeState(hash, browserHash, provider, now) {
      const value = states.get(hash);
      if (!value || value.browserHash !== browserHash || value.provider !== provider || value.expiresAt <= now) return undefined;
      states.delete(hash); return value;
    },
    async upsertUser(identity) {
      const key = `${identity.provider}:${identity.providerUserId}`;
      const id = identities.get(key) ?? `user-${users.size + 1}`;
      identities.set(key, id);
      const user = { id, name: identity.name, email: identity.email, avatarUrl: identity.avatarUrl, provider: identity.provider };
      users.set(id, user); return user;
    },
    async saveSession(hash, userId, expiresAt) { sessions.set(hash, { userId, expiresAt }); },
    async getSession(hash, now) { const entry = sessions.get(hash); return entry && entry.expiresAt > now ? users.get(entry.userId) : undefined; },
    async deleteSession(hash) { sessions.delete(hash); },
    async cleanup(now) { for (const [hash, value] of states) if (value.expiresAt <= now) states.delete(hash); for (const [hash, value] of sessions) if (value.expiresAt <= now) sessions.delete(hash); },
  };
  return { store, states, sessions, users };
}

async function fixture(overrides = {}) {
  const memory = memoryStore();
  const settings = { ...config, ...overrides };
  const app = express(); app.use(cookieParser(settings.sessionSecret)); app.use(express.json());
  let exchanges = 0;
  app.use("/api/auth", createAuthRouter(settings, memory.store, async (_config, provider) => { exchanges++; return { provider, providerUserId: "stable-subject", name: "Test Person", email: "test@example.com", avatarUrl: null }; }));
  app.get("/private", requireUser(settings, memory.store), (_req, res) => { res.json({ ownerId: res.locals.user.id }); });
  app.post("/private", requireSameOrigin(settings), requireUser(settings, memory.store), (_req, res) => { res.json({ ownerId: res.locals.user.id }); });
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address(); assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}`;
  const request = (path: string, options: RequestInit = {}) => fetch(`${base}${path}`, { ...options, redirect: "manual" });
  const close = () => new Promise<void>((resolve, reject) => { server.closeAllConnections(); server.close((error) => error ? reject(error) : resolve()); });
  return { ...memory, request, close, get exchanges() { return exchanges; } };
}

function cookie(response: Response, name: string) {
  const value = response.headers.getSetCookie().find((entry) => entry.startsWith(`${name}=`));
  assert.ok(value, `Expected cookie ${name}`); return value.split(";")[0];
}
async function start(f: Awaited<ReturnType<typeof fixture>>, provider = "google", returnTo = "/dashboard") {
  const response = await f.request(`/api/auth/${provider}/start?returnTo=${encodeURIComponent(returnTo)}`);
  assert.equal(response.status, 302);
  const location = new URL(response.headers.get("location")!);
  assert.equal(location.searchParams.get("code_challenge_method"), "S256");
  assert.ok(location.searchParams.get("code_challenge"));
  return { state: location.searchParams.get("state")!, browser: cookie(response, "folio_oauth_browser"), location };
}
async function login(f: Awaited<ReturnType<typeof fixture>>, provider = "google") {
  const auth = await start(f, provider);
  const response = await f.request(`/api/auth/${provider}/callback?state=${auth.state}&code=provider-code`, { headers: { Cookie: auth.browser } });
  assert.equal(response.headers.get("location"), "http://localhost:5173/dashboard");
  return cookie(response, SESSION_COOKIE);
}

test("configuration disables unconfigured auth and rejects unsafe production origins", () => {
  assert.equal(readAuthConfig({}).ready, false);
  assert.equal(readAuthConfig({ ...process.env, APP_URL: "http://localhost:5173", SESSION_SECRET: "short", DATABASE_URL: "test", NODE_ENV: "development" }).ready, false);
  assert.throws(() => readAuthConfig({ APP_URL: "http://localhost:5173", NODE_ENV: "production" }));
  assert.throws(() => readAuthConfig({ APP_URL: "https://example.com/path" }));
  assert.equal(sessionCookieOptions({ ...config, secure: true }).secure, true);
  for (const value of ["https://evil.test", "//evil.test", "/\\evil.test", "/api/auth/logout", "/dashboard/../../api/auth/logout", "/%2f%2fevil.test"]) {
    assert.equal(safeReturnTo(value), "/dashboard");
  }
  assert.equal(safeReturnTo("/onboarding/details"), "/onboarding/details");
});

test("unavailable providers return honest status and cannot sign a user in", async () => {
  const f = await fixture({ ready: false }); try {
    const providers = await (await f.request("/api/auth/providers")).json();
    assert.ok(providers.providers.every((p: { available: boolean }) => !p.available));
    assert.equal((await f.request("/api/auth/google/start")).status, 503);
    assert.deepEqual(await (await f.request("/api/auth/session")).json(), { authenticated: false, user: null });
    assert.equal((await f.request("/private")).status, 503);
  } finally { await f.close(); }
});

test("OAuth requires the initiating browser, exact provider, expiring state and one use", async () => {
  const f = await fixture(); try {
    const auth = await start(f, "google", "//evil.test");
    assert.equal(auth.location.searchParams.get("redirect_uri"), "http://localhost:5173/api/auth/google/callback");
    let response = await f.request(`/api/auth/google/callback?state=${auth.state}&code=test`);
    assert.ok(response.headers.get("location")?.endsWith("error=invalid_state"));
    response = await f.request(`/api/auth/github/callback?state=${auth.state}&code=test`, { headers: { Cookie: auth.browser } });
    assert.ok(response.headers.get("location")?.endsWith("error=invalid_state"));
    assert.equal(f.exchanges, 0);
    response = await f.request(`/api/auth/google/callback?state=${auth.state}&code=test`, { headers: { Cookie: auth.browser } });
    assert.equal(response.headers.get("location"), "http://localhost:5173/dashboard");
    assert.equal(f.exchanges, 1);
    response = await f.request(`/api/auth/google/callback?state=${auth.state}&code=test`, { headers: { Cookie: auth.browser } });
    assert.ok(response.headers.get("location")?.endsWith("error=invalid_state"));
    assert.equal(f.exchanges, 1);
    const expired = await start(f); f.states.get(hashToken(expired.state))!.expiresAt = new Date(0);
    response = await f.request(`/api/auth/google/callback?state=${expired.state}&code=test`, { headers: { Cookie: expired.browser } });
    assert.ok(response.headers.get("location")?.endsWith("error=invalid_state"));
  } finally { await f.close(); }
});

test("cancellation does not create a session and consumes its state", async () => {
  const f = await fixture(); try {
    const auth = await start(f);
    const response = await f.request(`/api/auth/google/callback?state=${auth.state}&error=access_denied`, { headers: { Cookie: auth.browser } });
    assert.ok(response.headers.get("location")?.endsWith("error=cancelled"));
    assert.equal(f.exchanges, 0); assert.equal(f.sessions.size, 0); assert.equal(f.states.size, 0);
  } finally { await f.close(); }
});

test("signed sessions require valid signatures, expire server-side, reject CSRF and revoke on logout", async () => {
  const f = await fixture(); try {
    assert.equal((await f.request("/private")).status, 401);
    const signed = await login(f);
    const session = await f.request("/api/auth/session", { headers: { Cookie: signed } });
    assert.equal(session.headers.get("cache-control"), "no-store");
    assert.equal((await session.json()).user.id, "user-1");
    assert.equal((await f.request("/private", { headers: { Cookie: signed + "tampered" } })).status, 401);
    assert.equal((await f.request("/private", { method: "POST", headers: { Cookie: signed, Origin: "https://evil.test" } })).status, 403);
    assert.equal((await f.request("/api/auth/logout", { method: "POST", headers: { Cookie: signed } })).status, 403);
    assert.equal((await f.request("/private", { method: "POST", headers: { Cookie: signed, Origin: config.appOrigin! } })).status, 200);
    const logout = await f.request("/api/auth/logout", { method: "POST", headers: { Cookie: signed, Origin: config.appOrigin! } });
    assert.equal(logout.status, 200); assert.equal(f.sessions.size, 0);
    assert.equal((await f.request("/private", { headers: { Cookie: signed } })).status, 401);
    const again = await login(f); for (const value of f.sessions.values()) value.expiresAt = new Date(0);
    assert.equal((await f.request("/private", { headers: { Cookie: again } })).status, 401);
  } finally { await f.close(); }
});

test("provider identities with matching emails remain separate and SQL scopes portfolio ownership", async () => {
  const f = await fixture(); try {
    const google = await login(f, "google"), github = await login(f, "github");
    const first = await (await f.request("/private", { headers: { Cookie: google } })).json();
    const second = await (await f.request("/private", { headers: { Cookie: github } })).json();
    assert.notEqual(first.ownerId, second.ownerId);
    const query = new PgDialect().sqlToQuery(ownerScope(first.ownerId, 42)!);
    assert.match(query.sql, /"owner_id" = \$1/); assert.match(query.sql, /"id" = \$2/);
    assert.deepEqual(query.params, [first.ownerId, 42]);
    const otherQuery = new PgDialect().sqlToQuery(ownerScope(second.ownerId, 42)!);
    assert.notDeepEqual(query.params, otherQuery.params);
  } finally { await f.close(); }
});

test("Google identities require a valid signature, issuer, audience, nonce and unexpired token", async () => {
  const pair = await generateKeyPair("RS256");
  const jwk = await exportJWK(pair.publicKey); jwk.kid = "test-key";
  const keys = createLocalJWKSet({ keys: [jwk] });
  const sign = (claims = {}, key = pair.privateKey) => new SignJWT({ nonce: "nonce", name: "Person", email: "person@example.com", email_verified: true, ...claims }).setProtectedHeader({ alg: "RS256", kid: "test-key" }).setSubject("stable-google-sub").setIssuer("https://accounts.google.com").setAudience("client").setIssuedAt().setExpirationTime("5m").sign(key);
  const valid = await sign();
  assert.equal((await verifyGoogleIdentity(valid, "client", "nonce", keys)).providerUserId, "stable-google-sub");
  await assert.rejects(verifyGoogleIdentity(valid, "wrong-client", "nonce", keys));
  await assert.rejects(verifyGoogleIdentity(valid, "client", "wrong-nonce", keys));
  const wrongPair = await generateKeyPair("RS256");
  await assert.rejects(verifyGoogleIdentity(await sign({}, wrongPair.privateKey), "client", "nonce", keys));
  const expired = await new SignJWT({ nonce: "nonce" }).setProtectedHeader({ alg: "RS256", kid: "test-key" }).setSubject("sub").setAudience("client").setIssuer("https://accounts.google.com").setIssuedAt(1).setExpirationTime(2).sign(pair.privateKey);
  await assert.rejects(verifyGoogleIdentity(expired, "client", "nonce", keys));
  const badIssuer = await new SignJWT({ nonce: "nonce" }).setProtectedHeader({ alg: "RS256", kid: "test-key" }).setSubject("sub").setAudience("client").setIssuer("https://evil.test").setIssuedAt().setExpirationTime("5m").sign(pair.privateKey);
  await assert.rejects(verifyGoogleIdentity(badIssuer, "client", "nonce", keys));
  assert.equal((await verifyGoogleIdentity(await sign({ email_verified: false }), "client", "nonce", keys)).email, null);
});

test("premium or unknown templates cannot be published without a payment integration", () => {
  assert.equal(publicationError("clean-professional"), null);
  assert.equal(publicationError("developer-command-center")?.status, 402);
  assert.equal(publicationError("bento-professional")?.status, 402);
  assert.equal(publicationError("unknown-template")?.status, 400);
});
