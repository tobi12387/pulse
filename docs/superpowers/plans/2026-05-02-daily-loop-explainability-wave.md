# Daily Loop Explainability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pulse should make the daily recommendation loop auditable: why an action is shown, why another action is hidden, which data supports it, and what happened recently.

**Architecture:** Reuse the existing `pulse_action_decisions`, Next Best Actions, Insight evidence and PulseContext contracts. Do not add hidden coach memory; any learning signal must be visible as action history, evidence, preference or plan trace. New persistence is only allowed if existing action/evidence records cannot answer the question.

**Tech Stack:** Fastify, Drizzle/Postgres, React 19, TanStack Query, Vite, Playwright.

---

## Context

The Garmin execution, plan personalization, daily decision, insight evidence and decision-closure waves are implemented. The next gap is not another dashboard, but trust in why Pulse stays quiet or changes its recommendation. This matters especially after Tobi completes, defers or dismisses an action: Home, Coach, Push and Insights should explain the same state.

## File Map

| Type | Path | Purpose |
|---|---|---|
| Modify | `backend/src/pulse/services/next-best-actions.ts` | Return shown and suppressed action explanations from one place |
| Modify | `backend/src/pulse/services/decision-closure.ts` | Summarize recent decisions for UI and Coach context |
| Modify | `backend/src/pulse/plugin.ts` | Extend `/api/pulse/actions` with optional recent history and hidden reasons |
| Modify | `backend/src/pulse/lib/pulse-context.ts` | Feed compact action history into Coach/Briefing without hidden memory |
| Modify | `shared/types/pulse.ts` | Shared types for action visibility, recent history and evidence target links |
| Modify | `frontend/src/pulse/api-client.ts` | Client contract for action history and evidence targets |
| Modify | `frontend/src/pulse/hooks.ts` | Query and invalidation helpers |
| Modify | `frontend/src/pages/Home.tsx` | Show compact daily-loop status and recent action history |
| Modify | `frontend/src/pages/Coach.tsx` | Let Coach reference visible action history before suggesting follow-up |
| Modify | `frontend/src/pages/Insights.tsx` | Add source links for evidence items where a route is known |
| Modify | `frontend/e2e/pulse-usability.spec.ts` | Browser flow for action closure, hidden reason and evidence navigation |

## Task 1: Action Visibility Contract

- [x] **Step 1: Write backend tests for hidden reasons**

  Add tests in `backend/src/pulse/services/next-best-actions.test.ts` proving:
  - a completed check-in action is suppressed with reason `already_completed_today`;
  - a deferred workout decision is suppressed until the deferral window expires;
  - a Garmin-matched workout action is suppressed with reason `resolved_by_activity`;
  - visible actions still include `source`, `kind`, `targetRoute`, `evidence` and `priority`.

  Run:

  ```bash
  cd backend
  set -a; source ../.env.test.example; set +a
  npm test -- --run src/pulse/services/next-best-actions.test.ts
  ```

- [x] **Step 2: Extend the pure service output**

  Add a small exported type next to the existing next-best-action type:

  ```ts
  export type SuppressedActionReason =
    | 'already_completed_today'
    | 'deferred'
    | 'dismissed'
    | 'resolved_by_activity'
    | 'stale';

  export type ActionVisibilitySummary = {
    visible: NextBestAction[];
    suppressed: Array<NextBestAction & {
      suppressedReason: SuppressedActionReason;
      suppressedUntil?: string | null;
    }>;
  };
  ```

  Keep the existing action list behavior compatible by returning `visible` to old callers.

- [x] **Step 3: Add `/api/pulse/actions` history mode**

  Extend `GET /api/pulse/actions?includeHistory=true` so it returns:
  - `actions`: current visible actions;
  - `suppressed`: compact hidden actions with human-readable reason;
  - `recentDecisions`: latest resolved/deferred/dismissed action decisions for the last 14 days.

  The default response without `includeHistory=true` remains compatible.

- [x] **Step 4: Verify and commit**

  ```bash
  npm run typecheck
  cd backend
  set -a; source ../.env.test.example; set +a
  npm test -- --run src/pulse/services/next-best-actions.test.ts src/pulse/services/decision-closure.test.ts src/pulse/plugin.test.ts
  git add backend/src/pulse/services/next-best-actions.ts backend/src/pulse/services/next-best-actions.test.ts backend/src/pulse/services/decision-closure.ts backend/src/pulse/services/decision-closure.test.ts backend/src/pulse/plugin.ts shared/types/pulse.ts
  git commit -m "feat: explain daily action visibility"
  ```

## Task 2: Home And Coach Action History

- [x] **Step 1: Add frontend contract tests or E2E fixtures**

  Extend `frontend/e2e/fixtures/pulse-api.ts` with one visible action, one completed action and one deferred action. The fixture should include the same `decisionId` shape already used by Home and Coach.

- [x] **Step 2: Add compact Home state**

  Home should show:
  - the primary action as it does today;
  - a compact "Zuletzt im Loop" section with the latest completed/deferred/dismissed item;
  - a short hidden reason only when there are no visible actions or when the hidden action explains repeated nudges.

  Avoid a large timeline. This is a trust aid, not a new task manager.

- [x] **Step 3: Add Coach context strip**

  Coach should show the same latest action state before the input area:
  - `Erledigt`, `Verschoben`, `Verworfen` or `Keine offene Aktion`;
  - one sentence explaining what the Coach will consider.

  The Coach must not auto-send a message.

- [x] **Step 4: Verify and commit**

  ```bash
  npm run typecheck
  npm run test:e2e -- --grep "daily action|Coach|hidden"
  git add frontend/src/pages/Home.tsx frontend/src/pages/Coach.tsx frontend/src/pulse/api-client.ts frontend/src/pulse/hooks.ts frontend/e2e/fixtures/pulse-api.ts frontend/e2e/pulse-usability.spec.ts
  git commit -m "feat: show daily loop history"
  ```

## Task 3: Insight Evidence Source Links

- [x] **Step 1: Add evidence target types**

  Extend the shared insight evidence item with:

  ```ts
  targetRoute?: '/data' | '/plan' | '/insights' | `/activities/${number}`;
  targetLabel?: string;
  ```

  Known mappings:
  - Sleep, HRV, recovery, stress, Body Battery -> `/data`;
  - Fitness Load, planned workouts, execution state -> `/plan`;
  - Activity-specific evidence with an activity id -> `/activities/:id`;
  - Mental check-ins and themes -> `/data`.

- [x] **Step 2: Update insight engine evidence builders**

  Add route targets inside `backend/src/pulse/services/insight-engine.ts` where the source domain is unambiguous. If a source cannot be routed confidently, leave `targetRoute` unset.

- [x] **Step 3: Render source links safely**

  In `frontend/src/pages/Insights.tsx`, render evidence items with a route link only when `targetRoute` is present. Preserve current labels and do not expose raw provider payloads.

- [x] **Step 4: Verify and commit**

  ```bash
  npm run typecheck
  cd backend
  set -a; source ../.env.test.example; set +a
  npm test -- --run src/pulse/services/insight-engine.test.ts
  cd ..
  npm run test:e2e -- --grep "Insights|Datenbasis"
  git add backend/src/pulse/services/insight-engine.ts backend/src/pulse/services/insight-engine.test.ts shared/types/pulse.ts frontend/src/pages/Insights.tsx frontend/src/pulse/api-client.ts frontend/e2e/pulse-usability.spec.ts
  git commit -m "feat: link insight evidence to source routes"
  ```

## Task 4: Daily Briefing Regression Guard

- [x] **Step 1: Add tests for today-only prompts**

  Extend `backend/src/jobs/briefing-generation.job.test.ts` and `backend/src/pulse/services/coach-engine.test.ts` so rest-day output cannot ask whether Tobi wants to do a workout planned for a future date.

- [x] **Step 2: Include action history in prompt context**

  Feed the compact action-history summary from Task 1 into briefing and coach context. Keep it factual:
  - latest completed/deferred/dismissed action;
  - no future workout as today's decision;
  - no hidden psychological inference.

- [x] **Step 3: Verify and commit**

  ```bash
  npm run typecheck
  cd backend
  set -a; source ../.env.test.example; set +a
  npm test -- --run src/jobs/briefing-generation.job.test.ts src/pulse/services/coach-engine.test.ts
  git add backend/src/jobs/briefing-generation.job.ts backend/src/jobs/briefing-generation.job.test.ts backend/src/pulse/services/coach-engine.ts backend/src/pulse/services/coach-engine.test.ts backend/src/pulse/lib/pulse-context.ts
  git commit -m "test: guard daily loop briefing context"
  ```

## Acceptance

- Home and Coach explain the same daily action state.
- Completed/deferred/dismissed actions do not reappear without a visible reason.
- Insights can deep-link to Data/Plan/Activity source routes when the route is unambiguous.
- Rest days never frame a future workout as today's training decision.
- No hidden memory, Telegram, data export or habit tracker is introduced.

## Implementation Notes

- Local verification passed for `npm run typecheck`, focused pure backend tests and focused Playwright E2E.
- Daily check-in action decisions are date-scoped so yesterday's completed check-in cannot hide today's missing check-in.
- `/api/pulse/actions?includeHistory=true` limits recent resolved decisions to the last 14 days.
- DB-bound tests in `backend/src/pulse/plugin.test.ts` and `backend/src/jobs/briefing-generation.job.test.ts` require local Postgres/Redis on ports 5433/6380. On the Mac workspace they were blocked because Docker Desktop is not running; CI remains the DB-bound verification gate.
