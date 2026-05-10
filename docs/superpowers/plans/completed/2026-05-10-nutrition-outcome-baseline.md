# Nutrition Outcome Baseline

Status: implemented 2026-05-10.

## Goal

1. Summarize recent long-session fueling logs into one structured baseline.
2. Reuse that baseline in existing Fueling & Recovery guidance and activity fueling UI.
3. Stay read-only and migration-free; no Garmin writes and no new top-level Nutrition tab in this slice.

## Architecture

- Create a pure backend summary service from existing nutrition logs and linked activity duration.
- Extend shared Pulse fueling contracts additively.
- Add compact UI display inside existing Fueling & Recovery surfaces only.
- Keep sodium/heat as evidence gaps until stronger data exists.

## File Map

| File | Change |
|---|---|
| `shared/types/pulse/fueling.ts` | Add outcome baseline contract. |
| `backend/src/pulse/services/fueling-outcome-baseline.ts` | Create pure summary + DB loader. |
| `backend/src/pulse/services/fueling-outcome-baseline.test.ts` | Cover 155-km style low-intake GI learning and tolerated follow-up baseline. |
| `backend/src/pulse/services/fueling-recovery-guidance.ts` | Include baseline in guidance response and use target range consistently. |
| `backend/src/pulse/services/fueling-recovery-planned-workout.ts` | Keep loading existing log history; guidance builds baseline from it. |
| `backend/src/pulse/routes/training-routes.ts` | Return baseline from `/fueling/debt`. |
| `frontend/src/pulse/api-client.ts` | Type the extended debt response. |
| `frontend/src/components/WorkoutDetailModal.tsx` | Show compact baseline in the existing modal card. |
| `frontend/src/pages/ActivityDetail.tsx` | Show compact baseline next to activity fueling logs. |
| `frontend/e2e/pulse-usability.spec.ts` | Browser-cover modal and activity baseline visibility. |

## Acceptance

- A 430-min / 300 g-carb / 4x750 ml / mild-GI log produces a `learning` baseline with observed `42 g/h`, target `50-70 g/h`, bottle/powder evidence and a sodium evidence gap.
- Fueling guidance uses the same baseline target that the UI explains.
- Activity detail can show the baseline without a new route or tab.
- Tests/build/browser smoke pass.

## Verification

- `npm run test -w backend -- src/pulse/services/fueling-outcome-baseline.test.ts`
- `npm run test -w backend -- src/pulse/services/fueling-recovery-guidance.test.ts`
- `npm run test -w backend -- src/pulse/services/fueling-debt.test.ts`
- `npm run build`
- `npm run test:e2e -- --project=desktop-chromium --grep "Activity fueling log captures|Plan workout modal shows Fueling"`
- `npm run qa:plan:no-garmin-write`
