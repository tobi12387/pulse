# 2026-05-13 Desktop Plan Action Density

## Scope

- Branch: `codex/desktop-density-evidence-loop`
- Route: `/plan?tab=training`
- Viewport: desktop Chromium first viewport, mobile regression check
- Goal: Reduce desktop Plan nesting without changing Plan, Garmin, scenario or navigation behavior.

## Finding

Fresh route evidence on `7e8f0cf` showed no horizontal overflow, but the desktop Plan first viewport still rendered the same daily planning decision as a card inside a card: the outer `Heute trainieren` surface owned status and refresh, while the inner `Plan-Aktion` surface repeated the visual shell for the primary action.

Before evidence:

- `/tmp/pulse-desktop-density-evidence/2026-05-13-7e8f0cf/desktop-chromium/06-plan.png`
- `/tmp/pulse-desktop-density-evidence/2026-05-13-7e8f0cf/mobile-chromium/06-plan.png`

## What Changed

- The existing full Plan action state now removes the inner `Plan-Aktion` border/background/padding on all viewports.
- Desktop keeps the outer status row and refresh button.
- Mobile keeps the previously compact state where the secondary header is hidden.

## Verification

- `npx playwright test frontend/e2e/pulse-usability.spec.ts --project=desktop-chromium -g "Plan desktop avoids nesting" --workers=1`
  - RED before implementation: failed because `plan-primary-action` had `border-top-width: 1px`.
  - GREEN after implementation: passed.
- `npx playwright test frontend/e2e/pulse-usability.spec.ts --project=desktop-chromium --project=mobile-chromium -g "Plan full today action does not duplicate|Plan mobile promotes the action contract above refresh chrome|Plan desktop avoids nesting|Plan keeps one training decision surface|Plan evidence does not show an empty decision" --workers=1`
  - Passed: 5 passed, 1 desktop-only skip in mobile project.
- `PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-desktop-density-evidence-after npm run qa:ux-evidence`
  - Passed: desktop and mobile route packs captured.
- `npm run qa:ux-summary -- /tmp/pulse-desktop-density-evidence-after`
  - Passed: 9 desktop screenshots, 15 mobile screenshots, 0 overflow.
- `npm run build -w frontend`
  - Passed.
- `npm run test:e2e:smoke`
  - Passed: 48 passed, 8 skipped.

## Evidence Artifacts

- `/tmp/pulse-desktop-density-evidence-after/2026-05-13-7e8f0cf/desktop-chromium/06-plan.png`
- `/tmp/pulse-desktop-density-evidence-after/2026-05-13-7e8f0cf/mobile-chromium/06-plan.png`

Artifacts remain outside the repo and are not committed.
