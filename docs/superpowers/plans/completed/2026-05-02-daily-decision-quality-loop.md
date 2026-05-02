# Daily Decision Quality Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pulse should measure whether its daily recommendations actually helped, repeated themselves, or need to change strategy.

**Architecture:** Add a deterministic quality layer on top of existing action decisions, daily outcome learning, check-ins, plan traces and Garmin execution evidence. Keep this as a compact loop signal in Home/Coach/Insights, not a new dashboard.

**Tech Stack:** Fastify, Drizzle/Postgres, React 19, TanStack Query, Vite, Playwright.

---

## Context

Pulse can now close actions, learn from yesterday and show a season strategy. The next missing layer is quality control: did the repeated advice reduce fatigue, improve execution, increase check-in consistency, or become stale? This plan turns that into a traceable score and concrete adjustment signal.

## File Map

| Type | Path | Purpose |
|---|---|---|
| Create | `backend/src/pulse/services/daily-decision-quality.ts` | Pure quality evaluator for recent daily decisions |
| Create | `backend/src/pulse/services/daily-decision-quality.test.ts` | Tests for helpful, stale, repeated and risky decisions |
| Modify | `shared/types/pulse.ts` | Add `PulseDailyDecisionQualityResponse` |
| Modify | `backend/src/pulse/plugin.ts` | Add `GET /api/pulse/decisions/quality` |
| Modify | `frontend/src/pulse/api-client.ts` | Add client method |
| Modify | `frontend/src/pulse/hooks.ts` | Add query hook and invalidation after action decisions/check-ins/plan generation |
| Modify | `frontend/src/pages/Home.tsx` | Add compact daily quality strip near the daily decision |
| Modify | `frontend/src/pages/Coach.tsx` | Add context chip so Coach can acknowledge stale/repeated advice |
| Modify | `frontend/src/pages/Insights.tsx` | Add evidence card in the existing insights flow |
| Modify | `frontend/e2e/fixtures/pulse-api.ts` | Mock quality endpoint |
| Modify | `frontend/e2e/pulse-usability.spec.ts` | Browser coverage for quality signal visibility |

## Task 1: Quality Evaluator

- [ ] **Step 1: Write failing tests**

  Cover:
  - `helpful` when a recommendation was accepted and the next-day readiness/execution did not worsen.
  - `stale` when the same recommendation appears repeatedly without closure or outcome evidence.
  - `needs_strategy_change` when skipped workouts, high RPE and poor recovery repeat across multiple days.
  - `insufficient_evidence` when Garmin/check-in data is missing.

- [ ] **Step 2: Implement pure service**

  Inputs:
  - recent `pulse_action_decisions`;
  - daily outcome learning items;
  - mental check-ins;
  - planned/completed workout execution;
  - daily metrics.

  Outputs:
  - `qualityScore` 0-100;
  - `status: "helpful" | "watch" | "stale" | "needs_strategy_change" | "insufficient_evidence"`;
  - `repeatedThemes`;
  - `bestEvidence`;
  - `suggestedAdjustment` for Coach/Plan language.

- [ ] **Step 3: Verify service**

  ```bash
  npm test -w backend -- --run src/pulse/services/daily-decision-quality.test.ts
  npm run typecheck
  ```

## Task 2: API Integration

- [ ] **Step 1: Add shared contract**

  Add response types that preserve evidence links without exposing raw sensitive notes.

- [ ] **Step 2: Add endpoint**

  Add `GET /api/pulse/decisions/quality?days=14`. Reuse existing action/outcome/check-in queries where possible and keep the endpoint read-only.

- [ ] **Step 3: Feed Coach context**

  Include the quality status in Coach context generation so the Coach can say "we keep seeing X" without inventing memory.

- [ ] **Step 4: Verify backend**

  ```bash
  npm test -w backend -- --run src/pulse/services/daily-decision-quality.test.ts src/pulse/plugin.test.ts
  npm run typecheck
  ```

## Task 3: Daily Flow UI

- [ ] **Step 1: Add Home quality strip**

  Show one line:
  - current quality status;
  - strongest evidence;
  - suggested adjustment if status is stale or needs strategy change.

- [ ] **Step 2: Add Coach and Insights visibility**

  Coach should show the current status as a context chip. Insights should show a compact evidence card for the last 14 days.

- [ ] **Step 3: Add E2E coverage**

  ```bash
  npm run test:e2e -- --grep "Decision Quality|Entscheidungsqualität|Coach|Home|Insights"
  ```

## Acceptance

- Pulse can distinguish useful repetition from stale repetition.
- Coach can reference the quality status without hidden memory.
- Missing Garmin/check-in data is visible as low evidence quality, not silently treated as success or failure.
- The feature improves daily trust without adding a new top-level page.
