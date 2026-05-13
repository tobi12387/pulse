# Plan Mobile Scenario Copy QA

## Problem

Live route evidence on `02528e7` showed the mobile scenario preview repeating the same no-write safety message in several adjacent places:

- header: `Preview-only` / preview writes nothing;
- mobile entry context;
- preview summary;
- preview reasons.

The safety contract is important, but the repeated copy made the result block feel heavier than the actual decision.

## Change

For quick scenario entries (`today-options`, `mobile-intent`), Pulse now filters preview summaries and reasons that only restate the no-write reminder. The scenario context, `Nach Apply`, `Sicherste Entscheidung`, Garmin impact and apply/cancel buttons remain visible.

## Verification

| Check | Result |
|---|---|
| Red test: `npx playwright test frontend/e2e/pulse-usability.spec.ts --grep "Home surfaces quick availability intents" --project=mobile-chromium` before implementation | Failed because the preview result still contained `Mobile Vorschau simuliert`, `Mobile Vorschau: erst Wochenlast` and `Plan oder Garmin werden erst nach Apply verändert.` |
| Red follow-up: same command after first implementation | Failed because the card still contained `Mobile Quick Decision vorbereitet` in the review hint below the result. |
| Green test: same command after hiding redundant quick-entry review hint once preview exists | Passed: 1/1. |
| `npx playwright test frontend/e2e/pulse-usability.spec.ts --grep "scenario\|Szenario\|availability intents\|Vorschau" --project=desktop-chromium --project=mobile-chromium` | Passed: 10/10 when run isolated. A previous parallel run with another Playwright/build process failed via Vite port refusal/timeouts, not product assertions. |
| `npx playwright test frontend/e2e/plan-no-garmin-write.spec.ts --project=desktop-chromium` | Passed: 2/2. |
| `npm run build` | Passed. |
| `git diff --check` | Passed. |
| `PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-plan-mobile-scenario-copy-final npm run qa:ux-evidence` | Passed: 2/2. |
| `npm run qa:ux-summary -- /tmp/pulse-plan-mobile-scenario-copy-final` | 2 manifests, 9 desktop screenshots, 15 mobile screenshots, 0 overflow. |

## Evidence

- Before screenshot: `/tmp/pulse-insights-duplicate-focus-merge-live/2026-05-13-02528e7/mobile-chromium/15-plan-mobile-intent-scenario.png`
- After screenshot: `/tmp/pulse-plan-mobile-scenario-copy-final/2026-05-13-02528e7/mobile-chromium/15-plan-mobile-intent-scenario.png`
