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
