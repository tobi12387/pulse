# 2026-05-12 Full E2E Focus Contract Repair

## Scope

- Branch: `codex/repair-full-e2e-after-focus`
- Surface: Browser full E2E after Focus/Home/Data/Plan/Settings compression
- Goal: Repair stale or over-broad test contracts that made `main` browser CI fail after the Focus UI changes.

## Root Cause

GitHub `main` browser full tests failed after PR #327, but the failures were not caused by the Plan copy-density change. The failing tests used global text locators or old route expectations that no longer matched the Focus UI:

- Home now intentionally repeats some text between the main decision and diary.
- Home can show more than one `Feedback erfassen` button, so click targets need card scope.
- Data hides secondary area actions behind `Weitere Datenbereiche anzeigen`.
- Plan Garmin debt is now surfaced through `Plan-Änderungen`/`Garmin absichern` before the old fallback card.
- Focus navigation has five primary items including Insights.
- Mobile Plan rows can contain hidden system text elsewhere, so status labels must be scoped to workout rows.

## What Changed

- Scoped Home feedback, Mental Check-in, no-training and readiness assertions to their owning card/heading.
- Updated the tablet navigation count to the current five Focus routes.
- Updated Data default-route expectations to verify the primary action plus progressive secondary areas.
- Updated Plan Garmin debt assertions to use the Plan Change Inbox contract.
- Scoped Plan execution/status labels to workout row buttons instead of global text.
- Scoped Settings profile provenance assertions to the Athletenprofil card.

## Verification

- `npx playwright test frontend/e2e/pulse-usability.spec.ts frontend/e2e/ux-data-mental.spec.ts --project=desktop-chromium --project=mobile-chromium -g "Home treats completed planned training|Home routes to activity feedback|Home treats a completed off-plan|Home completes a compact mental|Settings show profile value provenance|Daily loop keeps context|Tablet navigation|Home stays usable when the readiness|Plan shows Garmin execution states|Plan summarizes Garmin sync debt|Plan explains Garmin workout sync confidence|/data opens a user-facing overview" --workers=1`
  - RED before repair: 20 failed locally across desktop/mobile.
  - GREEN after repair: 24 passed.
- `npm run test:e2e:full`
  - Passed: 332 passed, 20 skipped.
- `npm run build -w frontend`
  - Passed.

## Notes

This is a test-contract repair only. No product runtime code was changed.
