# Garmin Execution Ledger Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Garmin execution trust durable by storing what Pulse intended to upload, what Garmin accepted, and what still needs repair.

**Architecture:** Add a backend-owned sync ledger that records one row per planned-workout sync attempt and stores the local contract, Garmin identifiers, a local Garmin payload snapshot and outcome. V1 does not claim a remote readback unless the implementation explicitly fetches Garmin after upload. Existing Garmin sync routes continue to upload workouts, but they also write ledger events and expose a read-only summary for Plan/Settings. The UI should surface only action-oriented debt, not raw API payloads.

**Tech Stack:** Fastify, Drizzle/Postgres, shared Pulse types, React/Vite, Vitest, Playwright smoke where UI changes are visible.

---

## Files

- Create: `backend/src/db/migrations/0031_garmin_execution_ledger.sql`
- Modify: `backend/src/db/migrations/meta/_journal.json`
- Modify: `backend/src/db/pulse-schema.ts`
- Modify: `shared/types/pulse/plan.ts`
- Create: `backend/src/pulse/services/garmin-execution-ledger.ts`
- Create: `backend/src/pulse/services/garmin-execution-ledger.test.ts`
- Modify: `backend/src/pulse/services/garmin-workout.ts`
- Modify: `backend/src/pulse/routes/training-routes.ts`
- Modify: `backend/src/pulse/routes/garmin-routes.ts`
- Modify: `frontend/src/components/WorkoutDetailModal.tsx`
- Modify: `frontend/src/pulse/api-client.ts`
- Modify: `frontend/src/pulse/hooks.ts`
- Modify: `frontend/src/pages/Settings.tsx`
- Test: `backend/src/pulse/plugin.test.ts`
- Test: `frontend/e2e/pulse-smoke.spec.ts` or focused Plan/Settings E2E coverage

## Task 1: Add The Ledger Schema

- [ ] **Step 1: Run migration guard context**

Run:

```bash
ls backend/src/db/migrations/*.sql | sort | tail -5
npm run check:migrations
```

Expected: `0030_garmin_sync_contract.sql` is the last migration at the time this plan was written. If `main` already has `0031_*.sql`, rename this migration to the next free number. Append a matching `backend/src/db/migrations/meta/_journal.json` entry with the next `idx`, matching `tag`, `version: "7"` and `breakpoints: true`; run `npm run check:migrations` before schema work continues.

- [ ] **Step 2: Create the additive migration**

Create `backend/src/db/migrations/0031_garmin_execution_ledger.sql` with:

```sql
CREATE TABLE IF NOT EXISTS "pulse_garmin_execution_ledger" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "planned_workout_id" uuid NOT NULL REFERENCES "pulse_planned_workouts"("id") ON DELETE CASCADE,
  "attempted_at" timestamp with time zone NOT NULL DEFAULT now(),
  "operation" varchar(32) NOT NULL,
  "outcome" varchar(32) NOT NULL,
  "local_contract" jsonb,
  "remote_workout_id" varchar(128),
  "remote_scheduled_id" varchar(128),
  "payload_snapshot" jsonb,
  "issues" jsonb DEFAULT '[]'::jsonb,
  "error_message" text
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pulse_garmin_execution_ledger_workout_idx"
  ON "pulse_garmin_execution_ledger" ("planned_workout_id", "attempted_at" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pulse_garmin_execution_ledger_user_outcome_idx"
  ON "pulse_garmin_execution_ledger" ("user_id", "outcome", "attempted_at" DESC);
```

- [ ] **Step 3: Add the Drizzle table**

Modify `backend/src/db/pulse-schema.ts` by adding `pulseGarminExecutionLedger` near the planned-workout tables:

```ts
export const pulseGarminExecutionLedger = pgTable('pulse_garmin_execution_ledger', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  plannedWorkoutId: uuid('planned_workout_id').notNull(),
  attemptedAt: timestamp('attempted_at', { withTimezone: true }).notNull().defaultNow(),
  operation: varchar('operation', { length: 32 }).notNull(),
  outcome: varchar('outcome', { length: 32 }).notNull(),
  localContract: jsonb('local_contract'),
  remoteWorkoutId: varchar('remote_workout_id', { length: 128 }),
  remoteScheduledId: varchar('remote_scheduled_id', { length: 128 }),
  payloadSnapshot: jsonb('payload_snapshot'),
  issues: jsonb('issues').default([]),
  errorMessage: text('error_message'),
}, table => ({
  workoutIdx: index('pulse_garmin_execution_ledger_workout_idx').on(table.plannedWorkoutId, table.attemptedAt),
  userOutcomeIdx: index('pulse_garmin_execution_ledger_user_outcome_idx').on(table.userId, table.outcome, table.attemptedAt),
}));
```

- [ ] **Step 4: Verify migration checks**

Run:

```bash
npm run check:migrations
npm run build -w backend
```

Expected: both commands exit `0`.

## Task 2: Model Payload Execution Snapshots

- [ ] **Step 1: Extend shared contracts**

Modify `shared/types/pulse/plan.ts`:

```ts
export type PulseGarminExecutionOperation = 'create' | 'update' | 'manual_resync' | 'calendar_repair' | 'delete';
export type PulseGarminExecutionOutcome = 'ready' | 'degraded' | 'blocked' | 'failed' | 'deleted';

export interface PulseGarminPayloadSnapshot {
  workoutId: string | null;
  scheduledId: string | null;
  stepCount: number;
  repeatGroupCount: number;
  invalidRepeatCount: number;
  hrTargetStepCount: number;
  durationSec: number | null;
  checkedAt: string;
}

export interface PulseGarminExecutionLedgerEntry {
  id: string;
  plannedWorkoutId: string;
  attemptedAt: string;
  operation: PulseGarminExecutionOperation;
  outcome: PulseGarminExecutionOutcome;
  summary: string;
  payloadSnapshot: PulseGarminPayloadSnapshot | null;
  issues: PulseGarminSyncContractIssue[];
  errorMessage: string | null;
}
```

- [ ] **Step 2: Add snapshot helpers**

Modify `backend/src/pulse/services/garmin-workout.ts`:

```ts
export function summarizeGarminPayloadSnapshot(payload: unknown, ids: {
  workoutId?: string | null;
  scheduledId?: string | null;
  checkedAt?: string;
} = {}): PulseGarminPayloadSnapshot {
  const steps = flattenGarminWorkoutSteps(payloadWorkoutSteps(payload));
  const repeatGroups = steps.filter(isGarminRepeatGroup);
  const executable = steps.filter(step => typeof step === 'object' && step != null && (step as { type?: string }).type === 'ExecutableStepDTO');
  const invalidRepeatCount = repeatGroups.filter(step => {
    const repeat = step as Partial<GarminRepeatGroup>;
    return (repeat.numberOfIterations ?? 0) <= 0
      || (repeat.endConditionValue ?? 0) <= 0
      || repeat.endCondition?.conditionTypeKey !== 'iterations';
  }).length;
  const hrTargetStepCount = executable.filter(step =>
    (step as { targetType?: { workoutTargetTypeKey?: string } }).targetType?.workoutTargetTypeKey === 'heart.rate.zone'
  ).length;

  return {
    workoutId: ids.workoutId ?? null,
    scheduledId: ids.scheduledId ?? null,
    stepCount: steps.length,
    repeatGroupCount: repeatGroups.length,
    invalidRepeatCount,
    hrTargetStepCount,
    durationSec: typeof payload === 'object' && payload != null
      ? ((payload as { estimatedDurationInSecs?: number }).estimatedDurationInSecs ?? null)
      : null,
    checkedAt: ids.checkedAt ?? new Date().toISOString(),
  };
}
```

Add the recursive helper before `summarizeGarminPayloadSnapshot` so nested repeat-group steps are counted:

```ts
function flattenGarminWorkoutSteps(steps: unknown[]): unknown[] {
  return steps.flatMap(step => {
    if (isGarminRepeatGroup(step)) {
      return [step, ...flattenGarminWorkoutSteps(Array.isArray(step.workoutSteps) ? step.workoutSteps : [])];
    }
    return [step];
  });
}
```

- [ ] **Step 3: Test repeat snapshots**

Add to `backend/src/pulse/services/garmin-execution-ledger.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildGarminWorkoutJson, summarizeGarminPayloadSnapshot } from './garmin-workout.js';

describe('Garmin payload snapshot', () => {
  it('counts repeat groups and HR targets from the generated Garmin payload', () => {
    const payload = buildGarminWorkoutJson({
      activityType: 'bike',
      zone: 4,
      durationMin: 60,
      description: 'Schwelle',
      steps: [
        { type: 'warmup', durationMin: 10, zone: 1 },
        { type: 'interval', durationMin: 8, reps: 3, restMin: 3, zone: 4 },
        { type: 'cooldown', durationMin: 10, zone: 1 },
      ],
    });

    const snapshot = summarizeGarminPayloadSnapshot(payload, { workoutId: 'w1', scheduledId: 's1', checkedAt: '2026-05-10T10:00:00.000Z' });

    expect(snapshot).toMatchObject({
      workoutId: 'w1',
      scheduledId: 's1',
      stepCount: 5,
      repeatGroupCount: 1,
      invalidRepeatCount: 0,
      hrTargetStepCount: 4,
    });
  });
});
```

- [ ] **Step 4: Run the focused test**

Run:

```bash
npm test -w backend -- --run src/pulse/services/garmin-execution-ledger.test.ts
```

Expected: PASS.

## Task 3: Persist Ledger Events From Sync Paths

- [ ] **Step 1: Create the service**

Create `backend/src/pulse/services/garmin-execution-ledger.ts`:

```ts
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { and, desc, eq } from 'drizzle-orm';
import type {
  PulseGarminExecutionLedgerEntry,
  PulseGarminExecutionOperation,
  PulseGarminExecutionOutcome,
  PulseGarminPayloadSnapshot,
  PulseGarminSyncContract,
  PulseGarminSyncContractIssue,
} from '@coaching-os/shared/pulse';
import { pulseGarminExecutionLedger } from '../../db/pulse-schema.js';

export interface RecordGarminExecutionInput {
  userId: string;
  plannedWorkoutId: string;
  operation: PulseGarminExecutionOperation;
  outcome: PulseGarminExecutionOutcome;
  localContract: PulseGarminSyncContract | null;
  remoteWorkoutId?: string | null;
  remoteScheduledId?: string | null;
  payloadSnapshot?: PulseGarminPayloadSnapshot | null;
  issues?: PulseGarminSyncContractIssue[];
  errorMessage?: string | null;
}

function summaryFor(input: RecordGarminExecutionInput): string {
  if (input.outcome === 'ready') return 'Garmin-Ausfuehrung bereit und remote pruefbar.';
  if (input.outcome === 'degraded') return 'Garmin-Ausfuehrung bereit, aber mit Einschraenkung.';
  if (input.outcome === 'blocked') return 'Garmin-Ausfuehrung blockiert; Payload vor Upload reparieren.';
  if (input.outcome === 'deleted') return 'Garmin-Remote fuer dieses Workout wurde entfernt.';
  return input.errorMessage ? `Garmin-Ausfuehrung fehlgeschlagen: ${input.errorMessage}` : 'Garmin-Ausfuehrung fehlgeschlagen.';
}

export async function recordGarminExecution(
  db: NodePgDatabase,
  input: RecordGarminExecutionInput,
): Promise<void> {
  await db.insert(pulseGarminExecutionLedger).values({
    userId: input.userId,
    plannedWorkoutId: input.plannedWorkoutId,
    operation: input.operation,
    outcome: input.outcome,
    localContract: input.localContract,
    remoteWorkoutId: input.remoteWorkoutId ?? null,
    remoteScheduledId: input.remoteScheduledId ?? null,
    payloadSnapshot: input.payloadSnapshot ?? null,
    issues: input.issues ?? input.localContract?.issues ?? [],
    errorMessage: input.errorMessage ?? null,
  });
}

export async function listLatestGarminExecutionEntries(
  db: NodePgDatabase,
  userId: string,
  plannedWorkoutId: string,
  limit = 5,
): Promise<PulseGarminExecutionLedgerEntry[]> {
  const rows = await db
    .select()
    .from(pulseGarminExecutionLedger)
    .where(and(eq(pulseGarminExecutionLedger.userId, userId), eq(pulseGarminExecutionLedger.plannedWorkoutId, plannedWorkoutId)))
    .orderBy(desc(pulseGarminExecutionLedger.attemptedAt))
    .limit(limit);

  return rows.map(row => ({
    id: row.id,
    plannedWorkoutId: row.plannedWorkoutId,
    attemptedAt: row.attemptedAt.toISOString(),
    operation: row.operation as PulseGarminExecutionOperation,
    outcome: row.outcome as PulseGarminExecutionOutcome,
    summary: summaryFor({
      userId: row.userId,
      plannedWorkoutId: row.plannedWorkoutId,
      operation: row.operation as PulseGarminExecutionOperation,
      outcome: row.outcome as PulseGarminExecutionOutcome,
      localContract: row.localContract as PulseGarminSyncContract | null,
      errorMessage: row.errorMessage,
    }),
    payloadSnapshot: row.payloadSnapshot as PulseGarminPayloadSnapshot | null,
    issues: row.issues as PulseGarminSyncContractIssue[],
    errorMessage: row.errorMessage,
  }));
}
```

- [ ] **Step 2: Wire successful uploads**

In `backend/src/pulse/routes/training-routes.ts`, import `{ db }` from `../../lib/db.js`. Update `uploadWorkoutToGarmin` so after `buildGarminSyncContract` and before any upload it records `outcome: 'blocked'` if `garminSyncContract.payloadReady` is false. After successful schedule it records:

```ts
await recordGarminExecution(db, {
  userId,
  plannedWorkoutId: workout.id,
  operation: context === 'sync-garmin' ? 'manual_resync' : context === 'plan-workout-update' ? 'update' : 'create',
  outcome: garminSyncContract.status,
  localContract: garminSyncContract,
  remoteWorkoutId: String(created.workoutId ?? created.id ?? ''),
  remoteScheduledId: garminScheduledId,
  payloadSnapshot: summarizeGarminPayloadSnapshot(garminWorkout, {
    workoutId: String(created.workoutId ?? created.id ?? ''),
    scheduledId: garminScheduledId,
  }),
});
```

- [ ] **Step 3: Wire failed uploads**

In every `catch` block that logs `[plan-workout-create]`, `[plan-workout-update]`, `[sync-garmin]` or `[plan-generate]` Garmin failures, record a ledger event with `outcome: 'failed'` and `errorMessage: String(err).slice(0, 240)`. Blocked payloads are not generic failures: record `outcome: 'blocked'` with the contract issues before throwing or returning.

- [ ] **Step 4: Wire deletes**

In `removeGarminRemoteForWorkout`, record `operation: 'delete'` and `outcome: 'deleted'` after successful deletion attempts. If deletion fails, record `outcome: 'failed'`.

- [ ] **Step 5: Extend plugin tests**

Add assertions to existing Garmin plugin tests:

```ts
expect(await db.select().from(pulseGarminExecutionLedger)).toEqual(expect.arrayContaining([
  expect.objectContaining({
    plannedWorkoutId: createdWorkoutId,
    outcome: 'ready',
    payloadSnapshot: expect.objectContaining({ repeatGroupCount: 1, invalidRepeatCount: 0 }),
  }),
]));
```

- [ ] **Step 6: Run backend Garmin tests**

Run:

```bash
npm test -w backend -- --run src/pulse/plugin.test.ts src/pulse/services/garmin-execution-ledger.test.ts
```

Expected: PASS.

## Task 4: Surface Actionable Debt In Plan And Settings

- [ ] **Step 1: Add a read endpoint**

In `backend/src/pulse/routes/garmin-routes.ts`, import `{ db }` from `../../lib/db.js`. Add `GET /garmin/execution-ledger?workoutId=...` authenticated endpoint that uses `const userId = req.user.sub`, validates ownership by filtering ledger rows with `(user_id, planned_workout_id)` and calls `listLatestGarminExecutionEntries(db, userId, workoutId)`.

- [ ] **Step 2: Add API wrapper and hook**

Add to `frontend/src/pulse/api-client.ts`:

```ts
garmin: {
  executionLedger: (workoutId: string): Promise<{ entries: PulseGarminExecutionLedgerEntry[] }> =>
    request(`/garmin/execution-ledger?workoutId=${encodeURIComponent(workoutId)}`),
}
```

Add to `frontend/src/pulse/hooks.ts`:

```ts
export function useGarminExecutionLedger(workoutId: string | null) {
  return useQuery({
    queryKey: pulseKeys.garminExecutionLedger(workoutId),
    queryFn: () => pulseApi.garmin.executionLedger(workoutId!),
    enabled: workoutId != null,
  });
}
```

- [ ] **Step 3: Show the latest ledger entry in the Plan workout detail modal**

In `frontend/src/components/WorkoutDetailModal.tsx`, show the latest ledger entry inside the existing detail modal:

```tsx
<section className="card" data-testid="garmin-execution-ledger">
  <span className="label-mono">GARMIN AUSFUEHRUNG</span>
  <p>{latest.summary}</p>
  {latest.payloadSnapshot && (
    <p>{latest.payloadSnapshot.repeatGroupCount} Wiederholungsblock(e), {latest.payloadSnapshot.hrTargetStepCount} HR-Zielschritte, {latest.payloadSnapshot.invalidRepeatCount} Repeat-Fehler.</p>
  )}
</section>
```

- [ ] **Step 4: Keep Settings high-level**

In `frontend/src/pages/Settings.tsx`, add only a small link from Garmin diagnostics to Plan when ledger debt exists. Do not duplicate the full ledger table in Settings.

- [ ] **Step 5: Run checks**

Run:

```bash
npm run build -w shared
npm run build -w backend
npm run build -w frontend
npm run test:e2e:smoke
```

Expected: all commands exit `0`. If browser smoke cannot run due missing local services, record the blocker and run `npm run verify:local:no-services`.

Add targeted browser assertions rather than relying only on smoke:

- Plan workout detail modal shows `garmin-execution-ledger`.
- Settings Garmin diagnostics links to Plan when execution debt exists.
- No test performs a live Garmin upload; use fixture responses.

## Acceptance

- Repeat workouts never have only a transient sync contract; every upload attempt leaves an inspectable event.
- A Garmin failure no longer erases the local contract or hides why a workout is not device-ready.
- Plan can explain the latest remote state without exposing raw Garmin JSON.
- Generic QA does not trigger live Garmin sync.
