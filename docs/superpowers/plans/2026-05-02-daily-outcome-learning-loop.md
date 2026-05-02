# Daily Outcome Learning Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pulse should learn from yesterday's recommendations and real outcomes so daily actions become less repetitive and more useful over time.

**Architecture:** Reuse `pulse_action_decisions`, planned workouts, matched Garmin activities, Daily Check-in and PulseContext. Start as a derived read-only learning layer with no new persistence table and no hidden LLM memory. LLM summaries may consume the output later, but the learning signal itself must be deterministic and testable.

**Tech Stack:** Fastify, Drizzle/Postgres, React 19, TanStack Query, Vite, Playwright.

---

## Context

Action Closure already knows whether a recommendation was completed, deferred or dismissed. Adaptive Training v2 knows whether planned workouts were matched, missed or replaced. The remaining gap is that Pulse does not yet show or reuse the outcome: "Did yesterday's recommendation actually help today's plan?"

## File Map

| Type | Path | Purpose |
|---|---|---|
| Create | `backend/src/pulse/services/daily-outcome-learning.ts` | Pure outcome correlation from action decisions, check-ins, workouts and metrics |
| Create | `backend/src/pulse/services/daily-outcome-learning.test.ts` | Red/green tests for completed, stale, repeated and insufficient-evidence outcomes |
| Modify | `shared/types/pulse.ts` | `PulseDailyOutcomeLearningResponse` types |
| Modify | `backend/src/pulse/plugin.ts` | Add `GET /api/pulse/outcomes/daily?days=14` |
| Modify | `frontend/src/pulse/api-client.ts` | Add outcome-learning client |
| Modify | `frontend/src/pulse/hooks.ts` | Add query hook and invalidate after action/check-in/workout mutations |
| Modify | `frontend/src/pages/Home.tsx` | Show compact learning signal near daily action |
| Modify | `frontend/src/pages/Coach.tsx` | Include last outcome signal before starting a recommendation conversation |
| Modify | `frontend/e2e/fixtures/pulse-api.ts` | Mock outcome endpoint |
| Modify | `frontend/e2e/pulse-usability.spec.ts` | Browser coverage for outcome visibility and empty state |

## Task 1: Pure Outcome Correlation

- [ ] **Step 1: Write failing tests**

  Add tests in `backend/src/pulse/services/daily-outcome-learning.test.ts` covering:
  - completed check-in action followed by same-day check-in becomes `reinforced`;
  - dismissed workout action with a completed Garmin activity becomes `superseded_by_data`;
  - repeated deferred action over three days becomes `stale_pattern`;
  - missing follow-up data becomes `insufficient_evidence`.

- [ ] **Step 2: Implement pure service**

  Create `buildDailyOutcomeLearning(input)` returning:
  - `date`;
  - `status: reinforced | superseded_by_data | stale_pattern | insufficient_evidence`;
  - `title`;
  - `reason`;
  - `evidence`;
  - `suggestedAdjustment` for Coach/Briefing wording.

- [ ] **Step 3: Verify pure service**

  ```bash
  npm test -w backend -- --run src/pulse/services/daily-outcome-learning.test.ts
  npm run typecheck
  ```

## Task 2: API Contract

- [ ] **Step 1: Add shared types**

  Add `PulseDailyOutcomeLearningItem` and `PulseDailyOutcomeLearningResponse` to `shared/types/pulse.ts`.

- [ ] **Step 2: Add authenticated endpoint**

  Add `GET /api/pulse/outcomes/daily?days=14` in `backend/src/pulse/plugin.ts`. Fetch recent action decisions, planned workouts, completed activities and check-ins for the authenticated user, then return a newest-first list.

- [ ] **Step 3: Verify route integration**

  ```bash
  npm test -w backend -- --run src/pulse/services/daily-outcome-learning.test.ts src/pulse/plugin.test.ts
  npm run typecheck
  ```

## Task 3: Daily UI Integration

- [ ] **Step 1: Add client and hook**

  Add `pulseApi.outcomes.daily(days)` and `useDailyOutcomeLearning(days = 7)`.

- [ ] **Step 2: Show Home learning signal**

  In `frontend/src/pages/Home.tsx`, add a compact "Gelernt aus gestern" row near the daily action. Hide the block when the API returns no items.

- [ ] **Step 3: Show Coach context signal**

  In `frontend/src/pages/Coach.tsx`, show the newest outcome above suggested starter questions so repeated advice has a visible reason or correction.

- [ ] **Step 4: Add browser coverage**

  Extend `frontend/e2e/fixtures/pulse-api.ts` and `frontend/e2e/pulse-usability.spec.ts` to verify the signal on Home and Coach for desktop and mobile.

- [ ] **Step 5: Verify frontend**

  ```bash
  npm run typecheck
  npm run test:e2e -- --grep "Outcome|Gelernt|Coach|Home"
  ```

## Acceptance

- Pulse can explain what it learned from the previous day's recommendation.
- Completed, dismissed and superseded actions lead to different visible outcomes.
- Coach and Home stop presenting stale repeated advice without provenance.
- No hidden LLM memory and no new persistence table are introduced in v1.
