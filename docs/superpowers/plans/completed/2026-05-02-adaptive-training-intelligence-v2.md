# Adaptive Training Intelligence v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Plan generation should adapt from executed workouts, missed sessions, RPE, recovery and preferences while explaining why stable weeks are intentional.

**Architecture:** Add a deterministic execution-review layer before LLM narration and feed it into the existing `plan-learning.ts`, `plan-engine.ts` and `plan-trace.ts` path. Reuse `pulse_planned_workouts`, `pulse_activities`, workout reconciliation, RPE, recovery, preferences and plan trace; do not add a new plan-memory table unless existing trace/learning data cannot represent the signal. LLM text may summarize decisions, but the adaptation decision must be inspectable in `PulsePlanTrace`.

**Tech Stack:** Fastify, Drizzle/Postgres, React 19, TanStack Query, Vite, Playwright, shared Pulse types.

---

## Context

Current planning already uses weekly availability, goals, risk signals, health states, recent RPE, coach preferences, Garmin workout sync and `PulsePlanLearningSnapshot`. Existing files already cover parts of the loop: `plan-learning.ts` summarizes previous traces, `workout-reconciliation.ts` derives execution state, and `adapt-engine.ts` handles same-day adjustments. The gap is that repeated-looking weeks are not always explained, missed/replaced workouts do not produce a clearly visible next-week adjustment, and free days still look like absence rather than a deliberate training decision.

## File Map

| Type | Path | Purpose |
|---|---|---|
| Create | `backend/src/pulse/services/training-execution-review.ts` | Pure execution review from planned vs executed training |
| Create | `backend/src/pulse/services/training-execution-review.test.ts` | Red/green tests for divergence, missed sessions, RPE and rest-day rationale |
| Modify | `shared/types/pulse.ts` | Add trace types for adaptation rationale and deliberate rest days |
| Modify | `backend/src/pulse/services/plan-learning.ts` | Include execution-review facts in the existing learning snapshot |
| Modify | `backend/src/pulse/services/plan-trace.ts` | Persist optional execution review/rest-day rationale in trace JSON |
| Modify | `backend/src/pulse/services/plan-engine.ts` | Consume adaptation summary when choosing days, sport mix, intensity and generated summary |
| Modify | `backend/src/pulse/services/workout-reconciliation.ts` | Export match deltas used by execution review |
| Modify | `backend/src/pulse/plugin.ts` | Fetch previous plan/execution context and persist adaptation rationale in plan trace |
| Modify | `frontend/src/pages/Plan.tsx` | Show "Warum diese Woche?" and deliberate rest-day reasoning |
| Modify | `frontend/e2e/pulse-usability.spec.ts` | Browser coverage for visible adaptation rationale |

## Task 1: Pure Execution Divergence Model

- [x] **Step 1: Write failing tests for plan-vs-execution divergence**

  Add `backend/src/pulse/services/training-execution-review.test.ts` with cases for:
  - completed workout within tolerance -> `matched`;
  - missed planned workout -> `missed`;
  - replacement activity on same day -> `replaced`;
  - high RPE or soreness after hard day -> `reduce_next_intensity`;
  - stable execution and good recovery -> `maintain_structure`.

  Run:

  ```bash
  npm test -w backend -- --run src/pulse/services/training-execution-review.test.ts
  ```

  Expected: fail because `training-execution-review.ts` does not exist.

- [x] **Step 2: Implement the pure service**

  Create `backend/src/pulse/services/training-execution-review.ts` with exported types:

  ```ts
  export type TrainingExecutionReviewSignal =
    | 'matched'
    | 'missed'
    | 'replaced'
    | 'reduce_next_intensity'
    | 'maintain_structure'
    | 'protect_recovery';

  export interface TrainingExecutionReview {
    signals: TrainingExecutionReviewSignal[];
    learnedFromLastWeek: string[];
    variationComparedToLastWeek: string[];
    restDayRationale: Array<{ date: string; reason: string }>;
    recommendedHardDayAvoidance: number[];
    intents: Array<'repeat' | 'reduce' | 'rotate' | 'rest' | 'stable'>;
  }
  ```

  Keep it pure: input arrays in, summary out, no DB and no LLM.

- [x] **Step 3: Verify the pure service**

  Run:

  ```bash
  npm test -w backend -- --run src/pulse/services/training-execution-review.test.ts
  npm run typecheck
  ```

## Task 2: Feed Adaptation Into Plan Generation

- [x] **Step 1: Write failing plan-engine tests**

  Extend `backend/src/pulse/services/plan-engine.test.ts` to prove:
  - a missed hard workout reduces or relocates the next hard day when recovery is not strong;
  - a completed stable week may intentionally keep a similar structure and says why;
  - deliberate rest days are represented in generated summary.

- [x] **Step 2: Wire execution review into learning, `generateWeekWorkouts` and trace**

  Add optional execution review to the existing plan input path and `PulsePlanLearningSnapshot`. Use it to:
  - avoid hard-day offsets returned by `recommendedHardDayAvoidance`;
  - append adaptation lines to `generatedSummary`;
  - add rest-day rationale to the plan trace.

- [x] **Step 3: Fetch required context in `/api/pulse/plan/generate`**

  In `backend/src/pulse/plugin.ts`, gather:
  - previous week planned workouts;
  - recent Garmin activities already used for reconciliation;
  - recent RPE and soreness;
  - current recovery/load.

  Pass the pure `TrainingExecutionReview` into plan learning, plan generation and plan trace.

- [x] **Step 4: Protect historical execution evidence during regeneration**

  In `backend/src/pulse/plugin.ts`, review the regeneration path that deletes future `status = planned` rows from `weekStart` forward. Preserve past same-week planned rows that are needed to derive missed/replaced evidence before deleting or replacing future work.

- [x] **Step 5: Verify backend behavior**

  Run:

  ```bash
  npm test -w backend -- --run src/pulse/services/training-execution-review.test.ts src/pulse/services/plan-learning.test.ts src/pulse/services/plan-engine.test.ts src/pulse/services/plan-trace.test.ts src/pulse/plugin.test.ts
  npm run typecheck
  ```

  If local Postgres/Redis are unavailable, record the blocker and rely on CI for `plugin.test.ts`.

## Task 3: Make Rest Days And Stability Visible

- [x] **Step 1: Extend shared trace types**

  Add optional `adaptation` and `restDayRationale` fields to `PulsePlanTrace` in `shared/types/pulse.ts`. Keep fields optional for old traces.

- [x] **Step 2: Add Plan UI rationale**

  In `frontend/src/pages/Plan.tsx`, add a compact section in `PlanTraceCard`:
  - "Gelernt aus Ausführung";
  - "Warum ähnlich/anders";
  - "Freie Tage bewusst".

  Keep it inside the existing Plan trace area, not as a new dashboard.

- [x] **Step 3: Add E2E coverage**

  Extend `frontend/e2e/fixtures/pulse-api.ts` with adaptation trace fields and add a Playwright assertion in `frontend/e2e/pulse-usability.spec.ts` that the rationale is visible and does not overflow on mobile.

- [x] **Step 4: Verify frontend**

  Run:

  ```bash
  npm run typecheck
  npm run test:e2e -- --grep "Plan|rationale|Freie Tage"
  ```

## Acceptance

- Plan generation can explain whether a similar week is deliberate or a fallback.
- Missed/replaced workouts influence the next week only when recovery/RPE/load supports the change.
- Free days are visible training decisions with rationale.
- Existing Garmin sync and workout scheduling behavior remains unchanged unless the generated plan itself changes.

## Implementation Notes

- Implemented in branch `codex/adaptive-training-v2`.
- Execution review is pure and deterministic in `training-execution-review.ts`; it reuses the existing reconciliation scorer and adds no table.
- `/api/pulse/plan/generate` and availability regeneration fetch previous-week planned workouts before deleting future planned rows, then pass the review into day selection, plan generation and trace persistence.
- Same-week historical evidence is preserved by replacing only planned rows from today onward when the requested week has already started; preserved rows stay in the returned trace, plan decision and response.
- Stable-week rationale is reachable in real generation by passing previous-week availability and current load-derived recovery into the execution review.
- Garmin orphan cleanup uses the same replacement cutoff so mid-week regeneration does not touch preserved past same-week schedules.
- Verification completed: focused backend service tests, `npm run typecheck`, and focused Playwright Plan rationale tests on desktop/mobile. `plugin.test.ts` remains a local Docker/Postgres/Redis-gated suite; local services were blocked because Docker Desktop is not running.
