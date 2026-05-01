import { describe, expect, it } from 'vitest';
import { aggregateThemeRows, type MentalThemeRow } from './mental-theme-aggregate.js';

function row(date: string, themes: string[]): MentalThemeRow {
  return {
    id: `${date}-${themes.join('-')}`,
    date,
    mood: 6,
    energy: 6,
    stress: 5,
    motivation: 6,
    notes: `Notiz ${date}`,
    themes,
  };
}

describe('aggregateThemeRows', () => {
  it('aggregates recurring themes and filters one-off noise', () => {
    const result = aggregateThemeRows([
      row('2026-04-29', ['Work-Stress', 'work-stress']),
      row('2026-04-25', ['work-stress']),
      row('2026-04-10', ['work-stress']),
      row('2026-04-05', ['schlaf-mangel']),
      row('2026-04-03', ['schlaf-mangel']),
      row('2026-03-31', ['schlaf-mangel']),
      row('2026-04-29', ['einmalig']),
    ], '2026-04-30');

    expect(result.totalCheckins).toBe(7);
    expect(result.themes.map((theme) => theme.theme)).toEqual(['work-stress', 'schlaf-mangel']);

    const workStress = result.themes.find((theme) => theme.theme === 'work-stress')!;
    expect(workStress.count).toBe(3);
    expect(workStress.firstSeen).toBe('2026-04-10');
    expect(workStress.lastSeen).toBe('2026-04-29');
    expect(workStress.isResurfacing).toBe(true);
    expect(workStress.isResolved).toBe(false);
    expect(workStress.weeklyFrequency.length).toBeGreaterThan(0);
    expect(workStress.occurrences[0]).toMatchObject({ notes: 'Notiz 2026-04-10' });
  });

  it('marks themes as resolved when they disappear after a frequent prior window', () => {
    const result = aggregateThemeRows([
      row('2026-04-10', ['rueckenschmerz']),
      row('2026-04-06', ['rueckenschmerz']),
      row('2026-03-29', ['rueckenschmerz']),
      row('2026-04-29', ['training-spass']),
      row('2026-04-20', ['training-spass']),
    ], '2026-04-30');

    const backPain = result.themes.find((theme) => theme.theme === 'rueckenschmerz')!;
    expect(backPain.isResolved).toBe(true);
    expect(backPain.isResurfacing).toBe(false);
  });

  it('uses the exact resurfacing formula without an extra minimum', () => {
    const result = aggregateThemeRows([
      row('2026-04-29', ['arbeit']),
      row('2026-03-10', ['arbeit']),
    ], '2026-04-30');

    expect(result.themes[0]?.isResurfacing).toBe(true);
  });
});
