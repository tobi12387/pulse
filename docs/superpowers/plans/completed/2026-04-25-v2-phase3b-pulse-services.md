# Pulse Services & Adapters (Phase 3b) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the Pulse backend services (load engine, coach engine, insight engine, plan engine, review engine) and the Garmin adapter, then wire them into the existing Phase 3a plugin stubs.

**Architecture:** Services in `backend/src/pulse/services/`. The Garmin adapter (`backend/src/pulse/adapters/garmin-client.ts`) calls the Python sidecar at `env.GARMIN_SIDECAR_URL` and upserts results to `pulse_daily_metrics` + `pulse_sleep_sessions`. All LLM calls reuse existing `src/lib/llm.ts` — no parallel LLM client. The load engine reads `pulse_activities`, computes CTL/ATL/TSB, and replaces the `tsb: 0` stubs in `plugin.ts`. Phase 3b ends with the `/api/pulse/home` route returning real fitness load and the garmin-sync worker actually syncing data.

**Prerequisite:** Phase 3a must be fully implemented (57 tests passing, all pulse_ tables exist).

**Repo root:** `/root/coaching-os-v2`

---

## File Map

| Action | Path |
|--------|------|
| Create | `backend/src/pulse/services/load-engine.ts` |
| Create | `backend/src/pulse/services/load-engine.test.ts` |
| Create | `backend/src/pulse/adapters/garmin-client.ts` |
| Create | `backend/src/pulse/adapters/garmin-client.test.ts` |
| Create | `backend/src/pulse/services/coach-engine.ts` |
| Create | `backend/src/pulse/services/coach-engine.test.ts` |
| Create | `backend/src/pulse/services/insight-engine.ts` |
| Create | `backend/src/pulse/services/insight-engine.test.ts` |
| Create | `backend/src/pulse/services/plan-engine.ts` |
| Create | `backend/src/pulse/services/plan-engine.test.ts` |
| Create | `backend/src/pulse/services/review-engine.ts` |
| Create | `backend/src/pulse/services/review-engine.test.ts` |
| Modify | `backend/src/pulse/plugin.ts` |
| Modify | `backend/src/pulse/queues/workers.ts` |

---

## Task 1: Load Engine (CTL/ATL/TSB + Readiness)

**Files:**
- Create: `backend/src/pulse/services/load-engine.ts`
- Create: `backend/src/pulse/services/load-engine.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `backend/src/pulse/services/load-engine.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import {
  computeTss,
  applyEma,
  computeReadinessScore,
} from './load-engine.js';

describe('computeTss', () => {
  it('returns 0 for missing duration', () => {
    expect(computeTss({ activityType: 'bike', durationSec: null, normalizedPowerW: 200, avgPowerW: null, avgHr: null, ftpWatts: 250, maxHrBpm: 185 })).toBe(0);
  });

  it('computes bike TSS correctly: 1h at FTP = 100 TSS', () => {
    const tss = computeTss({
      activityType: 'bike', durationSec: 3600,
      normalizedPowerW: 250, avgPowerW: null,
      avgHr: null, ftpWatts: 250, maxHrBpm: 185,
    });
    expect(tss).toBe(100);
  });

  it('computes bike TSS at 80% FTP = 64 TSS', () => {
    const tss = computeTss({
      activityType: 'bike', durationSec: 3600,
      normalizedPowerW: 200, avgPowerW: null,
      avgHr: null, ftpWatts: 250, maxHrBpm: 185,
    });
    expect(tss).toBe(64);
  });

  it('computes run TSS using HR', () => {
    const tss = computeTss({
      activityType: 'run', durationSec: 3600,
      normalizedPowerW: null, avgPowerW: null,
      avgHr: 155, ftpWatts: 250, maxHrBpm: 185,
    });
    expect(tss).toBeGreaterThan(0);
    expect(tss).toBeLessThan(200);
  });

  it('returns rough estimate for strength', () => {
    const tss = computeTss({
      activityType: 'strength', durationSec: 3600,
      normalizedPowerW: null, avgPowerW: null,
      avgHr: null, ftpWatts: 250, maxHrBpm: 185,
    });
    expect(tss).toBe(40);
  });
});

describe('applyEma', () => {
  it('returns same value for constant input', () => {
    const values = Array(42).fill(100);
    const ema = applyEma(values, 42);
    expect(ema.at(-1)).toBeCloseTo(100, 0);
  });

  it('converges toward the input values over time', () => {
    const values = [...Array(20).fill(0), ...Array(42).fill(100)];
    const ema = applyEma(values, 42);
    expect(ema.at(-1)!).toBeGreaterThan(50);
  });
});

describe('computeReadinessScore', () => {
  it('returns 0-100', () => {
    const r = computeReadinessScore({
      sleepHours: 7.5, hrvStatus: 'balanced',
      bodyBatteryMax: 80, stressAvg: 30,
      mentalScore: 70, tsb: 5,
    });
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
  });

  it('labels excellent for high values', () => {
    const r = computeReadinessScore({
      sleepHours: 8.5, hrvStatus: 'above_normal',
      bodyBatteryMax: 90, stressAvg: 20,
      mentalScore: 85, tsb: 10,
    });
    expect(r.label).toBe('excellent');
  });

  it('labels low for poor values', () => {
    const r = computeReadinessScore({
      sleepHours: 4, hrvStatus: 'poor',
      bodyBatteryMax: 20, stressAvg: 75,
      mentalScore: 30, tsb: -25,
    });
    expect(r.label).toBe('low');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /root/coaching-os-v2/backend && npm test -- src/pulse/services/load-engine.test.ts
```
Expected: FAIL — `Cannot find module './load-engine.js'`

- [ ] **Step 3: Create `backend/src/pulse/services/load-engine.ts`**

```typescript
import { db } from '../../lib/db.js';
import { pulseActivities, pulseUserProfile } from '../../db/pulse-schema.js';
import { eq, gte, and } from 'drizzle-orm';
import type { PulseReadiness, PulseFitnessLoad } from '@coaching-os/shared/pulse';

// ─── TSS Computation ──────────────────────────────────────────────────────────

export interface TssInput {
  activityType: string;
  durationSec: number | null;
  normalizedPowerW: number | null;
  avgPowerW: number | null;
  avgHr: number | null;
  ftpWatts: number;
  maxHrBpm: number;
}

export function computeTss(input: TssInput): number {
  const { activityType, durationSec, normalizedPowerW, avgPowerW, avgHr, ftpWatts, maxHrBpm } = input;
  if (!durationSec || durationSec <= 0) return 0;

  const durationH = durationSec / 3600;

  if (activityType === 'bike') {
    const np = normalizedPowerW ?? avgPowerW;
    if (!np || !ftpWatts) return 0;
    const ifFactor = np / ftpWatts;
    return Math.round(durationH * ifFactor * ifFactor * 100);
  }

  if (activityType === 'run') {
    if (!avgHr || !maxHrBpm) return Math.round(durationH * 50);
    const lthr = maxHrBpm * 0.88;
    const hrRatio = avgHr / lthr;
    return Math.round(durationH * hrRatio * hrRatio * 100 * 1.5);
  }

  // swim, strength, hike, other — rough estimate
  return Math.round(durationH * 40);
}

// ─── EMA (Exponential Moving Average) ────────────────────────────────────────

export function applyEma(values: number[], tau: number): number[] {
  const alpha = 1 / tau;
  const result: number[] = [];
  let ema = values[0] ?? 0;
  for (const v of values) {
    ema = ema + alpha * (v - ema);
    result.push(ema);
  }
  return result;
}

// ─── Fitness Load (CTL/ATL/TSB) ───────────────────────────────────────────────

function dateStr(daysAgo: number, from: Date): string {
  const d = new Date(from);
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0]!;
}

export async function computeFitnessLoad(userId: string, referenceDate: string): Promise<PulseFitnessLoad> {
  const [profile] = await db.select({
    ftpWatts: pulseUserProfile.ftpWatts,
    maxHrBpm: pulseUserProfile.maxHrBpm,
  }).from(pulseUserProfile).where(eq(pulseUserProfile.userId, userId));

  const ftpWatts = profile?.ftpWatts ?? 200;
  const maxHrBpm = profile?.maxHrBpm ?? 185;

  const refDate = new Date(referenceDate);
  const since = dateStr(60, refDate);

  const activities = await db.select({
    startTime: pulseActivities.startTime,
    activityType: pulseActivities.activityType,
    durationSec: pulseActivities.durationSec,
    normalizedPowerW: pulseActivities.normalizedPowerW,
    avgPowerW: pulseActivities.avgPowerW,
    avgHr: pulseActivities.avgHr,
    tss: pulseActivities.tss,
  }).from(pulseActivities)
    .where(and(
      eq(pulseActivities.userId, userId),
      gte(pulseActivities.startTime, new Date(since)),
    ));

  // Build daily TSS map for last 60 days
  const tssPerDay: Record<string, number> = {};
  for (const act of activities) {
    const day = act.startTime.toISOString().split('T')[0]!;
    const tss = act.tss ?? computeTss({
      activityType: act.activityType,
      durationSec: act.durationSec,
      normalizedPowerW: act.normalizedPowerW,
      avgPowerW: act.avgPowerW,
      avgHr: act.avgHr,
      ftpWatts,
      maxHrBpm,
    });
    tssPerDay[day] = (tssPerDay[day] ?? 0) + tss;
  }

  // Fill 60-day array (oldest first)
  const dailyTss: number[] = [];
  for (let i = 59; i >= 0; i--) {
    const day = dateStr(i, refDate);
    dailyTss.push(tssPerDay[day] ?? 0);
  }

  const ctlSeries = applyEma(dailyTss, 42);
  const atlSeries = applyEma(dailyTss, 7);

  const ctl = Math.round((ctlSeries.at(-1) ?? 0) * 10) / 10;
  const atl = Math.round((atlSeries.at(-1) ?? 0) * 10) / 10;
  const tsb = Math.round((ctl - atl) * 10) / 10;

  return { ctl, atl, tsb, date: referenceDate };
}

// ─── Readiness Score ──────────────────────────────────────────────────────────

export interface ReadinessInput {
  sleepHours: number | null;
  hrvStatus: string | null;
  bodyBatteryMax: number | null;
  stressAvg: number | null;
  mentalScore: number | null; // 0-100, pre-computed avg of mood/energy/motivation
  tsb: number;
}

export function computeReadinessScore(input: ReadinessInput): PulseReadiness {
  const sleep = input.sleepHours != null
    ? Math.min(input.sleepHours / 8, 1) * 100
    : 60;

  const hrv = ({
    above_normal: 100,
    balanced: 80,
    normal: 80,
    below_normal: 50,
    poor: 25,
  }[input.hrvStatus ?? ''] ?? 60);

  const tsb = Math.max(0, Math.min(100, (input.tsb + 30) / 60 * 100));

  const battery = input.bodyBatteryMax ?? 60;

  const mental = input.mentalScore ?? 60;

  const stress = input.stressAvg != null
    ? Math.max(0, 100 - input.stressAvg)
    : 60;

  const score = Math.round(
    sleep   * 0.25 +
    hrv     * 0.25 +
    tsb     * 0.20 +
    battery * 0.15 +
    mental  * 0.10 +
    stress  * 0.05,
  );

  const label: PulseReadiness['label'] =
    score >= 80 ? 'excellent' :
    score >= 65 ? 'good' :
    score >= 45 ? 'moderate' : 'low';

  return {
    score,
    components: { sleep, hrv, tsb, battery, mental, stress },
    label,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /root/coaching-os-v2/backend && npm test -- src/pulse/services/load-engine.test.ts
```
Expected: 8 tests pass.

- [ ] **Step 5: Commit**

```bash
git -C /root/coaching-os-v2 add backend/src/pulse/services/load-engine.ts backend/src/pulse/services/load-engine.test.ts
git -C /root/coaching-os-v2 commit -m "feat: add pulse load engine (CTL/ATL/TSB, TSS, readiness)"
```

---

## Task 2: Garmin Adapter

**Files:**
- Create: `backend/src/pulse/adapters/garmin-client.ts`
- Create: `backend/src/pulse/adapters/garmin-client.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `backend/src/pulse/adapters/garmin-client.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

vi.mock('../../lib/env.js', () => ({
  env: {
    GARMIN_SIDECAR_URL: 'http://localhost:8001',
    GARMIN_EMAIL: 'test@test.com',
    GARMIN_PASSWORD: 'pass',
    NODE_ENV: 'test',
  },
}));

vi.mock('../../lib/db.js', () => ({
  db: {
    insert: vi.fn(() => ({ values: vi.fn(() => ({ onConflictDoUpdate: vi.fn() })) })),
  },
}));

vi.mock('../../db/pulse-schema.js', () => ({
  pulseDailyMetrics: {},
  pulseSleepSessions: {},
}));

describe('syncGarminForDate', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('calls the sidecar with correct payload', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        status: 'ok', date: '2026-04-25',
        hrv_rmssd: 45, hrv_status: 'balanced',
        resting_hr: 52, sleep_hours: 7.5, sleep_score: 78,
        body_battery_min: 20, body_battery_max: 85,
        stress_avg: 28, steps: 9200, calories_active: 450,
        sleep_deep_h: 1.2, sleep_rem_h: 1.8, sleep_light_h: 3.5, sleep_awake_h: 0.5,
      }),
    });

    const { syncGarminForDate } = await import('./garmin-client.js');
    await syncGarminForDate('user-123', '2026-04-25');

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8001/sync',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"date":"2026-04-25"'),
      }),
    );
  });

  it('throws on sidecar error', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

    const { syncGarminForDate } = await import('./garmin-client.js');
    await expect(syncGarminForDate('user-123', '2026-04-25')).rejects.toThrow('500');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /root/coaching-os-v2/backend && npm test -- src/pulse/adapters/garmin-client.test.ts
```
Expected: FAIL — `Cannot find module './garmin-client.js'`

- [ ] **Step 3: Create `backend/src/pulse/adapters/garmin-client.ts`**

```typescript
import { env } from '../../lib/env.js';
import { db } from '../../lib/db.js';
import { pulseDailyMetrics, pulseSleepSessions } from '../../db/pulse-schema.js';

interface SidecarResponse {
  status: string;
  date: string;
  hrv_rmssd?: number;
  hrv_status?: string;
  resting_hr?: number;
  sleep_hours?: number;
  sleep_score?: number;
  body_battery_min?: number;
  body_battery_max?: number;
  stress_avg?: number;
  steps?: number;
  calories_active?: number;
  sleep_deep_h?: number;
  sleep_rem_h?: number;
  sleep_light_h?: number;
  sleep_awake_h?: number;
}

export async function syncGarminForDate(userId: string, dateStr: string): Promise<void> {
  const res = await fetch(`${env.GARMIN_SIDECAR_URL}/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      date: dateStr,
      garmin_email: env.GARMIN_EMAIL,
      garmin_password: env.GARMIN_PASSWORD,
    }),
  });

  if (!res.ok) throw new Error(`Garmin sidecar error: ${res.status}`);

  const data = await res.json() as SidecarResponse;

  // Upsert daily metrics
  await db.insert(pulseDailyMetrics).values({
    userId,
    date: dateStr,
    hrvRmssd:       data.hrv_rmssd    ?? null,
    hrvStatus:      data.hrv_status   ?? null,
    restingHr:      data.resting_hr   ?? null,
    sleepHours:     data.sleep_hours  ?? null,
    sleepScore:     data.sleep_score  ?? null,
    bodyBatteryMin: data.body_battery_min ?? null,
    bodyBatteryMax: data.body_battery_max ?? null,
    stressAvg:      data.stress_avg   ?? null,
    steps:          data.steps        ?? null,
    caloriesActive: data.calories_active ?? null,
    source: 'garmin',
    syncedAt: new Date(),
  }).onConflictDoUpdate({
    target: [pulseDailyMetrics.userId, pulseDailyMetrics.date],
    set: {
      hrvRmssd:       data.hrv_rmssd    ?? null,
      hrvStatus:      data.hrv_status   ?? null,
      restingHr:      data.resting_hr   ?? null,
      sleepHours:     data.sleep_hours  ?? null,
      sleepScore:     data.sleep_score  ?? null,
      bodyBatteryMin: data.body_battery_min ?? null,
      bodyBatteryMax: data.body_battery_max ?? null,
      stressAvg:      data.stress_avg   ?? null,
      steps:          data.steps        ?? null,
      caloriesActive: data.calories_active ?? null,
      syncedAt: new Date(),
    },
  });

  // Upsert sleep session if we have sleep data
  if (data.sleep_hours != null) {
    await db.insert(pulseSleepSessions).values({
      userId,
      date: dateStr,
      durationH:   data.sleep_hours,
      deepSleepH:  data.sleep_deep_h  ?? null,
      remSleepH:   data.sleep_rem_h   ?? null,
      lightSleepH: data.sleep_light_h ?? null,
      awakeH:      data.sleep_awake_h ?? null,
      sleepScore:  data.sleep_score   ?? null,
      source: 'garmin',
    }).onConflictDoUpdate({
      target: [pulseSleepSessions.userId, pulseSleepSessions.date],
      set: {
        durationH:   data.sleep_hours,
        deepSleepH:  data.sleep_deep_h  ?? null,
        remSleepH:   data.sleep_rem_h   ?? null,
        lightSleepH: data.sleep_light_h ?? null,
        awakeH:      data.sleep_awake_h ?? null,
        sleepScore:  data.sleep_score   ?? null,
      },
    });
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /root/coaching-os-v2/backend && npm test -- src/pulse/adapters/garmin-client.test.ts
```
Expected: 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git -C /root/coaching-os-v2 add backend/src/pulse/adapters/garmin-client.ts backend/src/pulse/adapters/garmin-client.test.ts
git -C /root/coaching-os-v2 commit -m "feat: add pulse garmin adapter (sidecar calls + upsert)"
```

---

## Task 3: Coach Engine

**Files:**
- Create: `backend/src/pulse/services/coach-engine.ts`
- Create: `backend/src/pulse/services/coach-engine.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `backend/src/pulse/services/coach-engine.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../lib/llm.js', () => ({
  llmComplete: vi.fn().mockResolvedValue('LLM-Antwort für unbekannten Intent.'),
  FAST_MODEL: 'test-model',
  SMART_MODEL: 'test-model',
}));

vi.mock('../../lib/env.js', () => ({
  env: {
    FAST_MODEL: 'test-model', SMART_MODEL: 'test-model',
    OPENROUTER_API_KEY: 'test', APP_URL: 'http://localhost:3000',
  },
}));

describe('detectIntent', () => {
  it('detects greeting', async () => {
    const { detectIntent } = await import('./coach-engine.js');
    expect(detectIntent('Hallo!')).toBe('greeting');
    expect(detectIntent('Hey Coach')).toBe('greeting');
    expect(detectIntent('Guten Morgen')).toBe('greeting');
  });

  it('detects sleep query', async () => {
    const { detectIntent } = await import('./coach-engine.js');
    expect(detectIntent('Wie war mein Schlaf?')).toBe('sleep');
    expect(detectIntent('Ich bin müde heute')).toBe('sleep');
  });

  it('detects hrv query', async () => {
    const { detectIntent } = await import('./coach-engine.js');
    expect(detectIntent('Was bedeutet mein HRV?')).toBe('hrv');
  });

  it('returns null for unknown input', async () => {
    const { detectIntent } = await import('./coach-engine.js');
    expect(detectIntent('Was ist der Sinn des Lebens?')).toBeNull();
  });
});

describe('getCoachReply', () => {
  it('returns rule-based reply for greeting', async () => {
    const { getCoachReply } = await import('./coach-engine.js');
    const reply = await getCoachReply('Hallo!', {
      readiness: 75, sleepHours: 7.5, hrvStatus: 'balanced',
      bodyBatteryMax: 80, tsb: 5, stressAvg: 30,
    });
    expect(reply).toContain('75');
    expect(typeof reply).toBe('string');
  });

  it('falls back to LLM for unrecognized message', async () => {
    const { llmComplete } = await import('../../lib/llm.js');
    const { getCoachReply } = await import('./coach-engine.js');
    await getCoachReply('Was ist der Sinn des Lebens?', {
      readiness: 70, sleepHours: 7, hrvStatus: 'normal',
      bodyBatteryMax: 70, tsb: 0, stressAvg: 40,
    });
    expect(llmComplete).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /root/coaching-os-v2/backend && npm test -- src/pulse/services/coach-engine.test.ts
```
Expected: FAIL — `Cannot find module './coach-engine.js'`

- [ ] **Step 3: Create `backend/src/pulse/services/coach-engine.ts`**

```typescript
import { llmComplete, FAST_MODEL } from '../../lib/llm.js';

export interface CoachContext {
  readiness: number;
  sleepHours: number | null;
  hrvStatus: string | null;
  bodyBatteryMax: number | null;
  tsb: number;
  stressAvg: number | null;
}

const INTENTS: Array<{ name: string; pattern: RegExp }> = [
  { name: 'greeting',    pattern: /^(hallo|hi|hey|guten morgen|servus|moin)/i },
  { name: 'readiness',   pattern: /(readiness|bereit|wie.*fit|topfit|in form)/i },
  { name: 'sleep',       pattern: /(schlaf|schlafen|müde|ausgeschlafen)/i },
  { name: 'hrv',         pattern: /(hrv|herzrate|herzratenvariabil)/i },
  { name: 'load',        pattern: /(ctl|atl|tsb|trainingsbelastung|trainingslast)/i },
  { name: 'training',    pattern: /(trainingsplan|heute.*training|workout|was.*trainier)/i },
  { name: 'nutrition',   pattern: /(ernährung|essen|protein|kohlenhydrat|kalorien)/i },
  { name: 'race',        pattern: /(wettkampf|rennen|race|event)/i },
  { name: 'injury',      pattern: /(verletzung|schmerz|weh|übertraining)/i },
  { name: 'motivation',  pattern: /(motivat|demotiviert|lustlos|keine.*lust)/i },
  { name: 'weather',     pattern: /(wetter|regen|draußen|outdoor)/i },
  { name: 'goal',        pattern: /(ziel|goal|target|anpeilen)/i },
  { name: 'recovery',    pattern: /(erholung|recovery|regeneration)/i },
  { name: 'weight',      pattern: /(gewicht|weight.*kg|abnehm)/i },
];

export function detectIntent(message: string): string | null {
  for (const { name, pattern } of INTENTS) {
    if (pattern.test(message)) return name;
  }
  return null;
}

function ruleReply(intent: string, ctx: CoachContext): string | null {
  const r = ctx.readiness;
  const intensityAdvice = r >= 70
    ? 'Grünes Licht für hartes Training (Zone 4-5).'
    : r >= 50
    ? 'Moderates Training (Zone 2-3) ist ideal.'
    : 'Heute besser regenerieren — Zone 1 oder Pause.';

  switch (intent) {
    case 'greeting':
      return `Hallo! Deine Readiness heute: ${r}/100. ${intensityAdvice} Wie kann ich dir helfen?`;

    case 'readiness':
      return `Deine Readiness beträgt ${r}/100. Schlaf: ${ctx.sleepHours?.toFixed(1) ?? '–'}h, HRV: ${ctx.hrvStatus ?? '–'}, TSB: ${ctx.tsb}. ${intensityAdvice}`;

    case 'sleep':
      return ctx.sleepHours != null
        ? `Du hast ${ctx.sleepHours.toFixed(1)} Stunden geschlafen. ${ctx.sleepHours < 7 ? 'Das ist etwas wenig — priorisiere heute Erholung.' : 'Gute Schlafbasis für das Training!'}`
        : 'Keine Schlafdaten für heute verfügbar. Verbinde Garmin oder Apple Health.';

    case 'hrv':
      return ctx.hrvStatus != null
        ? `Dein HRV-Status: "${ctx.hrvStatus}". ${ctx.hrvStatus === 'poor' || ctx.hrvStatus === 'below_normal' ? 'Dein Nervensystem braucht Erholung — kein intensives Training heute.' : 'Dein Nervensystem ist gut erholt.'}`
        : 'Keine HRV-Daten verfügbar. Stelle sicher, dass du Garmin-Daten synchronisierst.';

    case 'load':
      return `Dein Training Stress Balance (TSB) liegt bei ${ctx.tsb}. ${ctx.tsb > 10 ? 'Du bist frisch und bereit für intensives Training.' : ctx.tsb < -15 ? 'Du akkumulierst Ermüdung — eine Regenerationswoche wäre sinnvoll.' : 'Ausgewogene Trainingsbelastung.'}`;

    case 'training':
      return `Basierend auf Readiness ${r}/100: ${intensityAdvice} ${r >= 65 ? 'Heute wäre ein guter Tag für Qualitätstraining.' : 'Halte die Intensität gering.'}`;

    case 'recovery':
      return `TSB ${ctx.tsb}: ${ctx.tsb < -10 ? 'Du akkumulierst Ermüdung. Plane aktive Erholung: Spazieren, Yoga, Stretching.' : ctx.tsb > 15 ? 'Du bist gut erholt und frisch — nutze diesen Zustand für intensives Training.' : 'Gute Balance zwischen Belastung und Erholung.'}`;

    case 'nutrition':
      return `Für Ausdauersport: 6-8g Kohlenhydrate/kg Körpergewicht an Trainingstagen, 1.6-2g Protein/kg täglich. ${r < 60 ? 'Bei geringer Readiness besonders auf ausreichende Kohlenhydratzufuhr achten.' : 'Bei guter Readiness kannst du die Kohlenhydrate moderat halten.'}`;

    case 'motivation':
      return `Motivationstief? Das ist normal. Deine Readiness (${r}/100) zeigt: ${r < 50 ? 'Dein Körper braucht Pause — Motivation kommt nach Erholung zurück.' : 'Du bist körperlich bereit, der Kopf braucht manchmal einen Schubs. Klein anfangen!'}`;

    case 'weight':
      return 'Gewichtsmanagement im Sport: Fokus auf Qualität der Nahrung, nicht Kalorienzählen. Trainiere nicht nüchtern bei hoher Intensität. Kleine Kaloriendefizite (200-300 kcal) in der Basisphase sind ok.';

    default:
      return null;
  }
}

export async function getCoachReply(message: string, ctx: CoachContext): Promise<string> {
  const intent = detectIntent(message);
  if (intent) {
    const rule = ruleReply(intent, ctx);
    if (rule) return rule;
  }

  // LLM fallback
  const systemPrompt = `Du bist Pulse, ein persönlicher Ausdauercoach. Antworte auf Deutsch, kurz und präzise (max 120 Wörter). Kein Markdown.
Kontext: Readiness ${ctx.readiness}/100, Schlaf ${ctx.sleepHours?.toFixed(1) ?? 'unbekannt'}h, HRV ${ctx.hrvStatus ?? 'unbekannt'}, TSB ${ctx.tsb}.`;

  return llmComplete(systemPrompt, message, FAST_MODEL);
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /root/coaching-os-v2/backend && npm test -- src/pulse/services/coach-engine.test.ts
```
Expected: 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git -C /root/coaching-os-v2 add backend/src/pulse/services/coach-engine.ts backend/src/pulse/services/coach-engine.test.ts
git -C /root/coaching-os-v2 commit -m "feat: add pulse coach engine (14 intents, rule replies, LLM fallback)"
```

---

## Task 4: Insight Engine

**Files:**
- Create: `backend/src/pulse/services/insight-engine.ts`
- Create: `backend/src/pulse/services/insight-engine.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `backend/src/pulse/services/insight-engine.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../lib/llm.js', () => ({
  llmComplete: vi.fn().mockResolvedValue('LLM-generierter Insight.'),
  FAST_MODEL: 'test-model',
}));
vi.mock('../../lib/env.js', () => ({
  env: { FAST_MODEL: 'test-model', OPENROUTER_API_KEY: 'test', APP_URL: 'http://localhost:3000' },
}));

describe('getRuleInsight', () => {
  it('returns insight for hrv_rmssd metric', async () => {
    const { getRuleInsight } = await import('./insight-engine.js');
    const insight = getRuleInsight('hrv_rmssd', 35);
    expect(insight).not.toBeNull();
    expect(typeof insight).toBe('string');
  });

  it('returns insight for sleep_hours metric', async () => {
    const { getRuleInsight } = await import('./insight-engine.js');
    const insight = getRuleInsight('sleep_hours', 5.5);
    expect(insight).toContain('5.5');
  });

  it('returns null for unknown metric', async () => {
    const { getRuleInsight } = await import('./insight-engine.js');
    expect(getRuleInsight('unknown_metric', 42)).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /root/coaching-os-v2/backend && npm test -- src/pulse/services/insight-engine.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Create `backend/src/pulse/services/insight-engine.ts`**

```typescript
import { db } from '../../lib/db.js';
import { pulseInsightsCache } from '../../db/pulse-schema.js';
import { eq, and, gt } from 'drizzle-orm';
import { llmComplete, FAST_MODEL } from '../../lib/llm.js';

export function getRuleInsight(metricKey: string, value: number): string | null {
  switch (metricKey) {
    case 'hrv_rmssd':
      return value < 30
        ? `HRV ${value.toFixed(0)} ms ist niedrig. Dein Nervensystem braucht Erholung — kein intensives Training heute.`
        : value < 50
        ? `HRV ${value.toFixed(0)} ms ist moderat. Moderates Training ist ok, kein Highintensity.`
        : `HRV ${value.toFixed(0)} ms ist gut. Dein Nervensystem ist erholt und bereit.`;

    case 'sleep_hours':
      return value < 6
        ? `${value.toFixed(1)} Stunden Schlaf ist zu wenig. Priorisiere heute Erholung statt intensivem Training.`
        : value < 7.5
        ? `${value.toFixed(1)} Stunden Schlaf ist ok, aber etwas wenig für optimale Erholung. Versuche 7.5-9h zu schlafen.`
        : `${value.toFixed(1)} Stunden Schlaf — das ist ausgezeichnet! Optimale Erholung für das Training.`;

    case 'body_battery_max':
      return value < 30
        ? `Körperbatterie ${value}% — sehr erschöpft. Heute maximal leichtes Spazieren.`
        : value < 60
        ? `Körperbatterie ${value}% — moderat. Moderates Training möglich.`
        : `Körperbatterie ${value}% — gut geladen. Gute Voraussetzungen für Training.`;

    case 'steps':
      return value < 5000
        ? `${value.toLocaleString('de')} Schritte — wenig Alltagsbewegung heute. Bewegungspausen einbauen!`
        : value >= 10000
        ? `${value.toLocaleString('de')} Schritte — ausgezeichnet! Du bist sehr aktiv.`
        : `${value.toLocaleString('de')} Schritte — gute Alltagsaktivität.`;

    case 'resting_hr':
      return value > 65
        ? `Ruhepuls ${value} bpm — etwas erhöht. Mögliche Ursachen: Schlafmangel, Stress, beginnende Erkrankung.`
        : value <= 50
        ? `Ruhepuls ${value} bpm — ausgezeichnet. Zeigt gute kardiovaskuläre Fitness.`
        : `Ruhepuls ${value} bpm — im normalen Bereich für Ausdauersportler.`;

    default:
      return null;
  }
}

export async function getInsight(userId: string, metricKey: string, value: number): Promise<string> {
  // Check 1h cache
  const [cached] = await db.select({ insight: pulseInsightsCache.insight })
    .from(pulseInsightsCache)
    .where(and(
      eq(pulseInsightsCache.userId, userId),
      eq(pulseInsightsCache.metricKey, metricKey),
      gt(pulseInsightsCache.expiresAt, new Date()),
    ))
    .limit(1);

  if (cached) return cached.insight;

  // Rule-based
  const ruleInsight = getRuleInsight(metricKey, value);
  const insight = ruleInsight ?? await llmComplete(
    'Du bist Sportwissenschaftler. Erkläre kurz (max 80 Wörter) was dieser Messwert für einen Ausdauersportler bedeutet. Antworte auf Deutsch.',
    `Metrik: ${metricKey}, Wert: ${value}`,
    FAST_MODEL,
  );
  const source = ruleInsight ? 'rule' : 'llm';

  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  await db.insert(pulseInsightsCache).values({
    userId, metricKey, insight, expiresAt,
    source: source as 'rule' | 'llm',
  });

  return insight;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /root/coaching-os-v2/backend && npm test -- src/pulse/services/insight-engine.test.ts
```
Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git -C /root/coaching-os-v2 add backend/src/pulse/services/insight-engine.ts backend/src/pulse/services/insight-engine.test.ts
git -C /root/coaching-os-v2 commit -m "feat: add pulse insight engine (rule-based + LLM fallback, 1h cache)"
```

---

## Task 5: Plan Engine + Review Engine

**Files:**
- Create: `backend/src/pulse/services/plan-engine.ts`
- Create: `backend/src/pulse/services/plan-engine.test.ts`
- Create: `backend/src/pulse/services/review-engine.ts`
- Create: `backend/src/pulse/services/review-engine.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `backend/src/pulse/services/plan-engine.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { generateWeekWorkouts, adaptIntensityForReadiness } from './plan-engine.js';

describe('generateWeekWorkouts', () => {
  it('generates workouts for the week', () => {
    const workouts = generateWeekWorkouts({
      weekStart: '2026-04-28',
      phase: 'base',
      weeklyHoursTarget: 8,
      availableDays: [1, 3, 5, 6], // Mon, Wed, Fri, Sat
    });
    expect(workouts.length).toBeGreaterThan(0);
    expect(workouts.every((w) => w.durationMin > 0)).toBe(true);
    expect(workouts.every((w) => w.zone >= 1 && w.zone <= 5)).toBe(true);
  });
});

describe('adaptIntensityForReadiness', () => {
  it('reduces duration for low readiness', () => {
    const original = { durationMin: 90, zone: 4 };
    const adapted = adaptIntensityForReadiness(original, 35);
    expect(adapted.durationMin).toBeLessThan(90);
  });

  it('keeps duration for high readiness', () => {
    const original = { durationMin: 90, zone: 4 };
    const adapted = adaptIntensityForReadiness(original, 85);
    expect(adapted.durationMin).toBe(90);
  });

  it('drops zone for critically low readiness', () => {
    const original = { durationMin: 90, zone: 4 };
    const adapted = adaptIntensityForReadiness(original, 25);
    expect(adapted.zone).toBeLessThan(4);
  });
});
```

Create `backend/src/pulse/services/review-engine.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../lib/llm.js', () => ({
  llmComplete: vi.fn().mockResolvedValue('Diese Woche war produktiv mit 3 Einheiten...'),
  SMART_MODEL: 'test-model',
}));
vi.mock('../../lib/env.js', () => ({
  env: { SMART_MODEL: 'test-model', OPENROUTER_API_KEY: 'test', APP_URL: 'http://localhost:3000' },
}));
vi.mock('../../lib/db.js', () => ({
  db: {
    select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ orderBy: vi.fn(() => ({ limit: vi.fn(() => []) })) })) })) })),
    insert: vi.fn(() => ({ values: vi.fn(() => ({ returning: vi.fn(() => [{ id: 'rev-1', narrative: 'Test.' }]) })) })),
  },
}));
vi.mock('../../db/pulse-schema.js', () => ({
  pulseActivities: {}, pulseDailyMetrics: {}, pulseMentalCheckins: {}, pulseWeeklyReviews: {},
}));

describe('buildWeekSummary', () => {
  it('returns a summary string', async () => {
    const { buildWeekSummary } = await import('./review-engine.js');
    const summary = await buildWeekSummary('user-123', '2026-04-21', '2026-04-27');
    expect(typeof summary).toBe('string');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /root/coaching-os-v2/backend && npm test -- src/pulse/services/plan-engine.test.ts src/pulse/services/review-engine.test.ts
```
Expected: FAIL — modules not found.

- [ ] **Step 3: Create `backend/src/pulse/services/plan-engine.ts`**

```typescript
// Phase distribution: base=z2-heavy, build=z3+threshold, peak=race-specific, taper=reduced

type Phase = 'base' | 'build' | 'peak' | 'taper';
type ActivityType = 'run' | 'bike' | 'swim' | 'strength';

interface WorkoutTemplate {
  activityType: ActivityType;
  zone: number;
  durationMin: number;
  description: string;
}

interface WeekWorkout {
  plannedDate: string;
  activityType: ActivityType;
  zone: number;
  durationMin: number;
  targetTss: number;
  description: string;
}

const PHASE_TEMPLATES: Record<Phase, WorkoutTemplate[]> = {
  base: [
    { activityType: 'run',  zone: 2, durationMin: 60,  description: 'Langer Z2-Lauf — aerobes Fundament aufbauen' },
    { activityType: 'bike', zone: 2, durationMin: 90,  description: 'Z2-Ausfahrt — Grundlagenausdauer' },
    { activityType: 'run',  zone: 2, durationMin: 45,  description: 'Lockerer Z2-Lauf' },
    { activityType: 'strength', zone: 1, durationMin: 45, description: 'Kraft & Stabilität' },
  ],
  build: [
    { activityType: 'run',  zone: 4, durationMin: 60,  description: 'Tempotraining — Schwellenintervalle 4x10min' },
    { activityType: 'bike', zone: 2, durationMin: 120, description: 'Langer Z2-Block — Volumensaufbau' },
    { activityType: 'run',  zone: 3, durationMin: 75,  description: 'Tempoausdauer (Z3)' },
    { activityType: 'bike', zone: 4, durationMin: 60,  description: 'Schwellenintervalle Rad — 3x15min' },
  ],
  peak: [
    { activityType: 'run',  zone: 5, durationMin: 45,  description: 'VO2max-Intervalle — 6x4min' },
    { activityType: 'bike', zone: 4, durationMin: 75,  description: 'Renn-Simulation — Wettkampftempo' },
    { activityType: 'run',  zone: 2, durationMin: 30,  description: 'Kurzer Aktivierungslauf' },
    { activityType: 'run',  zone: 3, durationMin: 60,  description: 'Tempodauerlauf' },
  ],
  taper: [
    { activityType: 'run',  zone: 2, durationMin: 30,  description: 'Lockeres Eintrotteln' },
    { activityType: 'bike', zone: 2, durationMin: 45,  description: 'Lockere Aktivierung' },
    { activityType: 'run',  zone: 4, durationMin: 20,  description: 'Kurze Aktivierungsintervalle — 4x1min schnell' },
  ],
};

export function generateWeekWorkouts(params: {
  weekStart: string;
  phase: Phase;
  weeklyHoursTarget: number;
  availableDays: number[]; // 0=Sun ... 6=Sat
}): WeekWorkout[] {
  const { weekStart, phase, weeklyHoursTarget, availableDays } = params;
  const templates = PHASE_TEMPLATES[phase];
  const totalMin = weeklyHoursTarget * 60;

  const workoutsPerWeek = Math.min(availableDays.length, templates.length);
  const selectedTemplates = templates.slice(0, workoutsPerWeek);
  const templateTotal = selectedTemplates.reduce((s, t) => s + t.durationMin, 0);
  const scaleFactor = totalMin / templateTotal;

  const startDate = new Date(weekStart);
  const result: WeekWorkout[] = [];

  for (let i = 0; i < workoutsPerWeek; i++) {
    const template = selectedTemplates[i]!;
    const dayOffset = availableDays[i]!;
    const plannedDate = new Date(startDate);
    plannedDate.setDate(plannedDate.getDate() + dayOffset);

    const durationMin = Math.round(template.durationMin * scaleFactor);
    // Rough TSS estimate: zone * 15 * durationH
    const targetTss = Math.round(template.zone * 15 * (durationMin / 60));

    result.push({
      plannedDate: plannedDate.toISOString().split('T')[0]!,
      activityType: template.activityType,
      zone: template.zone,
      durationMin,
      targetTss,
      description: template.description,
    });
  }

  return result;
}

export function adaptIntensityForReadiness(
  workout: { durationMin: number; zone: number },
  readiness: number,
): { durationMin: number; zone: number } {
  if (readiness >= 65) return workout;

  if (readiness < 35) {
    return {
      durationMin: Math.round(workout.durationMin * 0.5),
      zone: Math.max(1, workout.zone - 2),
    };
  }

  // readiness 35-64: reduce duration, cap zone at 3
  return {
    durationMin: Math.round(workout.durationMin * 0.7),
    zone: Math.min(workout.zone, 3),
  };
}
```

- [ ] **Step 4: Create `backend/src/pulse/services/review-engine.ts`**

```typescript
import { db } from '../../lib/db.js';
import {
  pulseActivities,
  pulseDailyMetrics,
  pulseMentalCheckins,
  pulseWeeklyReviews,
} from '../../db/pulse-schema.js';
import { eq, and, gte, lte } from 'drizzle-orm';
import { llmComplete, SMART_MODEL } from '../../lib/llm.js';

export async function buildWeekSummary(userId: string, weekStart: string, weekEnd: string): Promise<string> {
  const [activities, metrics, checkins] = await Promise.all([
    db.select({
      activityType: pulseActivities.activityType,
      durationSec: pulseActivities.durationSec,
      tss: pulseActivities.tss,
      distanceM: pulseActivities.distanceM,
    }).from(pulseActivities)
      .where(and(
        eq(pulseActivities.userId, userId),
        gte(pulseActivities.startTime, new Date(weekStart)),
        lte(pulseActivities.startTime, new Date(weekEnd + 'T23:59:59')),
      )),

    db.select({
      date: pulseDailyMetrics.date,
      sleepHours: pulseDailyMetrics.sleepHours,
      hrvStatus: pulseDailyMetrics.hrvStatus,
      bodyBatteryMax: pulseDailyMetrics.bodyBatteryMax,
    }).from(pulseDailyMetrics)
      .where(and(
        eq(pulseDailyMetrics.userId, userId),
        gte(pulseDailyMetrics.date, weekStart),
        lte(pulseDailyMetrics.date, weekEnd),
      )),

    db.select({
      mood: pulseMentalCheckins.mood,
      energy: pulseMentalCheckins.energy,
      stress: pulseMentalCheckins.stress,
    }).from(pulseMentalCheckins)
      .where(and(
        eq(pulseMentalCheckins.userId, userId),
        gte(pulseMentalCheckins.date, weekStart),
        lte(pulseMentalCheckins.date, weekEnd),
      )),
  ]);

  const totalTss   = activities.reduce((s, a) => s + (a.tss ?? 0), 0);
  const totalDistM = activities.reduce((s, a) => s + (a.distanceM ?? 0), 0);
  const avgSleep   = metrics.length ? metrics.reduce((s, m) => s + (m.sleepHours ?? 7), 0) / metrics.length : null;
  const avgMood    = checkins.length ? checkins.reduce((s, c) => s + c.mood, 0) / checkins.length : null;

  return [
    `Woche ${weekStart} bis ${weekEnd}:`,
    `Trainingseinheiten: ${activities.length}`,
    `Gesamte TSS: ${Math.round(totalTss)}`,
    `Gesamtdistanz: ${(totalDistM / 1000).toFixed(1)} km`,
    avgSleep ? `Ø Schlaf: ${avgSleep.toFixed(1)}h` : '',
    avgMood ? `Ø Stimmung: ${avgMood.toFixed(1)}/10` : '',
  ].filter(Boolean).join('\n');
}

export async function generateWeeklyReview(userId: string, weekStart: string): Promise<{
  id: string;
  narrative: string;
  weekStart: string;
  weekEnd: string;
}> {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const weekEndStr = weekEnd.toISOString().split('T')[0]!;

  const summary = await buildWeekSummary(userId, weekStart, weekEndStr);

  const narrative = await llmComplete(
    `Du bist Pulse, ein Ausdauercoach. Schreibe eine motivierende Wochenauswertung (max 200 Wörter) auf Deutsch. Kein Markdown, fließender Text.`,
    `Hier sind die Daten:\n${summary}\n\nSchreibe eine Auswertung mit Lob, konkreten Beobachtungen und einem Ausblick auf nächste Woche.`,
    SMART_MODEL,
  );

  const [review] = await db.insert(pulseWeeklyReviews).values({
    userId,
    weekStart,
    weekEnd: weekEndStr,
    narrative,
    metrics: { summary },
    recommendations: [],
  }).returning({ id: pulseWeeklyReviews.id });

  return { id: review!.id, narrative, weekStart, weekEnd: weekEndStr };
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd /root/coaching-os-v2/backend && npm test -- src/pulse/services/plan-engine.test.ts src/pulse/services/review-engine.test.ts
```
Expected: 5 tests pass.

- [ ] **Step 6: Commit**

```bash
git -C /root/coaching-os-v2 add backend/src/pulse/services/plan-engine.ts backend/src/pulse/services/plan-engine.test.ts backend/src/pulse/services/review-engine.ts backend/src/pulse/services/review-engine.test.ts
git -C /root/coaching-os-v2 commit -m "feat: add pulse plan engine + review engine"
```

---

## Task 6: Wire Services into Plugin + Workers

**Files:**
- Modify: `backend/src/pulse/plugin.ts`
- Modify: `backend/src/pulse/queues/workers.ts`

- [ ] **Step 1: Update `plugin.ts` to use real fitness load and coach engine**

In `plugin.ts`, replace the static stubs with real service calls. Make these changes:

**Add imports at the top:**
```typescript
import { computeFitnessLoad, computeReadinessScore } from './services/load-engine.js';
import { getCoachReply } from './services/coach-engine.js';
```

**Replace the inline `computeReadiness` helper and its call in `/home`:**

Remove the existing `computeReadiness` function (the one with static `tsb: 0`).

Replace the `/home` handler body's readiness computation with:
```typescript
// In /home handler, after fetching metrics, mental, activities, nextWorkout:
const fitnessLoad = await computeFitnessLoad(userId, today);

const mentalScore = mental
  ? ((mental.mood + mental.energy + mental.motivation) / 3) * 10
  : null;

const readiness = computeReadinessScore({
  sleepHours:     metrics?.sleepHours ?? null,
  hrvStatus:      metrics?.hrvStatus ?? null,
  bodyBatteryMax: metrics?.bodyBatteryMax ?? null,
  stressAvg:      metrics?.stressAvg ?? null,
  mentalScore,
  tsb:            fitnessLoad.tsb,
});
```

Replace the static `fitnessLoad` stub:
```typescript
// Was: fitnessLoad: { ctl: 0, atl: 0, tsb: 0, date: today }
// Now: use the computed value directly
fitnessLoad,
```

**Replace `/coach` handler's `simpleCoachReply` call with `getCoachReply`:**

Remove the `simpleCoachReply` function definition.

In the `/coach` handler, replace:
```typescript
const reply_text = simpleCoachReply(parsed.data.message, readiness);
```
With:
```typescript
const reply_text = await getCoachReply(parsed.data.message, {
  readiness: readiness.score,
  sleepHours: metrics?.sleepHours ?? null,
  hrvStatus: metrics?.hrvStatus ?? null,
  bodyBatteryMax: metrics?.bodyBatteryMax ?? null,
  tsb: fitnessLoadForCoach.tsb,
  stressAvg: metrics?.stressAvg ?? null,
});
```

And add before that line:
```typescript
const fitnessLoadForCoach = await computeFitnessLoad(userId, today);
const readiness = computeReadinessScore({
  sleepHours: metrics?.sleepHours ?? null,
  hrvStatus: metrics?.hrvStatus ?? null,
  bodyBatteryMax: metrics?.bodyBatteryMax ?? null,
  stressAvg: metrics?.stressAvg ?? null,
  mentalScore: mental ? ((mental.mood + mental.energy + mental.motivation) / 3) * 10 : null,
  tsb: fitnessLoadForCoach.tsb,
});
```

Also remove the `PulseReadiness` import from `@coaching-os/shared/pulse` at the top of plugin.ts since `computeReadinessScore` now returns it. Keep `PulseHomeScreenData` and `PulseCoachMessage`.

- [ ] **Step 2: Update `workers.ts` to call garmin adapter and review engine**

Replace the stub bodies in `workers.ts`:

```typescript
import { syncGarminForDate } from '../adapters/garmin-client.js';
import { generateWeeklyReview } from '../services/review-engine.js';
import { db } from '../../lib/db.js';
import { users } from '../../db/schema.js';
```

Replace `handleGarminSync`:
```typescript
async function handleGarminSync(job: Job<PulseJobData>): Promise<void> {
  const { userId, date } = job.data;
  const targetDate = date ?? new Date().toISOString().split('T')[0]!;
  await syncGarminForDate(userId, targetDate);
}
```

Replace `handleWeeklyReview`:
```typescript
async function handleWeeklyReview(job: Job<PulseJobData>): Promise<void> {
  const { userId } = job.data;
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - dayOfWeek - 7); // previous week
  const weekStartStr = weekStart.toISOString().split('T')[0]!;
  await generateWeeklyReview(userId, weekStartStr);
}
```

- [ ] **Step 3: Run all tests**

```bash
cd /root/coaching-os-v2/backend && npm test
```
Expected: all 65+ tests pass. The `/api/pulse/home` test will now get real (computed) fitness load, and the `/api/pulse/coach` test will use `getCoachReply`.

Note: The `getCoachReply` call in plugin.test.ts for the coach route will use the mocked LLM (since `vi.mock` is not set in plugin.test.ts, the real `llmComplete` may be called). If this causes issues, add `vi.mock('../lib/llm.js', ...)` to `plugin.test.ts`.

- [ ] **Step 4: Commit**

```bash
git -C /root/coaching-os-v2 add backend/src/pulse/plugin.ts backend/src/pulse/queues/workers.ts
git -C /root/coaching-os-v2 commit -m "feat: wire load engine + coach engine into pulse plugin and workers"
```

---

## Task 7: Add Remaining REST Routes to plugin.ts

The Phase 3c frontend API client calls 10 endpoints not yet defined. This task adds them to `backend/src/pulse/plugin.ts`.

**Files:**
- Modify: `backend/src/pulse/plugin.ts`
- Modify: `backend/src/pulse/plugin.test.ts`

- [ ] **Step 1: Add additional tests to `backend/src/pulse/plugin.test.ts`**

Append these `describe` blocks at the bottom of `plugin.test.ts` (before the closing of the file, inside the same test module):

```typescript
describe('GET /api/pulse/sleep', () => {
  it('returns 200 with empty sessions', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/pulse/sleep',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveProperty('sessions');
    expect(Array.isArray(res.json<{ sessions: unknown[] }>().sessions)).toBe(true);
  });
});

describe('GET /api/pulse/activities', () => {
  it('returns 200 with empty activities', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/pulse/activities',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveProperty('activities');
  });
});

describe('GET /api/pulse/plan', () => {
  it('returns 200 with empty workouts', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/pulse/plan',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveProperty('workouts');
  });
});

describe('POST /api/pulse/plan/generate', () => {
  it('generates workouts and returns 201', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/pulse/plan/generate',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toHaveProperty('workouts');
  });
});

describe('GET /api/pulse/goals', () => {
  it('returns 200 with empty goals', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/pulse/goals',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveProperty('goals');
  });
});

describe('POST /api/pulse/goals', () => {
  it('creates a goal and returns 201', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/pulse/goals',
      payload: { title: 'Test-Ziel', description: 'Testbeschreibung' },
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json<{ id: string; title: string }>();
    expect(body.title).toBe('Test-Ziel');
  });

  it('returns 400 for missing title', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/pulse/goals',
      payload: {},
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('GET /api/pulse/review/latest', () => {
  it('returns 200 (null when no review exists)', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/pulse/review/latest',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
  });
});

describe('POST /api/pulse/garmin/sync', () => {
  it('returns 200 with queued status', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/pulse/garmin/sync',
      headers: { Authorization: `Bearer ${token}` },
    });
    // May be 200 (queued) or 503 if Redis not available in test
    expect([200, 503]).toContain(res.statusCode);
  });
});
```

- [ ] **Step 2: Run new tests to verify they fail**

```bash
cd /root/coaching-os-v2/backend && npm test -- src/pulse/plugin.test.ts
```
Expected: FAIL — new routes return 404.

- [ ] **Step 3: Add new imports to `backend/src/pulse/plugin.ts`**

Add to the existing import from `../db/pulse-schema.js`:
```typescript
import {
  pulseDailyMetrics,
  pulseMentalCheckins,
  pulseActivities,
  pulsePlannedWorkouts,
  pulseCoachSessions,
  pulseSleepSessions,    // add
  pulseGoals,            // add
  pulseUserProfile,      // add
  pulseWeeklyReviews,    // add
} from '../db/pulse-schema.js';
```

Add new service imports (after existing service imports from Task 6):
```typescript
import { generateWeekWorkouts } from './services/plan-engine.js';
import { generateWeeklyReview } from './services/review-engine.js';
import { pulseQueues } from './queues/queues.js';
```

- [ ] **Step 4: Add 10 new routes to `backend/src/pulse/plugin.ts`**

Append these routes inside the `pulsePlugin` function, after the `/checkin` route:

```typescript
// ─── Sleep sessions ───────────────────────────────────────────────────────────
app.get('/sleep', { onRequest: [app.authenticate] }, async (req) => {
  const userId = req.user.sub;
  const limit = Math.min(Number((req.query as { limit?: string }).limit ?? 7), 30);
  const sessions = await db.select()
    .from(pulseSleepSessions)
    .where(eq(pulseSleepSessions.userId, userId))
    .orderBy(desc(pulseSleepSessions.date))
    .limit(limit);
  return {
    sessions: sessions.map((s) => ({
      ...s,
      startTime: s.startTime?.toISOString() ?? null,
      endTime:   s.endTime?.toISOString()   ?? null,
    })),
  };
});

// ─── Activities ───────────────────────────────────────────────────────────────
app.get('/activities', { onRequest: [app.authenticate] }, async (req) => {
  const userId = req.user.sub;
  const limit = Math.min(Number((req.query as { limit?: string }).limit ?? 10), 50);
  const activities = await db.select()
    .from(pulseActivities)
    .where(eq(pulseActivities.userId, userId))
    .orderBy(desc(pulseActivities.startTime))
    .limit(limit);
  return {
    activities: activities.map((a) => ({
      ...a,
      startTime: a.startTime.toISOString(),
    })),
  };
});

// ─── Training plan ────────────────────────────────────────────────────────────
app.get('/plan', { onRequest: [app.authenticate] }, async (req) => {
  const userId = req.user.sub;
  const today = new Date().toISOString().split('T')[0]!;
  const workouts = await db.select()
    .from(pulsePlannedWorkouts)
    .where(and(eq(pulsePlannedWorkouts.userId, userId), gte(pulsePlannedWorkouts.plannedDate, today)))
    .orderBy(pulsePlannedWorkouts.plannedDate)
    .limit(14);
  return { workouts };
});

app.post('/plan/generate', { onRequest: [app.authenticate] }, async (req, reply) => {
  const userId = req.user.sub;
  const now = new Date();
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() + mondayOffset);
  const weekStartStr = weekStart.toISOString().split('T')[0]!;

  const [profile] = await db.select()
    .from(pulseUserProfile)
    .where(eq(pulseUserProfile.userId, userId));

  const generated = generateWeekWorkouts({
    weekStart: weekStartStr,
    phase: (profile?.trainingPhase ?? 'base') as 'base' | 'build' | 'peak' | 'taper',
    weeklyHoursTarget: profile?.weeklyHoursTarget ?? 8,
    availableDays: [1, 3, 5, 6],
  });

  await db.delete(pulsePlannedWorkouts).where(
    and(
      eq(pulsePlannedWorkouts.userId, userId),
      gte(pulsePlannedWorkouts.plannedDate, weekStartStr),
      eq(pulsePlannedWorkouts.status, 'planned'),
    ),
  );

  const inserted = await db.insert(pulsePlannedWorkouts).values(
    generated.map((w) => ({
      userId,
      plannedDate:  w.plannedDate,
      activityType: w.activityType,
      zone:         w.zone,
      durationMin:  w.durationMin,
      targetTss:    w.targetTss,
      description:  w.description,
    })),
  ).returning();

  return reply.status(201).send({ workouts: inserted });
});

// ─── Goals ────────────────────────────────────────────────────────────────────
app.get('/goals', { onRequest: [app.authenticate] }, async (req) => {
  const userId = req.user.sub;
  const goals = await db.select()
    .from(pulseGoals)
    .where(eq(pulseGoals.userId, userId))
    .orderBy(desc(pulseGoals.createdAt));
  return { goals };
});

app.post('/goals', { onRequest: [app.authenticate] }, async (req, reply) => {
  const schema = z.object({
    title:       z.string().min(1).max(255),
    description: z.string().max(1000).optional(),
    targetDate:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return reply.status(400).send({ error: 'Ungültige Eingabe' });

  const userId = req.user.sub;
  const [goal] = await db.insert(pulseGoals).values({
    userId,
    title:       parsed.data.title,
    description: parsed.data.description ?? null,
    targetDate:  parsed.data.targetDate  ?? null,
  }).returning();

  return reply.status(201).send(goal);
});

app.patch('/goals/:id', { onRequest: [app.authenticate] }, async (req, reply) => {
  const schema = z.object({
    status:   z.enum(['active', 'completed', 'paused', 'abandoned']).optional(),
    progress: z.number().min(0).max(1).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return reply.status(400).send({ error: 'Ungültige Eingabe' });

  const userId = req.user.sub;
  const { id } = req.params as { id: string };

  const [updated] = await db.update(pulseGoals)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(and(eq(pulseGoals.id, id), eq(pulseGoals.userId, userId)))
    .returning();

  if (!updated) return reply.status(404).send({ error: 'Ziel nicht gefunden' });
  return updated;
});

// ─── Weekly review ────────────────────────────────────────────────────────────
app.get('/review/latest', { onRequest: [app.authenticate] }, async (req) => {
  const userId = req.user.sub;
  const [review] = await db.select()
    .from(pulseWeeklyReviews)
    .where(eq(pulseWeeklyReviews.userId, userId))
    .orderBy(desc(pulseWeeklyReviews.weekStart))
    .limit(1);
  return review ?? null;
});

app.post('/review/generate', { onRequest: [app.authenticate] }, async (req) => {
  const userId = req.user.sub;
  const now = new Date();
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const lastMonday = new Date(now);
  lastMonday.setDate(now.getDate() + mondayOffset - 7);
  const weekStartStr = lastMonday.toISOString().split('T')[0]!;
  return generateWeeklyReview(userId, weekStartStr);
});

// ─── Garmin manual sync ───────────────────────────────────────────────────────
app.post('/garmin/sync', { onRequest: [app.authenticate] }, async (req, reply) => {
  const userId = req.user.sub;
  const today = new Date().toISOString().split('T')[0]!;
  try {
    await pulseQueues['pulse-garmin-sync'].add('sync-now', { userId, date: today }, { priority: 1 });
    return { status: 'queued', date: today };
  } catch {
    return reply.status(503).send({ error: 'Queue nicht verfügbar' });
  }
});
```

- [ ] **Step 5: Run plugin tests to verify they pass**

```bash
cd /root/coaching-os-v2/backend && npm test -- src/pulse/plugin.test.ts
```
Expected: all 16+ plugin tests pass.

- [ ] **Step 6: Run all tests**

```bash
cd /root/coaching-os-v2/backend && npm test
```
Expected: all 75+ tests pass.

- [ ] **Step 7: Commit**

```bash
git -C /root/coaching-os-v2 add backend/src/pulse/plugin.ts backend/src/pulse/plugin.test.ts
git -C /root/coaching-os-v2 commit -m "feat: add pulse REST routes (sleep, activities, plan, goals, review, garmin/sync)"
```

---

## Self-Review

**Spec coverage:**

| Requirement | Task |
|---|---|
| Load engine: TSS (bike NP, run HR-based) | Task 1 |
| Load engine: CTL (42d EMA) + ATL (7d EMA) | Task 1 |
| Load engine: Readiness score (6 components, weighted) | Task 1 |
| Garmin adapter: calls Python sidecar POST /sync | Task 2 |
| Garmin adapter: upserts pulse_daily_metrics + pulse_sleep_sessions | Task 2 |
| Coach engine: 14 intents via regex | Task 3 |
| Coach engine: rule-based responses | Task 3 |
| Coach engine: LLM fallback (FAST_MODEL) | Task 3 |
| Insight engine: rule-based + LLM fallback | Task 4 |
| Insight engine: 1h cache in pulse_insights_cache | Task 4 |
| Plan engine: week workouts per phase | Task 5 |
| Plan engine: adapt intensity for readiness | Task 5 |
| Review engine: collect week data + LLM narration | Task 5 |
| Review engine: store in pulse_weekly_reviews | Task 5 |
| /api/pulse/home returns real CTL/ATL/TSB | Task 6 |
| /api/pulse/coach uses coach engine | Task 6 |
| garmin-sync worker calls syncGarminForDate | Task 6 |
| weekly-review worker calls generateWeeklyReview | Task 6 |
| GET /api/pulse/sleep | Task 7 |
| GET /api/pulse/activities | Task 7 |
| GET /api/pulse/plan + POST /plan/generate | Task 7 |
| GET/POST /api/pulse/goals + PATCH /goals/:id | Task 7 |
| GET /api/pulse/review/latest + POST /review/generate | Task 7 |
| POST /api/pulse/garmin/sync | Task 7 |

**Placeholder scan:** None. All service implementations are complete.

**Type consistency:**
- `TssInput` defined and used in Task 1 only ✓
- `CoachContext` defined in coach-engine.ts, used in plugin.ts Task 6 ✓
- `ReadinessInput` defined in load-engine.ts, used in plugin.ts Task 6 ✓
- `PulseReadiness` / `PulseFitnessLoad` from shared types used throughout ✓
- `generateWeekWorkouts` return shape matches `pulsePlannedWorkouts` insert columns ✓
