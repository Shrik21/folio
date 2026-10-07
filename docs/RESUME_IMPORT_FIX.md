# Resume import fix — October 7, 2026

## Cause

The local Gemini key authenticated successfully, but the old default model,
`gemini-2.5-flash`, returned HTTP 404 stating it was no longer available to this
account. The previous local fallback only extracted contacts and explicitly
returned empty experience, education, skills, and project arrays.

## Changes

- Default to `gemini-3.1-flash-lite`, verified with a real Gemini extraction.
- Use low reasoning effort and a 60-second request deadline.
- Retry transient HTTP 429/500/502/503/504 responses up to three attempts
  within the same deadline; permanent errors are not retried.
- Request all resume sections, distinguish document text from instructions,
  and prohibit invented facts or placeholder entries.
- Accept missing generated IDs and fenced JSON responses.
- Preserve recognizable source sections during fallback, flagging them as
  incomplete rather than pretending that a full AI import succeeded.
- Keep provider error logs free of resume contents and credentials.
- Replace the placeholder resume test with regression coverage.
- Add a fictional-PDF smoke test that checks AI extraction through the actual
  multipart upload endpoint without writing portfolio records.

## Local verification

- API TypeScript check: passed.
- API build: passed.
- Parser regressions: 3 passed.
- Real Gemini sample: 1 job, 1 education entry, 1 project, 3 skills.

## Deployment

A separate free Hobby workspace named **Folio** was created at the user's
request. Workspace ID: `tea-db37skegekts73air020`.

- API: https://folio-ai-api.onrender.com
- Render service: `srv-db37uccs728c73bl11ag`, Singapore, free plan.
- Source branch: `fix/resume-import-2026-10-07` in `Shrik21/folio`.
- Initial deploy `dep-db37ud4s728c73bl13o0`: confirmed live.
- Gemini key supplied from the ignored local `.env`, never from client code.
- Vercel project-level routing rule **Folio Gemini resume import** matches
  only `/api/resume/parse` and proxies it to the new API. Rule ID:
  `80c8172b-f105-4bdd-b5a0-cd504cb501ec`. Confirmed published, not staged.
- The existing frontend deployment and all other API routes remain unchanged.
  No database records were migrated or overwritten. The old Workflow-orch
  service is retained unchanged.

The parser still requires a signed user session and the correct request origin.
The initial unauthenticated HTTP smoke test returned 403, as expected without
an Origin header. Browser verification requires the Chrome extension's file
access permission. Full PDF parsing and live Gemini extraction are tested
separately while that browser permission is pending.

To roll back the routing change, disable **Folio Gemini resume import** and
publish the staged route change with the Vercel CLI. This returns uploads to
the old backend without touching portfolio data.

No API key is included in source, this report, or the browser bundle.
