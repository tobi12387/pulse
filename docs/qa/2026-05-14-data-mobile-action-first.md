# Data Mobile Action First QA

## Problem

Live mobile route evidence on `ebf4060` showed `/data` with the daily `Daten-Aktion`, but the actual `Check-in öffnen` action followed the full `Warum jetzt` and `Nach dem Klick` explanatory copy. The page still felt like reading before acting.

## Change

On mobile, Data now shows title, evidence chips and the primary action first. The full explanatory contract stays available behind `Warum diese Aufgabe?`. Desktop keeps the visible two-part contract.

## Verification

| Check | Result |
|---|---|
| Red test: `npx playwright test frontend/e2e/pulse-usability.spec.ts --grep "Data mobile keeps the missing-check-in action" --project=mobile-chromium` before implementation | Failed because `Warum diese Aufgabe?` did not exist. |
| Green test: same command after implementation | Passed: 1/1. |
| Focused regression: `npx playwright test frontend/e2e/pulse-usability.spec.ts --grep "Data starts with one daily action\|Data mobile keeps the missing-check-in action\|Mobile navigation and tabs\|Mobile repeated controls" --project=desktop-chromium --project=mobile-chromium` | Passed: 5 passed, 3 skipped. |
| Build: `npm run build` | Passed. |
| Diff whitespace: `git diff --check` | Passed. |
| Route evidence: `PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-data-mobile-action-first-final npm run qa:ux-evidence` | Passed: 2/2. |
| Route summary: `npm run qa:ux-summary -- /tmp/pulse-data-mobile-action-first-final` | Passed: 2 manifests, 24 screenshots, 0 horizontal overflow. |
| Visual inspection | Mobile `/data` now shows evidence chips and `Check-in öffnen` before the optional `Warum diese Aufgabe?` disclosure. |

## Evidence

- Pre-change live evidence root: `/tmp/pulse-data-mental-suggestion-disclosure-live`
- Final route evidence root: `/tmp/pulse-data-mobile-action-first-final`
