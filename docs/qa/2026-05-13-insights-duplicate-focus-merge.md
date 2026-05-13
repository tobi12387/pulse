# Insights Duplicate Focus Merge QA

## Problem

Fresh route evidence on `f46d71d` showed `/insights` repeating the same user job in two adjacent first-viewport blocks:

- `Aktueller Fokus`: `Fueling-Praxis absichern`
- `Nächste sinnvolle Prüfung`: `Fueling-Praxis absichern`

This made one synthesis feel like two competing tasks.

## Change

When the primary next-check title matches the hero focus title, Insights now keeps the hero as the owner of that action and replaces the duplicate intervention row with a compact note:

`Die wichtigste Prüfung steckt bereits im aktuellen Fokus.`

Secondary checks (`Datenqualität`, `Capability`) remain available after `Weitere Prüfungen anzeigen`.

## Verification

| Check | Result |
|---|---|
| Red test: `npx playwright test frontend/e2e/pulse-usability.spec.ts --grep "Insights does not repeat the current focus" --project=mobile-chromium` before implementation | Failed because the next-check card still repeated `Fueling-Praxis absichern`. |
| Green test: same command after implementation | Passed: 1/1. |
| `npx playwright test frontend/e2e/pulse-usability.spec.ts --grep "Insights" --project=desktop-chromium --project=mobile-chromium` | Passed: 6/6. |
| `npm run build` | Passed. |
| `git diff --check` | Passed. |
| `PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-insights-duplicate-focus-merge-final npm run qa:ux-evidence` | Passed: 2/2. |
| `npm run qa:ux-summary -- /tmp/pulse-insights-duplicate-focus-merge-final` | 2 manifests, 9 desktop screenshots, 15 mobile screenshots, 0 overflow. |

## Evidence

- Before screenshot: `/tmp/pulse-next-ui-intake/2026-05-13-f46d71d/mobile-chromium/08-insights.png`
- After screenshot: `/tmp/pulse-insights-duplicate-focus-merge-final/2026-05-13-f46d71d/mobile-chromium/08-insights.png`
