# QA — Plan Review Analysis Disclosure

Date: 2026-05-13
Branch: `codex/plan-review-analysis-disclosure`

## Scope

- Keep `/plan?tab=review` focused on the weekly decision and the next Plan action.
- Move the long weekly review narrative behind `Analyse anzeigen`.
- Preserve the `Review lesen` primary action behavior by opening and focusing the narrative when that is the weekly action.

## Red / Green

- Red: `Plan Review keeps the long weekly narrative behind disclosure` failed because `weekly-review-narrative` rendered immediately.
- Green: after adding the disclosure, the narrative is absent by default and appears after `Analyse anzeigen`.

## Verification

- `npx playwright test frontend/e2e/pulse-usability.spec.ts --project=desktop-chromium -g "Plan Review keeps the long weekly narrative" --workers=1`
- `npx playwright test frontend/e2e/pulse-usability.spec.ts --project=desktop-chromium --project=mobile-chromium -g "Plan Review surfaces|Plan Review keeps|Mobile routes avoid unintended horizontal overflow|Plan desktop|Plan mobile" --workers=1`
- `npm run build`
- `git diff --check`
- `PULSE_ROUTE_EVIDENCE=true PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-plan-review-analysis-disclosure-mobile-rerun npx playwright test frontend/e2e/route-evidence.spec.ts --project=mobile-chromium --workers=1`
- `PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-plan-review-analysis-disclosure-final npm run qa:ux-evidence && npm run qa:ux-summary -- /tmp/pulse-plan-review-analysis-disclosure-final`

## Evidence

- Local route evidence: `/tmp/pulse-plan-review-analysis-disclosure-final/`
- Desktop screenshots: 9
- Mobile screenshots: 15
- Horizontal overflow: 0
- Note: the first full route-evidence run had one mobile loading flake on the Plan scenario route. The isolated mobile rerun and the full rerun both passed.
