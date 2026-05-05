# Mental Check-in Simplification QA

Date: 2026-05-04

## Scope

PR 1 through PR 3 of `docs/superpowers/plans/completed/2026-05-04-mental-checkin-simplification.md`, plus the Coach-context follow-up:

- Data > Mental uses a Quick Check-in instead of mandatory 1-10 scoring.
- Quick choices map back to the existing numeric `POST /api/pulse/checkin` payload.
- Garmin/recovery signals from the existing home context are shown as a client-side suggestion.
- Exact 1-10 correction remains available behind `Feinjustieren`.
- Free text can be evaluated through a preview endpoint before explicit save.
- Extracted mood, energy, stress, motivation, themes and follow-up questions are inspectable before saving through the existing numeric check-in contract.
- Home can complete the daily mental check-in with three compact presets without opening Data.
- Data remains the detailed mental review and evidence surface.
- Coach shows today's saved mental check-in as planning context instead of asking for the same guided check-in again.

## Verification

| Check | Result |
|---|---|
| Red test: `npm run test:e2e -- --project=mobile-chromium --grep "Data mental check-in uses quick choices"` before UI implementation | Failed because `Quick Check-in` was missing. |
| Green test: `npm run test:e2e -- --project=mobile-chromium --grep "Data mental check-in uses quick choices"` | Passed: 1/1. |
| `npm run build -w frontend` | Passed. |
| `npm run test:e2e -- --project=mobile-chromium --grep "Mental\|Check-in\|Data"` | Passed: 19 passed, 1 route-evidence test skipped by flag. |
| `PULSE_ROUTE_EVIDENCE_DIR=test-results/route-evidence/mental-checkin-simplification npm run qa:ux-evidence` | Passed: desktop and mobile route evidence captured. |
| Red test: `npm run test:e2e -- --project=mobile-chromium --grep "free text into editable scores"` before UI implementation | Failed because `Kurz beschreiben` was missing. |
| `npm run build` | Passed: shared, backend and frontend. |
| `npm run test:e2e -- --project=mobile-chromium --grep "free text into editable scores"` | Passed: 1/1. |
| `npm run test:e2e -- --project=mobile-chromium --grep "Data mental check-in"` | Passed: 2/2, covering quick choices plus free text. |
| `PULSE_ROUTE_EVIDENCE_DIR=test-results/route-evidence/mental-checkin-free-text npm run qa:ux-evidence` | Passed: desktop and mobile route evidence captured; manifest reports no horizontal overflow on all captured routes. |
| `npm run test -w backend -- src/pulse/plugin.test.ts -t "POST /api/pulse/checkin/text"` | Blocked locally: Docker is not installed/running, so Postgres `127.0.0.1:5433` and Redis `127.0.0.1:6380` are unavailable. The backend test was still added for CI/service-backed environments. |
| Red test: `npm run test:e2e -- --project=mobile-chromium --grep "Home completes a compact mental check-in"` before Home implementation | Failed because `Mental Check-in` was missing on Home. |
| `npm run build` | Passed: shared, backend and frontend. |
| `npm run test:e2e -- --project=mobile-chromium --grep "Home completes a compact mental check-in"` | Passed: 1/1. |
| `npm run test:e2e -- --project=mobile-chromium --grep "Home\|Mental\|Check-in\|Data"` | Passed: 27 passed, 1 route-evidence test skipped by flag. |
| `PULSE_ROUTE_EVIDENCE_DIR=test-results/route-evidence/mental-checkin-home-entry npm run qa:ux-evidence` | Passed: desktop and mobile route evidence captured; manifest reports no horizontal overflow on all captured routes. |
| Red test: `npm run test:e2e -- --project=mobile-chromium --grep "Coach uses today mental check-in"` before Coach-context implementation | Failed because `MENTAL HEUTE` was missing on Coach. |
| `npm run build` | Passed: shared, backend and frontend. |
| `npm run test:e2e -- --project=mobile-chromium --grep "Coach uses today mental check-in"` | Passed: 1/1. |
| `npm run test:e2e -- --project=mobile-chromium --grep "Coach\|Mental\|Check-in\|Data"` | Passed: 32 passed, 1 route-evidence test skipped by flag. |
| `PULSE_ROUTE_EVIDENCE_DIR=test-results/route-evidence/mental-checkin-coach-context npm run qa:ux-evidence` | Passed: desktop and mobile route evidence captured; manifest reports no horizontal overflow on all captured routes. |

## Evidence Pack

Generated under:

- `test-results/route-evidence/mental-checkin-simplification/2026-05-04-<commit>/desktop-chromium/`
- `test-results/route-evidence/mental-checkin-simplification/2026-05-04-<commit>/mobile-chromium/`
- `test-results/route-evidence/mental-checkin-free-text/2026-05-05-<commit>/desktop-chromium/`
- `test-results/route-evidence/mental-checkin-free-text/2026-05-05-<commit>/mobile-chromium/`
- `test-results/route-evidence/mental-checkin-home-entry/2026-05-05-<commit>/desktop-chromium/`
- `test-results/route-evidence/mental-checkin-home-entry/2026-05-05-<commit>/mobile-chromium/`
- `test-results/route-evidence/mental-checkin-coach-context/2026-05-05-<commit>/desktop-chromium/`
- `test-results/route-evidence/mental-checkin-coach-context/2026-05-05-<commit>/mobile-chromium/`

The manifests report `horizontalOverflow: false` for all captured routes:

- `/`
- `/coach`
- `/data`
- `/data?tab=mental`
- `/data?tab=analysen`
- `/plan`
- `/settings`

## Notes

The first route-evidence run failed because the shared mock API marked today's check-in as already completed. The route evidence fixture now sets `checkinToday` to `null`, so `/data?tab=mental` captures the actual Quick Check-in input surface instead of the completed state.
