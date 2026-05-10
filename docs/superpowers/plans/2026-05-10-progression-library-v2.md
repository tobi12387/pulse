# Progression Library v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Pulse's workout planning feel less repetitive and more TrainerRoad-level by exposing progression, fit, and variety without copying proprietary workouts.

**Architecture:** Build on existing `training-capabilities`, `workout-library`, `workout-steps`, RPE/compliance and adaptation events. Keep workout generation deterministic and Garmin-safe; improve selection and visibility before expanding volume.

**Tech Stack:** TypeScript backend services, shared Pulse types, React Plan/Data UI, Playwright, backend Vitest.

---

## Files

- Modify: `backend/src/pulse/services/training-capabilities.ts`.
- Modify: `backend/src/pulse/services/workout-library.ts`.
- Modify: `backend/src/pulse/services/plan-engine.ts`.
- Modify: `backend/src/pulse/services/today-options.ts`.
- Modify: `shared/pulse.ts` or current shared Pulse type file.
- Modify: `frontend/src/features/training/TrainingCapabilityCard.tsx`.
- Modify: `frontend/src/pages/Plan.tsx`.
- Modify: `frontend/src/pages/Insights.tsx` / Data Analysen if progression evidence belongs there.
- Tests: `backend/src/pulse/services/training-capabilities.test.ts`, `backend/src/pulse/services/workout-library.test.ts`, `backend/src/pulse/services/plan-engine.test.ts`, `frontend/e2e/pulse-usability.spec.ts`.

## Task 1: Make Progression Visible

- [ ] **Step 1: Add backend tests for capability language**

Extend `training-capabilities.test.ts`:

- Completed threshold workout with high compliance and RPE <= 8 raises threshold capability.
- Hard-feeling low-compliance workout marks `reduce_next_intensity`.
- Long off-plan ride raises long endurance cautiously and triggers recovery protection.

- [ ] **Step 2: Extend shared type**

Add to each capability level:

```ts
nextRecommendedWorkoutLevel: number;
lastProgressionReason: string | null;
staleReason: string | null;
```

- [ ] **Step 3: Implement fields**

In `deriveTrainingCapabilities`, compute:

- `nextRecommendedWorkoutLevel = clamp(level + 0.3, 1, 10)` for productive systems.
- Hold or reduce if `protect_recovery` or `reduce_next_intensity` is present.
- `staleReason` if no evidence in that energy system.

- [ ] **Step 4: Surface in UI**

In `TrainingCapabilityCard`, show compact rows:

- `Endurance 4.1 -> nächster produktiver Reiz 4.4`.
- `Threshold 3.2 · vorsichtig`.
- `Long Endurance · geschützt nach langer Tour`.

- [ ] **Step 5: Run tests**

Run:

```bash
npm run test -w backend -- src/pulse/services/training-capabilities.test.ts
npm run test:e2e -- --project=desktop-chromium --grep "Capability|Progression|Plan"
```

Expected: progression evidence visible and deterministic.

## Task 2: Expand Library Where It Reduces Repetition

- [ ] **Step 1: Add repetition tests**

In `workout-library.test.ts`, assert that two consecutive weeks with same target energy system choose different archetypes unless constraints force reuse.

- [ ] **Step 2: Add local variants**

Extend `workout-library.ts` with additional Garmin-safe variants:

- Endurance: steady, cadence blocks, short aerobic maintenance.
- Tempo: sustained tempo, over-under-lite.
- Threshold: short repeats, sustained threshold, controlled progression.
- VO2: on/off, short repeats, conservative intro.
- Long endurance: fueling-practice, durability, social/relaxed.
- Strength support: mobility/core/glutes variants already concrete; add rotation metadata, not a new habit surface.

Keep each variant original and local; do not copy third-party workouts.

- [ ] **Step 3: Add rotation memory**

Use existing planned workout `archetypeId` history to avoid repeating the same archetype within 14 days when alternatives fit.

- [ ] **Step 4: Run tests**

Run:

```bash
npm run test -w backend -- src/pulse/services/workout-library.test.ts src/pulse/services/plan-engine.test.ts
```

Expected: no repeated archetype unless constraints make it the only safe option.

## Task 3: Tie RPE, Fueling and Mental State Into Fit

- [ ] **Step 1: Add tests**

Add plan-engine tests:

- High RPE on easy workout reduces next intensity.
- GI discomfort on long ride blocks next long/hard recommendation until recovery/fueling action is handled.
- Mental protect state shifts hard workout to endurance/recovery if no A-race constraint.

- [ ] **Step 2: Implement fit modifiers**

In `fitWorkoutToCapabilities` or plan-engine selection, apply:

- `rpe >= 9`: cap workout fit at `too_hard_today` for hard systems.
- GI discomfort from fueling log: mark long endurance as `stretch` or `too_hard_today`.
- Mental protect: prefer recovery/endurance options.

- [ ] **Step 3: Surface "why this variant"**

In Plan row/detail, show one compact line:

```txt
Warum diese Einheit: Endurance-Level 4.1, letzte Z2 sauber, GI neutral, Garmin bereit.
```

- [ ] **Step 4: Run tests**

Run:

```bash
npm run test:training-intelligence
npm run test:e2e -- --project=mobile-chromium --grep "Workout Level|Warum diese Einheit|Plan"
```

Expected: variant rationale is visible and matches backend selection.

## Task 4: Today Options Becomes Progression-Aware

- [ ] **Step 1: Add tests**

In `today-options.test.ts`, assert that Today Options:

- offers recovery/rest after high fatigue.
- offers productive endurance when short availability and good readiness.
- does not offer hard VO2 after GI discomfort or protect mental state.

- [ ] **Step 2: Implement selection**

Use capability fit and daily command state to produce at most three options:

- Primary: safest useful action.
- Alternate: shorter/lighter option.
- Support: mobility/fueling/feedback if training is not the best next action.

- [ ] **Step 3: Run tests**

Run:

```bash
npm run test -w backend -- src/pulse/services/today-options.test.ts src/pulse/services/training-capabilities.test.ts
npm run test:e2e -- --project=mobile-chromium --grep "Today Options|Mobile Quick Decision"
```

Expected: options vary by data and do not fill every available day automatically.

## Non-Goals

- No imported TrainerRoad/TrainingPeaks/JOIN workout catalog.
- No automatic FTP/profile changes from power-duration estimates.
- No extra top-level Workout Library tab.
- No plan mutation without explicit preview/apply.

