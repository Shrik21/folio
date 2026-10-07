# Resume import fix — October 7, 2026

## Cause

The local Gemini key authenticated successfully, but the old default model,
`gemini-2.5-flash`, returned HTTP 404 stating it was no longer available to this
account. The previous local fallback only extracted contacts and explicitly
returned empty experience, education, skills, and project arrays.

## Changes

- Default to `gemini-3.1-flash-lite`, verified with a real Gemini extraction.
- Use low reasoning effort and a 60-second request deadline.
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
request. Deployment verification and the production endpoint will be recorded
here after they are confirmed. The old Workflow-orch service is retained.

No API key is included in source, this report, or the browser bundle.
