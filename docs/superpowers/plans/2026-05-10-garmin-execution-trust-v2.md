# Garmin Execution Trust v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Garmin device execution trust visible and repairable before workouts are performed on watch/Edge.

**Architecture:** Add read-only remote diff first, then repair actions. Plan gets a nested `Ausführung` surface; Settings remains diagnostics. Live Garmin calls stay explicit and never happen during generic QA.

**Tech Stack:** Fastify, Drizzle/Postgres, existing Garmin client/service layer, React/Vite, Playwright, additive migrations only if remote-diff snapshots need persistence.

---

## Files

- Modify: `backend/src/pulse/services/garmin-calendar-workouts.ts` for remote readback normalization.
- Create: `backend/src/pulse/services/garmin-execution-diff.ts`.
- Test: `backend/src/pulse/services/garmin-execution-diff.test.ts`.
- Modify: `backend/src/pulse/routes/garmin-routes.ts` to expose `/api/pulse/garmin/execution-diff`.
- Modify: `frontend/src/pulse/api-client.ts` for typed diff fetch.
- Create: `frontend/src/components/GarminExecutionTrustPanel.tsx`.
- Modify: `frontend/src/pages/Plan.tsx` to add nested `Ausführung` tab/panel.
- Modify: `frontend/e2e/fixtures/pulse-api.ts` and `frontend/e2e/pulse-usability.spec.ts`.

## Task 1: Build Remote Diff Service

- [x] **Step 1: Write service tests**

Create `backend/src/pulse/services/garmin-execution-diff.test.ts` with cases:

- Local workout has template and calendar ID, remote calendar contains same scheduled ID -> `ready`.
- Local workout has no remote scheduled item -> `missing_calendar`.
- Remote item has broken repeat iterations -> `broken_repeat`.
- Strength support contract is degraded but expected -> `degraded_expected`.
- Past completed workout has matching Garmin activity -> `completed`.

- [x] **Step 2: Implement service**

Create `garmin-execution-diff.ts` with:

```ts
export type GarminExecutionDiffStatus = 'ready' | 'missing_calendar' | 'missing_template' | 'broken_repeat' | 'degraded_expected' | 'completed' | 'stale' | 'unknown';

export function buildGarminExecutionDiff(input: {
  localWorkouts: PulsePlannedWorkout[];
  remoteWorkouts: NormalizedGarminCalendarWorkout[];
  ledgerEntries: PulseGarminExecutionLedgerEntry[];
  today: string;
}): PulseGarminExecutionDiffResponse { ... }
```

Use existing helpers:

- `garminWorkoutHasBrokenRepeatIterations`.
- `buildGarminSyncContract`.
- `listLatestGarminExecutionEntries`.

- [x] **Step 3: Run backend test**

Run:

```bash
npm run test -w backend -- src/pulse/services/garmin-execution-diff.test.ts
```

Expected: tests pass without external Garmin calls.

## Task 2: Add Read-Only Endpoint

- [x] **Step 1: Add route contract**

In shared Pulse types, add `PulseGarminExecutionDiffResponse` with:

```ts
{
  generatedAt: string;
  window: { from: string; to: string; days: number };
  rows: Array<{
    workoutId: string;
    plannedDate: string;
    title: string;
    status: GarminExecutionDiffStatus;
    summary: string;
    local: { garminWorkoutId: string | null; garminScheduledId: string | null };
    remote: { workoutId: string | null; scheduledId: string | null; lastSeenAt: string | null };
    repairActions: Array<'upload_template' | 'schedule_calendar' | 'repair_repeat' | 'delete_stale_remote'>;
  }>;
}
```

- [x] **Step 2: Implement `/garmin/execution-diff`**

In `garmin-routes.ts`, add:

```ts
app.get('/garmin/execution-diff', { onRequest: [app.authenticate] }, async (req) => {
  const days = Number((req.query as { days?: string }).days ?? 15);
  ...
});
```

Read future planned workouts, fetch remote calendar/workouts through existing Garmin service, and build diff. If Garmin is unavailable, return rows with `unknown` and a clear status instead of 502 where possible.

- [x] **Step 3: Add route tests**

Use mocked Garmin service data; no live Garmin credentials.

- [x] **Step 4: Run tests**

Run:

```bash
npm run test -w backend -- src/pulse/routes/garmin-routes.test.ts src/pulse/services/garmin-execution-diff.test.ts
```

Expected: all tests pass.

## Task 3: Add Plan `Ausführung` Panel

- [x] **Step 1: Add e2e fixture and failing test**

In `frontend/e2e/fixtures/pulse-api.ts`, return execution diff rows for `/api/pulse/garmin/execution-diff`.

In `pulse-usability.spec.ts`, assert:

- Plan has nested tab/button `Ausführung`.
- It shows `Auf Garmin bereit`, `Fehlt im Garmin-Kalender`, `Repeat reparieren`.
- It does not trigger live sync on page load.

- [x] **Step 2: Add client API**

In `frontend/src/pulse/api-client.ts`:

```ts
executionDiff: (days = 15): Promise<PulseGarminExecutionDiffResponse> =>
  request(`/garmin/execution-diff?days=${encodeURIComponent(String(days))}`),
```

Add a hook in `frontend/src/pulse/hooks.ts`.

- [x] **Step 3: Implement panel**

Create `frontend/src/components/GarminExecutionTrustPanel.tsx`:

- Compact status summary.
- Rows grouped by `ready`, `needs_repair`, `degraded_expected`, `unknown`.
- Repair CTAs route to existing Settings/Plan actions; do not call repair automatically.
- Copy for strength: `Support-Blockliste: Garmin nur Notiz/Handoff`.

- [x] **Step 4: Wire Plan nested tab**

In `Plan.tsx`, extend:

```ts
type Tab = 'training' | 'ausfuehrung' | 'ziele' | 'review' | 'statistik';
```

Add `Ausführung` after `Training`, keep top-level nav unchanged.

- [x] **Step 5: Run frontend checks**

Run:

```bash
npm run test:e2e -- --project=desktop-chromium --project=mobile-chromium --grep "Garmin execution|Ausführung|Plan"
npm run build -w frontend
```

Expected: execution panel visible, no live Garmin sync during generic tests.

## Task 4: Add Repair Flow

- [x] **Step 1: Write tests for repair actions**

Test that clicking repair:

- calls the existing upload/sync endpoint only after explicit click.
- updates row status or shows an inline error.
- records ledger entries via existing non-blocking ledger path.

- [x] **Step 2: Reuse existing Garmin actions**

Use existing endpoints:

- `/plan/workout/:id/sync-garmin`.
- `/garmin/calendar/sync`.

Do not add another mutation if existing endpoints can repair the state.

- [x] **Step 3: Run deploy readiness**

Run:

```bash
npm run check:migrations
npm run test -w backend -- src/pulse/services/garmin-execution-ledger.test.ts src/pulse/services/garmin-execution-diff.test.ts
npm run test:e2e -- --project=mobile-chromium --grep "Garmin execution|Plan"
```

Expected: migrations pass; backend/frontend tests pass.

## Non-Goals

- No new top-level `Device` or `Garmin` tab.
- No generic QA live Garmin writes.
- No destructive remote delete without explicit confirmation.
- No attempt to make strength workouts look like native Garmin interval sessions.
