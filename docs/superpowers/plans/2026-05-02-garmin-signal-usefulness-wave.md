# Garmin Signal Usefulness Wave Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pulse should show which Garmin signals are already useful, which are available but underused, and which should influence daily decisions next.

**Architecture:** Build a read-only signal inventory from existing Pulse tables and preserved Garmin raw/detail payloads. Do not call Garmin live from page loads. Convert signals into ranked product use cases before adding new sync scope.

**Tech Stack:** Fastify, Drizzle/Postgres, React 19, TanStack Query, Vite, Playwright.

---

## Context

Pulse already stores and uses many Garmin-derived values: daily metrics, HRV, sleep, body battery, stress, respiration, SpO2, activity summaries, HR zones, laps, raw detail payloads, weight and profile provenance. The next value step is not "collect everything"; it is deciding which available signals should affect daily planning, recovery guidance, mental load, Race Command and Season Strategy.

## File Map

| Type | Path | Purpose |
|---|---|---|
| Create | `backend/src/pulse/services/garmin-signal-usefulness.ts` | Pure service that ranks used, underused and missing Garmin signal groups |
| Create | `backend/src/pulse/services/garmin-signal-usefulness.test.ts` | Tests for prioritization, missing data and no-live-Garmin behavior |
| Modify | `shared/types/pulse.ts` | Add `PulseGarminSignalUsefulnessResponse` contract |
| Modify | `backend/src/pulse/plugin.ts` | Add `GET /api/pulse/garmin/signal-usefulness` |
| Modify | `frontend/src/pulse/api-client.ts` | Add client method |
| Modify | `frontend/src/pulse/hooks.ts` | Add query hook and invalidation after Garmin sync/backfill |
| Modify | `frontend/src/pages/Data.tsx` | Add compact "Signalnutzen" section in the Garmin/data quality area |
| Modify | `frontend/src/pages/Settings.tsx` | Add small diagnostics link or summary if Data is not the current route |
| Modify | `frontend/e2e/fixtures/pulse-api.ts` | Mock signal usefulness endpoint |
| Modify | `frontend/e2e/pulse-usability.spec.ts` | Browser coverage for underused-signal visibility |

## Task 1: Signal Inventory Contract

- [ ] **Step 1: Write service tests**

  Cover:
  - Body Battery, stress duration, respiration and SpO2 are ranked as underused when present in metrics but absent from daily decision evidence.
  - HR zones/laps are ranked for workout execution quality when activity detail cache exists.
  - Missing domains become `missing_or_sparse`, not errors.
  - The service accepts rows/payload summaries and never calls Garmin.

- [ ] **Step 2: Implement pure service**

  Return signal groups:
  - `alreadyUsed`: sleep, HRV, CTL/ATL/TSB, planned/completed workouts, check-ins;
  - `underused`: body battery charge/drain, stress duration, respiration, SpO2, HR zones/laps, weather-detail pairing;
  - `missingOrSparse`: domains below coverage thresholds;
  - `recommendedUseCases`: daily decision, plan generation, recovery note, race readiness, mental load context.

- [ ] **Step 3: Verify service**

  ```bash
  npm test -w backend -- --run src/pulse/services/garmin-signal-usefulness.test.ts
  npm run typecheck
  ```

## Task 2: API and Data UI

- [ ] **Step 1: Add shared response types**

  Add compact item types with:
  - `signalKey`;
  - `label`;
  - `status: "used" | "underused" | "missing_or_sparse"`;
  - `coverageDays`;
  - `currentConsumers`;
  - `recommendedNextConsumer`;
  - `whyItMatters`.

- [ ] **Step 2: Add endpoint**

  Add `GET /api/pulse/garmin/signal-usefulness?days=30`. It should read Pulse tables only and reuse existing coverage helpers where possible.

- [ ] **Step 3: Add UI**

  In Data, show:
  - top 3 underused signals;
  - which Pulse flow would benefit;
  - whether data is already present or needs repair/backfill.

- [ ] **Step 4: Verify browser behavior**

  ```bash
  npm run typecheck
  npm run test:e2e -- --grep "Garmin|Signalnutzen|Data"
  ```

## Task 3: Roadmap Feedback Loop

- [ ] **Step 1: Update future roadmap**

  After implementation, move this plan to `completed/` and update `2026-05-02-future-direction-roadmap.md` with the next highest-value signal integration.

- [ ] **Step 2: Add decision entry**

  Persist whether the first integration target is Daily Decision, Plan Generation, Recovery Note or Race Readiness.

## Acceptance

- Pulse can explain which Garmin data is already used and which is valuable but not yet wired into decisions.
- No page load performs live Garmin API probing.
- Underused signals are ranked by daily value, not by raw data novelty.
- The next Garmin implementation can start from evidence instead of another broad API audit.
