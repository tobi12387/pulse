# Power Duration And Durability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add WKO/Intervals-style performance depth through best efforts, power-duration curve, durability and limiter signals without turning Pulse into an analytics cockpit.

**Architecture:** Build pure analytics from trusted activity streams first and lap approximations only when `2026-05-10-power-data-quality-foundation.md` marks them usable with caution. Persist compact derived metrics per activity plus a latest user profile snapshot. Feed only high-value limiters into Plan/Data; Home gets no extra chart noise. This plan must not update FTP automatically.

**Tech Stack:** TypeScript analytics services, Drizzle/Postgres, Garmin detail cache, React Data/Plan surfaces, Vitest.

**Implementation note:** Implemented as a quality-gated v1. Activity detail persists compact power-duration snapshots from trusted streams or cautious lap approximations; `/training-analytics` exposes a summary for Data > Analysen; Plan receives a Durability limiter only when the latest usable snapshot is actually `limited`. FTP/profile values remain unchanged.

---

## Files

- Create: `backend/src/db/migrations/0033_power_duration_durability.sql`
- Modify: `backend/src/db/migrations/meta/_journal.json`
- Modify: `backend/src/db/pulse-schema.ts`
- Modify: `shared/types/pulse/training.ts`
- Create: `backend/src/pulse/services/power-duration.ts`
- Create: `backend/src/pulse/services/power-duration.test.ts`
- Modify: `backend/src/pulse/routes/activity-routes.ts`
- Modify: `backend/src/pulse/routes/training-routes.ts`
- Modify: `backend/src/pulse/services/goal-limiters.ts`
- Modify: `frontend/src/pages/Data.tsx`
- Modify: `frontend/src/pages/Plan.tsx`

## Task 1: Pure Power-Duration Functions

- [x] **Step 1: Create tests**

Create `backend/src/pulse/services/power-duration.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { bestPowerEfforts, deriveDurabilitySignal } from './power-duration.js';

describe('power-duration analytics', () => {
  it('finds best rolling power efforts for standard durations', () => {
    const power = Array.from({ length: 3600 }, (_, i) => i >= 1200 && i < 1800 ? 280 : 180);
    const efforts = bestPowerEfforts(power, [60, 300, 1200]);

    expect(efforts.find(e => e.durationSec === 300)?.avgPowerW).toBe(280);
    expect(efforts.find(e => e.durationSec === 1200)?.avgPowerW).toBeGreaterThan(220);
  });

  it('marks durability as limited when late power drops at similar HR', () => {
    const result = deriveDurabilitySignal({
      durationSec: 4 * 3600,
      firstHalfPowerW: 210,
      secondHalfPowerW: 165,
      firstHalfHr: 135,
      secondHalfHr: 138,
    });

    expect(result.rating).toBe('limited');
    expect(result.evidence.join(' ')).toContain('Power -21%');
  });
});
```

- [x] **Step 2: Implement rolling best efforts**

Create `backend/src/pulse/services/power-duration.ts`:

```ts
export interface PowerEffort {
  durationSec: number;
  avgPowerW: number;
  startSec: number;
}

export function bestPowerEfforts(powerStream: readonly number[], durationsSec: readonly number[]): PowerEffort[] {
  const prefix = [0];
  for (const value of powerStream) prefix.push(prefix[prefix.length - 1]! + Math.max(0, Number.isFinite(value) ? value : 0));
  return durationsSec
    .filter(duration => duration > 0 && duration <= powerStream.length)
    .map(duration => {
      let best = 0;
      let startSec = 0;
      for (let start = 0; start + duration <= powerStream.length; start += 1) {
        const avg = (prefix[start + duration]! - prefix[start]!) / duration;
        if (avg > best) {
          best = avg;
          startSec = start;
        }
      }
      return { durationSec: duration, avgPowerW: Math.round(best), startSec };
    });
}

export interface DurabilitySignal {
  rating: 'strong' | 'watch' | 'limited';
  powerDropPct: number;
  hrDriftBpm: number;
  evidence: string[];
}

export function deriveDurabilitySignal(input: {
  durationSec: number;
  firstHalfPowerW: number;
  secondHalfPowerW: number;
  firstHalfHr: number;
  secondHalfHr: number;
}): DurabilitySignal {
  const powerDropPct = input.firstHalfPowerW > 0
    ? Math.round(((input.secondHalfPowerW - input.firstHalfPowerW) / input.firstHalfPowerW) * 100)
    : 0;
  const hrDriftBpm = Math.round(input.secondHalfHr - input.firstHalfHr);
  const rating = input.durationSec >= 10_800 && powerDropPct <= -18 && hrDriftBpm <= 8
    ? 'limited'
    : powerDropPct <= -10 || hrDriftBpm >= 10
      ? 'watch'
      : 'strong';
  return {
    rating,
    powerDropPct,
    hrDriftBpm,
    evidence: [`Power ${powerDropPct}%`, `HR ${hrDriftBpm >= 0 ? '+' : ''}${hrDriftBpm} bpm`, `${Math.round(input.durationSec / 60)} min`],
  };
}
```

- [x] **Step 3: Run test**

Run:

```bash
npm test -w backend -- --run src/pulse/services/power-duration.test.ts
```

Expected: PASS.

## Task 2: Persist Compact Metrics

- [x] **Step 1: Migration**

Create `backend/src/db/migrations/0033_power_duration_durability.sql`:

```sql
CREATE TABLE IF NOT EXISTS "pulse_power_duration_snapshots" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "activity_id" uuid NOT NULL REFERENCES "pulse_activities"("id") ON DELETE CASCADE,
  "activity_date" date NOT NULL,
  "best_efforts" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "durability" jsonb,
  "quality_source" varchar(32) NOT NULL DEFAULT 'unavailable',
  "quality_status" varchar(32) NOT NULL DEFAULT 'blocked',
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "pulse_power_duration_activity_uq"
  ON "pulse_power_duration_snapshots" ("activity_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pulse_power_duration_user_date_idx"
  ON "pulse_power_duration_snapshots" ("user_id", "activity_date" DESC);
```

- [x] **Step 2: Add schema table**

Add `pulsePowerDurationSnapshots` in `backend/src/db/pulse-schema.ts`. Append a matching `backend/src/db/migrations/meta/_journal.json` entry with the next `idx`, matching `tag`, `version: "7"` and `breakpoints: true`; run `npm run check:migrations` before schema work continues.

- [x] **Step 3: Fill after activity detail cache**

In `backend/src/pulse/routes/activity-routes.ts`, after Garmin detail streams/laps are cached, load the quality result from `classifyPowerDataQuality`.

- If `source === 'stream' && status === 'trusted'`, compute true rolling best efforts from `pulse_activity_streams.powerStream`.
- If `source === 'lap_approximation' && status === 'usable_with_caution'`, compute only coarse lap-derived efforts and mark every row with `quality_source = 'lap_approximation'`.
- If `status === 'blocked'`, do not create a power-duration snapshot; return a visible quality warning instead.

If current Garmin detail routes do not populate `pulse_activity_streams`, keep v1 lap-only and record that limitation in `quality_source`; do not pretend rolling 60s/300s/1200s best efforts are stream-derived.

- [x] **Step 4: Test route behavior**

Extend `backend/src/pulse/plugin.test.ts` activity detail test:

```ts
expect(await db.select().from(pulsePowerDurationSnapshots)).toEqual(expect.arrayContaining([
  expect.objectContaining({
    activityId: activityIdWithPower,
    qualitySource: 'lap_approximation',
    bestEfforts: expect.arrayContaining([expect.objectContaining({ durationSec: 300, source: 'lap_approximation' })]),
  }),
]));
```

## Task 3: Feed Goal Limiters

- [x] **Step 1: Extend limiter kinds**

In `shared/types/pulse/plan.ts`, extend `PulseGoalLimiterKind`:

```ts
export type PulseGoalLimiterKind =
  | 'long_endurance_fueling'
  | 'threshold_vo2'
  | 'durability'
  | 'anaerobic_repeatability';
```

- [x] **Step 2: Extend limiter input and route wiring**

In `backend/src/pulse/services/goal-limiters.ts`, extend `DeriveGoalLimiterInput`:

```ts
durability: {
  rating: 'strong' | 'watch' | 'limited';
  evidence: string[];
  qualitySource: 'stream' | 'lap_approximation';
  qualityStatus: 'trusted' | 'usable_with_caution';
} | null;
```

In `backend/src/pulse/routes/training-routes.ts`, query the latest `pulsePowerDurationSnapshots` row for the user, map it into `deriveGoalLimiter`, and include the durability limiter in the plan trace/API response. If the latest quality status is `blocked`, pass `durability: null`.

- [x] **Step 3: Update `goal-limiters.ts`**

Add logic:

```ts
if (input.durability?.rating === 'limited') {
  return {
    kind: 'durability',
    label: 'Durability',
    confidence: input.durability.qualitySource === 'stream' ? 'high' : 'medium',
    evidence: [...input.durability.evidence, `Quelle: ${input.durability.qualitySource}`],
    planBias: 'lange Ausdauer progressiv verlaengern und Spaetleistungsabfall reduzieren',
    workoutFocus: ['long_endurance', 'endurance'],
  };
}
```

- [x] **Step 4: Show compact evidence**

In `frontend/src/pages/Data.tsx`, add a small performance card in the existing training/analytics area:

```tsx
<section className="card" data-testid="power-duration-summary">
  <span className="label-mono">POWER / DURABILITY</span>
  <p>{summary.bestEffortLine}</p>
  <p>{summary.durabilityLine}</p>
</section>
```

In `frontend/src/pages/Plan.tsx`, show the active limiter only if it changes the plan bias.

- [x] **Step 5: Verification**

Run:

```bash
npm run check:migrations
npm test -w backend -- --run src/pulse/services/power-duration.test.ts src/pulse/services/goal-limiters.test.ts src/pulse/plugin.test.ts
npm run build -w frontend
```

Expected: PASS.

## Acceptance

- Best efforts and durability are derived from real cached activity data.
- Every derived metric carries `qualitySource` and `qualityStatus`.
- Plan can cite durability as a limiter without adding a new dashboard.
- No proprietary WKO formulas are copied.
- Missing power data degrades cleanly.
- FTP/profile values are not changed in this plan.
