# 2026-05-12 Plan Mobile Copy Density

## Scope

- Branch: `codex/mobile-plan-tab-density`
- Route: `/plan?tab=training`
- Viewport: mobile Chromium first viewport
- Goal: Remove duplicated planned-day explanation from the full Today Options plan action without changing Plan, Garmin or scenario behavior.

## Finding

Fresh route evidence after the UI/Ops prep showed the Plan mobile first viewport still had unnecessary copy density. The full Today Options block rendered the same planned-day summary once in the card header and again as `Warum jetzt` inside the `Plan-Aktion` contract.

Before evidence:

- `/tmp/pulse-ui-ops-prep-live-after/2026-05-12-0575477/mobile-chromium/06-plan.png`

## What Changed

- `TodayOptionsCard` now treats the visible Plan action contract as the owner of the planned-day summary.
- When `showPlanActionContract` is active and a primary option exists, the card header keeps only the state label and refresh button.
- The `Warum jetzt` line remains visible inside `plan-primary-action`, so the user still sees the reason exactly once next to the actual action.

## Verification

- `npx playwright test frontend/e2e/pulse-usability.spec.ts --project=mobile-chromium -g "Plan full today action does not duplicate" --workers=1`
  - RED before implementation: failed with `Expected: 1`, `Received: 2`.
  - GREEN after implementation: passed.
- `npx playwright test frontend/e2e/pulse-usability.spec.ts --project=desktop-chromium --project=mobile-chromium -g "Plan full today action does not duplicate|Mobile navigation and tabs keep core labels readable|Home planned-day change option opens" --workers=1`
  - Passed: 5 passed, 1 desktop mobile-only skip.
- `npm run build -w frontend`
  - Passed.
- `PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-plan-mobile-copy-density npm run qa:ux-evidence`
  - Passed: desktop and mobile route packs captured.
- `npm run qa:ux-summary -- /tmp/pulse-plan-mobile-copy-density`
  - Passed: 9 desktop screenshots, 15 mobile screenshots, 0 overflow.

## Evidence Artifacts

- `/tmp/pulse-plan-mobile-copy-density/2026-05-12-0575477/mobile-chromium/06-plan.png`
- `/tmp/pulse-plan-mobile-copy-density/2026-05-12-0575477/desktop-chromium/06-plan.png`

Artifacts remain outside the repo and are not committed.
