# Goal Race Command Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Plan should expose the current race/goal phase, next key workout, recovery boundary and risk impact in one preparation view.

**Architecture:** Reuse goals, `race-engine`, fitness load, health states, risk signals and plan trace. Keep this inside Plan unless a tested workflow proves it needs a standalone route. Race readiness must be computed from existing data and shown with provenance.

**Tech Stack:** Fastify, Drizzle/Postgres, React 19, TanStack Query, Vite, Playwright.

---

## Context

Race goals already store discipline, distance, target time, priority, location and notes. `race-engine.ts` derives phase/prognosis, `/api/pulse/races` already exists, Home has a `RaceCard`, and Plan already has goal creation/editing plus trace. The command center should make this existing intelligence visible in Plan rather than introduce a new dashboard.

## File Map

| Type | Path | Purpose |
|---|---|---|
| Create | `backend/src/pulse/services/race-command.ts` | Pure command-center summary from race/load/plan/risk context |
| Create | `backend/src/pulse/services/race-command.test.ts` | Phase, taper, risk and key-workout tests |
| Modify | `shared/types/pulse.ts` | Race command response types |
| Modify | `backend/src/pulse/services/race-engine.ts` | Export phase/prognosis helpers used by race command summary |
| Modify | `backend/src/pulse/plugin.ts` | Add `GET /api/pulse/race-command` |
| Modify | `frontend/src/pages/Plan.tsx` | Add command-center section to Plan |
| Modify | `frontend/src/pulse/api-client.ts` | Add race command client for the dedicated endpoint |
| Modify | `frontend/src/pulse/hooks.ts` | Add query hook and invalidation around goals/races |
| Modify | `frontend/e2e/pulse-usability.spec.ts` | Browser coverage for command center and mobile density |

## Task 1: Pure Race Command Summary

- [x] **Step 1: Write failing tests**

  Add `backend/src/pulse/services/race-command.test.ts` covering:
  - A-race in taper phase highlights next key workout and recovery boundary;
  - illness/critical risk lowers readiness state and explains impact;
  - missing race returns `null` summary so Plan stays uncluttered;
  - CTL/TSB values appear as evidence, not static copy.

- [x] **Step 2: Implement pure summary**

  Create a pure function `buildRaceCommandSummary(input)` returning:
  - `race`;
  - `phase`;
  - `readinessLabel`;
  - `nextKeyWorkout`;
  - `recoveryBoundary`;
  - `riskImpact`;
  - `evidence`.

- [x] **Step 3: Verify pure summary**

  Run:

  ```bash
  npm test -w backend -- --run src/pulse/services/race-command.test.ts
  npm run typecheck
  ```

## Task 2: API Integration

- [x] **Step 1: Add shared types**

  Add `PulseRaceCommandResponse` and related item types to `shared/types/pulse.ts`.

- [x] **Step 2: Add authenticated endpoint**

  In `backend/src/pulse/plugin.ts`, add `GET /api/pulse/race-command`. Fetch active race, fitness load, risk signals, health states and current/future planned workouts. Return `{ command: null }` when no active race exists.

- [x] **Step 3: Preserve race goal editing fields**

  Add regression coverage that editing an existing race goal preserves discipline, distance, target time, priority, location and race notes. Fix Plan goal editing only if the test shows drift.

- [x] **Step 4: Verify route**

  Run:

  ```bash
  npm test -w backend -- --run src/pulse/services/race-command.test.ts src/pulse/services/race-engine.test.ts src/pulse/plugin.test.ts
  npm run typecheck
  ```

## Task 3: Plan UI Integration

- [x] **Step 1: Add API client and hook**

  Add `pulseApi.raceCommand.get()` and `useRaceCommand()` following existing hooks.

- [x] **Step 2: Add Plan section**

  In `frontend/src/pages/Plan.tsx`, add a compact "Race Command" band near goals/trace:
  - race title and date;
  - phase and readiness;
  - next key workout;
  - recovery boundary;
  - risk impact with evidence.

- [x] **Step 3: Add E2E coverage**

  Extend `frontend/e2e/fixtures/pulse-api.ts` with a race command response and test visibility on desktop/mobile.

- [x] **Step 4: Verify frontend**

  Run:

  ```bash
  npm run typecheck
  npm run test:e2e -- --grep "Race|Plan|readiness"
  ```

## Acceptance

- Race preparation is visible inside Plan without creating another dashboard.
- Health-state/risk changes explain race-plan impact.
- Race readiness uses CTL/TSB/recovery evidence.
- Existing race goal fields remain editable and preserved.
- No native iOS or public hosting scope is introduced.

## Completion Notes

- Implemented on `codex/goal-race-command`.
- Verified pure service tests and shared/backend/frontend typecheck locally.
- Verified Plan/Race/readiness E2E coverage on desktop and mobile Chromium.
- `src/pulse/plugin.test.ts` could not run locally because Mac-local Postgres `5433` and Redis `6380` were not running; CI remains the authoritative route-suite gate.
