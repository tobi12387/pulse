import { describe, expect, it } from 'vitest';
import { buildGarminSignalUsefulness } from './garmin-signal-usefulness.js';

type SignalInput = Parameters<typeof buildGarminSignalUsefulness>[0];

function input(overrides: Partial<SignalInput> = {}): SignalInput {
  return {
    range: { from: '2026-04-03', to: '2026-05-02', days: 30 },
    dailyMetrics: [],
    sleepSessions: [],
    activities: [],
    decisionEvidenceSignals: ['sleep_hrv', 'training_load_execution'],
    ...overrides,
  };
}

function item(response: ReturnType<typeof buildGarminSignalUsefulness>, key: string) {
  const found = response.items.find(signal => signal.signalKey === key);
  expect(found, `missing signal ${key}`).toBeDefined();
  return found!;
}

describe('buildGarminSignalUsefulness', () => {
  it('ranks present body battery, stress, respiration and spo2 depth as underused for daily decisions', () => {
    const response = buildGarminSignalUsefulness(input({
      dailyMetrics: [
        {
          date: '2026-05-01',
          hrvRmssd: 48,
          sleepHours: 7.2,
          bodyBatteryMax: 82,
          bodyBatteryCharged: 45,
          bodyBatteryDrained: 58,
          bodyBatteryAtWake: 71,
          highStressSec: 3600,
          mediumStressSec: 7200,
          lowStressSec: 12_000,
          avgWakingRespiration: 13.4,
          latestSpo2: 97,
          syncedAt: '2026-05-01T07:00:00.000Z',
        },
      ],
    }));

    expect(item(response, 'body_battery_depth').status).toBe('underused');
    expect(item(response, 'stress_duration').status).toBe('underused');
    expect(item(response, 'respiration').recommendedNextConsumer).toBe('daily_decision');
    expect(item(response, 'spo2').whyItMatters).toContain('Atem');
    const underusedKeys = response.items.filter(signal => signal.status === 'underused').map(signal => signal.signalKey);
    expect(underusedKeys).toEqual(expect.arrayContaining([
      'body_battery_depth',
      'stress_duration',
      'respiration',
      'spo2',
    ]));
    expect(response.topUnderused).toHaveLength(3);
  });

  it('ranks cached HR zones and laps for workout execution quality', () => {
    const response = buildGarminSignalUsefulness(input({
      activities: [
        {
          date: '2026-05-01',
          hasWeather: true,
          hasHrZones: true,
          hasLaps: true,
          hasDetail: true,
        },
      ],
    }));

    const zones = item(response, 'activity_hr_zones_laps');
    expect(zones.status).toBe('underused');
    expect(zones.coverageDays).toBe(1);
    expect(zones.recommendedNextConsumer).toBe('plan_generation');
    expect(zones.whyItMatters).toContain('Ausfuehrungsqualitaet');
  });

  it('marks sparse signal groups as missing without failing the response', () => {
    const response = buildGarminSignalUsefulness(input());

    expect(item(response, 'body_battery_depth').status).toBe('missing_or_sparse');
    expect(item(response, 'activity_hr_zones_laps').status).toBe('missing_or_sparse');
    expect(response.summary.missingOrSparse).toBeGreaterThan(0);
    expect(response.items.length).toBeGreaterThan(4);
  });

  it('keeps already-used core signals separate from underused candidates', () => {
    const response = buildGarminSignalUsefulness(input({
      dailyMetrics: [
        {
          date: '2026-05-01',
          hrvRmssd: 48,
          sleepHours: 7.2,
          bodyBatteryMax: 82,
          bodyBatteryCharged: null,
          bodyBatteryDrained: null,
          bodyBatteryAtWake: null,
          highStressSec: null,
          mediumStressSec: null,
          lowStressSec: null,
          avgWakingRespiration: null,
          latestSpo2: null,
          syncedAt: '2026-05-01T07:00:00.000Z',
        },
      ],
    }));

    const sleepHrv = item(response, 'sleep_hrv');
    expect(sleepHrv.status).toBe('used');
    expect(sleepHrv.currentConsumers).toContain('Home');
    expect(response.summary.used).toBeGreaterThan(0);
  });
});
