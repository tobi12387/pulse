# Season Strategy Planner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pulse should translate goals and races into a season-level strategy so weekly plans are purposeful instead of repeatedly filling every available day.

**Architecture:** Build a deterministic season projection from active goals, RaceContext, fitness load, availability and coach preferences. The first implementation is read-only plus plan-generation guidance: no new top-level frontend route, no native iOS scope and no public hosting. Weekly plan generation may consume the strategy as guardrails, but the strategy remains inspectable in Plan.

**Tech Stack:** Fastify, Drizzle/Postgres, React 19, TanStack Query, Vite, Playwright.

---

## Context

Race Command explains the current race phase and next key workout. Adaptive Training v2 explains the current week. The missing middle layer is the 8-16 week strategy: target weeks, deload weeks, specificity progression and when an available day should intentionally stay free.

## File Map

| Type | Path | Purpose |
|---|---|---|
| Create | `backend/src/pulse/services/season-strategy.ts` | Pure 8-16 week strategy projection |
| Create | `backend/src/pulse/services/season-strategy.test.ts` | Tests for phase progression, deload boundaries and free-day discipline |
| Modify | `shared/types/pulse.ts` | `PulseSeasonStrategyResponse` and guardrail types |
| Modify | `backend/src/pulse/plugin.ts` | Add `GET /api/pulse/season-strategy` |
| Modify | `backend/src/pulse/services/plan-engine.ts` | Consume strategy guardrails when generating a week |
| Modify | `backend/src/pulse/services/plan-trace.ts` or plan-trace mapping in `backend/src/pulse/plugin.ts` | Surface season guardrails in trace |
| Modify | `frontend/src/pulse/api-client.ts` | Add season-strategy client |
| Modify | `frontend/src/pulse/hooks.ts` | Add query hook and invalidation after goals, races, availability and plan generation |
| Modify | `frontend/src/pages/Plan.tsx` | Add compact season line near Race Command and Plan Trace |
| Modify | `frontend/e2e/fixtures/pulse-api.ts` | Mock season strategy endpoint |
| Modify | `frontend/e2e/pulse-usability.spec.ts` | Browser coverage for strategy visibility and guardrails |

## Task 1: Pure Season Strategy

- [ ] **Step 1: Write failing tests**

  Add `backend/src/pulse/services/season-strategy.test.ts` covering:
  - A-race 10 weeks away yields build, peak, taper and race-week blocks;
  - negative TSB and high recent load mark the next week as consolidation;
  - availability with six open days still produces intentional free days;
  - no active race falls back to maintenance strategy.

- [ ] **Step 2: Implement pure service**

  Create `buildSeasonStrategy(input)` returning:
  - `horizonWeeks`;
  - `primaryGoal`;
  - `currentBlock`;
  - `upcomingBlocks`;
  - `guardrails` with max hard days, target sessions, deload and free-day rationale;
  - `evidence`.

- [ ] **Step 3: Verify pure service**

  ```bash
  npm test -w backend -- --run src/pulse/services/season-strategy.test.ts
  npm run typecheck
  ```

## Task 2: API and Plan Generation Guardrails

- [ ] **Step 1: Add shared contract**

  Add `PulseSeasonStrategy`, `PulseSeasonStrategyGuardrails` and `PulseSeasonStrategyResponse` to `shared/types/pulse.ts`.

- [ ] **Step 2: Add endpoint**

  Add `GET /api/pulse/season-strategy` in `backend/src/pulse/plugin.ts`. Reuse active races, goals, fitness load, availability and coach preferences. Return a maintenance strategy when no race exists.

- [ ] **Step 3: Feed guardrails into weekly plan generation**

  In `backend/src/pulse/services/plan-engine.ts`, use the strategy guardrails to cap hard days, avoid filling every available day and record deliberate free-day rationale. Preserve existing health-state and risk constraints as stronger rules.

- [ ] **Step 4: Verify backend**

  ```bash
  npm test -w backend -- --run src/pulse/services/season-strategy.test.ts src/pulse/services/plan-engine.test.ts src/pulse/plugin.test.ts
  npm run typecheck
  ```

## Task 3: Plan UI Integration

- [ ] **Step 1: Add client and hook**

  Add `pulseApi.seasonStrategy.get()` and `useSeasonStrategy()`.

- [ ] **Step 2: Add Plan season line**

  In `frontend/src/pages/Plan.tsx`, render a compact "Saisonlinie" near Race Command:
  - current block;
  - next deload or taper boundary;
  - max hard days;
  - why available days may stay free;
  - evidence chips.

- [ ] **Step 3: Add E2E coverage**

  Extend fixture and tests so desktop and mobile Plan show the season line, and a six-day availability mock still surfaces intentional free-day rationale.

- [ ] **Step 4: Verify frontend**

  ```bash
  npm run typecheck
  npm run test:e2e -- --grep "Saison|Season|Plan|free"
  ```

## Acceptance

- Weekly plans can be traced to a visible season strategy.
- Available days are not automatically treated as required training days.
- Deload, taper and free-day decisions are visible before LLM narration.
- The feature remains inside Plan and does not introduce a separate dashboard.
