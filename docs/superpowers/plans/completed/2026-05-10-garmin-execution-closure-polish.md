# Garmin Execution Closure Polish

**Status:** Implemented 2026-05-10.

**Goal:** Make the Plan `Ausführung` flow trustworthy after plan changes by proving whether Garmin readback matches Pulse for templates, calendar entries and repeat counts.

## Why

Tobi had seen Garmin workouts where repeats appeared as `0`/`null`. Pulse already had Garmin readback and repair actions, but the UI could still feel too generic and the backend could mark repeat workouts as ready when Garmin workout details were unavailable.

## Implemented Slice

- Added an optional `repeatAudit` contract to Garmin execution diff rows.
- The backend now compares Pulse's expected repeat groups/iterations with Garmin readback:
  - matching repeats stay `ready`;
  - invalid or mismatched repeats become `broken_repeat`;
  - repeat workouts with unreadable Garmin details become `unknown` instead of falsely `ready`.
- Plan `Ausführung` now starts with a compact task contract:
  - why this check matters;
  - what `Neu prüfen` does;
  - when repair buttons actually write to Garmin.
- Execution rows now separate `Pulse bekannt` from `Garmin Readback`, so a local scheduled id no longer looks like proof that Garmin returned the calendar item.
- Settings `Plan prüfen` opens `/plan?tab=execution` directly.
- The no-Garmin-write Playwright harness covers the readback and Settings path without triggering live Garmin writes.

## Verification

- RED: `npm run test -w backend -- src/pulse/services/garmin-execution-diff.test.ts` failed before `repeatAudit` existed.
- RED: `npm run test:e2e -- --project=desktop-chromium --grep "Plan no-Garmin-write harness"` failed before the UI contract/readback copy existed.
- RED: `npm run test:e2e -- --project=desktop-chromium --grep "Settings Plan prüfen"` failed while Settings linked to `/plan`.
- `npm run test -w backend -- src/pulse/services/garmin-execution-diff.test.ts`
- `npm run test -w backend -- src/pulse/plugin.test.ts`
- `npm run build -w shared`
- `npm run build -w backend`
- `npm run build -w frontend`
- `npm run test:e2e -- --project=desktop-chromium --grep "Plan no-Garmin-write harness|Settings Plan prüfen"`
- `npm run qa:plan:no-garmin-write`
- `PULSE_ROUTE_EVIDENCE_DIR=test-results/route-evidence/garmin-execution-closure-polish npm run qa:ux-evidence`
- `npm run test:e2e:smoke`

## Follow-Up

The remaining Garmin polish is optional and should be evidence-led: modal wording can later distinguish `vor Upload`, `auf Garmin prüfen` and `Readback zuletzt geprüft` if screenshots show the modal still creates confusion.
