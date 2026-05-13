# 2026-05-13 Plan Mobile Action Density

## Scope

- Branch: `codex/plan-density-evidence-loop`
- Route: `/plan?tab=training`
- Viewport: mobile Chromium first viewport, desktop regression check
- Goal: Make the first Plan action feel less nested on mobile without changing Plan, Garmin or scenario behavior.

## Finding

Fresh route evidence on `deca22d` showed no horizontal overflow, but the mobile Plan first viewport still stacked PageHeader, tab strip, `Heute trainieren`, refresh button and the nested `Plan-Aktion` contract before the week context. The refresh chrome was useful but secondary; it competed visually with the primary daily Plan action.

Before evidence:

- `/tmp/pulse-plan-density-evidence/2026-05-13-deca22d/mobile-chromium/06-plan.png`
- `/tmp/pulse-plan-density-evidence/2026-05-13-deca22d/desktop-chromium/06-plan.png`

## What Changed

- `TodayOptionsCard` marks the full Plan action state with a dedicated class when the action contract is visible.
- On mobile only, that state hides the secondary header/refresh row and removes the inner action-card border/background.
- Desktop keeps the existing `Heute trainieren` header and refresh button.

## Verification

- `npx playwright test frontend/e2e/pulse-usability.spec.ts --project=mobile-chromium -g "Plan mobile promotes the action contract above refresh chrome" --workers=1`
  - RED before implementation: failed because `Tagesoptionen aktualisieren` was visible.
  - GREEN after implementation: passed.
- `npx playwright test frontend/e2e/pulse-usability.spec.ts --project=desktop-chromium --project=mobile-chromium -g "Plan full today action does not duplicate|Plan mobile promotes the action contract above refresh chrome|Plan keeps one training decision surface|Plan evidence does not show an empty decision" --workers=1`
  - Passed: 4 passed.
- `PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-plan-density-evidence-after npm run qa:ux-evidence`
  - Passed: desktop and mobile route packs captured.
- `npm run qa:ux-summary -- /tmp/pulse-plan-density-evidence-after`
  - Passed: 9 desktop screenshots, 15 mobile screenshots, 0 overflow.
- `npm run build -w frontend`
  - Passed.
- `npm run test:e2e:smoke`
  - Passed: 48 passed, 8 skipped.

## Evidence Artifacts

- `/tmp/pulse-plan-density-evidence-after/2026-05-13-deca22d/mobile-chromium/06-plan.png`
- `/tmp/pulse-plan-density-evidence-after/2026-05-13-deca22d/desktop-chromium/06-plan.png`

Artifacts remain outside the repo and are not committed.
