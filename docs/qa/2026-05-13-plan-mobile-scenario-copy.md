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

The review hint below a quick scenario preview is now hidden only when it is also a no-write/preview reminder. Real intent copy, such as the free-day reduce-volume hint `Heute bewusst frei halten.`, remains visible.

## Verification

| Check | Result |
|---|---|
| Red test: `npx playwright test frontend/e2e/pulse-usability.spec.ts --grep "Home surfaces quick availability intents" --project=mobile-chromium` before implementation | Failed because the preview result still contained `Mobile Vorschau simuliert`, `Mobile Vorschau: erst Wochenlast` and `Plan oder Garmin werden erst nach Apply verändert.` |
| Red follow-up: same command after first implementation | Failed because the card still contained `Mobile Quick Decision vorbereitet` in the review hint below the result. |
| Green test: same command after hiding redundant quick-entry review hint once preview exists | Passed: 1/1. |
| CI regression from `npm run test:e2e:smoke` on PR #354 before the follow-up fix | Failed in the mobile free-day reduce-volume flow because `Heute bewusst frei halten.` was hidden together with the redundant no-write hint. |
| Focused CI regression check: `npx playwright test frontend/e2e/pulse-smoke.spec.ts --grep "mobile Home free-day intent opens reduce-volume preview" --project=mobile-chromium` | Passed: 1/1 after narrowing the hidden review hint to no-write/preview copy. |
| `npm run test:e2e:smoke` after the follow-up fix | Passed: 48 passed, 8 skipped. |
| `npx playwright test frontend/e2e/pulse-usability.spec.ts --grep "scenario\|Szenario\|availability intents\|Vorschau" --project=desktop-chromium --project=mobile-chromium` | Passed: 10/10 when run isolated. A previous parallel run with another Playwright/build process failed via Vite port refusal/timeouts, not product assertions. |
| `npx playwright test frontend/e2e/plan-no-garmin-write.spec.ts --project=desktop-chromium` | Passed: 2/2. |
| `npm run build` | Passed. |
| `git diff --check` | Passed. |
| `PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-plan-mobile-scenario-copy-followup npm run qa:ux-evidence` | Passed: 2/2. |
| `npm run qa:ux-summary -- /tmp/pulse-plan-mobile-scenario-copy-followup` | 2 manifests, 9 desktop screenshots, 15 mobile screenshots, 0 overflow. |

## Evidence

- Before screenshot: `/tmp/pulse-insights-duplicate-focus-merge-live/2026-05-13-02528e7/mobile-chromium/15-plan-mobile-intent-scenario.png`
- After screenshot root: `/tmp/pulse-plan-mobile-scenario-copy-followup` (`15-plan-mobile-intent-scenario.png` in the mobile-chromium commit folder).
