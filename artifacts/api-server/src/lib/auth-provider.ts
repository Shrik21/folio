import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import { callbackUrl, pkceChallenge, type AuthConfig, type Identity, type OAuthState, type Provider } from "./auth-core";

const googleKeys = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));
export function authorizationUrl(config: AuthConfig, provider: Provider, state: string, verifier: string, nonce: string): string {
  const url = new URL(provider === "google" ? "https://accounts.google.com/o/oauth2/v2/auth" : "https://github.com/login/oauth/authorize");
  url.search = new URLSearchParams({ client_id: config.providers[provider].clientId, redirect_uri: callbackUrl(config, provider), response_type: "code", scope: provider === "google" ? "openid email profile" : "read:user user:email", state, code_challenge: pkceChallenge(verifier), code_challenge_method: "S256", ...(provider === "google" ? { nonce, prompt: "select_account" } : {}) }).toString();
  return url.toString();
}

async function jsonResponse(url: string, options: RequestInit) {
  const response = await fetch(url, { ...options, redirect: "error", signal: AbortSignal.timeout(12_000) });
  if (!response.ok) throw new Error("Identity provider request failed");
  return response.json() as Promise<Record<string, unknown>>;
}

function stringField(value: unknown, max = 500): string | null { return typeof value === "string" && value.length > 0 && value.length <= max ? value : null; }
function imageUrl(value: unknown): string | null {
  const candidate = stringField(value, 2000);
  if (!candidate) return null;
  try { return new URL(candidate).protocol === "https:" ? candidate : null; } catch { return null; }
}

export async function verifyGoogleIdentity(idToken: string, clientId: string, nonce: string, keys: JWTVerifyGetKey = googleKeys): Promise<Identity> {
  const { payload } = await jwtVerify(idToken, keys, { issuer: ["https://accounts.google.com", "accounts.google.com"], audience: clientId, algorithms: ["RS256"], requiredClaims: ["exp", "iat", "sub", "nonce"], maxTokenAge: "10m", clockTolerance: 5 });
  if (payload.nonce !== nonce || !stringField(payload.sub, 255) || (payload.azp && payload.azp !== clientId)) throw new Error("Google identity validation failed");
  return { provider: "google", providerUserId: payload.sub!, name: stringField(payload.name, 200) ?? "Google user", email: payload.email_verified === true ? stringField(payload.email, 320) : null, avatarUrl: imageUrl(payload.picture) };
}

export async function exchangeIdentity(config: AuthConfig, provider: Provider, code: string, state: OAuthState): Promise<Identity> {
  const token = await jsonResponse(provider === "google" ? "https://oauth2.googleapis.com/token" : "https://github.com/login/oauth/access_token", {
    method: "POST", headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: config.providers[provider].clientId, client_secret: config.providers[provider].clientSecret, code, grant_type: "authorization_code", redirect_uri: callbackUrl(config, provider), code_verifier: state.verifier }),
  });
  if (token.error) throw new Error("Authorization code was rejected");
  if (provider === "google") {
    if (typeof token.id_token !== "string") throw new Error("Google did not return an identity token");
    return verifyGoogleIdentity(token.id_token, config.providers.google.clientId, state.nonce);
  }
  const accessToken = stringField(token.access_token, 4096);
  if (!accessToken || token.token_type !== "bearer") throw new Error("GitHub did not return a valid access token");
  const headers = { Accept: "application/vnd.github+json", Authorization: `Bearer ${accessToken}`, "User-Agent": "Folio-Portfolio-Builder", "X-GitHub-Api-Version": "2022-11-28" };
  const profile = await jsonResponse("https://api.github.com/user", { headers });
  if (!Number.isSafeInteger(profile.id) || Number(profile.id) <= 0) throw new Error("GitHub did not return a stable user ID");
  const emailResult: unknown = await jsonResponse("https://api.github.com/user/emails", { headers });
  const emails = Array.isArray(emailResult) ? emailResult : [];
  const primary = emails.find((entry) => entry && entry.verified === true && entry.primary === true);
  return { provider, providerUserId: String(profile.id), name: stringField(profile.name, 200) ?? stringField(profile.login, 200) ?? "GitHub user", email: primary ? stringField(primary.email, 320) : null, avatarUrl: imageUrl(profile.avatar_url) };
}
