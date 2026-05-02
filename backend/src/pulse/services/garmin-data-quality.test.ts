import { describe, expect, it } from 'vitest';
import { buildGarminDataQuality } from './garmin-data-quality.js';

function range(days: number): { from: string; to: string; days: number } {
  return { from: '2026-04-03', to: '2026-05-02', days };
}

function baseInput(overrides: Partial<Parameters<typeof buildGarminDataQuality>[0]> = {}): Parameters<typeof buildGarminDataQuality>[0] {
  return {
    today: '2026-05-02',
    now: '2026-05-02T12:00:00.000Z',
    range: range(30),
    dailyMetrics: [],
    sleepSessions: [],
    activities: [],
    weightLogs: [],
    plannedWorkouts: [],
    circuit: { status: 'ok', failures: 0, reason: null },
    ...overrides,
  };
}

function domain(result: ReturnType<typeof buildGarminDataQuality>, id: ReturnType<typeof buildGarminDataQuality>['domains'][number]['domain']) {
  const state = result.domains.find(row => row.domain === id);
  if (!state) throw new Error(`Missing domain ${id}`);
  return state;
}

describe('buildGarminDataQuality', () => {
  it('marks activities fresh when the latest Garmin activity is within 24 hours', () => {
    const result = buildGarminDataQuality(baseInput({
      activities: [
        { startTime: '2026-05-02T07:15:00.000Z', weather: { temperature: 14 } },
      ],
    }));

    expect(domain(result, 'activities')).toMatchObject({
      status: 'fresh',
      lastFreshDate: '2026-05-02',
      lastFreshAt: '2026-05-02T07:15:00.000Z',
    });
    expect(domain(result, 'activities').repairAction).toBeNull();
  });

  it('marks sleep missing for the selected date range when neither sessions nor daily sleep exist', () => {
    const result = buildGarminDataQuality(baseInput({
      dailyMetrics: [
        { date: '2026-05-02', syncedAt: '2026-05-02T08:00:00.000Z', hrvRmssd: 42, sleepHours: null, bodyBatteryMax: 80, stressAvg: 31, steps: 9000 },
      ],
    }));

    expect(domain(result, 'sleep')).toMatchObject({
      status: 'missing',
      reason: 'Keine Schlafdaten im gewählten Zeitraum.',
      repairAction: {
        type: 'backfill',
        label: 'Schlaf nachladen',
        domains: ['sleep'],
      },
    });
  });

  it('keeps HRV partial but usable when most recent days have values and some days are missing', () => {
    const result = buildGarminDataQuality(baseInput({
      dailyMetrics: [
        { date: '2026-04-30', syncedAt: '2026-04-30T07:00:00.000Z', hrvRmssd: null, sleepHours: 7.1, bodyBatteryMax: 76, stressAvg: 29, steps: 8100 },
        { date: '2026-05-01', syncedAt: '2026-05-01T07:00:00.000Z', hrvRmssd: 40, sleepHours: 6.8, bodyBatteryMax: 70, stressAvg: 35, steps: 9200 },
        { date: '2026-05-02', syncedAt: '2026-05-02T07:00:00.000Z', hrvRmssd: 43, sleepHours: 7.4, bodyBatteryMax: 82, stressAvg: 28, steps: 5100 },
      ],
    }));

    expect(domain(result, 'hrv')).toMatchObject({
      status: 'partial',
      reason: 'HRV ist nutzbar, aber einzelne Tage fehlen.',
      missingDays: 1,
    });
    expect(domain(result, 'hrv').evidence).toContain('2 Tage mit HRV');
  });

  it('marks body composition stale when weight exists but recent composition fields are absent', () => {
    const result = buildGarminDataQuality(baseInput({
      weightLogs: [
        { date: '2026-05-01', bodyFatPct: null, muscleMassKg: null, bmi: null },
      ],
    }));

    expect(domain(result, 'body_composition')).toMatchObject({
      status: 'stale',
      reason: 'Gewicht ist vorhanden, aber Körperzusammensetzung fehlt oder ist alt.',
      repairAction: {
        type: 'backfill',
        label: 'Körperdaten nachladen',
        domains: ['weight'],
      },
    });
  });

  it('represents provider circuit breaker state as blocked for Garmin domains', () => {
    const result = buildGarminDataQuality(baseInput({
      circuit: { status: 'open', failures: 3, reason: 'Garmin rate limit' },
      activities: [{ startTime: '2026-05-02T07:15:00.000Z', weather: null }],
    }));

    for (const id of ['activities', 'daily_metrics', 'sleep', 'hrv', 'body_composition'] as const) {
      expect(domain(result, id)).toMatchObject({
        status: 'blocked',
        reason: 'Garmin rate limit',
      });
    }
    expect(domain(result, 'activities').evidence).toContain('Circuit Breaker offen');
  });

  it('keeps backfill candidate days domain-specific', () => {
    const result = buildGarminDataQuality(baseInput({
      dailyMetrics: [
        { date: '2026-05-01', syncedAt: '2026-05-01T08:00:00.000Z', hrvRmssd: 41, sleepHours: 7.0, bodyBatteryMax: 80, stressAvg: 30, steps: 8000 },
        { date: '2026-05-02', syncedAt: '2026-05-02T08:00:00.000Z', hrvRmssd: null, sleepHours: 7.2, bodyBatteryMax: 82, stressAvg: 28, steps: 10000 },
      ],
      sleepSessions: [
        { date: '2026-05-01', durationH: 7.0, deepSleepH: 1.1, remSleepH: 1.5, lightSleepH: 4.0, awakeH: 0.4 },
      ],
    }));

    expect(domain(result, 'hrv').repairAction).toMatchObject({
      type: 'backfill',
      domains: ['dailyMetrics'],
      candidateDays: ['2026-05-02'],
    });
    expect(domain(result, 'sleep').repairAction).toMatchObject({
      type: 'backfill',
      domains: ['sleep'],
      candidateDays: ['2026-05-02'],
    });
  });
});
