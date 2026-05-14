# Plan Scenario Editor Disclosure QA

## Problem

Live route evidence on `c19f143` showed that the mobile quick scenario preview had a clearer result block, but the complete scenario editor still appeared immediately underneath. The user decision after preview competed with mode buttons and form fields.

## Change

Quick-entry scenario previews (`today-options`, `mobile-intent`) now collapse the editor once a preview result exists. `Option ändern` opens the editor again and keeps the prefilled scenario values. Non-quick Plan scenario flows keep the existing always-visible editor.

## Verification

| Check | Result |
|---|---|
| Red test: `npx playwright test frontend/e2e/pulse-usability.spec.ts --grep "Home surfaces quick availability intents" --project=mobile-chromium` before implementation | Failed because `plan-scenario-edit-toggle` did not exist and the editor was still visible. |
| Green test: same command after implementation | Passed: 1/1. |
| Focused smoke: `npx playwright test frontend/e2e/pulse-smoke.spec.ts --grep "mobile Home availability intent opens a workout scenario preview" --project=mobile-chromium` | Passed: 1/1. |
| Focused smoke: `npx playwright test frontend/e2e/pulse-smoke.spec.ts --grep "mobile Home free-day intent opens reduce-volume preview" --project=mobile-chromium` | Passed: 1/1. |
| First full `npm run test:e2e:smoke` | Failed once: one real Free-Day issue because the meaningful review hint moved with the collapsed editor, plus three desktop route-ready timeouts that passed in isolation. |
| Free-Day fix: same focused free-day smoke | Passed: 1/1 after rendering meaningful review hints outside the collapsed editor. |
| Desktop timeout isolation: `npx playwright test frontend/e2e/pulse-smoke.spec.ts --grep "primary navigation exposes Focus routes\|top-level hotkeys\|app starts when service workers" --project=desktop-chromium` | Passed: 3/3. |
| `npm run build` | Passed. |
| `git diff --check` | Passed. |
| `npx playwright test frontend/e2e/pulse-usability.spec.ts --grep "scenario\|Szenario\|availability intents\|Vorschau" --project=desktop-chromium --project=mobile-chromium` | Passed: 10/10. |
| Final `npm run test:e2e:smoke` | Passed: 48 passed, 8 skipped. |
| `PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-plan-scenario-editor-disclosure npm run qa:ux-evidence` | Passed: 2/2. |
| `npm run qa:ux-summary -- /tmp/pulse-plan-scenario-editor-disclosure` | 2 manifests, 9 desktop screenshots, 15 mobile screenshots, 0 overflow. |

## Evidence

- Before screenshot: `/tmp/pulse-plan-mobile-scenario-copy-live/2026-05-13-c19f143/mobile-chromium/15-plan-mobile-intent-scenario.png`
- After screenshot root: `/tmp/pulse-plan-scenario-editor-disclosure` (`15-plan-mobile-intent-scenario.png` in the mobile-chromium commit folder).
