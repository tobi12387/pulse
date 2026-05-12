# 2026-05-12 — Workout Progression Clarity v3 QA

## Scope

- `/plan` now explains the next workout's progression role, calibration, repetition rationale and change trigger in one compact read-only block.
- Scheduled workout rows add one compact progression chip so repeated-looking workouts are visible as consolidation, maintenance or a change candidate.
- No backend endpoint, DB migration, LLM call, plan mutation or Garmin write was introduced.

## Verification

- `npm run test:frontend-logic` — passed.
- `npm run build -w frontend` — passed.
- `npx playwright test frontend/e2e/pulse-smoke.spec.ts --project=desktop-chromium --project=mobile-chromium -g "Plan starts with the current action contract" --workers=1` — passed.
- `npx playwright test frontend/e2e/pulse-smoke.spec.ts --project=mobile-chromium -g "Plan mobile workout rows wrap status chips" --workers=1` — passed.
- `npx playwright test frontend/e2e/pulse-usability.spec.ts --project=desktop-chromium --project=mobile-chromium -g "Plan explains Athlete-Level fit|Plan Training explains repeated-looking workouts" --workers=1` — passed.
- `npm run qa:plan:no-garmin-write` — passed.
- `PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-workout-progression-clarity npm run qa:ux-evidence` — passed.

## Route Evidence

- Desktop screenshots: `/tmp/pulse-workout-progression-clarity/2026-05-12-0038c31/desktop-chromium/`
- Mobile screenshots: `/tmp/pulse-workout-progression-clarity/2026-05-12-0038c31/mobile-chromium/`
- Horizontal overflow: `0` overflowing screenshots on desktop (`9` screenshots) and mobile (`15` screenshots).

## Notes

- The usability tests originally used fixed `2026-05-11`/`2026-05-13` workout dates. On 2026-05-12 this made the first workout past-dated and hid the repeated-future rationale. The tests now use relative future dates so the progression copy is tested against the intended open-plan state.
- A pre-PR review found that different archetypes with the same energy system were not grouped as repeated progression stimuli. `sameProgressionGroup` now treats matching `difficultyEnergySystem` as the intended fallback even when both workouts have different archetype IDs, covered by `groups different archetype variants when they train the same energy system`.
