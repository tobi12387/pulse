# Workout Library V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand Pulse from a small archetype set to a richer deterministic workout library with progression levels, alternatives and Garmin-safe step generation.

**Architecture:** Keep the library local and Tobi-specific instead of copying public workout catalogs. Add variants under each energy system, select by capability fit and plan limiter, and generate title, description, steps and Garmin contract from the same library item.

**Tech Stack:** TypeScript pure services, shared Pulse types, Fastify route consumers, Vitest.

---

## Files

- Modify: `backend/src/pulse/services/training-intelligence.ts`
- Modify: `backend/src/pulse/services/workout-library.ts`
- Modify: `backend/src/pulse/services/workout-library.test.ts`
- Modify: `backend/src/pulse/services/training-intelligence.test.ts`
- Modify: `backend/src/pulse/services/plan-engine.ts`
- Modify: `backend/src/pulse/routes/training-routes.ts`
- Modify: `backend/src/pulse/services/today-options.ts`
- Modify: `shared/types/pulse/plan.ts`
- Modify: `frontend/src/features/plan/training/training-components.tsx`
- Modify: `frontend/src/pulse/activity-labels.ts`
- Test: `frontend/e2e/pulse-smoke.spec.ts` or focused Plan route coverage

## Library Shape

Add 30-50 variants over time, but implement the first safe slice with 20 variants:

- Recovery: `recovery_spin`, `mobility_flush`
- Endurance: `endurance_steady`, `endurance_cadence`, `endurance_progressive`, `endurance_hills`
- Long endurance: `long_endurance`, `long_endurance_fueling_practice`, `long_endurance_durability`
- Tempo: `tempo_sustained`, `tempo_over_distance`, `gravel_specificity`
- Threshold: `threshold_intervals`, `threshold_cruise`, `sweet_spot_builder`
- VO2/Anaerobic: `vo2_repeats`, `vo2_short_sharp`, `anaerobic_sharpening`
- Strength: `strength_support`, `strength_prehab`

## Task 1: Extend Archetype Metadata

- [ ] **Step 1: Add variant fields**

Modify `TrainingArchetype` in `backend/src/pulse/services/training-intelligence.ts`:

```ts
export interface TrainingArchetype {
  id: string;
  label: string;
  energySystem: TrainingEnergySystem;
  suitableFor: Array<'road' | 'gravel' | 'century' | 'fitness' | 'race' | 'recovery'>;
  phaseFit: Array<'base' | 'build' | 'peak' | 'taper' | 'maintenance'>;
  defaultZone: number;
  durationRangeMin: [number, number];
  difficultyBand: 'easy' | 'moderate' | 'productive' | 'stretch';
  progressionFamily: 'recovery' | 'endurance' | 'long' | 'tempo' | 'threshold' | 'vo2' | 'strength';
  garminStructure: 'steady' | 'intervals' | 'repeat_group' | 'strength_notes';
  description: string;
}
```

- [ ] **Step 2: Update all existing archetypes**

For example:

```ts
{
  id: 'endurance_cadence',
  label: 'Endurance Cadence',
  energySystem: 'endurance',
  suitableFor: ['road', 'fitness'],
  phaseFit: ['base', 'build', 'maintenance'],
  defaultZone: 2,
  durationRangeMin: [45, 90],
  difficultyBand: 'moderate',
  progressionFamily: 'endurance',
  garminStructure: 'intervals',
  description: 'Aerober Reiz mit kurzen Kadenzfenstern, ohne echte Intensitaet.',
}
```

- [ ] **Step 3: Test unique IDs**

Add to `backend/src/pulse/services/training-intelligence.test.ts`:

```ts
it('keeps workout library archetype ids unique and Garmin-structure aware', () => {
  const ids = trainingArchetypes.map(archetype => archetype.id);
  expect(new Set(ids).size).toBe(ids.length);
  expect(trainingArchetypes.every(archetype => archetype.garminStructure)).toBe(true);
  expect(trainingArchetypes.filter(archetype => archetype.progressionFamily === 'endurance').length).toBeGreaterThanOrEqual(4);
});
```

- [ ] **Step 4: Run the library test**

Run:

```bash
npm test -w backend -- --run src/pulse/services/training-intelligence.test.ts src/pulse/services/workout-library.test.ts
```

Expected: PASS after metadata is complete.

## Task 2: Select Variants By Capability And Goal Limiter

- [ ] **Step 1: Add input fields**

Extend `WorkoutLibraryInput`:

```ts
export interface WorkoutLibraryInput extends WorkoutDifficultyInput {
  description?: string | null;
  preferredFamily?: TrainingArchetype['progressionFamily'] | null;
  avoidRepeatArchetypeIds?: string[];
  goalLimiterKind?: PulseGoalLimiterKind | null;
}
```

- [ ] **Step 2: Replace single-rule selection**

In `selectWorkoutArchetype`, score candidates:

```ts
function scoreArchetype(candidate: TrainingArchetype, workout: WorkoutLibraryInput): number {
  let score = 0;
  if (candidate.defaultZone === clampZone(workout.zone)) score += 4;
  if (workout.durationMin >= candidate.durationRangeMin[0] && workout.durationMin <= candidate.durationRangeMin[1]) score += 4;
  if (workout.preferredFamily && candidate.progressionFamily === workout.preferredFamily) score += 3;
  if (workout.goalLimiterKind === 'long_endurance_fueling' && candidate.progressionFamily === 'long') score += 3;
  if (workout.goalLimiterKind === 'threshold_vo2' && ['threshold', 'vo2'].includes(candidate.progressionFamily)) score += 3;
  if (workout.avoidRepeatArchetypeIds?.includes(candidate.id)) score -= 5;
  return score;
}
```

Then choose the highest scored candidate from the same broad system rather than the first hard-coded match.

- [ ] **Step 3: Test non-repetition**

Add:

```ts
it('rotates endurance variants when the previous archetype should be avoided', () => {
  const next = selectWorkoutArchetype({
    activityType: 'bike',
    zone: 2,
    durationMin: 75,
    avoidRepeatArchetypeIds: ['endurance_steady'],
  });

  expect(next.id).not.toBe('endurance_steady');
  expect(next.progressionFamily).toBe('endurance');
});
```

## Task 3: Generate Variant-Specific Garmin Steps

- [ ] **Step 1: Add step builders by `garminStructure`**

In `workout-library.ts`, split step generation into helpers:

```ts
function buildCadenceSteps(duration: number): WorkoutStep[] {
  return normalizeStepDurations([
    { type: 'warmup', durationMin: 10, zone: 1, description: 'Locker einrollen.' },
    { type: 'interval', durationMin: 4, reps: 4, restMin: 6, zone: 2, description: 'Kadenzfenster: locker schnell treten, Druck niedrig halten.' },
    { type: 'steady', durationMin: Math.max(10, duration - 10 - 4 * 4 - 6 * 3 - 10), zone: 2, description: 'Ruhig aerob fortsetzen.' },
    { type: 'cooldown', durationMin: 10, zone: 1, description: 'Locker ausrollen.' },
  ], duration);
}
```

Add equivalent helpers for:

- `long_endurance_fueling_practice`: steady Z2 with fueling prompts in descriptions.
- `threshold_cruise`: repeat groups, not loose text.
- `sweet_spot_builder`: Z3/Z4 mix, capped when capability is not high.
- `strength_prehab`: steady note block without fake Garmin intervals.

- [ ] **Step 2: Route archetype IDs to helpers**

Add a switch in `buildWorkoutLibrarySteps`:

```ts
if (archetype.id === 'endurance_cadence') return buildCadenceSteps(duration);
if (archetype.id === 'long_endurance_fueling_practice') return buildLongFuelingSteps(duration);
if (archetype.id === 'threshold_cruise') return buildThresholdCruiseSteps(duration);
```

- [ ] **Step 3: Test Garmin repeat readiness**

Add:

```ts
it('builds threshold cruise as Garmin-safe repeat groups', () => {
  const prescription = buildWorkoutLibraryPrescription({
    activityType: 'bike',
    zone: 4,
    durationMin: 75,
    targetTss: 88,
    preferredFamily: 'threshold',
  });

  expect(prescription.steps.some(step => step.type === 'interval' && (step.reps ?? 0) > 1)).toBe(true);
  expect(previewGarminSyncContract({ activityType: 'bike', zone: 4, durationMin: 75, description: prescription.description, steps: prescription.steps }).status).toBe('ready');
});
```

## Task 4: Feed Plan Engine And Today Options

- [ ] **Step 1: Preserve selected variants through the real plan-generation path**

Current weekly generation sets `archetypeId` in `backend/src/pulse/services/plan-engine.ts`, inserts workouts in `backend/src/pulse/routes/training-routes.ts`, and then calls `buildWorkoutSteps()` / `buildWorkoutLibraryPrescription()` from only activity, zone, duration and description. This plan must change that path so selected variants are not lost.

Implement one of these two approaches and document the choice in the PR body:

- Preferred: extend `WeekWorkout` and the insert/update helper so the selected `archetypeId`, `difficultyLevel`, `difficultyEnergySystem`, `capabilityFit`, generated `description` and `steps` are returned by the plan engine and stored directly.
- Acceptable: extend `buildWorkoutLibraryPrescription(input, capabilitySummary, { forcedArchetypeId })` and make `buildWorkoutSteps()` accept the persisted `archetypeId` when regenerating details.

Add a regression test in `backend/src/pulse/services/plan-engine.test.ts` proving generated weeks persist at least two different endurance-family archetypes across repeated weeks.

- [ ] **Step 2: Pass previous archetypes**

In `backend/src/pulse/services/plan-engine.ts`, collect the last 2-3 archetype IDs from the learning snapshot and pass them as `avoidRepeatArchetypeIds` when selecting the workout library variant.

- [ ] **Step 3: Pass goal limiter**

When `params.goalLimiter` exists, pass `goalLimiterKind: params.goalLimiter.kind` using the shared `PulseGoalLimiterKind` type.

- [ ] **Step 4: Pass Today Options into better variants**

In `today-options.ts`, use:

```ts
archetypeId: input.fueling.recentGiIssue ? 'long_endurance_fueling_practice' : 'endurance_cadence'
```

only when the suggested duration and activity type match; keep recovery days simple. Also specify how the selected `archetypeId` influences the created workout: Today Options must deep-link into scenario preview or create/update with the selected archetype preserved through the same generation path from Step 1.

- [ ] **Step 5: Surface variant purpose in Plan**

In `frontend/src/features/plan/training/training-components.tsx`, show archetype label and purpose near the existing fit label:

```tsx
{workout.archetypeId && <span className="chip">Archetyp: {formatArchetype(workout.archetypeId)}</span>}
```

Implement `formatArchetype` from a small frontend map in `frontend/src/pulse/activity-labels.ts` or extend the existing label helper if present.

- [ ] **Step 6: Verification**

Run:

```bash
npm test -w backend -- --run src/pulse/services/workout-library.test.ts src/pulse/services/plan-engine.test.ts src/pulse/services/today-options.test.ts
npm run build -w frontend
npm run test:e2e:smoke
```

Expected: PASS.

## Acceptance

- Repeated weeks can preserve purpose while changing structure.
- Sport changes regenerate description and Garmin-safe steps from the same library source.
- No proprietary workout content is imported or copied.
- Plan UI remains scannable and does not show full step details in every row.
