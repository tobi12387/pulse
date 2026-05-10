# Daily Delta Home v1 Implementation Plan

**Status:** Implemented 2026-05-10.

**Goal:** Show whether the latest real activity matched the plan, how load differed, and what that means for the next recommendation without adding another bulky dashboard.

## Why

Tobi flagged that Home felt confusing after a completed planned workout. A daily flow should not say only what is planned; it should also close the loop once Garmin shows what actually happened.

## Implemented Slice

- Added a read-only `GET /api/pulse/daily-delta?days=7` contract.
- Built `buildDailyDelta(...)` from existing Pulse data only:
  - `pulse_planned_workouts`;
  - `pulse_activities`;
  - `pulse_daily_metrics`.
- No migration and no LLM call.
- Home now renders a compact `Plan vs Ausführung` card immediately after the daily decision when a recent delta exists.
- The card shows match status, compliance score, TSS delta and the next plan effect.

## Verification

- RED: `npm run test -w backend -- src/pulse/services/daily-delta.test.ts` failed before the service existed.
- `npm run test -w backend -- src/pulse/services/daily-delta.test.ts src/pulse/plugin.test.ts`
- `npm run test:e2e -- --project=desktop-chromium --grep "Home shows the latest planned-vs-completed daily delta"`
- `npm run build -w shared`
- `npm run build -w frontend`
- `npm run build -w backend`

## Follow-Up

Plan and Data can echo the same daily-delta contract later, but Home is the primary daily-use surface. Keep future echoes compact and avoid adding another interpretation-heavy dashboard.
