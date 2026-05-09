import { describe, expect, it } from 'vitest';
import { buildSeasonStrategy } from './season-strategy.js';

type StrategyInput = Parameters<typeof buildSeasonStrategy>[0];

function race(overrides: Partial<StrategyInput['races'][number]> = {}): StrategyInput['races'][number] {
  return {
    goalId: 'race-1',
    title: '70.3 Kraichgau',
    date: '2026-07-11',
    daysUntil: 70,
    phase: 'build',
    discipline: 'triathlon_70_3',
    distanceKm: 113,
    targetTimeSec: null,
    priority: 'A',
    predictedTimeSec: null,
    predictionConfidence: null,
    location: null,
    notes: null,
    ...overrides,
  };
}

function input(overrides: Partial<StrategyInput> = {}): StrategyInput {
  return {
    today: '2026-05-02',
    weekStart: '2026-05-04',
    races: [],
    goals: [],
    fitnessLoad: { ctl: 42, atl: 39, tsb: 3 },
    availability: { availableDays: [0, 1, 2, 3, 4, 5], weeklyHours: 8 },
    coachPreferences: { preferredLongDays: [], dislikedWorkoutPatterns: [] },
    ...overrides,
  };
}

describe('buildSeasonStrategy', () => {
  it('projects build, peak, taper and race-week blocks for an A-race ten weeks away', () => {
    const strategy = buildSeasonStrategy(input({
      races: [race()],
    }));

    expect(strategy.primaryGoal?.title).toBe('70.3 Kraichgau');
    expect(strategy.currentBlock.kind).toBe('build');
    expect(strategy.upcomingBlocks.map(block => block.kind)).toEqual(expect.arrayContaining(['build', 'peak', 'taper', 'race_week']));
    expect(strategy.guardrails.nextBoundary?.label).toContain('Taper');
    expect(strategy.evidence).toContain('A-Race in 10 Wochen');
  });

  it('marks the current week as consolidation when TSB is negative and recent load is high', () => {
    const strategy = buildSeasonStrategy(input({
      races: [race({ daysUntil: 42, date: '2026-06-13', phase: 'peak' })],
      fitnessLoad: { ctl: 44, atl: 63, tsb: -19 },
    }));

    expect(strategy.currentBlock.kind).toBe('consolidation');
    expect(strategy.guardrails.maxHardDays).toBe(0);
    expect(strategy.guardrails.deload).toBe(true);
    expect(strategy.guardrails.rationale.join(' ')).toContain('TSB');
  });

  it('keeps intentional free days even when six days are available', () => {
    const strategy = buildSeasonStrategy(input({
      races: [race()],
      availability: { availableDays: [0, 1, 2, 3, 4, 5], weeklyHours: 8 },
    }));

    expect(strategy.guardrails.targetSessions).toBeLessThan(6);
    expect(strategy.guardrails.freeDayRationale).toContain('nicht alle verfügbaren Tage');
  });

  it('falls back to maintenance strategy when no race is active', () => {
    const strategy = buildSeasonStrategy(input({
      goals: [{ id: 'goal-1', title: 'Alltag robust halten', category: 'volume', targetDate: null, racePriority: null }],
    }));

    expect(strategy.primaryGoal?.title).toBe('Alltag robust halten');
    expect(strategy.currentBlock.kind).toBe('maintenance');
    expect(strategy.guardrails.maxHardDays).toBeLessThanOrEqual(1);
    expect(strategy.evidence).toContain('Kein aktives Race-Ziel');
  });

  it('adds taper load targets when an A race is near', () => {
    const strategy = buildSeasonStrategy(input({
      races: [race({ daysUntil: 14, date: '2026-05-16', phase: 'taper' })],
      availability: { availableDays: [0, 2, 4, 5], weeklyHours: 9 },
    }));

    expect(strategy.currentBlock.kind).toBe('taper');
    expect(strategy.loadModel.currentWeek.kind).toBe('taper');
    expect(strategy.loadModel.currentWeek.targetHours).toBeLessThan(9);
    expect(strategy.loadModel.warnings.join(' ')).toContain('Taper');
  });

  it('caps overloaded weeks and shows a four-week correction lane', () => {
    const strategy = buildSeasonStrategy(input({
      races: [race({ daysUntil: 56, date: '2026-06-27', phase: 'build' })],
      fitnessLoad: { ctl: 45, atl: 66, tsb: -21 },
    }));

    expect(strategy.currentBlock.kind).toBe('consolidation');
    expect(strategy.loadModel.currentWeek.kind).toBe('deload');
    expect(strategy.loadModel.forecast).toHaveLength(4);
    expect(strategy.loadModel.forecast[0]?.targetTss).toBeLessThan(strategy.loadModel.forecast[3]?.targetTss ?? 0);
    expect(strategy.loadModel.warnings.join(' ')).toContain('ATL-CTL');
  });
});
