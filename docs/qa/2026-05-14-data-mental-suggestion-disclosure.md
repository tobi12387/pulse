# Data Mental Suggestion Disclosure QA

## Problem

Live mobile evidence showed that the Mental Check-in still rendered `Pulse Vorschlag` with Garmin/readiness factors directly below `Heute speichern`. The evidence is useful, but it competed with the quick state choice in the first viewport.

## Change

`Pulse Vorschlag` now opens behind `Warum dieser Vorschlag?`. The existing deterministic suggestion still preselects the quick state, and the evidence panel remains reachable with `aria-expanded` / `aria-controls`.

## Verification

| Check | Result |
|---|---|
| Red test: `npx playwright test frontend/e2e/pulse-usability.spec.ts --grep "Data mental check-in uses quick choices" --project=mobile-chromium` before implementation | Failed because `Warum dieser Vorschlag?` did not exist. |
| Green test: same command after implementation | Passed: 1/1. |
| Build: `npm run build` | Passed. |
| Diff whitespace: `git diff --check` | Passed. |
| Focused regression: `npx playwright test frontend/e2e/pulse-usability.spec.ts --grep "Data mental\|Mental Check-in\|touch targets" --project=desktop-chromium --project=mobile-chromium` | Passed: 17 passed, 1 skipped. |
| Route evidence: `PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-data-mental-suggestion-disclosure-final npm run qa:ux-evidence` | Passed: 2/2. |
| Route summary: `npm run qa:ux-summary -- /tmp/pulse-data-mental-suggestion-disclosure-final` | Passed: 2 manifests, 24 screenshots, 0 horizontal overflow. |
| Visual inspection | Mobile first viewport shows quick state choices and `Heute speichern` before optional detail controls; `Pulse Vorschlag` is no longer expanded by default. |

## Evidence

- Before screenshot: `/tmp/pulse-plan-scenario-editor-disclosure-live/2026-05-14-5732d54/mobile-chromium/14-data-mental-first-viewport.png`
- Final route evidence root: `/tmp/pulse-data-mental-suggestion-disclosure-final`
