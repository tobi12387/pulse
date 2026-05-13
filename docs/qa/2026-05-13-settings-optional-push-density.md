# 2026-05-13 Settings Optional Push Density

## Scope

- Branch: `codex/settings-optional-push-density`
- Route: `/settings`
- Viewports: desktop Chromium and mobile Chromium
- Goal: Keep blocked or inactive Push visible as an optional device action without making the Settings first viewport feel like a problem state.

## Finding

Fresh live route evidence after the Home task-contract slice showed `/settings` was technically ready and had no overflow, but the optional Push warning still consumed too much attention inside the first mobile Settings status area. That contradicted the existing product decision that Push should not block core readiness.

Before evidence:

- `/tmp/pulse-home-task-contract-live/2026-05-13-dfd0022/mobile-chromium/09-settings.png`

## What Changed

- Optional Push setup rows now render as one compact `settings-optional-summary-row`.
- The row keeps the current Push state pill and `Push öffnen` action.
- Full technical diagnostics stay behind `Diagnose anzeigen` and the existing Push section.
- True readiness blockers keep the previous action-card treatment.

## Verification

- `npx playwright test frontend/e2e/pulse-usability.spec.ts --project=mobile-chromium -g "Settings treats blocked push as optional" --workers=1`
  - RED before implementation: failed because no compact optional summary row existed.
  - GREEN after implementation: passed.
- `npx playwright test frontend/e2e/pulse-usability.spec.ts frontend/e2e/ux-auth-settings.spec.ts --project=desktop-chromium --project=mobile-chromium -g "Settings starts|Settings treats blocked push|Settings diagnostics matrix separates|Settings separates push|Settings keeps Garmin diagnostics" --workers=1`
  - Passed: 8 passed.
- `PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-settings-push-density-evidence npm run qa:ux-evidence`
  - Passed: desktop and mobile route packs captured.
- `npm run qa:ux-summary -- /tmp/pulse-settings-push-density-evidence`
  - Passed: 9 desktop screenshots, 15 mobile screenshots, 0 overflow.
- `npm run build -w frontend`
  - Passed.
- `npm run test:e2e:smoke`
  - Passed: 48 passed, 8 skipped.
- `git diff --check`
  - Passed.

## Evidence Artifacts

- `/tmp/pulse-settings-push-density-evidence/2026-05-13-dfd0022/desktop-chromium/09-settings.png`
- `/tmp/pulse-settings-push-density-evidence/2026-05-13-dfd0022/mobile-chromium/09-settings.png`

Artifacts remain outside the repo and are not committed.
