# Plan Season Contract Disclosure QA

## Scope

- Route: `/plan?tab=training`.
- Change: the Adaptive Season Contract keeps the season decision headline visible and moves guardrails, next intervention and evidence chips behind `Saisonvertrag anzeigen`.
- Non-goal: no season strategy, goal projection, plan generation, Garmin write or mutation behavior changed.

## Verification

| Check | Result |
|---|---|
| `npx playwright test frontend/e2e/pulse-usability.spec.ts --grep "Plan shows adaptive season contract from season and goal projection evidence" --project=mobile-chromium` | Pass after red/green; initial red failed because `Fueling-Praxis absichern` rendered before opening the disclosure. |
| `npx playwright test frontend/e2e/pulse-usability.spec.ts --grep "Plan\|season contract\|season strategy" --project=desktop-chromium --project=mobile-chromium` | Pass: 116 passed, 2 skipped. |
| `npm run build` | Pass. |
| First `PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-plan-season-contract-disclosure-final npm run qa:ux-evidence` | Failed on `/insights` navigation after the broad Playwright run; isolated rerun below reproduced no product failure. |
| `PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-plan-season-contract-disclosure-final-rerun npm run qa:ux-evidence` | Pass: 2 route-evidence projects. |
| `npm run qa:ux-summary -- /tmp/pulse-plan-season-contract-disclosure-final-rerun` | Pass: 2 manifests, 9 desktop screenshots, 15 mobile screenshots, 0 horizontal overflow. |
| `git diff --check` | Pass. |

## Evidence

- Desktop manifest: `/tmp/pulse-plan-season-contract-disclosure-final-rerun/2026-05-13-f425ca5/desktop-chromium/manifest.json`
- Mobile manifest: `/tmp/pulse-plan-season-contract-disclosure-final-rerun/2026-05-13-f425ca5/mobile-chromium/manifest.json`
- Mobile Plan screenshot: `/tmp/pulse-plan-season-contract-disclosure-final-rerun/2026-05-13-f425ca5/mobile-chromium/06-plan.png`

## Flake Note

The first route-evidence attempt timed out while navigating to `/insights`, not while rendering the changed Plan route. A clean rerun of the same command passed in 10.1s with 0 overflow, matching the previously documented transient Playwright/Vite collision pattern.
