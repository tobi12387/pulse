# Training Benchmark Gap Plan

> **Status:** Completed on 2026-05-09. Implemented through `8a384ab` (capability levels), `92d4d34` (workout library fit), `18b0025` (TrainNow today options), `cdf9275` (plan scenario preview), `602bf94` (season load model), `2467fa8` (Garmin sync contract) and `6de9f86` (goal limiter evidence).

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the highest-value gaps between Pulse and leading endurance training products without copying proprietary plan content.

**Architecture:** Pulse should compete by combining a deterministic training intelligence layer with Tobi-specific Garmin, recovery, mental and fueling evidence. The next work should expand from weekly generation into capability levels, reusable workout archetypes, scenario planning and Garmin-safe execution, while keeping Home quiet and Plan/Data as evidence surfaces.

**Tech Stack:** Node/Fastify backend, Drizzle/Postgres, shared Pulse types, React/Vite frontend, Playwright E2E, Garmin integration, local PWA over VPN.

---

## Public Benchmark Evidence Reviewed

Reviewed on 2026-05-09. These are used as product references, not as content to copy:

- TrainerRoad Plan Builder: custom plans from goals, training time, schedule and training history; Garmin/Strava history sync; Base/Build/Specialty review before adding to the calendar. Source: <https://support.trainerroad.com/hc/en-us/articles/360037923191-Plan-Builder-Overview>
- TrainerRoad TrainNow: quick AI workout suggestions from recent training history with duration/type filtering for days without a plan. Source: <https://support.trainerroad.com/hc/en-us/articles/360057075531-TrainNow-Overview>
- TrainerRoad Athlete/Workout Levels and Difficulty Levels: zone-specific capability, workout difficulty, and Achievable/Productive/Stretch style fit labels. Sources: <https://support.trainerroad.com/hc/en-us/articles/4404665021595-Progression-Levels>, <https://support.trainerroad.com/hc/en-us/articles/360061003592-Workout-Levels>, <https://support.trainerroad.com/hc/en-us/articles/4404984267291-Difficulty-Levels>
- TrainerRoad AI FTP Detection/Prediction: FTP estimates from training and biometrics, plus predicted FTP changes from current and planned training. Sources: <https://support.trainerroad.com/hc/en-us/articles/4415864080155-How-to-Use-AI-FTP-Detection>, <https://support.trainerroad.com/hc/en-us/articles/41653598134043-What-is-AI-FTP-Prediction>
- TrainingPeaks ATP and structured workout ecosystem: annual planning by duration, TSS or event CTL; recovery cycles; plan/device sync; structured workout builder calculates TSS/IF and syncs to Garmin. Sources: <https://help.trainingpeaks.com/hc/en-us/articles/224662768-Annual-Training-Plan-Methodologies>, <https://help.trainingpeaks.com/hc/en-us/articles/115003760832-Structured-Workout-Builder-FAQ>, <https://help.trainingpeaks.com/hc/en-us/articles/115000325647-Structured-Workout-sync-and-Manual-Export>
- JOIN: adaptive plans around goals, availability and performance, with a large coached workout catalog and everyday schedule flexibility. Sources: <https://join.cc/>, <https://apps.apple.com/us/app/join-cycling-coach-app/id1167933055>
- Intervals.icu: free analytics/planning with fitness-fatigue-form, workout builder, device sync, annual planning, custom zones and plan library concepts. Sources: <https://www.intervals.icu/>, <https://www.intervals.icu/features/plan/>, <https://www.intervals.icu/features/fitness-chart/>
- WKO5: physiological profiling, power-duration modeling, limiters, optimized intervals and blending subjective metrics with objective training data. Source: <https://www.trainingpeaks.com/wko5/>

## Pulse Baseline

Already implemented:

- Garmin activity, health, sleep, HRV, Body Battery and planned-workout sync quality surfaces.
- HR-first plan generation with CTL/ATL/TSB, goals, availability, health states, mental state, RPE and execution review.
- Race Command, Season Strategy, deliberate free-day rationale and plan trace evidence.
- Training Intelligence control layer: workout archetypes, difficulty scoring, athlete progression signals, plan quality warnings and repeated-week variation.
- Manual/user-locked workouts for tours like the 155 km ride.
- Fueling and recovery guidance with Tobi-specific MNSTRY anchors, 750 ml bottles, During logs, GI comfort and weekly plan-density caps.
- Plan UI evidence card: `Warum diese Woche so?` grouped by Fueling, Erholung, Variation, Freie Tage and Zielbezug.

Original gaps this plan closed:

- No durable athlete capability levels by zone/archetype that evolve over time.
- No reusable workout library with stable difficulty labels and alternatives.
- No quick "TrainNow" style suggestions for unplanned days or spontaneous changes.
- No long-range Annual Training Plan target model that simulates weekly CTL/TSS/ramp/taper beyond the current season card.
- No scenario simulator that previews impact of adding/skipping/moving workouts before committing.
- Garmin sync exists, but plan generation does not yet treat device compatibility and repeat semantics as first-class acceptance criteria.

## Priority Order

| Rank | Theme | Why Now | Product Reference | Pulse Advantage |
|---|---|---|---|---|
| 1 | Capability Levels + Workout Difficulty Fit | Fixes the repeated/generic plan concern at the root by measuring what a workout means for Tobi, not only its TSS | TrainerRoad Athlete/Workout Levels | Can blend Garmin execution, HR-first compliance, RPE, mental and fueling tolerance |
| 2 | Structured Workout Library + Alternatives | Gives Pulse better building blocks than ad-hoc generation and makes sport changes update description/steps cleanly | TrainerRoad workout library, TrainingPeaks Workout Builder, JOIN catalog | Can keep only Tobi-relevant archetypes instead of a huge generic marketplace |
| 3 | TrainNow / Adaptive Today Suggestions | Solves "today has no plan" and spontaneous rides without bloating Home | TrainerRoad TrainNow, JOIN flexibility | Can include local recovery, weather, mental check-in, fueling readiness and Garmin state |
| 4 | Plan Builder Scenario Preview | Makes availability, custom tours and goals editable with visible tradeoffs before plan regeneration | TrainerRoad Plan Builder | Can be simpler and more transparent because Pulse is single-athlete/local |
| 5 | Annual Load / Event CTL Model | Moves from weekly adaptation to season-quality planning with ramp, deload and taper constraints | TrainingPeaks ATP, Intervals annual plan | Can present one clear season lane instead of coach-grade complexity |
| 6 | Sync-Safe Execution Contract | Prevents Garmin edge cases such as repeat counts, stale workouts and unsupported targets from undermining trust | TrainingPeaks/Garmin structured sync docs | Pulse controls both local plan state and Garmin cleanup/resync |
| 7 | Physiological Limiters + Course Specificity | Adds WKO-style quality once the basics are reliable | WKO5, Intervals analytics | Can focus on Tobi's actual goals, not broad analytics dashboards |

## Implementation Stories

### Story 1: Pulse Capability Levels

**User story:** As Tobi, I want Pulse to know which training systems I can currently handle, so planned workouts progress without feeling random or repetitive.

**Scope:**

- Persist rolling capability levels for endurance, tempo, sweet spot/threshold, VO2, anaerobic/sprint and long-endurance fueling sensitivity.
- Derive levels from completed planned workouts, off-plan Garmin activities, RPE, compliance, HR drift/load and fueling tolerance.
- Show compact levels in Plan/Data without making Home busier.

**Acceptance:**

- A failed hard workout does not raise the relevant capability level.
- A long off-plan ride raises endurance evidence but triggers recovery/fueling caution.
- Plan decisions can reference level fit: `Produktiv`, `Stretch`, `Erhaltung`, `Zu hart heute`.

### Story 2: Workout Difficulty Fit And Library

**User story:** As Tobi, I want every planned workout to have a stable archetype, difficulty and purpose, so sport changes or alternatives update the whole workout coherently.

**Scope:**

- Convert current training archetypes into a small reusable Pulse workout library.
- Add a deterministic fit label from workout difficulty versus capability level.
- Generate descriptions, steps and Garmin payloads from the same archetype instance.

**Acceptance:**

- Changing sport from bike to run/hike/swim regenerates title, description, steps and Garmin sync state.
- Alternatives preserve purpose but adjust duration/intensity safely.
- E2E covers at least one sport-change cleanup and one Garmin resync path.

### Story 3: TrainNow For Unplanned Days

**User story:** As Tobi, I want useful workout suggestions when nothing is planned or life changes, without being pushed to train on every available day.

**Scope:**

- Add `/api/pulse/plan/today-options` returning 2-3 options such as endurance, quality, recovery/skills or rest.
- Filter by available time, current recovery, mental state, fueling readiness, recent sport mix and goals.
- Surface on Home only when helpful; Plan gets the fuller explanation.

**Acceptance:**

- If today has a completed Garmin activity, suggestions become recovery/fueling/feedback options instead of another workout.
- If recovery risk is high, rest is a first-class option with evidence.
- Suggestions are stable and explainable; refresh does not generate random churn.

### Story 4: Plan Scenario Preview

**User story:** As Tobi, I want to see what happens if I add a long ride, skip a day or change availability before Pulse rewrites the week.

**Scope:**

- Add preview-only plan generation that returns projected workouts, changed days, load impact and reasons without saving.
- Support common scenario inputs: add custom tour, move workout, reduce volume, add event, change availability.
- Make "Apply" explicit and Garmin-safe.

**Acceptance:**

- Previewing a 155 km relaxed tour shows recovery/fueling impact on the following days.
- Applying a preview preserves user-locked workouts and cleans up stale Garmin schedules.
- Canceling preview leaves database and Garmin untouched.

### Story 5: Annual Load And Event Model

**User story:** As Tobi, I want Pulse to understand the whole season, not just next week, so weekly decisions feel aligned with longer goals.

**Scope:**

- Add a lightweight annual/season model with target weekly hours/TSS, ramp-rate caps, deload cycles, taper windows and A/B/C event priority.
- Keep the UI as one simple season lane plus warnings, not a TrainingPeaks clone.
- Feed weekly plan generation with the season target and current deviation.

**Acceptance:**

- A near A event creates taper constraints.
- A missed or overloaded week adjusts the next 2-4 weeks rather than only the next generated week.
- Plan trace explains whether the week is build, deload, taper, maintenance or recovery.

### Story 6: Garmin Structured Workout Contract

**User story:** As Tobi, I want workouts to arrive on the Edge 1040/watch exactly as Pulse planned them, including repeats, targets and cleanup when changed.

**Scope:**

- Add a deterministic Garmin payload validator for repeat counts, unsupported targets and stale remote IDs.
- Store a sync contract result per planned workout.
- Use this contract in tests before upload and in UI confidence copy after upload.

**Acceptance:**

- A workout with repeats never uploads as `null` repeats.
- Unsupported targets degrade visibly before sync, not silently on Garmin.
- Updating sport/duration/steps removes stale remote workouts and uploads the new structure.

### Story 7: Limiters And Course Specificity

**User story:** As Tobi, I want Pulse to identify the limiter that matters for a goal, not just generic fitness.

**Scope:**

- Derive goal-specific limiters from race discipline, distance, terrain hints, power/HR/pace patterns, decoupling, durability and fueling tolerance.
- Use limiters to select archetypes and explain why a workout appears.
- Keep this as a Plan/Data evidence feature first; do not add a new top-level dashboard.

**Acceptance:**

- Long endurance/fueling limiter changes long-ride progression.
- Threshold/VO2 limiter changes intensity mix without overloading recovery.
- Plan trace cites the active limiter and the evidence behind it.

## Explicit Non-Goals

- Do not scrape, import or reproduce proprietary TrainerRoad, JOIN or paid TrainingPeaks plan content.
- Do not build a public TrainingPeaks marketplace clone.
- Do not add new top-level navigation.
- Do not make nutrition or medical claims beyond conservative fueling/recovery guidance.
- Do not trigger live Garmin sync in generic QA.

## Implemented Sequence

1. `8a384ab` — backend capability levels, tests, small Data/Plan read surface.
2. `92d4d34` — reusable workout library, difficulty fit and sport-change consistency.
3. `18b0025` — TrainNow/today options API and Home/Plan surfaces.
4. `cdf9275` — preview/apply flow for custom tours and availability changes.
5. `602bf94` — annual load/ramp/taper constraints feeding weekly generation.
6. `2467fa8` — Garmin sync contract and repeat/target regression tests.
7. `6de9f86` — goal limiter evidence and limiter-aware archetype selection.

## Verification Strategy

- Pure backend services first with failing tests before implementation.
- No schema change without `pulse-migration-guard`.
- Frontend route checks for Plan/Home only when a user-visible surface changes.
- Garmin sync contract tests must run without live Garmin calls.
- Full local gate: `npm run verify:local:no-services`.
