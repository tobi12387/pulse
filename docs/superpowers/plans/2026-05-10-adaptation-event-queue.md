# Adaptation Event Queue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Centralize how completed activities, missed workouts, RPE, mental state, fueling tolerance, readiness and Garmin sync debt adapt the plan.

**Architecture:** Add a pure adaptation-event classifier first, then a small persisted event queue. The queue does not auto-edit the plan by default; it produces explainable recommendations that Home/Plan can show and that Plan scenario apply can consume explicitly.

**Tech Stack:** Fastify, Drizzle/Postgres, shared Pulse types, Vitest, React/Vite.

---

## Files

- Create: `backend/src/db/migrations/0032_adaptation_events.sql`
- Modify: `backend/src/db/migrations/meta/_journal.json`
- Modify: `backend/src/db/pulse-schema.ts`
- Modify: `shared/types/pulse/plan.ts`
- Create: `backend/src/pulse/services/adaptation-events.ts`
- Create: `backend/src/pulse/services/adaptation-events.test.ts`
- Modify: `backend/src/pulse/services/today-options.ts`
- Modify: `backend/src/pulse/services/plan-engine.ts` only if adaptation events are used for trace/explanation or scenario inputs; do not mutate plan generation invisibly in this plan
- Modify: `backend/src/pulse/routes/training-routes.ts`
- Modify: `frontend/src/pages/Home.tsx`
- Modify: `frontend/src/pages/Plan.tsx`
- Modify: `frontend/e2e/fixtures/pulse-api.ts`
- Test: `frontend/e2e/pulse-smoke.spec.ts` or focused Home/Plan adaptation E2E coverage

## Task 1: Define Adaptation Signals

- [ ] **Step 1: Extend shared types**

Add to `shared/types/pulse/plan.ts`:

```ts
export type PulseAdaptationEventKind =
  | 'activity_completed'
  | 'planned_workout_missed'
  | 'workout_replaced'
  | 'high_rpe'
  | 'mental_load'
  | 'fueling_limiter'
  | 'sync_debt'
  | 'recovery_risk';

export type PulseAdaptationRecommendation =
  | 'keep_plan'
  | 'reduce_intensity'
  | 'reduce_volume'
  | 'protect_recovery'
  | 'move_workout'
  | 'regenerate_week'
  | 'sync_garmin'
  | 'log_feedback';

export interface PulseAdaptationEvent {
  id: string;
  userId: string;
  eventDate: string;
  kind: PulseAdaptationEventKind;
  sourceId: string | null;
  severity: 'info' | 'watch' | 'action';
  recommendation: PulseAdaptationRecommendation;
  summary: string;
  evidence: string[];
  resolvedAt: string | null;
  createdAt: string;
}
```

- [ ] **Step 2: Create a pure classifier test**

Create `backend/src/pulse/services/adaptation-events.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { classifyAdaptationEvents } from './adaptation-events.js';

describe('classifyAdaptationEvents', () => {
  it('turns a completed long off-plan ride with GI issue into recovery and fueling actions', () => {
    const events = classifyAdaptationEvents({
      today: '2026-05-10',
      completedActivities: [{ id: 'a1', date: '2026-05-09', activityType: 'bike', durationMin: 430, tss: 310, rpe: 7, plannedWorkoutId: null }],
      missedWorkouts: [],
      mental: null,
      readinessScore: 68,
      tsb: -18,
      fuelingHistory: [{ date: '2026-05-09', giComfort: 'mild_issue', durationMin: 430, carbsG: 360 }],
      syncDebtCount: 0,
    });

    expect(events.map(event => event.recommendation)).toEqual(expect.arrayContaining(['protect_recovery', 'reduce_volume']));
    expect(events.map(event => event.kind)).toEqual(expect.arrayContaining(['activity_completed', 'fueling_limiter']));
  });

  it('keeps the plan when signals are green and no sync debt exists', () => {
    const events = classifyAdaptationEvents({
      today: '2026-05-10',
      completedActivities: [],
      missedWorkouts: [],
      mental: { energy: 7, stress: 3, mood: 7, motivation: 7 },
      readinessScore: 82,
      tsb: 4,
      fuelingHistory: [],
      syncDebtCount: 0,
    });

    expect(events).toEqual([
      expect.objectContaining({ recommendation: 'keep_plan', severity: 'info' }),
    ]);
  });
});
```

- [ ] **Step 3: Run test and confirm failure**

Run:

```bash
npm test -w backend -- --run src/pulse/services/adaptation-events.test.ts
```

Expected: FAIL because `adaptation-events.ts` does not exist.

## Task 2: Implement The Pure Classifier

- [ ] **Step 1: Create `backend/src/pulse/services/adaptation-events.ts`**

```ts
import type { PulseAdaptationEvent, PulseAdaptationEventKind, PulseAdaptationRecommendation } from '@coaching-os/shared/pulse';

interface ClassifierActivity {
  id: string;
  date: string;
  activityType: string;
  durationMin: number;
  tss: number | null;
  rpe: number | null;
  plannedWorkoutId: string | null;
}

interface ClassifierFuelingLog {
  date: string;
  giComfort: string | null;
  durationMin: number | null;
  carbsG: number | null;
}

export interface ClassifyAdaptationEventsInput {
  today: string;
  completedActivities: ClassifierActivity[];
  missedWorkouts: Array<{ id: string; plannedDate: string; activityType: string; durationMin: number; zone: number }>;
  mental: { mood: number; energy: number; stress: number; motivation: number } | null;
  readinessScore: number;
  tsb: number;
  fuelingHistory: ClassifierFuelingLog[];
  syncDebtCount: number;
}

function event(input: {
  kind: PulseAdaptationEventKind;
  sourceId?: string | null;
  severity: PulseAdaptationEvent['severity'];
  recommendation: PulseAdaptationRecommendation;
  summary: string;
  evidence: string[];
  today: string;
}): PulseAdaptationEvent {
  return {
    id: `${input.kind}:${input.sourceId ?? input.today}`,
    userId: '',
    eventDate: input.today,
    kind: input.kind,
    sourceId: input.sourceId ?? null,
    severity: input.severity,
    recommendation: input.recommendation,
    summary: input.summary,
    evidence: input.evidence,
    resolvedAt: null,
    createdAt: new Date(`${input.today}T12:00:00.000Z`).toISOString(),
  };
}

function hasGiIssue(log: ClassifierFuelingLog): boolean {
  return ['mild_issue', 'issue'].includes(log.giComfort ?? '');
}

export function classifyAdaptationEvents(input: ClassifyAdaptationEventsInput): PulseAdaptationEvent[] {
  const events: PulseAdaptationEvent[] = [];
  const longCompleted = input.completedActivities.find(activity => activity.durationMin >= 240 || (activity.tss ?? 0) >= 250);
  const highRpe = input.completedActivities.find(activity => (activity.rpe ?? 0) >= 8);
  const giLog = input.fuelingHistory.find(hasGiIssue);

  if (longCompleted) {
    events.push(event({
      today: input.today,
      kind: 'activity_completed',
      sourceId: longCompleted.id,
      severity: 'action',
      recommendation: 'protect_recovery',
      summary: 'Lange reale Einheit erkannt; Folgetage muessen Belastung absorbieren.',
      evidence: [`${longCompleted.activityType} ${longCompleted.durationMin} min`, `TSS ${longCompleted.tss ?? 'unbekannt'}`, `TSB ${input.tsb.toFixed(1)}`],
    }));
  }

  if (giLog) {
    events.push(event({
      today: input.today,
      kind: 'fueling_limiter',
      sourceId: giLog.date,
      severity: 'watch',
      recommendation: 'reduce_volume',
      summary: 'Fueling-Vertraeglichkeit begrenzt die naechste lange Einheit.',
      evidence: [`GI-Komfort ${giLog.giComfort}`, giLog.carbsG != null ? `${giLog.carbsG} g Carbs` : 'Carbs nicht geloggt'],
    }));
  }

  if (highRpe) {
    events.push(event({
      today: input.today,
      kind: 'high_rpe',
      sourceId: highRpe.id,
      severity: 'watch',
      recommendation: 'reduce_intensity',
      summary: 'Hohe RPE spricht gegen direktes Nachlegen harter Reize.',
      evidence: [`RPE ${highRpe.rpe}/10`, `${highRpe.activityType} ${highRpe.durationMin} min`],
    }));
  }

  if (input.missedWorkouts.length > 0) {
    events.push(event({
      today: input.today,
      kind: 'planned_workout_missed',
      sourceId: input.missedWorkouts[0]!.id,
      severity: 'watch',
      recommendation: 'move_workout',
      summary: 'Mindestens eine geplante Einheit wurde nicht ausgefuehrt.',
      evidence: input.missedWorkouts.slice(0, 2).map(w => `${w.plannedDate}: ${w.activityType} Z${w.zone} ${w.durationMin} min`),
    }));
  }

  if (input.mental && input.mental.energy <= 3 && input.mental.stress >= 7) {
    events.push(event({
      today: input.today,
      kind: 'mental_load',
      severity: 'watch',
      recommendation: 'protect_recovery',
      summary: 'Mentale Last spricht fuer weniger Entscheidungsdruck.',
      evidence: [`Energie ${input.mental.energy}/10`, `Stress ${input.mental.stress}/10`],
    }));
  }

  if (input.readinessScore < 55 || input.tsb <= -12) {
    events.push(event({
      today: input.today,
      kind: 'recovery_risk',
      severity: 'action',
      recommendation: 'protect_recovery',
      summary: 'Readiness/TSB sprechen fuer Erholungsprioritaet.',
      evidence: [`Readiness ${input.readinessScore}/100`, `TSB ${input.tsb.toFixed(1)}`],
    }));
  }

  if (input.syncDebtCount > 0) {
    events.push(event({
      today: input.today,
      kind: 'sync_debt',
      severity: 'action',
      recommendation: 'sync_garmin',
      summary: 'Garmin-Sync-Schulden muessen vor Ausfuehrung geschlossen werden.',
      evidence: [`${input.syncDebtCount} offene Einheit(en)`],
    }));
  }

  if (events.length === 0) {
    events.push(event({
      today: input.today,
      kind: 'recovery_risk',
      severity: 'info',
      recommendation: 'keep_plan',
      summary: 'Keine harte Anpassung noetig; Plan beibehalten.',
      evidence: [`Readiness ${input.readinessScore}/100`, `TSB ${input.tsb.toFixed(1)}`],
    }));
  }

  return events;
}
```

- [ ] **Step 2: Run focused test**

Run:

```bash
npm test -w backend -- --run src/pulse/services/adaptation-events.test.ts
```

Expected: PASS.

## Task 3: Persist Adaptation Events

- [ ] **Step 1: Create migration**

Create `backend/src/db/migrations/0032_adaptation_events.sql`:

```sql
CREATE TABLE IF NOT EXISTS "pulse_adaptation_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "event_date" date NOT NULL,
  "kind" varchar(48) NOT NULL,
  "source_id" varchar(128) NOT NULL DEFAULT '',
  "severity" varchar(16) NOT NULL,
  "recommendation" varchar(48) NOT NULL,
  "summary" text NOT NULL,
  "evidence" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "resolved_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "pulse_adaptation_events_unique_source_idx"
  ON "pulse_adaptation_events" ("user_id", "event_date", "kind", "source_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pulse_adaptation_events_open_idx"
  ON "pulse_adaptation_events" ("user_id", "event_date", "resolved_at");
```

- [ ] **Step 2: Add schema table**

Add `pulseAdaptationEvents` to `backend/src/db/pulse-schema.ts` using the same columns. Keep `sourceId` non-null with default `''` in the DB model and map `''` back to `null` in API responses. Append a matching `backend/src/db/migrations/meta/_journal.json` entry with the next `idx`, matching `tag`, `version: "7"` and `breakpoints: true`; run `npm run check:migrations` before schema work continues.

- [ ] **Step 3: Add store helpers**

Add to `backend/src/pulse/services/adaptation-events.ts`:

```ts
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { pulseAdaptationEvents } from '../../db/pulse-schema.js';

export async function upsertAdaptationEvents(db: NodePgDatabase, userId: string, events: PulseAdaptationEvent[]): Promise<void> {
  for (const item of events) {
    await db.insert(pulseAdaptationEvents)
      .values({
        userId,
        eventDate: item.eventDate,
        kind: item.kind,
        sourceId: item.sourceId ?? '',
        severity: item.severity,
        recommendation: item.recommendation,
        summary: item.summary,
        evidence: item.evidence,
        resolvedAt: item.resolvedAt ? new Date(item.resolvedAt) : null,
      })
      .onConflictDoUpdate({
        target: [pulseAdaptationEvents.userId, pulseAdaptationEvents.eventDate, pulseAdaptationEvents.kind, pulseAdaptationEvents.sourceId],
        set: {
          severity: item.severity,
          recommendation: item.recommendation,
          summary: item.summary,
          evidence: item.evidence,
          resolvedAt: item.resolvedAt ? new Date(item.resolvedAt) : null,
        },
      });
  }
}

export async function loadOpenAdaptationEvents(
  db: NodePgDatabase,
  userId: string,
  today: string,
): Promise<PulseAdaptationEvent[]> {
  const rows = await db
    .select()
    .from(pulseAdaptationEvents)
    .where(and(
      eq(pulseAdaptationEvents.userId, userId),
      eq(pulseAdaptationEvents.eventDate, today),
      isNull(pulseAdaptationEvents.resolvedAt),
    ))
    .orderBy(desc(pulseAdaptationEvents.createdAt));

  return rows.map(row => ({
    id: row.id,
    userId: row.userId,
    eventDate: row.eventDate,
    kind: row.kind as PulseAdaptationEventKind,
    sourceId: row.sourceId === '' ? null : row.sourceId,
    severity: row.severity as PulseAdaptationEvent['severity'],
    recommendation: row.recommendation as PulseAdaptationRecommendation,
    summary: row.summary,
    evidence: row.evidence as string[],
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  }));
}
```

- [ ] **Step 4: Run checks**

Run:

```bash
npm run check:migrations
npm run build -w backend
```

Expected: PASS.

## Task 4: Feed Home And Plan

- [ ] **Step 1: Add read endpoint**

In `backend/src/pulse/routes/training-routes.ts`, add:

```ts
import { db } from '../../lib/db.js';

app.get('/plan/adaptation-events', { onRequest: [app.authenticate] }, async (req) => {
  const userId = req.user.sub;
  const today = new Date().toISOString().slice(0, 10);
  const events = await loadOpenAdaptationEvents(db, userId, today);
  return { events };
});
```

- [ ] **Step 2: Hook classifier into existing sync/reconciliation paths**

Call `classifyAdaptationEvents` after:

- Garmin day sync finishes and activities are written.
- Workout reconciliation marks missed/replaced/completed states.
- RPE/fueling feedback is saved.
- Garmin ledger creates action-level sync debt.

Only persist events; do not auto-apply plan changes in this plan.

- [ ] **Step 3: Add frontend hook**

Add `pulseApi.adaptationEvents()` and `useAdaptationEvents()` in `frontend/src/pulse/api-client.ts` and `frontend/src/pulse/hooks.ts`.

- [ ] **Step 4: Show a compact adaptation strip on Home**

In `frontend/src/pages/Home.tsx`, show only the highest severity event:

```tsx
{primaryAdaptation && (
  <section className="card" data-testid="home-adaptation-event">
    <span className="label-mono">PLAN GEPRUEFT</span>
    <h3>{primaryAdaptation.summary}</h3>
    <p>{primaryAdaptation.evidence.slice(0, 2).join(' · ')}</p>
    <button onClick={() => navigate('/plan?tab=training#plan-scenario-preview')}>Im Plan pruefen</button>
  </section>
)}
```

- [ ] **Step 5: Show full list on Plan**

In `frontend/src/pages/Plan.tsx`, place a compact `Adaptionshinweise` card near the current plan decision and map events to actions: `sync_garmin` opens Settings, `protect_recovery` opens reduce-volume scenario, `move_workout` opens scenario preview.

- [ ] **Step 6: Verification**

Run:

```bash
npm run build -w shared
npm test -w backend -- --run src/pulse/services/adaptation-events.test.ts src/pulse/plugin.test.ts
npm run build -w frontend
npm run test:e2e:smoke
```

Expected: all pass, or smoke blocker is documented with `npm run verify:local:no-services`.

Add targeted browser assertions with fixture data:

- Home shows only the highest-severity adaptation event.
- Plan maps `sync_garmin`, `protect_recovery` and `move_workout` to the intended action target.
- Completed-activity fixture still prioritizes feedback/fueling/recovery and does not show "Heute ist kein Training geplant" as the primary decision.

## Acceptance

- One central classifier explains why Pulse wants to keep, reduce, move, sync or recover.
- Preserve existing completed-activity behavior and add a regression test that adaptation events do not reintroduce "no training planned" as the primary Home decision.
- No plan mutation happens invisibly.
- Plan and Home use the same adaptation reason.
