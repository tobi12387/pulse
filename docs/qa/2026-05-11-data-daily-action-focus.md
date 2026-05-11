# 2026-05-11 Data Daily Action Focus

## Scope

- Branch: `codex/data-daily-action-focus`
- Route: `/data`
- Goal: Reduce the default Data first viewport from several equal entry surfaces to one clear daily data action with optional deeper areas.

## What Changed

- `/data` now starts with `Daten-Aktion`, including:
  - one selected action derived from existing Check-in, Garmin and Home evidence;
  - `Warum jetzt`;
  - `Nach dem Klick`;
  - compact Readiness, TSB, Mental and Garmin evidence.
- The previous triage buttons, secondary area cards and decision-evidence shortcuts still exist, but open only after `Weitere Datenbereiche anzeigen`.
- Deep links and route contracts stay unchanged: old query aliases and hash anchors still open the correct Data section, and Plan-/Load triage still routes to Plan scenario preview.

## Verification

- `npx playwright test frontend/e2e/pulse-usability.spec.ts --project=desktop-chromium -g "Data starts with one daily action"`
  - RED before implementation: failed because `data-primary-action` did not exist.
  - GREEN after implementation: passed.
- `npx playwright test frontend/e2e/pulse-usability.spec.ts --project=desktop-chromium --project=mobile-chromium -g "Data starts with one daily action|Data overview exposes provenance shortcuts|Data Plan Load triage|Mobile repeated controls"`
  - Passed: 7 passed, 1 desktop mobile-only skip.
- `npm run lint -w frontend`
  - Passed.
- `npm run build -w frontend`
  - Passed.
- `PULSE_ROUTE_EVIDENCE_DIR=test-results/route-evidence/data-daily-action-focus-after npm run qa:ux-evidence`
  - Passed: desktop and mobile route packs captured.
  - `/data` reports no document-level horizontal overflow on desktop or mobile.

## Evidence Artifacts

- `test-results/route-evidence/data-daily-action-focus-after/2026-05-11-0fb1b84/desktop-chromium/03-data.png`
- `test-results/route-evidence/data-daily-action-focus-after/2026-05-11-0fb1b84/mobile-chromium/03-data.png`

Artifacts remain under `test-results/` and are not committed.
