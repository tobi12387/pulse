# Plan Empty Actions QA

## Scope

This slice makes the empty next-training decision on `/plan` actionable. When no open workout exists, the top card now offers direct actions for availability, plan generation, and Coach context.

## Evidence

- Command: `env PULSE_ROUTE_EVIDENCE_DIR=test-results/route-evidence/plan-empty-actions npm run qa:ux-evidence`
- Result: passed after rerun outside the sandbox because Vite could not bind to `127.0.0.1:5173` in the sandbox.
- Path: `test-results/route-evidence/plan-empty-actions/2026-05-04-6802079/`
- Viewports:
  - Desktop Chromium: `1280x720`
  - Mobile Chromium: `412x839`
- Manifest result: no horizontal overflow on `/`, `/coach`, `/data`, `/plan`, `/insights`, or `/settings`.

## Verification

- `npm run build -w frontend`: passed.
- `npm run test:e2e -- --project=mobile-chromium --grep "Plan empty training decision"`:
  - RED before implementation: failed because `Verfügbarkeit prüfen` was missing.
  - GREEN after implementation: passed.
- `npm run test:e2e -- --project=mobile-chromium --grep "Plan empty training decision|Plan prioritizes|Plan generation failure|Plan alternative|Plan shows|Plan preserves|Plan trace"`: passed, `11 passed`.
- `npm run test:e2e`: passed, `111 passed`, `7 skipped`.

## Route Notes

- `/plan`: empty next-training decision now opens availability, opens the plan generator, or routes to Coach directly.
- `/plan`: existing availability editor remains available in its original location and is controlled by the same open state.
- `/plan`: existing plan generator toggle still works; the new top action opens the same generator panel.
- Other routes were screenshot-checked for horizontal overflow only and were not changed.
