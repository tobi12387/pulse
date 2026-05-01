import { describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/db.js', () => ({ db: {} }));
vi.mock('./load-engine.js', () => ({ computeFitnessLoad: vi.fn() }));

const { predictRaceTime } = await import('./race-engine.js');

const recentRuns = [
  { distanceKm: 10, timeSec: 3_000, date: '2026-04-15' },
  { distanceKm: 8, timeSec: 2_520, date: '2026-04-20' },
  { distanceKm: 6, timeSec: 1_920, date: '2026-04-25' },
];

describe('predictRaceTime', () => {
  it('uses supplied CTL to adjust race predictions', () => {
    const lowCtl = predictRaceTime({
      discipline: 'run',
      distanceKm: 21.1,
      recentRuns,
      ctl: 20,
    });

    const highCtl = predictRaceTime({
      discipline: 'run',
      distanceKm: 21.1,
      recentRuns,
      ctl: 60,
    });

    expect(lowCtl).not.toBeNull();
    expect(highCtl).not.toBeNull();
    expect(highCtl!.timeSec).toBeLessThan(lowCtl!.timeSec);
  });
});
