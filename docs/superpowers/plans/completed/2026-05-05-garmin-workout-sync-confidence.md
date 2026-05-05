# Garmin Workout Sync Confidence Implementation Plan

> **Completed slice (2026-05-05):** Implemented as the smallest frontend trust-closure slice. The existing Pulse training contract already exposes `executionStatus`, `garminWorkoutId`, `garminScheduledId` and `executionNotes`, so this pass did not add backend schema, migrations or live Garmin calls. Plan rows now reuse shared Garmin confidence copy, and `WorkoutDetailModal` shows a visible confidence panel beside the existing bounded Garmin upload/repair action.

**Goal:** Plan should clearly show whether each planned workout is local only, uploaded as a Garmin template, scheduled on Garmin calendar, repair-needed, synced or failed.

**Architecture:** Build on existing workout execution status, Garmin template ids, scheduled ids, calendar sync and PR #176 repeat repair detection. Do not contact Garmin during generic QA; use backend unit tests and mocked frontend E2E fixtures.

**Tech Stack:** Fastify, Drizzle, React/Vite, TanStack Query, Playwright, Vitest.

---

## Context

PR #176 fixed broken-repeat repair detection for `0` iteration values. The next gap is user trust: Plan needs a simple status surface that answers "is this workout really right on my watch/Edge?"

Do not reimplement Garmin upload or calendar repair logic. This plan surfaces confidence and adds tests around existing code.

## File Map

| Type | Path | Purpose |
|---|---|---|
| Modify | `shared/types/pulse/training.ts` or current Pulse training type file | Add optional confidence/status fields if not already expressible |
| Modify | `backend/src/pulse/services/workout-reconciliation.ts` | Pure mapper for user-facing Garmin confidence state if backend-owned |
| Modify | `backend/src/pulse/services/workout-reconciliation.test.ts` | Unit coverage for confidence states |
| Modify | `frontend/src/components/WorkoutDetailModal.tsx` | Add visible confidence panel and bounded action |
| Modify | `frontend/src/pages/Plan.tsx` | Show compact status in workout rows / next workout decision |
| Modify | `frontend/e2e/fixtures/pulse-api.ts` | Mock local/template/calendar/repair/failed states |
| Modify | `frontend/e2e/pulse-usability.spec.ts` | Browser coverage for Plan Garmin confidence |

## Task 1: Define Confidence States In Tests

- [x] **Step 1: Add backend tests for mapping**

Implemented as explicit unit label coverage; existing backend execution-state mapping was left unchanged.

In `backend/src/pulse/services/workout-reconciliation.test.ts`, add cases:

```ts
it('summarizes Garmin confidence states for planned workouts', () => {
  expect(summarizeExecutionState('local_planned')).toBe('Lokal');
  expect(summarizeExecutionState('garmin_template')).toBe('Garmin');
  expect(summarizeExecutionState('garmin_scheduled')).toBe('Kalender');
  expect(summarizeExecutionState('completed_matched')).toBe('Erledigt');
  expect(summarizeExecutionState('missed')).toBe('Verpasst');
  expect(summarizeExecutionState('replaced_or_off_plan')).toBe('Ersetzt');
});
```

- [x] **Step 2: Add frontend red test**

In `frontend/e2e/pulse-usability.spec.ts`, add a Plan test with mocked workouts:

```ts
test('Plan explains Garmin workout sync confidence before opening Garmin actions', async ({ page }) => {
  await mockPulseApi(page, {
    plan: {
      workouts: [
        { id: 'w-local', plannedDate: '2026-05-05', activityType: 'bike', zone: 2, durationMin: 45, status: 'planned', executionStatus: 'local_planned' },
        { id: 'w-calendar', plannedDate: '2026-05-06', activityType: 'run', zone: 3, durationMin: 50, status: 'planned', executionStatus: 'garmin_scheduled', garminWorkoutId: '123', garminScheduledId: '456' },
      ],
    },
  });

  await page.goto('/plan');
  await expect(page.getByText('Lokal')).toBeVisible();
  await expect(page.getByText('Kalender')).toBeVisible();
  await expect(page.getByText(/auf Garmin geplant|auf Uhr\\/Edge bereit/i)).toBeVisible();
});
```

- [x] **Step 3: Run red**

```bash
npm run test:e2e -- --project=desktop-chromium --grep "Garmin workout sync confidence"
```

Expected: FAIL until confidence copy is rendered.

## Task 2: Add A Small Frontend Confidence Helper

- [x] **Step 1: Create local helper in `WorkoutDetailModal.tsx` or extract if reused**

Use this mapping:

```ts
function garminConfidenceCopy(workout: PulsePlannedWorkout): { title: string; detail: string; tone: 'ok' | 'watch' | 'error' } {
  const status = executionStatusFor(workout);
  if (status === 'garmin_scheduled') return { title: 'Auf Garmin geplant', detail: 'Template und Kalendertermin sind vorhanden.', tone: 'ok' };
  if (status === 'garmin_template') return { title: 'Garmin Vorlage vorhanden', detail: 'Noch nicht sicher im Kalender. Bei Bedarf erneut synchronisieren.', tone: 'watch' };
  if (status === 'local_planned') return { title: 'Nur in Pulse geplant', detail: 'Noch nicht auf Uhr oder Edge synchronisiert.', tone: 'watch' };
  if (status === 'completed_matched') return { title: 'Mit Garmin erledigt', detail: 'Eine Garmin-Aktivitaet passt zu diesem Workout.', tone: 'ok' };
  if (status === 'missed') return { title: 'Nicht ausgefuehrt', detail: 'Keine passende Garmin-Aktivitaet gefunden.', tone: 'error' };
  return { title: 'Ersetzt oder ausserhalb Plan', detail: 'Garmin zeigt eine andere Ausfuehrung als geplant.', tone: 'watch' };
}
```

- [x] **Step 2: Render compact row status in Plan**

In `frontend/src/pages/Plan.tsx`, show the title or badge near each workout row without adding a new card.

- [x] **Step 3: Render detail panel in modal**

In `frontend/src/components/WorkoutDetailModal.tsx`, render:

```tsx
<div data-testid="garmin-sync-confidence">
  <strong>{copy.title}</strong>
  <span>{copy.detail}</span>
</div>
```

Keep the existing "Auf Garmin" action as the bounded repair/upload action.

## Task 3: Wire Calendar Repair Evidence

- [x] **Step 1: Extend mocks only where needed**

Covered inline in `frontend/e2e/pulse-usability.spec.ts`; the shared `mockPulseApi` already accepts arbitrary `planWorkouts`, so `frontend/e2e/fixtures/pulse-api.ts` did not need a code change.

In `frontend/e2e/fixtures/pulse-api.ts`, add mock fields for `garminWorkoutId`, `garminScheduledId`, `executionStatus`, and `executionNotes` in relevant workouts.

- [x] **Step 2: Add failed/sync retry coverage**

Covered in the modal confidence E2E with mocked `POST /api/pulse/plan/workout/:id/sync-garmin` failure. The modal keeps the confidence panel visible and shows the bounded failure message.

Use existing `failEndpoints` to simulate `POST /api/pulse/plan/workout/:id/sync-garmin` failure and assert the workout stays visible.

## Task 4: Verify

- [x] **Step 1: Backend focused tests**

Run for the reconciliation mapper touched by test coverage.

```bash
npm run test -w backend -- src/pulse/services/garmin-workout.test.ts src/pulse/services/workout-reconciliation.test.ts
```

Expected: PASS.

- [x] **Step 2: Frontend focused tests**

```bash
npm run test:e2e -- --grep "Garmin workout sync confidence|Garmin execution states|sync-garmin"
```

Expected: PASS.

- [x] **Step 3: Build**

```bash
npm run build
```

Expected: PASS.

## Acceptance

- Plan answers whether a workout is local, Garmin-template-only, calendar-scheduled, completed, missed or replaced.
- Garmin repeat repair from PR #176 remains covered.
- No live Garmin call is made by automated tests.
- The user has one bounded action to upload/repair, not multiple scattered guesses.
