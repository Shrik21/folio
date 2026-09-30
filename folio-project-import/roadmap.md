# Folio build roadmap

Stack note: this project runs on TanStack Start (React 19, Vite, TypeScript strict) with
Lovable Cloud (Postgres + auth + storage) instead of Next.js/Prisma. Server logic uses
`createServerFn`; public HTTP endpoints use server routes.

## Done (iteration 1)

- Design system "Ink & Paper" in `src/styles.css` (oklch tokens, display/sans/mono fonts, paper
  textures, motion-reduction support).
- Public marketing site, server-rendered with unique title/description/canonical/H1:
  `/`, `/features`, `/templates`, `/examples`, `/pricing`, `/resume-to-portfolio`,
  `/portfolio-for-developers`, `/portfolio-for-designers`, `/portfolio-for-freelancers`,
  `/guides`, `/guides/[slug]`, `/privacy`, `/terms`.
- Interactive résumé → portfolio demonstration (Motion, reduced-motion aware).
- JSON-LD: Organization, WebSite, SoftwareApplication + Offers, FAQPage, Article, BreadcrumbList.
- robots.txt (search + answer-engine crawlers allowed, GPTBot training separate), `/sitemap.xml`.
- Auth: email/password + Google sign-in enabled; `/login`, `/signup`, `/dashboard` stub, all noindex.
- Mobile 390px verified with no horizontal overflow; lint clean.

## Next priorities

1. Data model: profiles, portfolios, portfolio_sections, resume_uploads, subscriptions,
   analytics_events — with RLS + GRANTs.
2. Résumé upload to private storage bucket + server-side PDF/DOCX text extraction.
3. AI structuring server function (Lovable AI), constrained to supplied text, with
   `needs_review` flags per field.
4. Onboarding flow: review editor → purpose/profession → template → appearance → preview → publish.
5. Public portfolio route `/p/[slug]` with ProfilePage/Person JSON-LD, 404 for unknown,
   410 for unpublished.
6. Stripe: Checkout, webhooks, entitlement checks server-side, billing portal, failed payments.
7. Analytics for published portfolios; custom domains (Pro).
8. IndexNow ping on publish/update/unpublish; dynamic sitemap including published portfolios.
9. Automated tests (vitest) for entitlements, extraction guards, publish state transitions.
10. Docs: setup, env vars, deployment, operational runbook.
