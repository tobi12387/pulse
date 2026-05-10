# Athlete-Level Decision Language v1

**Status:** Implemented 2026-05-10.

**Goal:** Make existing capability fit useful in daily decisions without adding another dashboard.

## Why

Pulse already stored `capabilityFit`, `difficultyLevel` and capability summaries, but parts of the UI still exposed them as small badges or raw labels. Tobi needs to understand whether a workout is `machbar`, `produktiv`, `stretch` or `zu hart heute`, and what alternative that implies.

## Implemented Slice

- Today Options now translate planned workout fit into readable signal labels:
  - `Machbar`;
  - `Produktiv`;
  - `Stretch`;
  - `Zu hart heute`.
- Recovery-protect decisions caused by `too_hard_today` keep that fit evidence visible before the recovery option.
- Plan's next training decision shows an `Athlete-Level` block with workout level and the recommended interpretation.
- Stretch and too-hard workouts can mark the safer alternative first, with a visible `Level-Wirkung` result preview.
- Plan rows and workout modal use the same `Machbar` / `Zu hart heute` vocabulary.
- No migration and no new model/provider call.

## Verification

- RED: `npm run test -w backend -- src/pulse/services/today-options.test.ts` failed before readable fit signals existed.
- RED: `npm run test:e2e -- --project=desktop-chromium --grep "Plan explains Athlete-Level fit"` failed before the Plan Athlete-Level summary existed.
- `npm run test -w backend -- src/pulse/services/today-options.test.ts`
- `npm run test:e2e -- --project=desktop-chromium --grep "Plan explains Athlete-Level fit"`
- `npm run build -w shared`
- `npm run build -w backend`
- `npm run build -w frontend`
- `npm run build`
- `npm run qa:plan:no-garmin-write`
- `PULSE_ROUTE_EVIDENCE_DIR=test-results/route-evidence/athlete-level-decision-language npm run qa:ux-evidence`
- `npm run test:e2e:smoke`

## Follow-Up

The next Athlete Levels/Alternatives slice should enrich scenario preview projected workouts with capability fit detail, so alternatives can explain their level effect before any apply or Garmin write.
