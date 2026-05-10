# Scenario Preview Capability Fit

**Status:** Implemented 2026-05-10.

**Goal:** Make scenario preview decisions show Athlete-Level impact before applying a plan change or writing to Garmin.

## Why

After Athlete-Level Decision Language v1, Plan could explain the next workout fit, but scenario previews still focused on date, duration, TSS and Garmin impact. That left a gap before applying alternatives: Tobi could not see whether a projected workout was still `Machbar`, `Produktiv`, `Stretch` or `Zu hart heute`.

## Implemented Slice

- `PulsePlanScenarioProjectedWorkout` now supports read-only preview metadata:
  - archetype label;
  - workout difficulty level;
  - difficulty energy system;
  - capability fit label;
  - full capability fit detail.
- Scenario preview computes those fields from the existing workout library and capability engine.
- Preview loads capability summary with `persist: false`, so the preview remains read-only and does not update capability rows.
- Plan scenario preview now shows a compact `Athlete-Level` line for affected workouts before apply.
- No migration and no Garmin write.

## Verification

- RED: `npm run test -w backend -- src/pulse/services/plan-scenario-preview.test.ts` failed before projected workouts exposed capability metadata.
- RED: `npm run test:e2e -- --project=desktop-chromium --grep "Plan scenario preview lists affected future workouts"` failed before the preview rendered `Athlete-Level`.
- `npm run test -w backend -- src/pulse/services/plan-scenario-preview.test.ts`
- `npm run test:e2e -- --project=desktop-chromium --grep "Plan scenario preview lists affected future workouts"`
- `npm run build`
- `npm run qa:plan:no-garmin-write`
- `PULSE_ROUTE_EVIDENCE_DIR=test-results/route-evidence/scenario-preview-capability-fit npm run qa:ux-evidence`
- `npm run test:e2e:smoke`

## Follow-Up

The next canonical roadmap item is Nutrition Intelligence: use fueling logs, MNSTRY products, 750 ml bottles, GI comfort and workout intensity to improve practical per-session guidance.
