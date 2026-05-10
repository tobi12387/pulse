# Nutrition Intelligence v1

Status: implemented 2026-05-10.

## Goal

Use real fueling and GI logs to change the next practical fueling recommendation, not only to explain it afterwards.

## Implemented

- Long endurance workouts now use a controlled tolerance-learning carb range when the most relevant recent long-session log had a GI issue at low carbohydrate intake.
- The concrete next-session recommendation changes from the generic `60-90 g/h` long-session target to `50-70 g/h`.
- Existing 750-ml bottle and MNSTRY `POWER CARB Sour Cherry 1:0.8` powder math recalculates from that target range.
- The generic upper-range warning is suppressed in this learning mode because the guidance is already a controlled next step.
- The Plan workout modal tolerates partial Fueling & Recovery responses so the card remains visible instead of crashing if a read-only field is missing.
- No database migration and no Garmin write behavior changed.

## Verification

- `npm run test -w backend -- src/pulse/services/fueling-recovery-guidance.test.ts`
- `npm run test -w backend -- src/pulse/services/fueling-debt.test.ts`
- `npm run build`
- `npm run test:e2e -- --project=desktop-chromium --grep "Plan workout modal shows Fueling and Recovery guidance for long sessions"`
- `npm run test:e2e:smoke`
- `git diff --check`

## Follow-Up

- Build a richer fueling outcome baseline that tracks temperature, sodium, total fluid, product mix and subjective tolerance across repeated long sessions.
- Add a weekly nutrition coaching summary once enough logs exist.
- Keep sodium guidance conservative until Pulse has better sweat-rate or heat evidence.
