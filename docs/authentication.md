# Google and GitHub sign-in

The frontend sends users through the Express API's OAuth authorization-code flow. The API validates their identity and issues a signed, HttpOnly cookie backed by an expiring PostgreSQL session. Private portfolio routes use the authenticated user's ID. Google and GitHub accounts are separate identities, including when their emails match. There is no password signup, demo-account sign-in, or automatic account linking.

## Local setup

1. Use Node 22+ and install dependencies with `pnpm install` from the repository root.
2. Copy `.env.example` to `.env` and set either `DATABASE_URL` for PostgreSQL or `DATABASE_PROVIDER=mongo` plus `MONGODB_URI` for MongoDB. Also set `APP_URL=http://localhost:5173`, `PORT=3001`, and a random `SESSION_SECRET` of at least 32 characters. Generate a secret with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.
3. Provision your own PostgreSQL database. For a fresh empty PostgreSQL database, run `pnpm --filter @workspace/db push` with `DATABASE_URL` in the shell environment to create the current schema. MongoDB creates its collections and indexes on first request. For an existing PostgreSQL deployment, review/back up the database and apply `lib/db/migrations/0001_social_auth.sql` once. The migration retains existing portfolio owners and removes the insecure default owner. No database migration is run automatically by the API.
4. Configure one or both providers as below. Each button is available only when its client ID and secret, `APP_URL`, session secret, and database URL are configured. Provider availability reports configuration, not a successful database connection or completed provider verification.
5. Start the API with `pnpm --filter @workspace/api-server dev` and the frontend with `pnpm --filter @workspace/portfolio-builder dev`. The API dev/start scripts load the root `.env` file; keep it out of Git. Visit the frontend at `http://localhost:5173`. Vite proxies `/api` to port 3001. Do not open the API port for the sign-in UI.

## Google

In the [Google Cloud console](https://console.cloud.google.com/auth/overview), configure the OAuth consent screen, audience, branding, support email, and test users if the application is in testing. Create an OAuth client of type **Web application**. Add this exact authorized redirect URI:

```text
http://localhost:5173/api/auth/google/callback
```

Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` on the server. For production, register `https://YOUR-DOMAIN/api/auth/google/callback` and set `APP_URL=https://YOUR-DOMAIN`. If the console asks for authorized JavaScript origins, use the matching frontend origin. The server requests only `openid email profile`; no offline access or refresh token is required.

Google ID tokens are checked for a trusted RSA signature against Google's JWKS, issuer, audience, expiration, recent issue time, nonce, and authorized party when present. The immutable `sub` claim identifies the user; an email is stored only when Google marks it verified. See [Google's OpenID Connect documentation](https://developers.google.com/identity/openid-connect/openid-connect).

## GitHub

Create an **OAuth App** in [GitHub developer settings](https://github.com/settings/developers). Use `http://localhost:5173` as the homepage URL and this authorization callback URL:

```text
http://localhost:5173/api/auth/github/callback
```

Set `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` on the server. Use a separate OAuth App for production with homepage `https://YOUR-DOMAIN` and callback `https://YOUR-DOMAIN/api/auth/github/callback`. The app requests `read:user user:email`, not repository permissions. The authenticated GitHub `/user` API's stable numeric ID identifies the account. Only its verified primary email is stored; a missing email is supported. See [GitHub's OAuth App authorization documentation](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps).

## Deployment requirements

- Serve the UI and `/api` under the same fixed origin. Forward all `/api/*` methods, cookies, `Origin`, and response `Set-Cookie` headers to the API. Register callback URLs on that public origin, not an internal API host.
- HTTPS is mandatory in production. Cookies become `Secure`; there is no cookie domain override, wildcard CORS, dynamic callback host, or provider secret in the client bundle.
- This repository contains an Express API and PostgreSQL persistence. A static frontend deployment alone cannot complete sign-in. Deploy the API separately behind `/api` or adapt it to your hosting platform's server runtime.
- Keep secrets in the host's secret manager. Changing `SESSION_SECRET` invalidates existing signed cookies. Never put these variables in a `VITE_` or other public/client environment setting.
- OAuth state expires after 10 minutes, is tied to the initiating browser and provider, and is consumed atomically once. Both providers use PKCE S256. Successful login rotates the previous session; sessions expire after seven days and logout deletes them server-side. Only token hashes are saved in the database; provider access tokens are not persisted.
- Expired state/session rows are cleaned on new login starts. High-traffic deployments should additionally schedule database cleanup and apply an edge rate limit to sign-in endpoints. The legacy admin password endpoint has a process-local attempt limit; multiple replicas need a shared/edge limit.
- Private portfolio read/write routes require authentication and scope every record to its owner. State-changing requests and logout require the configured `Origin`. Templates and published portfolio pages stay public. Resume files and drafts must not be served through the public route.
- The optional existing `/admin` login is separate, requires configured credentials and the strong session secret, and grants access only to legacy `demo-user` portfolios. It cannot access social users' portfolios. Old admin cookies are invalid after this update. Admin cookies have an eight-hour expiry validated by the server; to revoke all legacy admin cookies immediately, rotate `SESSION_SECRET` or disable `ADMIN_PASSWORD`.

## API behavior

| Endpoint | Behavior |
| --- | --- |
| `GET /api/auth/providers` | `{ configured, providers: [{ id, name, available, startUrl }] }`; no secrets |
| `GET /api/auth/session` | `{ authenticated, user }`; user is `null` when signed out, otherwise `{ id, name, email, avatarUrl, provider }` |
| `GET /api/auth/google/start?returnTo=/onboarding` | Starts Google; GitHub uses `/github/start` |
| `GET /api/auth/:provider/callback` | Validates state/identity and redirects to a safe local destination |
| `POST /api/auth/logout` | Revokes the session; requires same-origin `Origin`; returns `{ authenticated: false, user: null }` |
| `GET /api/portfolios` | Current user's latest portfolio; `404` until they create one, no fabricated starter data |

Failure redirects go to `/login?error=cancelled`, `invalid_state`, `provider_unavailable`, or `authentication_failed`. Missing/invalid session returns `401` on private routes; missing auth configuration returns `503`. The API still fails startup if `DATABASE_URL` is absent, rather than silently creating a local/demo store. Database/provider failures never create an authenticated session or expose provider response payloads. Profile edits retain the portfolio slug, so previously shared links remain valid.

## Verification

Run `pnpm typecheck:libs`, `pnpm --filter @workspace/api-server typecheck`, and `pnpm --filter @workspace/api-server test:auth`. Tests run without a live database or provider credentials. They cover provider availability, PKCE parameters, browser/provider state binding, replay and expiry, cancellation, signed-session tampering, CSRF, logout revocation, expired sessions, separate identities with matching emails, SQL ownership scopes, and Google signature/issuer/audience/nonce/expiration validation using generated test keys.

Before enabling real users, complete one real consent flow with each configured provider, refresh the dashboard, sign out, and verify a second account cannot retrieve/update/publish the first account's portfolio. These live-provider and migrated-database checks require the owner's credentials/infrastructure and are not claimed by the offline tests. Payment collection, AI resume extraction, custom-domain provisioning, and production deployment are separate integrations.
