# Power Data Quality Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish trustworthy activity-stream and power-quality provenance before Pulse uses power-duration, durability or FTP-like model claims.

**Architecture:** Start with read-only coverage and quality classification. Pulse already has `pulse_activity_streams`, `pulse_activity_analytics`, Garmin lap caches and HR-zone caches, but stream ingestion is not a proven daily path. This plan records whether each performance signal is stream-derived, lap-approximated or unavailable, then exposes the quality state in Data/Plan without changing FTP automatically.

**Tech Stack:** TypeScript pure services, existing Pulse activity/analytics schema, Fastify routes, React Data/Plan surfaces, Vitest, Playwright route checks.

---

## Files

- Create: `backend/src/pulse/services/power-data-quality.ts`
- Create: `backend/src/pulse/services/power-data-quality.test.ts`
- Modify: `backend/src/pulse/routes/activity-routes.ts`
- Modify: `backend/src/pulse/routes/data-routes.ts` if the Data route owns the analytics response; otherwise modify the existing training analytics route in `backend/src/pulse/routes/training-routes.ts`
- Modify: `shared/types/pulse/training.ts`
- Modify: `frontend/src/pages/Data.tsx`
- Modify: `frontend/src/features/plan/strategy/strategy-components.tsx` only if Plan needs a compact warning
- Test: `backend/src/pulse/plugin.test.ts`
- Test: `frontend/e2e/pulse-smoke.spec.ts` or a focused route evidence spec

## Task 1: Classify Signal Provenance

- [ ] **Step 1: Write the failing pure-service test**

Create `backend/src/pulse/services/power-data-quality.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { classifyPowerDataQuality } from './power-data-quality.js';

describe('classifyPowerDataQuality', () => {
  it('marks stream-derived power as trusted when sample coverage is high and spikes are bounded', () => {
    const result = classifyPowerDataQuality({
      durationSec: 3600,
      sampleRateHz: 1,
      powerStream: Array.from({ length: 3600 }, (_, i) => (i % 600 === 0 ? 260 : 210)),
      laps: [],
    });

    expect(result.source).toBe('stream');
    expect(result.status).toBe('trusted');
    expect(result.coveragePct).toBeGreaterThan(95);
  });

  it('falls back to lap approximation when no stream exists', () => {
    const result = classifyPowerDataQuality({
      durationSec: 3600,
      sampleRateHz: null,
      powerStream: null,
      laps: [
        { durationSec: 900, avgPowerW: 180 },
        { durationSec: 900, avgPowerW: 190 },
        { durationSec: 900, avgPowerW: 185 },
        { durationSec: 900, avgPowerW: 175 },
      ],
    });

    expect(result.source).toBe('lap_approximation');
    expect(result.status).toBe('usable_with_caution');
    expect(result.limitations).toContain('Keine 1Hz-Power-Streams im Pulse-Datensatz.');
  });

  it('blocks model claims for sparse or spiky power', () => {
    const result = classifyPowerDataQuality({
      durationSec: 1800,
      sampleRateHz: 1,
      powerStream: [0, 0, 0, 2500, 180, 0],
      laps: [],
    });

    expect(result.status).toBe('blocked');
    expect(result.limitations.join(' ')).toContain('Coverage');
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
npm test -w backend -- --run src/pulse/services/power-data-quality.test.ts
```

Expected: FAIL because the service does not exist.

- [ ] **Step 3: Implement the service**

Create `backend/src/pulse/services/power-data-quality.ts`:

```ts
export type PowerDataQualitySource = 'stream' | 'lap_approximation' | 'unavailable';
export type PowerDataQualityStatus = 'trusted' | 'usable_with_caution' | 'blocked';

export interface PowerDataQualityResult {
  source: PowerDataQualitySource;
  status: PowerDataQualityStatus;
  coveragePct: number;
  spikeCount: number;
  limitations: string[];
}

export function classifyPowerDataQuality(input: {
  durationSec: number;
  sampleRateHz: number | null;
  powerStream: readonly number[] | null;
  laps: Array<{ durationSec: number | null; avgPowerW: number | null }>;
}): PowerDataQualityResult {
  const duration = Math.max(1, input.durationSec);
  const expectedSamples = Math.max(1, Math.round(duration * (input.sampleRateHz ?? 1)));
  const stream = input.powerStream?.filter(value => Number.isFinite(value)) ?? [];
  const positive = stream.filter(value => value > 0 && value < 1800);
  const spikeCount = stream.filter(value => value >= 1800 || value < 0).length;
  const coveragePct = input.powerStream
    ? Math.round((positive.length / expectedSamples) * 1000) / 10
    : 0;
  const limitations: string[] = [];

  if (input.powerStream && coveragePct >= 85 && spikeCount <= 3) {
    return { source: 'stream', status: 'trusted', coveragePct, spikeCount, limitations };
  }

  if (input.powerStream) {
    limitations.push(`Coverage ${coveragePct}% oder ${spikeCount} Power-Spike(s) reichen nicht fuer Modellclaims.`);
    return { source: 'stream', status: 'blocked', coveragePct, spikeCount, limitations };
  }

  const powerLaps = input.laps.filter(lap => (lap.durationSec ?? 0) >= 60 && (lap.avgPowerW ?? 0) > 0);
  if (powerLaps.length >= 2) {
    limitations.push('Keine 1Hz-Power-Streams im Pulse-Datensatz.');
    limitations.push('Best efforts und Durability nur als Lap-Approximation verwenden.');
    return { source: 'lap_approximation', status: 'usable_with_caution', coveragePct: 0, spikeCount: 0, limitations };
  }

  limitations.push('Keine nutzbaren Power-Streams oder Power-Laps vorhanden.');
  return { source: 'unavailable', status: 'blocked', coveragePct: 0, spikeCount: 0, limitations };
}
```

- [ ] **Step 4: Run focused test**

Run:

```bash
npm test -w backend -- --run src/pulse/services/power-data-quality.test.ts
```

Expected: PASS.

## Task 2: Expose Coverage Without Changing FTP

- [ ] **Step 1: Extend shared training type**

In `shared/types/pulse/training.ts`, add:

```ts
export interface PulsePowerDataQualitySummary {
  source: 'stream' | 'lap_approximation' | 'unavailable';
  status: 'trusted' | 'usable_with_caution' | 'blocked';
  coveragePct: number;
  spikeCount: number;
  limitations: string[];
  updatedAt: string | null;
}
```

- [ ] **Step 2: Wire route summary**

In the existing Data/training analytics route, query the latest activity streams and lap caches for the user, call `classifyPowerDataQuality`, and return:

```ts
powerDataQuality: {
  source: result.source,
  status: result.status,
  coveragePct: result.coveragePct,
  spikeCount: result.spikeCount,
  limitations: result.limitations,
  updatedAt: latestActivity?.startTime?.toISOString() ?? null,
}
```

If no power data exists, return `source: 'unavailable'` and `status: 'blocked'`. Do not update FTP or profile values in this plan.

- [ ] **Step 3: Add backend integration test**

Extend `backend/src/pulse/plugin.test.ts` with one route test proving:

```ts
expect(body.powerDataQuality).toMatchObject({
  source: 'lap_approximation',
  status: 'usable_with_caution',
});
```

Use seeded lap cache data; do not require live Garmin.

## Task 3: Add Compact UI Evidence

- [ ] **Step 1: Data UI**

In `frontend/src/pages/Data.tsx`, add one compact row or card in the existing analytics area:

```tsx
<section className="card" data-testid="power-data-quality">
  <span className="label-mono">POWER-DATEN</span>
  <strong>{quality.status === 'trusted' ? 'Stream-Daten vertrauenswuerdig' : quality.status === 'usable_with_caution' ? 'Nur Lap-Approximation' : 'Power-Modell blockiert'}</strong>
  <p>{quality.limitations[0] ?? `Coverage ${quality.coveragePct}%`}</p>
</section>
```

- [ ] **Step 2: Plan warning only when needed**

If Plan displays a durability or power-derived limiter later, it must also display the quality source. This foundation plan may add a placeholder warning only when `status !== 'trusted'`; it must not add a new dashboard.

- [ ] **Step 3: Browser verification**

Run:

```bash
npm test -w backend -- --run src/pulse/services/power-data-quality.test.ts src/pulse/plugin.test.ts
npm run build -w frontend
npm run test:e2e:smoke
```

Expected: PASS or document local-service blocker and run `npm run verify:local:no-services`.

## Acceptance

- Pulse can say whether power analysis is stream-derived, lap-approximated or blocked.
- No FTP/profile value is changed by this plan.
- Later power-duration work must consume this quality status before making limiter claims.
- Missing or low-quality power data is visible but not noisy.
