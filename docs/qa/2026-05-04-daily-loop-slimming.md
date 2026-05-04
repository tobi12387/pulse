# Daily Loop Slimming QA

## Scope

Approach A reduces repeated daily-loop bulk by keeping the full daily decision on Home and using slim daily-decision support cards on Coach and Plan.

## Baseline Evidence

- Command: `npm run qa:ux-evidence`
- Result: passed after rerun outside the sandbox because Vite could not bind to `127.0.0.1:5173` in the sandbox.
- Path: `test-results/route-evidence/2026-05-04-3d42067/`
- Viewports:
  - Desktop Chromium: `1280x720`
  - Mobile Chromium: `412x839`
- Manifest result: no horizontal overflow on `/`, `/coach`, `/data`, `/plan`, `/insights`, or `/settings`.
- Finding: Home, Coach, and Plan were layout-stable, but Coach repeated the full daily-decision detail grid that Home already owned.

## After Evidence

- Command: `env PULSE_ROUTE_EVIDENCE_DIR=test-results/route-evidence/after-daily-loop-slimming npm run qa:ux-evidence`
- Result: passed after rerun outside the sandbox because Vite could not bind to `127.0.0.1:5173` in the sandbox.
- Path: `test-results/route-evidence/after-daily-loop-slimming/2026-05-04-3d42067/`
- Viewports:
  - Desktop Chromium: `1280x720`
  - Mobile Chromium: `412x839`
- Manifest result: no horizontal overflow on `/`, `/coach`, `/data`, `/plan`, `/insights`, or `/settings`.
- Finding: Coach now shows the briefing and a compact Tagesentscheidung support card with the conversation action. The repeated `Grenze`, `Alternative`, and `Abschluss` tiles remain on Home and are absent on Coach and Plan.

## Verification

- `npm run build -w frontend`: passed.
- `npm run test:e2e -- --project=mobile-chromium --grep "Daily loop slimming"`:
  - RED before implementation: failed because Coach still exposed `Grenze`.
  - GREEN after implementation: passed.
- `npm run test:e2e -- --project=mobile-chromium --grep "Daily loop slimming|Home daily action|Home closes|Coach|Plan"`: passed, `26 passed`.
- `npm run test:e2e`: passed, `109 passed`, `7 skipped`.

## Route Notes

- `/`: remains the full daily decision source with boundary, alternative, completion, evidence, and CTA.
- `/coach`: keeps daily briefing, guided prompt context, quick prompts, and sticky input while removing the repeated full decision detail grid.
- `/plan`: continues to prioritize the next training decision and compact daily support before deeper planning tools.
- `/data`, `/insights`, `/settings`: covered by route evidence for overflow regressions; not changed in this PR.
