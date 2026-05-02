# Garmin Data Quality Control Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Settings and Data should clearly show which Garmin data domains are fresh, missing, partial or repairable.

**Architecture:** Extend the existing coverage/backfill work into a single read-only domain-quality contract from Pulse tables, sync metadata, circuit-breaker state and bounded backfill reasons. Repair actions must be bounded by domain/date and use existing Garmin sync routes; no broad live probing or credential changes by default. Rate limits, provider errors and local service issues should be represented as states instead of silent failures.

**Tech Stack:** Fastify, Drizzle/Postgres, React 19, TanStack Query, Vite, Playwright.

---

## File Map

| Type | Path | Purpose |
|---|---|---|
| Create | `backend/src/pulse/services/garmin-data-quality.ts` | Domain freshness, gaps and repair recommendation service |
| Create | `backend/src/pulse/services/garmin-data-quality.test.ts` | Pure/domain tests for freshness and missing reasons |
| Modify | `shared/types/pulse.ts` | Coverage response and domain status types |
| Modify | `backend/src/pulse/plugin.ts` | Extend existing coverage/backfill endpoints or add `/api/pulse/garmin/coverage` if a clearer contract is needed |
| Modify | `backend/src/routes/garmin.ts` | Preserve sync error domain details for coverage |
| Modify | `backend/src/jobs/garmin-sync.job.ts` | Surface circuit-breaker/rate-limit state for coverage |
| Modify | `frontend/src/pages/Settings.tsx` | Show sync quality by Garmin domain and safe repair actions |
| Modify | `frontend/src/pages/Data.tsx` | Show data gaps near affected data sections |
| Modify | `frontend/e2e/pulse-usability.spec.ts` | Coverage UI and repair-state browser tests |

## Task 1: Coverage Domain Model

- [ ] **Step 1: Write failing pure tests**

  Add `backend/src/pulse/services/garmin-data-quality.test.ts` for:
  - activities fresh within 24h;
  - sleep missing for the selected date range;
  - HRV partial but usable;
  - body composition stale;
  - provider/rate-limit/circuit-breaker error shown as `blocked`;
  - backfill candidate days are domain-specific, not always "all domains".

- [ ] **Step 2: Implement coverage service types**

  Use domains:

  ```ts
  export type GarminCoverageDomain =
    | 'activities'
    | 'daily_metrics'
    | 'sleep'
    | 'hrv'
    | 'body_composition'
    | 'planned_workouts'
    | 'calendar';

  export type GarminCoverageStatus = 'fresh' | 'partial' | 'missing' | 'stale' | 'blocked';
  ```

  The pure function should accept table-derived counts/timestamps and return one row per domain.

- [ ] **Step 3: Verify model**

  Run:

  ```bash
  npm test -w backend -- --run src/pulse/services/garmin-data-quality.test.ts
  npm run typecheck
  ```

## Task 2: API And Sync Error Surface

- [ ] **Step 1: Add shared response types**

  Add `PulseGarminCoverageDomainState` and `PulseGarminCoverageResponse` to `shared/types/pulse.ts`.

- [ ] **Step 2: Add or extend authenticated coverage endpoint**

  In `backend/src/pulse/plugin.ts`, prefer extending existing data coverage/backfill contracts when possible. Add `GET /api/pulse/garmin/coverage?days=30` only if it reduces frontend ambiguity. Query existing Pulse tables only; do not call Garmin live from a GET.

- [ ] **Step 3: Preserve bounded sync and circuit errors**

  If `syncGarminDay` already returns domain errors, map them into coverage states. If not, minimally normalize its result so the coverage endpoint can show `blocked` with a safe message. Include Redis circuit-breaker state from `garmin-sync.job.ts` when available.

- [ ] **Step 4: Verify backend**

  Run:

  ```bash
  npm test -w backend -- --run src/pulse/services/garmin-data-quality.test.ts src/pulse/plugin.test.ts
  npm run typecheck
  ```

## Task 3: Settings/Data UI

- [ ] **Step 1: Add client hook**

  Add `pulseApi.garmin.coverage()` and `useGarminCoverage()` using the existing client/hook pattern.

- [ ] **Step 2: Render domain cards in Settings**

  In `frontend/src/pages/Settings.tsx`, add a compact Garmin coverage section:
  - domain label;
  - status;
  - last fresh date;
  - missing reason;
  - safe repair CTA only for bounded domains.

- [ ] **Step 3: Add Data-page gap hints**

  In `frontend/src/pages/Data.tsx`, show relevant missing/partial state near Sleep, Mental and body composition areas without duplicating the full Settings panel.

- [ ] **Step 4: Add E2E coverage**

  Extend fixtures and add browser tests for fresh, stale and blocked domain states.

- [ ] **Step 5: Verify frontend**

  Run:

  ```bash
  npm run typecheck
  npm run test:e2e -- --grep "Garmin|coverage|Settings|Data"
  ```

## Acceptance

- Tobi can see which Garmin domains are trustworthy without logs.
- Safe repair actions are bounded by date/domain.
- Provider/rate-limit/local-service failures are visible states.
- Any real repair/backfill run remains deliberate and auditable; preview does not call Garmin.
- No data export, Telegram or public tunnel is introduced.
