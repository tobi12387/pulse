import { describe, expect, it } from 'vitest';
import { bestPowerEfforts, deriveDurabilitySignal, bestPowerEffortsFromLaps, deriveDurabilityFromLaps } from './power-duration.js';

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

  it('marks lap-derived efforts as approximations', () => {
    const efforts = bestPowerEffortsFromLaps([
      { durationSec: 900, avgPowerW: 180 },
      { durationSec: 900, avgPowerW: 220 },
      { durationSec: 900, avgPowerW: 190 },
    ], [300, 1200]);

    expect(efforts.find(e => e.durationSec === 300)).toMatchObject({
      avgPowerW: 220,
      source: 'lap_approximation',
    });
    expect(efforts.find(e => e.durationSec === 1200)?.avgPowerW).toBeGreaterThan(190);
  });

  it('derives lap durability from first and second half lap averages', () => {
    const result = deriveDurabilityFromLaps([
      { durationSec: 3600, avgPowerW: 210, avgHr: 135 },
      { durationSec: 3600, avgPowerW: 208, avgHr: 136 },
      { durationSec: 3600, avgPowerW: 165, avgHr: 138 },
      { durationSec: 3600, avgPowerW: 164, avgHr: 139 },
    ]);

    expect(result?.rating).toBe('limited');
    expect(result?.evidence.join(' ')).toContain('Power -21%');
  });
});
