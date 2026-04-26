import { describe, it, expect } from 'vitest';
import { computeLinearTrend, buildPrognosis } from './prognosis-engine.js';

describe('computeLinearTrend', () => {
  it('erkennt fallenden Trend', () => {
    const values = [50, 48, 45, 43, 40, 38, 35];
    expect(computeLinearTrend(values)).toBeLessThan(0);
  });

  it('erkennt steigenden Trend', () => {
    const values = [35, 38, 40, 43, 45, 48, 50];
    expect(computeLinearTrend(values)).toBeGreaterThan(0);
  });

  it('gibt 0 bei weniger als 3 Werten zurück', () => {
    expect(computeLinearTrend([40, 42])).toBe(0);
  });
});

describe('buildPrognosis', () => {
  it('gibt alert=true bei fallender HRV + erhöhtem Stress', () => {
    const result = buildPrognosis({
      hrv7d:      [55, 52, 50, 47, 44, 42, 39],
      mentalLast5: [{ mood: 5, energy: 4 }, { mood: 4, energy: 4 }, { mood: 4, energy: 3 }, { mood: 3, energy: 3 }, { mood: 3, energy: 3 }],
      tsb: -18,
    });
    expect(result.alert).toBe(true);
    expect(result.factors.length).toBeGreaterThanOrEqual(2);
  });

  it('gibt alert=false bei guten Werten', () => {
    const result = buildPrognosis({
      hrv7d:      [45, 46, 47, 48, 47, 48, 49],
      mentalLast5: [{ mood: 7, energy: 8 }, { mood: 8, energy: 7 }, { mood: 7, energy: 8 }, { mood: 8, energy: 8 }, { mood: 7, energy: 7 }],
      tsb: 5,
    });
    expect(result.alert).toBe(false);
  });
});
