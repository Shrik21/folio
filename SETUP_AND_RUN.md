# Setup and Run Guide

## Two Codebases
Folio consists of two completely separate codebases that communicate over HTTP:
1. **Express Backend**: `D:\code\AI-Portfolio-Builder` (API server, database, auth)
2. **Next.js Frontend**: `D:\portfolio-builder` (App Router UI, client side)

## Environment Variables

### Backend (`D:\code\AI-Portfolio-Builder\.env`)
Required variables:
- `DATABASE_URL` (when using PostgreSQL)
- `DATABASE_PROVIDER` (`postgres` by default, or `mongo`)
- `MONGODB_URI` and `MONGODB_DATABASE` (when `DATABASE_PROVIDER=mongo`)
- `APP_URL`
- `PORT`
- `SESSION_SECRET`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `GEMINI_API_KEY` (Required for resume parsing)
- `ENABLE_DEV_ADMIN` (Optional, set to `true` to enable admin@folio.com development login in production)

### Frontend (`D:\portfolio-builder\.env.local`)
Required variables:
- `API_URL` (e.g. `http://localhost:3001`)

## Start Commands

Always use `pnpm` to manage packages in both repositories. If you do not have `pnpm` installed globally, you can use `npx pnpm`.

### Backend
1. Open terminal in `D:\code\AI-Portfolio-Builder`
2. Run `pnpm install`
3. If using PostgreSQL, run `pnpm --filter @workspace/db run push`. If using MongoDB, create a database/user in MongoDB Atlas and set `DATABASE_PROVIDER=mongo`, `MONGODB_URI`, and optionally `MONGODB_DATABASE=folio`; the API creates its collections and indexes on first request.
4. Run `pnpm run dev:api`
   - Backend will run on `http://localhost:3001`

### Frontend
1. Open terminal in `D:\portfolio-builder`
2. Run `npx pnpm install`
3. Run `npx pnpm dev`
   - Frontend will run on `http://localhost:3000`

## Gemini Resume Parsing
Folio allows users to upload a PDF or DOCX file to extract their experience and skills.
- The file is sent directly from the frontend to the backend via `multipart/form-data`.
- The backend parses the text and sends it to the Gemini API.
- The `GEMINI_API_KEY` must be set in the **backend** `.env` file. Do not set it in the frontend.
- If the key is missing or the API fails, a local fallback parser is used.

## Choosing MongoDB instead of PostgreSQL
MongoDB is supported by the API as an alternative store. It uses the same Google sessions, portfolios, admin statistics, public portfolio routes, and resume flow. Set `DATABASE_PROVIDER=mongo`; do not set it to `mongo` until the MongoDB URI is reachable. Existing PostgreSQL rows are not copied automatically—export/import them before switching production traffic.

For a local MongoDB instance:
```env
DATABASE_PROVIDER=mongo
MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_DATABASE=folio
```

For Atlas, use the `mongodb+srv://...` URI supplied by Atlas. Keep `DATABASE_URL` available while you migrate back or run PostgreSQL-based tooling.

## Dark Mode
The frontend includes a full Light/Dark/System theme implementation.
- This is controlled by a `next-themes` switcher component in the navigation bar.
- To style custom components, use the CSS variables defined in `src/app/globals.css` (e.g. `bg-background`, `text-foreground`, `bg-surface`, `border-border`).

## Admin Access
The frontend includes a full admin dashboard located at `/admin/login`.
**⚠️ WARNING**: A development admin login fallback is configured. If `ADMIN_PASSWORD` is left empty in the backend environment, or if running in development mode, you can log in as an administrator using:
- **Email**: `admin@folio.com`
- **Password**: `Admin@123`

This fallback is disabled in production unless you explicitly set `ENABLE_DEV_ADMIN=true`. You should always set a strong `ADMIN_PASSWORD` in production.

## Troubleshooting
- **Cannot Sign In / Invalid State Error**: Ensure both frontend and backend are running and that `API_URL` in frontend `.env.local` points correctly to the backend. Also, ensure you are accessing the frontend via `http://localhost:3000` exactly (not `127.0.0.1`).
- **OAuth Callback Error**: Double-check that your Google Cloud Console redirect URI precisely matches `http://localhost:3000/api/auth/google/callback`.
