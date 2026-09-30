# Folio End-to-End Setup and Operations Guide

This guide explains how to install, start, configure, test, and operate Folio from a fresh checkout. Folio is a résumé-to-portfolio application built with TanStack Start, React 19, TypeScript, Tailwind CSS, Supabase, and optional Gemini or OpenAI-compatible AI.

## 1. What works in each setup mode

### Local mode

You can start the site without Supabase or an AI API key. In this mode:

- Marketing pages, templates, guides, dark mode, and responsive UI work.
- Signup and login automatically use **Local mode** with a signed, HTTP-only browser session.
- Portfolio drafts are stored in this browser and can be opened through a local preview URL.
- Résumé upload or pasted text works with the grounded local parser or Gemini.
- The hardcoded administrator login works.
- The admin dashboard opens, but displays zero live users and portfolios until Supabase is connected.

Local mode is designed for development and product evaluation. It stores one account in the browser and is not a replacement for production authentication or cloud storage.

### Full application mode

After connecting Supabase and applying the included migration:

- Users can sign up and log in.
- Résumés can be uploaded and parsed.
- Portfolio drafts can be saved, edited, published, and viewed at `/p/{slug}`.
- The admin dashboard can list accounts and portfolios and unpublish portfolios.
- AI résumé structuring can use either the built-in grounded parser or an OpenAI-compatible model.

## 2. Prerequisites

Install the following:

- Node.js 22.12 or newer
- npm
- A Supabase project for the full application
- An OpenAI-compatible API key only if remote AI generation is wanted

The Supabase CLI is optional because the database migration can also be pasted into the Supabase SQL Editor.

## 3. Quick start

Open PowerShell and run:

```powershell
cd "D:\code\AI-Portfolio-Builder\folio-project-import"
npm install
npm run dev -- --port 8080
```

Open:

- Website: `http://127.0.0.1:8080/`
- User login: `http://127.0.0.1:8080/login`
- User signup: `http://127.0.0.1:8080/signup`
- Admin login: `http://127.0.0.1:8080/admin-login`

Stop the development server with `Ctrl+C` in the terminal.

## 4. Hardcoded administrator login

The requested administrator credentials are hardcoded in the server-only authentication module:

```text
Email:    admin@folio.com
Password: Admin@123
```

Sign in at `http://127.0.0.1:8080/admin-login`. A successful login redirects to `/admin` and creates an eight-hour, HTTP-only, same-site session cookie.

The hardcoded values are defined in `src/lib/admin-auth.server.ts`. They are not included in the browser JavaScript bundle. Change both the credentials and `SESSION_SIGNING_SECRET` in that file before deploying a public production instance.

The hardcoded admin login is independent of Supabase Auth. Supabase is required only when the admin dashboard needs to read or manage live application data.

## 5. Configure the environment

Create a local environment file:

```powershell
Copy-Item .env.example .env
```

Fill in `.env`:

```dotenv
# Available to browser code
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key

# Available only to server code
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY=your-publishable-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Recommended AI setup
GEMINI_API_KEY=your-gemini-api-key

# Optional generic OpenAI-compatible provider
AI_API_KEY=
AI_BASE_URL=
AI_MODEL=

# Public canonical site URL
SITE_URL=http://127.0.0.1:8080
```

Find the Supabase URL and keys in the Supabase dashboard under project API settings.

Important:

- Never prefix the service-role key with `VITE_`.
- Never expose `SUPABASE_SERVICE_ROLE_KEY` to browser code or commit it to Git.
- Restart the development server after changing `.env`.
- `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `.env.example` are used only by the optional `admin:bootstrap` script. They do not change the separate hardcoded login described above.

## 6. Create the Supabase data model

The complete schema is in:

```text
supabase/migrations/202609210001_folio_core.sql
```

It creates:

- `profiles` and `portfolios` tables
- Profile and portfolio indexes
- A private `resumes` storage bucket
- User-creation and timestamp triggers
- Portfolio view counting
- Row Level Security policies
- Administrator-aware data policies

### Option A: Supabase SQL Editor

1. Open the Supabase dashboard.
2. Select the project.
3. Open **SQL Editor**.
4. Create a new query.
5. Paste the entire migration file.
6. Run the query once.

### Option B: Supabase CLI

From the project directory:

```powershell
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REFERENCE
npx supabase db push
```

The existing `supabase/config.toml` contains a project ID from the original project. Replace or relink it if using a different Supabase project.

## 7. Configure user authentication

Without Supabase, `/signup` and `/login` automatically use Local mode. The local account cookie is signed and HTTP-only, its password is hashed, and portfolio data stays in the current browser. No Google button or database setup is shown in this mode.

Connect Supabase for real multi-device user accounts and production deployment.

Email and password authentication uses Supabase Auth.

In Supabase:

1. Open **Authentication → Providers**.
2. Enable the Email provider.
3. Decide whether email confirmation is required.
4. Add the local and deployed URLs under **Authentication → URL Configuration**.

Suggested local URLs:

```text
Site URL: http://127.0.0.1:8080
Redirect URL: http://127.0.0.1:8080/**
```

Google login is optional. To use it, enable Google in Supabase and configure its OAuth client and redirect URLs. Email/password login works without Google OAuth.

### Optional Supabase admin account

The project also contains a bootstrap script that creates a Supabase Auth user with an `admin` profile role:

```powershell
npm run admin:bootstrap
```

This script requires `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. It is separate from the hardcoded `/admin-login` authentication and is not required for that login to work.

## 8. Configure AI résumé structuring

The résumé flow accepts:

- PDF files
- DOCX files
- Plain-text files
- Pasted résumé text

Limits enforced by the server include an 8 MB file limit, a 30-page PDF limit, and a 60,000-character text limit.

### Gemini API

Add only this value to `.env`:

```dotenv
GEMINI_API_KEY=your-gemini-api-key
```

Folio automatically uses Google's OpenAI-compatible Gemini endpoint and the default `gemini-3.8-flash` model. Override the model with `AI_MODEL` only when needed. Keep the key server-side and restart the development server after adding it.

### Local grounded parser

Leave both `GEMINI_API_KEY` and `AI_API_KEY` empty to use the deterministic local parser. It structures only information found in the supplied résumé and does not intentionally invent experience or credentials.

### Remote OpenAI-compatible model

Set:

```dotenv
AI_API_KEY=your-api-key
AI_BASE_URL=https://api.openai.com/v1
AI_MODEL=gpt-4.1-mini
```

`AI_BASE_URL` and `AI_MODEL` can be changed for another OpenAI-compatible provider. AI output is validated and audited against the source résumé before being used.

The `/api/ai-structure` endpoint accepts either a valid Supabase session or a signed Local-mode session. API keys remain server-side.

## 9. Normal user workflow

1. Visit `/signup` and create an account. Local mode is selected automatically when Supabase is absent.
2. Confirm the email if Supabase email confirmation is enabled.
3. Log in and open `/dashboard`.
4. Upload a PDF, DOCX, or TXT résumé, or paste résumé text.
5. Generate structured portfolio content.
6. Review and edit every generated section.
7. Choose a portfolio template and accent colour.
8. Choose a unique URL slug.
9. Save the draft.
10. Publish the portfolio.
11. Open the public page at `/p/{slug}`.

Public portfolio pages are server-rendered and include canonical metadata and ProfilePage/Person structured data for search engines and AI discovery systems.

## 10. Administrator workflow

1. Visit `/admin-login`.
2. Enter `admin@folio.com` and `Admin@123`.
3. Review account, portfolio, and view totals.
4. Open published portfolios for inspection.
5. Unpublish a portfolio when needed.
6. Use the logout button to clear the admin session.

If Supabase is not configured, the admin login still works but the dashboard shows an informational message and empty metrics.

## 11. Important routes

| Route                        | Purpose                            |
| ---------------------------- | ---------------------------------- |
| `/`                          | Search-focused marketing homepage  |
| `/features`                  | Product capabilities               |
| `/templates`                 | Portfolio template gallery         |
| `/examples`                  | Example portfolios                 |
| `/pricing`                   | Pricing page                       |
| `/guides`                    | SEO content hub                    |
| `/resume-to-portfolio`       | Search-intent landing page         |
| `/portfolio-for-developers`  | Developer landing page             |
| `/portfolio-for-designers`   | Designer landing page              |
| `/portfolio-for-freelancers` | Freelancer landing page            |
| `/signup`                    | User registration                  |
| `/login`                     | User login                         |
| `/dashboard`                 | Authenticated portfolio studio     |
| `/p/{slug}`                  | Supabase-backed public portfolio   |
| `/local/{slug}`              | Same-browser Local-mode preview    |
| `/admin-login`               | Hardcoded administrator login      |
| `/admin`                     | Protected administration dashboard |
| `/sitemap.xml`               | Generated search sitemap           |

## 12. Codebase map

```text
src/
  components/
    dashboard/        Portfolio creation and editing UI
    portfolio/        Public portfolio templates and renderer
    site/             Marketing layout, authentication card, header, footer
    ui/               Shared accessible UI primitives
  integrations/
    lovable/          Lovable authentication integration
    supabase/         Browser/server clients, types, and auth middleware
  lib/
    admin-auth.ts     Browser-callable admin server functions
    admin-auth.server.ts  Server-only hardcoded admin authentication
    local-auth.ts     Browser-callable Local-mode auth functions
    local-auth.server.ts  Signed local account and session cookies
    ai-resume.ts      AI/local résumé structuring and audit logic
    portfolio.ts      Portfolio normalization and JSON-LD helpers
  routes/             TanStack Start file routes
supabase/
  migrations/         Database, storage, trigger, and RLS definitions
scripts/
  bootstrap-admin.mjs Optional Supabase admin user bootstrap
```

## 13. Quality checks

Run these before committing or deploying:

```powershell
npm run typecheck
npm test
npm run lint
npm run build
```

Expected state at the time this guide was written:

- TypeScript check passes.
- Six automated tests pass.
- Production build passes.
- ESLint has no errors. It may report existing Fast Refresh warnings in shared UI component files.

To format the project:

```powershell
npm run format
```

## 14. Production build and preview

Build the application:

```powershell
npm run build
```

Preview the production output locally:

```powershell
npm run preview -- --port 8080
```

Before deployment:

1. Set `SITE_URL` to the final HTTPS domain.
2. Add all environment variables to the hosting provider.
3. Apply the Supabase migration.
4. Add the production URL to Supabase Auth redirects.
5. Change the hardcoded administrator credentials and signing secret.
6. Run all quality checks.
7. Test signup, login, résumé upload, publish, public portfolio, admin login, and logout on the deployed site.

The current build is configured through the Lovable TanStack/Vite integration and produces a Nitro Cloudflare-compatible server bundle. Confirm that the selected hosting provider supports the generated server runtime or adjust the Nitro preset before deployment.

## 15. Troubleshooting

### The port is already in use

Start on another port:

```powershell
npm run dev -- --port 8081
```

Update `SITE_URL` and Supabase local redirect URLs when using a different port.

### Supabase environment variable error

Confirm that `.env` exists and contains both browser and server variables. Restart the development server after editing it.

### Admin login works but shows zero records

This is expected without `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Add them and restart the server. Also confirm that the migration was applied.

### User login or signup fails

When Supabase is not configured, the page should show **Local mode** and work without cloud settings. If Supabase is configured, check:

- Supabase URL and publishable key
- Email provider status
- Email confirmation state
- Allowed site and redirect URLs
- Browser network response from Supabase Auth

### Résumé upload returns Unauthorized

The AI endpoint requires either a Supabase or Local-mode session. Log in again. If Local mode was cleared, create the local account again in the same browser.

### PDF or DOCX text is empty

Scanned PDFs may contain images instead of selectable text. Convert them with OCR first or paste the résumé text manually.

### AI uses the local parser unexpectedly

For Gemini, confirm that `GEMINI_API_KEY` is set in `.env` and restart the process. For another provider, verify `AI_API_KEY`, `AI_BASE_URL`, and `AI_MODEL`.

### Public portfolio returns 404

Confirm that the slug exists and the portfolio status is `published`. Draft and unpublished portfolios are not returned by the public route.

## 16. Security checklist

- Keep `.env` out of version control.
- Never expose the Supabase service-role key to the browser.
- Replace the hardcoded admin password and signing secret before public deployment.
- Keep the résumé storage bucket private.
- Preserve the supplied Row Level Security policies.
- Review AI-generated content before publishing.
- Use HTTPS in production so the admin cookie is sent only over a secure connection.
- Rotate credentials immediately if they are ever committed to a public repository.
