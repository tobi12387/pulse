import { describe, expect, it } from 'vitest';
import { computeRecovery } from './recovery-metrics.js';

describe('computeRecovery', () => {
  it('uses Garmin sleep need gaps before falling back to fixed sleep-hour targets', () => {
    const daily = Array.from({ length: 7 }, (_, i) => ({
      sleepHours: 7.7,
      hrvRmssd: 58,
      restingHr: 49,
      sleepNeedMin: 540,
      sleepActualMin: i < 5 ? 390 : 500,
      highStressSec: i < 3 ? 7_200 : 900,
      bodyBatteryAtWake: i < 3 ? 28 : 72,
      bodyBatteryCharged: 35,
      bodyBatteryDrained: 62,
    }));

    const recovery = computeRecovery({ daily });

    expect(recovery.sleepDebt7d.baselineSource).toBe('garmin_sleep_need');
    expect(recovery.sleepDebt7d.hours).toBeGreaterThan(9);
    expect(recovery.sleepDebt7d.status).toBe('severe');
    expect(recovery.recoveryScore).toBeLessThan(65);
    expect(recovery.recommendation).toContain('Schlafbedarf');
  });
});
