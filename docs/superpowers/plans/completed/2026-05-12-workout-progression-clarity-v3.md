# Workout Progression Clarity v3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Planned workouts should explain their progression role, calibration and repetition rationale so repeated-looking units feel intentional or clearly adjustable.

**Architecture:** Keep this slice frontend-first and read-only. Use existing `PulsePlannedWorkout` fields (`archetypeId`, `difficultyLevel`, `difficultyEnergySystem`, `capabilityFit`, `description`, `steps`) plus the current visible plan list; do not add a backend endpoint, migration, LLM call or Garmin write.

**Tech Stack:** React/Vite, TypeScript, shared Pulse types, node:test via `npm run test:frontend-logic`, Playwright smoke/usability checks.

---

## File Map

| Change | File | Responsibility |
|---|---|---|
| Create | `frontend/src/features/plan/workout-progression-model.ts` | Pure helper that turns a planned workout and sibling workouts into compact progression copy. |
| Modify | `frontend/src/pages/Plan.tsx` | Show a compact progression explanation in the next training decision before alternatives. |
| Modify | `frontend/src/features/plan/training/training-components.tsx` | Show a terse progression chip in scheduled workout rows without expanding density. |
| Test | `scripts/plan-workout-progression.test.ts` | Unit coverage for productive, maintenance/repeated and stretch cases. |
| Test | `frontend/e2e/pulse-smoke.spec.ts` | Smoke coverage that the next decision exposes progression clarity. |
| Test | `frontend/e2e/pulse-usability.spec.ts` | Usability coverage for repeated-looking workouts showing intentional repetition. |
| Docs | `docs/decisions.md`, `docs/ai/current-focus.md`, `docs/qa/2026-05-12-workout-progression-clarity-v3.md` | Decision, durable queue update and QA evidence. |

## Task 1: Pure Progression Model

**Files:**
- Create: `frontend/src/features/plan/workout-progression-model.ts`
- Test: `scripts/plan-workout-progression.test.ts`

- [ ] **Step 1: Write failing unit tests**

Create tests that cover:
- productive workout with a known archetype returns `role`, `calibration`, `repetition` and `changeTrigger`;
- maintenance workout repeated in the visible plan explains that repetition is intentional;
- stretch workout returns a caution-oriented change trigger.

Run:

```bash
npm run test:frontend-logic -- scripts/plan-workout-progression.test.ts
```

Expected before implementation: import/function failure.

- [ ] **Step 2: Implement the helper**

Export:

```ts
export interface WorkoutProgressionInsight {
  label: string;
  tone: 'green' | 'amber' | 'rose' | 'text';
  role: string;
  calibration: string;
  repetition: string;
  changeTrigger: string;
  evidence: string[];
}

export function buildWorkoutProgressionInsight(input: {
  workout: PulsePlannedWorkout;
  workouts: PulsePlannedWorkout[];
  today: string;
}): WorkoutProgressionInsight;
```

Implementation rules:
- use `workoutArchetypeCopy(workout.archetypeId)` when available;
- use `difficultyLevel` and `capabilityFit` for calibration copy;
- count planned workouts with the same `archetypeId` or same `difficultyEnergySystem`;
- treat `maintenance` and repeated low-intensity/endurance work as deliberate consolidation;
- treat `stretch` and `too_hard_today` as change-candidate states;
- keep copy German, concrete and short.

- [ ] **Step 3: Verify unit tests pass**

Run:

```bash
npm run test:frontend-logic -- scripts/plan-workout-progression.test.ts
```

Expected: new tests pass.

## Task 2: Plan UI Integration

**Files:**
- Modify: `frontend/src/pages/Plan.tsx`
- Modify: `frontend/src/features/plan/training/training-components.tsx`

- [ ] **Step 1: Pass sibling workout context**

Add a `workouts: PlannedWorkout[]` prop to `NextTrainingDecisionCard` and pass the current `workouts` from `TrainingTab`.

- [ ] **Step 2: Add next-decision progression card**

In `NextTrainingDecisionCard`, compute `buildWorkoutProgressionInsight({ workout: nextWorkout, workouts, today })` and render one compact card with `data-testid="plan-workout-progression"`:
- eyebrow `PROGRESSION`;
- headline from `label`;
- lines for `Rolle`, `Kalibrierung`, `Wiederholung`, `Ändern wenn`;
- max three evidence chips.

- [ ] **Step 3: Add scheduled-row progression chip**

In `WorkoutRow`, compute the same insight with the row workout and render one compact `data-testid="plan-workout-progression-row"` chip under existing rationale/body copy:
- label and repetition sentence only;
- keep it one small inline block so rows stay scannable.

## Task 3: Browser Coverage And QA

**Files:**
- Modify: `frontend/e2e/pulse-smoke.spec.ts`
- Modify: `frontend/e2e/pulse-usability.spec.ts`
- Create: `docs/qa/2026-05-12-workout-progression-clarity-v3.md`

- [ ] **Step 1: Add smoke assertion**

Add an assertion to an existing Plan smoke path or a new narrow test that `/plan` shows `plan-workout-progression` with `Rolle`, `Kalibrierung`, `Wiederholung` and `Ändern wenn`.

- [ ] **Step 2: Add repeated-workout usability assertion**

Mock at least two planned workouts with the same archetype or energy system and assert the UI says repetition is deliberate/consolidating rather than silently generic.

- [ ] **Step 3: Run focused verification**

Run:

```bash
npm run test:frontend-logic
npm run build -w frontend
npx playwright test frontend/e2e/pulse-smoke.spec.ts --project=desktop-chromium --project=mobile-chromium -g "progression|Plan starts with the current action contract" --workers=1
npx playwright test frontend/e2e/pulse-usability.spec.ts --project=desktop-chromium --project=mobile-chromium -g "progression|repeated" --workers=1
PULSE_ROUTE_EVIDENCE_DIR=/tmp/pulse-workout-progression-clarity npm run qa:ux-evidence
git diff --check
```

- [ ] **Step 4: Record QA**

Record commands, route-evidence folder and overflow summary in `docs/qa/2026-05-12-workout-progression-clarity-v3.md`.

## Acceptance

- Every visible next workout on `/plan` has a compact progression explanation.
- Repeated-looking workouts are explained as consolidation, maintenance or a change candidate.
- The slice is read-only and does not create plan, Garmin, database or LLM mutations.
- Focused unit, build, browser and route-evidence checks pass.
