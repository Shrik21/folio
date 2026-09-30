# Folio deployment

## Services

- Source repository: https://github.com/Shrik21/folio (branch `main`).
- Render project: **Folio Production**, Production environment (inside the existing Workflow-orch workspace).
- Render API: https://folio-api-t9uk.onrender.com
- Health endpoint: https://folio-api-t9uk.onrender.com/api/health
- Atlas project: **Folio Production**, ID `6abc93a4ff5aaa982c7bb02d`.
- Atlas cluster: **folio-production**, free tier, AWS Singapore.
- MongoDB database: `folio`. Application database user: `folio_app`, with read/write access to this database.
- Frontend: https://folio-seven-delta.vercel.app
- Vercel project: `folio`, ID `prj_aTgry5pjEHOzFNduIZLr8iIgSMsV`.
- Vercel deployment: `dpl_DuJViB9rP7eLueT6PZZ63KpMq7dk`, production alias `https://folio-seven-delta.vercel.app`.

The Render URL hosts the API. `Cannot GET /` on that URL does not mean the API is offline. Health reports whether a Gemini key exists; it does not prove database connectivity or a successful AI generation.

## Environment configuration

Local configuration is in `D:\code\AI-Portfolio-Builder\.env`. This file is ignored by Git. Keep real credentials out of documentation and the frontend.

Render requires:

```dotenv
NODE_ENV=production
DATABASE_PROVIDER=mongo
MONGODB_DATABASE=folio
MONGODB_URI=<Atlas application connection string>
SESSION_SECRET=<session signing secret>
GEMINI_API_KEY=<Gemini key>
GOOGLE_CLIENT_ID=<Google OAuth client ID>
GOOGLE_CLIENT_SECRET=<Google OAuth client secret>
APP_URL=https://folio-seven-delta.vercel.app
ADMIN_USERNAME=admin@folio.com
ADMIN_PASSWORD=<production admin password>
```

Production admin login is enabled with `ADMIN_USERNAME=admin@folio.com` and the configured production password. GitHub sign-in additionally requires its own client ID and secret. Do not replace Render's platform-assigned `PORT` with the local development port.

Atlas network access permits the Render Singapore outbound ranges `74.220.52.0/24` and `74.220.60.0/24`, plus the development machine's public IP at setup time. If the local public IP changes, update its Atlas access entry. Keep Render's ranges current using the service's Connect menu.

## Frontend and Google sign-in

`vercel.json` builds the Vite workspace and publishes `artifacts/portfolio-builder/dist/public`. `/api/*` is proxied to Render, and other application routes fall back to `index.html`, so direct links to login and dashboard work.

After the frontend deployment succeeds:

1. Render's `APP_URL` must be the actual frontend HTTPS origin, without a path.
2. In the Google OAuth web client, add `https://folio-seven-delta.vercel.app` as an authorized JavaScript origin and add the exact redirect URI `https://folio-seven-delta.vercel.app/api/auth/google/callback`.
3. Keep the existing localhost OAuth entries if local development is still needed.
4. Redeploy Render and verify sign-in from the frontend, portfolio editing, publishing, and resume parsing.

Vercel's production deploy is live from a CLI upload. Vercel's GitHub integration must still be granted access to `Shrik21/folio` before automatic Git-based deployments work. GitHub may require the account owner to confirm access before changing this installation.

## PostgreSQL data migration

The migration copied and verified **4 users and 3 portfolios** from PostgreSQL to MongoDB on September 30, 2026. IDs, owner relationships, content, timestamps, publication state, slugs, and view counts were preserved. The source PostgreSQL database remains unchanged. Temporary OAuth states and login sessions are not migrated; users sign in again.

The local `.env` retains `DATABASE_URL` as the PostgreSQL source and contains the new `MONGODB_URI`. The application uses MongoDB because `DATABASE_PROVIDER=mongo`.

Run a read-only comparison from the project root:

```powershell
node scripts/migrate-postgres-to-mongo.mjs
```

To insert missing records after reviewing the dry run:

```powershell
node scripts/migrate-postgres-to-mongo.mjs --apply
```

The script never overwrites conflicting target records. It verifies copied document contents and sets the portfolio ID counter to avoid collisions. After production users edit MongoDB data, conflicts against the older PostgreSQL copy are expected; do not use this script as continuous synchronization.
