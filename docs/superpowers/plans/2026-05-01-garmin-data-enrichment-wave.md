# Garmin Data Enrichment & Execution Wave Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pulse preserves richer Garmin data, closes planned-vs-executed workout reconciliation, and uses recovery/execution signals to explain daily training decisions.

**Architecture:** Keep GitHub `main` as source of truth and keep the local server as deploy mirror. Garmin reads stay behind the existing Garmin client layer; Garmin writes remain limited to explicit workout/calendar sync flows. New persistence is additive-only and separates normalized fields from raw provider snapshots so detail fetches never overwrite summary data.

**Tech Stack:** Node 22, Fastify 5, Drizzle/Postgres, React 19, TanStack Query, Vite, Playwright.

---

## Context

Pulse currently syncs Garmin sleep, heart rate, daily summary, activities and weight through `backend/src/routes/garmin.ts`. The app already uses HRV, sleep, resting HR, Body Battery, stress, TSS, RPE, activity details, goals and health states. The gaps are not "no Garmin data" but incomplete preservation and insufficient execution semantics:

- `pulse_activities.rawData` can be overwritten by the activity detail route with `{ laps, hrZones }`, losing the original Garmin activity summary.
- `pulse_activity_streams` exists but is not filled by sync.
- Sleep stores duration and stages but not sleep windows, movement, respiration, HR during sleep, sleep stress, Body Battery during sleep, breathing disruption or Sleep Need.
- Daily metrics store a few values but not Body Battery charge/drain, stress distribution, intensity minutes, respiration or SpO2 presence.
- Planned workouts have Garmin IDs and completed activity IDs, but not a clear state model for "on Garmin", "scheduled", "done", "missed", "replaced" or "off-plan".

Garmin rate limiting was observed on 2026-05-01 after repeated read-only probes. Implementation must avoid broad repeated live probing and use fixtures/unit tests wherever possible.

## File Map

| Type | Path | Purpose |
|---|---|---|
| Modify | `backend/src/db/pulse-schema.ts` | Additive fields/tables for Garmin raw/detail snapshots and execution state |
| Create | `backend/src/db/migrations/00XX_garmin_data_enrichment.sql` | Additive migration only |
| Modify | `backend/src/routes/garmin.ts` | Normalize richer daily/sleep/activity fields during sync |
| Modify | `backend/src/lib/garmin-activities.ts` | Preserve activity summary raw data and expose richer mapping |
| Modify | `backend/src/pulse/plugin.ts` | Activity details, plan status endpoints, reconciliation contract |
| Modify | `backend/src/pulse/services/*` | Recovery, plan learning, evidence and risk use enriched signals |
| Modify | `shared/types/pulse.ts` | Shared contracts for execution state and enriched evidence |
| Modify | `frontend/src/pages/Plan.tsx` | Show planned/Garmin/executed/missed/replaced states |
| Modify | `frontend/src/pages/Data.tsx` | Show recovery depth/coverage without raw provider text |
| Modify | `frontend/src/pages/ActivityDetail.tsx` | Show execution evidence and preserved details |
| Modify | `frontend/e2e/fixtures/pulse-api.ts` | Add reconciliation and enriched data fixtures |
| Modify | `frontend/e2e/pulse-usability.spec.ts` | Cover Garmin execution and evidence states |

## Task 1: Preserve Garmin Raw Data And Detail Cache

**Files:**
- Modify: `backend/src/db/pulse-schema.ts`
- Create: `backend/src/db/migrations/00XX_garmin_raw_detail_cache.sql`
- Modify: `backend/src/lib/garmin-activities.ts`
- Modify: `backend/src/pulse/plugin.ts`
- Test: `backend/src/lib/garmin-activities.test.ts` or `backend/src/pulse/plugin.test.ts`

- [ ] **Step 1: Write failing tests**

Add tests proving that:

- `upsertGarminActivity()` stores the original activity summary raw snapshot.
- Fetching `/api/pulse/activities/:id` with splits/zones augments detail cache without replacing summary raw data.
- Existing rows with legacy `{ laps, hrZones }` rawData still render activity details.

Run:

```bash
cd backend
set -a; source ../.env.test.example; set +a; npm test -- --run src/lib/garmin-activities.test.ts src/pulse/plugin.test.ts
```

Expected before implementation: tests fail because detail fetch overwrites `rawData`.

- [ ] **Step 2: Add additive persistence**

Add one of these additive shapes:

- preferred: keep `pulse_activities.rawData` as provider summary snapshot and add `garminDetailData jsonb`, `garminLaps jsonb`, `garminHrZones jsonb`, `garminDetailSyncedAt timestamp`;
- acceptable alternative: create `pulse_activity_garmin_details` keyed by `activity_id`.

Migration rules: no `DROP`, no `NOT NULL` without `DEFAULT`.

- [ ] **Step 3: Update mapping and detail route**

`mapGarminActivityForPulse()` continues to write `rawData: a`. `/activities/:id` reads legacy detail data from `rawData` only as fallback, then writes the new detail cache fields/table.

- [ ] **Step 4: Verify**

Run:

```bash
npm run check:migrations
npm run typecheck
cd backend && set -a; source ../.env.test.example; set +a; npm test -- --run src/lib/garmin-activities.test.ts src/pulse/plugin.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/db/pulse-schema.ts backend/src/db/migrations/00XX_garmin_raw_detail_cache.sql backend/src/lib/garmin-activities.ts backend/src/pulse/plugin.ts backend/src/lib/garmin-activities.test.ts backend/src/pulse/plugin.test.ts
git commit -m "fix: preserve garmin raw activity details"
```

## Task 2: Garmin Execution Reconciliation

**Files:**
- Modify: `backend/src/db/pulse-schema.ts`
- Create: `backend/src/db/migrations/00XX_workout_execution_reconciliation.sql`
- Modify: `backend/src/routes/garmin.ts`
- Modify: `backend/src/pulse/plugin.ts`
- Modify: `shared/types/pulse.ts`
- Modify: `frontend/src/pages/Plan.tsx`
- Modify: `frontend/src/components/WorkoutDetailModal.tsx`
- Test: `backend/src/pulse/plugin.test.ts`, `frontend/e2e/pulse-usability.spec.ts`

- [ ] **Step 1: Write failing backend tests**

Cover these states:

- planned workout with no Garmin IDs => `local_planned`;
- `garminWorkoutId` but no schedule => `garmin_template`;
- `garminWorkoutId` and `garminScheduledId` => `garmin_scheduled`;
- completed activity matched to workout => `completed_matched`;
- future missed cutoff after planned date with no activity => `missed`;
- completed same-day activity that differs from planned type or is unmatched => `replaced_or_off_plan`.

- [ ] **Step 2: Add additive execution state fields**

Add nullable fields such as `executionStatus`, `executionMatchedAt`, `executionMatchConfidence`, `executionNotes`, and keep `completedActivityId` as canonical activity link. Do not remove existing `status`.

- [ ] **Step 3: Build reconciliation service**

Create a focused helper, for example `backend/src/pulse/services/workout-reconciliation.ts`, with pure functions:

- `deriveWorkoutExecutionState(workout, calendarItem?, activity?)`
- `scoreActivityWorkoutMatch(workout, activity)`
- `summarizeExecutionState(state)`

Keep Garmin API calls in routes/jobs; keep pure matching logic testable without Garmin.

- [ ] **Step 4: Update sync and UI contracts**

After activity sync, reconcile planned workouts for the day. `/api/pulse/plan` returns the derived execution state and a short explanation. Plan UI shows compact labels: `Lokal`, `Garmin`, `Kalender`, `Erledigt`, `Verpasst`, `Ersetzt`.

- [ ] **Step 5: Add E2E coverage**

Add fixture rows for "on Garmin" and "completed matched". Test that the Plan page shows both states and that the detail modal explains the match.

- [ ] **Step 6: Verify and commit**

```bash
npm run check:migrations
npm run typecheck
npm run test:e2e -- --grep "Garmin|completed"
git add backend/src/db/pulse-schema.ts backend/src/db/migrations/00XX_workout_execution_reconciliation.sql backend/src/pulse/services/workout-reconciliation.ts backend/src/routes/garmin.ts backend/src/pulse/plugin.ts shared/types/pulse.ts frontend/src/pages/Plan.tsx frontend/src/components/WorkoutDetailModal.tsx frontend/e2e/fixtures/pulse-api.ts frontend/e2e/pulse-usability.spec.ts
git commit -m "feat: reconcile garmin workout execution"
```

## Task 3: Recovery Data Depth

**Files:**
- Modify: `backend/src/db/pulse-schema.ts`
- Create: `backend/src/db/migrations/00XX_recovery_data_depth.sql`
- Modify: `backend/src/routes/garmin.ts`
- Modify: `backend/src/lib/recovery-metrics.ts`
- Modify: `backend/src/pulse/services/readiness.ts`
- Modify: `backend/src/pulse/services/risk-engine.ts`
- Modify: `frontend/src/pages/Data.tsx`

- [ ] **Step 1: Write failing tests**

Use Garmin fixture payloads that include sleep need, sleep start/end, sleep stress, sleep Body Battery, respiration, Body Battery charge/drain and stress distribution. Tests should prove these fields are normalized and surfaced as optional data, not required for basic sync.

- [ ] **Step 2: Add additive fields**

Add nullable recovery-depth fields. Suggested names:

- sleep: `startTime`, `endTime`, `sleepNeedMin`, `sleepActualMin`, `avgSleepStress`, `avgSleepHr`, `avgRespiration`, `restlessMoments`, `bodyBatteryChange`, `rawData`;
- daily: `bodyBatteryCharged`, `bodyBatteryDrained`, `bodyBatteryHighest`, `bodyBatteryLowest`, `bodyBatteryAtWake`, `maxStress`, `lowStressSec`, `mediumStressSec`, `highStressSec`, `moderateIntensityMin`, `vigorousIntensityMin`, `avgWakingRespiration`, `latestSpo2`.

- [ ] **Step 3: Normalize without overfitting**

If Garmin omits a field, store `null` and keep sync successful. Preserve compact raw snapshots for audit. Do not expose raw Garmin copy in frontend.

- [ ] **Step 4: Use in decisions**

Readiness/Risk should use richer signals conservatively:

- poor sleep need gap increases caution;
- high stress duration can nudge daily recommendation;
- Body Battery at wake and charge/drain explain recovery but do not override HRV/RHR alone.

- [ ] **Step 5: UI and coverage**

Data shows "Recovery Depth" with available/missing signals and a short explanation. Home/Coach can mention one extra high-confidence driver only.

- [ ] **Step 6: Verify and commit**

```bash
npm run check:migrations
npm run typecheck
cd backend && set -a; source ../.env.test.example; set +a; npm test -- --run src/routes/garmin.test.ts src/lib/recovery-metrics.test.ts src/pulse/services/risk-engine.test.ts
git add backend/src/db/pulse-schema.ts backend/src/db/migrations/00XX_recovery_data_depth.sql backend/src/routes/garmin.ts backend/src/lib/recovery-metrics.ts backend/src/pulse/services/readiness.ts backend/src/pulse/services/risk-engine.ts frontend/src/pages/Data.tsx
git commit -m "feat: enrich garmin recovery signals"
```

## Task 4: Training Metadata And Profile Quality

**Files:**
- Modify: `backend/src/pulse/plugin.ts`
- Modify: `backend/src/jobs/garmin-sync.job.ts`
- Modify: `backend/src/db/pulse-schema.ts`
- Modify: `backend/src/pulse/services/plan-engine.ts`
- Modify: `backend/src/pulse/services/adapt-engine.ts`
- Modify: `frontend/src/pages/Settings.tsx`

- [ ] **Step 1: Split profile field provenance**

Profile values should distinguish manual, activity-derived and Garmin-settings-derived values for FTP, max HR, LTHR and VO2max. Keep user-editable values authoritative when manually set.

- [ ] **Step 2: Probe optional Garmin metadata carefully**

Only use endpoints that pass a single controlled server-side read without triggering rate limits. If an endpoint returns 404/429, store no failure spam; mark provider unavailable in diagnostics.

- [ ] **Step 3: UI transparency**

Settings shows where profile values came from and when they were last refreshed. PlanTrace uses provenance to explain fallback HR zones or FTP estimates.

- [ ] **Step 4: Verify and commit**

```bash
npm run typecheck
cd backend && set -a; source ../.env.test.example; set +a; npm test -- --run src/pulse/plugin.test.ts src/pulse/services/plan-engine.test.ts
git add backend/src/pulse/plugin.ts backend/src/jobs/garmin-sync.job.ts backend/src/db/pulse-schema.ts backend/src/pulse/services/plan-engine.ts backend/src/pulse/services/adapt-engine.ts frontend/src/pages/Settings.tsx
git commit -m "feat: explain garmin profile provenance"
```

## Task 5: Garmin Sync Architecture Cleanup

**Files:**
- Modify: `backend/src/lib/garmin-client.ts`
- Modify: `backend/src/pulse/adapters/garmin-client.ts`
- Modify: `backend/src/pulse/queues/workers.ts`
- Modify: `backend/src/routes/garmin.ts`
- Modify: `docs/decisions.md`

- [ ] **Step 1: Inventory direct client vs sidecar**

Document every Garmin call site and whether it uses `garmin-connect`, raw `gc.client`, or the sidecar adapter.

- [ ] **Step 2: Choose the single-user operating model**

For current local Pulse, keep `GARMIN_EMAIL/PASSWORD` as the server-side single-user model. Do not activate OAuth/token UX unless Tobi decides Pulse becomes multi-user.

- [ ] **Step 3: Reduce drift**

Wrap repeated raw URLs behind a small internal adapter with named methods. Preserve direct `gc.client` only where Garmin lacks a library method and add tests around payload shape.

- [ ] **Step 4: Persist the decision**

Add a `docs/decisions.md` entry explaining why the local single-user Garmin model stays for now and how an official Garmin API migration would fit later.

- [ ] **Step 5: Verify and commit**

```bash
npm run typecheck
git diff --check
git add backend/src/lib/garmin-client.ts backend/src/pulse/adapters/garmin-client.ts backend/src/pulse/queues/workers.ts backend/src/routes/garmin.ts docs/decisions.md
git commit -m "refactor: consolidate garmin sync access"
```

## Acceptance

- Existing Garmin sync still works without destructive provider writes.
- Existing planned workouts keep syncing to Garmin with correct repeat groups.
- Activity detail fetches no longer destroy original activity raw data.
- Plan shows whether a workout is local, on Garmin, scheduled, completed, missed or replaced.
- Data and Coach use richer recovery signals only when available and explain missing depth clearly.
- Garmin API rate limits are respected; broad live probing is not part of normal sync.
