# Folio — AI Portfolio Builder

Folio turns the resume someone already has into a considered, shareable portfolio. The first build includes the complete core journey:

**Upload → Review → Choose → Preview → Publish → Share**

## What is included

- Premium marketing landing page with template gallery and pricing
- Guided onboarding with PDF/DOC/DOCX validation, review, profession, purpose, and template steps
- Three initial templates in a shared catalog:
  - Clean Professional (free)
  - Developer Command Center (premium)
  - Bento Professional (premium)
- Portfolio content stored separately from the selected template
- Editable portfolio content surface and appearance controls
- Draft/published state with stable slug generation
- Public portfolio route at `/p/:slug`
- Basic view counting for published portfolios
- Responsive dashboard shell for portfolio, content, template, appearance, domain, analytics, billing, and settings surfaces
- Typed OpenAPI contract, generated React Query hooks, generated Zod validation, and a PostgreSQL schema

## Architecture

This repository is a pnpm monorepo:

```text
artifacts/
  api-server/          Express API and route handlers
  portfolio-builder/  React + Vite application
lib/
  api-spec/            OpenAPI source of truth
  api-client-react/    Generated React Query client
  api-zod/             Generated request/response schemas
  db/                  Drizzle schema and database client
```

The application uses one shared portfolio record and a template catalog. Publishing changes the portfolio status and timestamp; it does not generate a separate site codebase. Public pages render from the portfolio record plus template configuration.

## Stack

- React, TypeScript, Vite, Wouter, Tailwind CSS
- Express 5 API server
- PostgreSQL with Drizzle ORM
- OpenAPI 3.1 + Orval-generated React Query and Zod helpers
- Replit-managed workflow routing

Authentication, object storage, AI provider calls, payments, custom domains, and privacy-safe analytics are designed as server-side service boundaries for the next product phases. No secrets are committed to the repository.

## Local development

Install dependencies with pnpm, then start the managed workflows:

```bash
pnpm install
pnpm --filter @workspace/api-server run dev
pnpm --filter @workspace/portfolio-builder run dev
```

The API is served through `/api`; the web app is served at `/`.

Useful checks:

```bash
pnpm run typecheck
pnpm --filter @workspace/portfolio-builder run typecheck
pnpm --filter @workspace/api-server run typecheck
PORT=20730 BASE_PATH=/ pnpm --filter @workspace/portfolio-builder run build
```

## Environment variables

See `.env.example`. The development database is supplied by the workspace. Secrets must be added through the workspace secrets manager, never committed to `.env` files.

## Database

The current schema stores portfolio content as a validated JSON document so templates can change without duplicating user data. Push development schema changes with:

```bash
pnpm --filter @workspace/db run push
```

Production schema changes should be applied through the platform publish flow.

## API contract

Update `lib/api-spec/openapi.yaml` first, then regenerate the typed clients:

```bash
pnpm --filter @workspace/api-spec run codegen
```

Do not hand-edit generated files under `lib/api-client-react/src/generated` or `lib/api-zod/src/generated`.

## Security notes

- Resume endpoint validates MIME type and enforces a 10 MB limit.
- Draft portfolios are not returned from the public slug endpoint.
- Public pages expose only published portfolio content.
- Slugs are generated and collision-safe.
- Server handlers validate request bodies, path parameters, and response payloads.
- Frontend checks are not used as the premium or publishing security boundary.
- Public browser code cannot be made impossible to inspect; secrets and business rules remain server-side.
