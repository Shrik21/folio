import { Router } from "express";
import { authorizationUrl, exchangeIdentity } from "./auth-provider";
import { hashToken, isProvider, providerAvailable, randomToken, requireSameOrigin, safeReturnTo, SESSION_COOKIE, SESSION_TTL, sessionCookieOptions, sessionUser, STATE_COOKIE, STATE_TTL, stateCookieOptions, validToken, type AuthConfig, type AuthStore } from "./auth-core";

export function createAuthRouter(config: AuthConfig, store: AuthStore, exchange = exchangeIdentity) {
  const router = Router();
  router.use((_req, res, next) => { res.setHeader("Cache-Control", "no-store"); res.setHeader("Referrer-Policy", "no-referrer"); next(); });
  router.get("/providers", (_req, res) => {
    res.json({ configured: config.ready, providers: (["google", "github"] as const).map((id) => ({ id, name: id === "google" ? "Google" : "GitHub", available: providerAvailable(config, id), startUrl: `/api/auth/${id}/start` })) });
  });
  router.get("/session", async (req, res) => {
    const user = await sessionUser(req, config, store);
    res.json({ authenticated: Boolean(user), user: user ?? null });
  });
  router.get("/:provider/start", async (req, res) => {
    const provider = req.params.provider;
    if (!isProvider(provider)) return void res.status(404).json({ message: "Unknown sign-in provider." });
    if (!providerAvailable(config, provider)) return void res.status(503).json({ message: `${provider === "google" ? "Google" : "GitHub"} sign-in is not configured yet.` });
    // Reject explicit cross-origin initiation; direct navigation/bookmarks remain supported.
    if (req.get("origin") && req.get("origin") !== config.appOrigin) return void res.status(403).json({ message: "Request origin is not allowed." });
    const state = randomToken(), browser = randomToken(), verifier = randomToken(), nonce = randomToken();
    await store.cleanup(new Date());
    await store.saveState({ stateHash: hashToken(state), browserHash: hashToken(browser), provider, verifier, nonce, returnTo: safeReturnTo(req.query.returnTo), expiresAt: new Date(Date.now() + STATE_TTL) });
    res.cookie(STATE_COOKIE, browser, stateCookieOptions(config));
    res.redirect(authorizationUrl(config, provider, state, verifier, nonce));
  });
  router.get("/:provider/callback", async (req, res) => {
    const failure = (error: string) => res.redirect(config.appOrigin ? `${config.appOrigin}/login?error=${error}` : `/login?error=${error}`);
    const provider = req.params.provider;
    if (!isProvider(provider) || !providerAvailable(config, provider)) return void failure("provider_unavailable");
    const browser = req.signedCookies?.[STATE_COOKIE];
    const stateValue = req.query.state;
    res.clearCookie(STATE_COOKIE, { ...stateCookieOptions(config), maxAge: undefined });
    if (!validToken(stateValue) || !validToken(browser)) return void failure("invalid_state");
    try {
      const state = await store.consumeState(hashToken(stateValue), hashToken(browser), provider, new Date());
      if (!state) return void failure("invalid_state");
      if (req.query.error) return void failure(req.query.error === "access_denied" ? "cancelled" : "authentication_failed");
      if (typeof req.query.code !== "string" || !req.query.code || req.query.code.length > 4096) return void failure("authentication_failed");
      const identity = await exchange(config, provider, req.query.code, state);
      const user = await store.upsertUser(identity);
      // Rotate any existing session and issue an opaque, independently revocable token.
      const previous = req.signedCookies?.[SESSION_COOKIE];
      if (validToken(previous)) await store.deleteSession(hashToken(previous));
      const token = randomToken();
      await store.saveSession(hashToken(token), user.id, new Date(Date.now() + SESSION_TTL));
      res.cookie(SESSION_COOKIE, token, sessionCookieOptions(config));
      res.redirect(`${config.appOrigin}${safeReturnTo(state.returnTo)}`);
    } catch {
      // Never expose or log provider codes, tokens, profile payloads, or credentials.
      failure("authentication_failed");
    }
  });
  router.post("/logout", requireSameOrigin(config), async (req, res) => {
    const token = req.signedCookies?.[SESSION_COOKIE];
    if (config.ready && validToken(token)) await store.deleteSession(hashToken(token));
    res.clearCookie(SESSION_COOKIE, { ...sessionCookieOptions(config), maxAge: undefined });
    res.json({ authenticated: false, user: null });
  });
  return router;
}
