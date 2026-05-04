# Mental Check-in Simplification QA

Date: 2026-05-04

## Scope

PR 1 of `docs/superpowers/plans/2026-05-04-mental-checkin-simplification.md`:

- Data > Mental uses a Quick Check-in instead of mandatory 1-10 scoring.
- Quick choices map back to the existing numeric `POST /api/pulse/checkin` payload.
- Garmin/recovery signals from the existing home context are shown as a client-side suggestion.
- Exact 1-10 correction remains available behind `Feinjustieren`.

## Verification

| Check | Result |
|---|---|
| Red test: `npm run test:e2e -- --project=mobile-chromium --grep "Data mental check-in uses quick choices"` before UI implementation | Failed because `Quick Check-in` was missing. |
| Green test: `npm run test:e2e -- --project=mobile-chromium --grep "Data mental check-in uses quick choices"` | Passed: 1/1. |
| `npm run build -w frontend` | Passed. |
| `npm run test:e2e -- --project=mobile-chromium --grep "Mental\|Check-in\|Data"` | Passed: 18 passed, 1 route-evidence test skipped by flag. |
| `PULSE_ROUTE_EVIDENCE_DIR=test-results/route-evidence/mental-checkin-simplification npm run qa:ux-evidence` | Passed: desktop and mobile route evidence captured. |

## Evidence Pack

Generated under:

- `test-results/route-evidence/mental-checkin-simplification/2026-05-04-<commit>/desktop-chromium/`
- `test-results/route-evidence/mental-checkin-simplification/2026-05-04-<commit>/mobile-chromium/`

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
