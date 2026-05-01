import { describe, it, expect } from 'vitest';
import {
  computeTss,
  applyEma,
  buildFitnessLoadSeriesFromDailyTss,
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

describe('buildFitnessLoadSeriesFromDailyTss', () => {
  it('returns aligned CTL/ATL/TSB points for every input day', () => {
    const series = buildFitnessLoadSeriesFromDailyTss([
      { date: '2026-04-01', tss: 0 },
      { date: '2026-04-02', tss: 100 },
      { date: '2026-04-03', tss: 50 },
    ]);

    expect(series).toHaveLength(3);
    expect(series[0]).toMatchObject({ date: '2026-04-01', tss: 0, ctl: 0, atl: 0, tsb: 0 });
    expect(series[1]!.ctl).toBeGreaterThan(0);
    expect(series[1]!.atl).toBeGreaterThan(series[1]!.ctl);
    expect(series[1]!.tsb).toBeLessThan(0);
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
    expect(r.label).toBe('optimal');
    expect(r.shortLabel).toBe('OPTIMAL');
    expect(r.color).toBe('green');
  });

  it('labels low for poor values', () => {
    const r = computeReadinessScore({
      sleepHours: 4, hrvStatus: 'poor',
      bodyBatteryMax: 20, stressAvg: 75,
      mentalScore: 30, tsb: -25,
    });
    expect(r.label).toBe('erholen');
    expect(r.shortLabel).toBe('ERHOLEN');
    expect(r.color).toBe('rose');
  });
});
