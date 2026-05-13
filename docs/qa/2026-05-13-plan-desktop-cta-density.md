# QA — Plan Desktop CTA Density

Date: 2026-05-13  
Branch: `codex/plan-desktop-cta-density`  
Scope: `/plan?tab=training` first action contract on desktop, with mobile regression coverage.

## Intent

The Plan page should still lead with one explicit action, but the desktop CTA should read like a command in the contract instead of a full-width banner. The mobile CTA remains full-width because the touch target and scan pattern are different.

## Red / Green

- Red: `npx playwright test frontend/e2e/pulse-usability.spec.ts --project=desktop-chromium -g "Plan desktop keeps the primary action CTA from dominating" --workers=1`
  - Expected failure before implementation: desktop CTA width `1052px`, limit `260px`.
- Green: same command after implementation.
  - Result: `1 passed`.

## Regression Checks

- `npx playwright test frontend/e2e/pulse-usability.spec.ts --project=desktop-chromium --project=mobile-chromium -g "Plan full today action does not duplicate|Plan mobile promotes the action contract above refresh chrome|Plan desktop avoids nesting|Plan desktop keeps the primary action CTA|Plan keeps one training decision surface|Plan evidence does not show an empty decision|Mobile routes avoid unintended horizontal overflow" --workers=1`
  - Result: `7 passed`, `3 skipped`.
- `PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-plan-cta-density-evidence-final npm run qa:ux-evidence`
  - Result: desktop and mobile route evidence passed.
- `node scripts/route-evidence-summary.mjs /tmp/pulse-plan-cta-density-evidence-final`
  - Result: desktop `9` screenshots, mobile `15` screenshots, `0` horizontal overflow.

## Evidence

- Evidence root: `/tmp/pulse-plan-cta-density-evidence-final`
- Desktop Plan screenshot: `<evidence-root>/<date>-<commit>/desktop-chromium/06-plan.png`
- Mobile Plan screenshot: `<evidence-root>/<date>-<commit>/mobile-chromium/06-plan.png`

## Notes

The change is presentation-only. It does not change plan generation, Garmin sync, scenario preview, workout opening or Today Options data flow.
