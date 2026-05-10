# Training Benchmark Upgrade Roadmap

> Stand: 2026-05-10 after the second benchmark against TrainerRoad, TrainingPeaks, JOIN, Garmin Coach, Intervals.icu, WKO5, Wahoo SYSTM and adjacent AI coaching apps.

## Product Target

Pulse should become a better personal training coach than the benchmark apps for Tobi's use case: local-first, Garmin-backed, daily-useful, explainable, conservative with health signals and precise enough that planned workouts arrive correctly on Edge/watch.

The next improvement wave is not another broad dashboard wave. It is a sequence of narrow implementation plans that close the gap between "good recommendations" and "trusted execution".

## Benchmark Diagnosis

| Capability | Benchmark Leader Pattern | Pulse Today | Gap Severity |
|---|---|---|---|
| Device execution trust | TrainingPeaks/Garmin structured workouts appear reliably on device; TrainerRoad keeps workout structure stable | Sync contracts exist, but no durable remote ledger or real remote diff surface | Critical |
| Daily adaptation | TrainerRoad/JOIN adapt after rides, misses, schedule changes and readiness shifts | Pulse has capabilities, TrainNow and scenario preview, but adaptation is still scattered | Critical |
| Workout library depth | TrainerRoad/JOIN have many variants per system and difficulty band | Pulse has a small deterministic archetype set | High |
| Fast mobile planning | JOIN makes "today I have X time" easy | Pulse has Today Options and scenario preview, but the interaction is still heavier than it needs to be | High |
| Physiological modeling | WKO5/Intervals expose power-duration, durability, limiters and comparable efforts | Pulse has EF, decoupling, HR drift and basic capability levels, but stream coverage and power-quality provenance are not yet trustworthy enough | High |
| Season / ATP planning | TrainingPeaks ATP models long-range CTL/TSS/event cycles | Pulse has a lightweight Season Load forecast | Medium-High |
| Strength / mobility | Runna/SYSTM integrate supporting strength/mobility as actionable plans | Pulse has strength_support but no concrete exercise prescription | Medium |

## Active Plan Order

1. `2026-05-10-power-duration-durability.md`
   - Adds WKO/Intervals-style performance depth after the data-quality foundation can prove whether a signal is stream-derived or only lap-approximated.
2. `2026-05-10-season-atp-v2.md`
   - Upgrades season planning once workout/adaptation/load signals are stronger.
3. `2026-05-10-strength-mobility-companion.md`
   - Adds concrete support sessions after the main endurance loop is more trustworthy.

## Completed In This Wave

- `completed/2026-05-10-garmin-execution-ledger.md`
  - Trust foundation: upload/delete attempts now have a durable local ledger and Plan can explain the latest execution state.
- `completed/2026-05-10-adaptation-event-queue.md`
  - Daily adaptation foundation: write-triggered adaptation events now centralize activity, RPE, mental, fueling, recovery and sync-debt reasons for Home/Plan.
- `completed/2026-05-10-workout-library-v2.md`
  - Workout depth foundation: 20 local deterministic variants, scored selection, Garmin-safe step generation and archetype preservation through plan generation, Today Options and custom workout creation.
- `completed/2026-05-10-mobile-plan-flow.md`
  - iPhone/PWA planning foundation: Home availability intents deep-link into an auto-computed Plan scenario preview with explicit Apply and Garmin-impact context.
- `completed/2026-05-10-power-data-quality-foundation.md`
  - Power provenance foundation: `/training-analytics` reports stream/lap/unavailable quality and Data > Analysen shows whether power model claims are trusted, cautious or blocked without changing FTP/profile.

## Implementation Rule

Each plan is intended to become one or more small PRs. Do not combine all plans in one runtime PR. If a plan requires a migration, run `pulse-migration-guard`, use the next free migration number and renumber if `main` advances.

## Non-Goals

- Do not copy proprietary TrainerRoad, JOIN, TrainingPeaks or WKO plan/workout content.
- Do not add a new top-level navigation item.
- Do not trigger live Garmin sync in generic browser QA.
- Do not weaken the current local-server/VPN model.
- Do not turn mental health signals into clinical diagnosis.

## Benchmark Evidence Sources

- TrainerRoad Plan Builder: <https://support.trainerroad.com/hc/en-us/articles/360037923191-Plan-Builder-Overview>
- TrainerRoad TrainNow: <https://support.trainerroad.com/hc/en-us/articles/360057075531-TrainNow-Overview>
- TrainerRoad Workout Levels and Progression Levels: <https://support.trainerroad.com/hc/en-us/articles/360061003592-Workout-Levels>, <https://support.trainerroad.com/hc/en-us/articles/4404665021595-Progression-Levels>
- TrainingPeaks ATP and Structured Workout Builder: <https://help.trainingpeaks.com/hc/en-us/articles/224662768-Annual-Training-Plan-Methodologies>, <https://help.trainingpeaks.com/hc/en-us/articles/235164967-Structured-Workout-Builder>
- TrainingPeaks structured workout sync: <https://help.trainingpeaks.com/hc/en-us/articles/115000325647-Structured-Workout-sync-and-Manual-Export>
- TrainingPeaks Strength Workout Builder: <https://help.trainingpeaks.com/hc/en-us/articles/21397126893581-Using-the-Strength-Workout-Builder>
- JOIN product/help pages: <https://join.cc/>
- Garmin Cycling Coach: <https://www.garmin.com/en-GB/garmin-technology/garmin-coach/garmin-cycling-coach/>
- Intervals.icu Power Charts and planning surfaces: <https://www.intervals.icu/features/power-charts/>
- WKO5 / modeled power reference: <https://www.trainingpeaks.com/wko5/>, <https://www.trainingpeaks.com/coach-blog/power-duration-curve-modeled-power/>
