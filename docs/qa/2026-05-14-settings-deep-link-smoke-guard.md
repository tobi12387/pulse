# Settings Deep Link Smoke Guard QA

## Scope

Add one PR-smoke regression check for the Settings section deep-link behavior that previously failed only after merge in the main full browser suite.

## Change

`frontend/e2e/pulse-smoke.spec.ts` now opens `/settings?section=push`, waits for Settings to render, and asserts that the `Benachrichtigungen` heading lands near the first viewport (`y < 260`).

## Verification

- `npx playwright test frontend/e2e/pulse-smoke.spec.ts --grep "Settings section deep links" --project=desktop-chromium --project=mobile-chromium`
  - Result: 2 passed.
- `npm run test:e2e:smoke`
  - Result: 50 passed, 8 skipped.
- `git diff --check`
  - Result: passed.

## Rationale

This keeps PR feedback small and targeted. It does not enable the full browser suite on every PR, but it catches the exact async-layout/deep-link class that made `main` red after the Settings desktop layout slice.
