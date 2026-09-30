# Folio — AI Portfolio Builder

Folio turns a resume into a polished, editable, and shareable portfolio website.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string (or set `DATABASE_PROVIDER=mongo` and `MONGODB_URI` for MongoDB)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/portfolio-builder/src/App.tsx` — routed product experience
- `artifacts/portfolio-builder/src/index.css` — shared dashboard/onboarding tokens
- `artifacts/api-server/src/routes/portfolios.ts` — portfolio, template, resume, and public URL routes
- `lib/api-spec/openapi.yaml` — API contract source of truth
- `lib/db/src/schema/portfolios.ts` — persisted portfolio schema
- `README.md` — architecture, setup, and security notes

## Architecture decisions

- Portfolio content is stored once as a JSON document and rendered through a selected template configuration.
- Draft and published portfolios share one stable slug; publishing only changes state and timestamp.
- The first product slice uses the shared Express/PostgreSQL service rather than frontend-only state.
- OpenAPI is the source of truth for client hooks and server validation.

## Product

- Marketing landing page, templates, pricing, login/signup surfaces
- Resume upload/review onboarding
- Profession and purpose-based portfolio setup
- Free and premium template catalog
- Dashboard for content, templates, appearance, domain, analytics, billing, and settings
- Published public portfolio pages with view counting
- Secure admin entry at `/admin` with server-side password verification and a signed HttpOnly cookie

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Run `pnpm --filter @workspace/api-spec run codegen` after changing `lib/api-spec/openapi.yaml`.
- Vite build requires the workflow-provided `PORT` and `BASE_PATH` values.
- Use managed artifact workflows rather than starting a second server for the same app.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
