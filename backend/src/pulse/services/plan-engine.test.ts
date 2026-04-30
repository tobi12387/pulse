import { describe, it, expect, vi } from 'vitest';
import { generateScientificWeekPlan, generateWeekWorkouts, adaptIntensityForReadiness, decidePlanDays } from './plan-engine.js';

vi.mock('../../lib/llm.js', () => ({
  llmComplete: vi.fn().mockResolvedValue('[]'),
  SMART_MODEL: 'test-model',
}));

describe('generateWeekWorkouts', () => {
  it('generates workouts for the week', () => {
    const workouts = generateWeekWorkouts({
      weekStart: '2026-04-28',
      phase: 'base',
      weeklyHoursTarget: 8,
      availableDays: [1, 3, 5, 6], // Mon, Wed, Fri, Sat
    });
    expect(workouts.length).toBeGreaterThan(0);
    expect(workouts.every((w) => w.durationMin > 0)).toBe(true);
    expect(workouts.every((w) => w.zone >= 1 && w.zone <= 5)).toBe(true);
  });
});

describe('adaptIntensityForReadiness', () => {
  it('reduces duration for low readiness', () => {
    const original = { durationMin: 90, zone: 4 };
    const adapted = adaptIntensityForReadiness(original, 35);
    expect(adapted.durationMin).toBeLessThan(90);
  });

  it('keeps duration for high readiness', () => {
    const original = { durationMin: 90, zone: 4 };
    const adapted = adaptIntensityForReadiness(original, 85);
    expect(adapted.durationMin).toBe(90);
  });

  it('drops zone for critically low readiness', () => {
    const original = { durationMin: 90, zone: 4 };
    const adapted = adaptIntensityForReadiness(original, 25);
    expect(adapted.zone).toBeLessThan(4);
  });
});

describe('decidePlanDays', () => {
  it('treats availability as candidate days for weight goals', () => {
    const decision = decidePlanDays({
      availableDays: [0, 1, 4, 5, 6],
      weeklyHoursTarget: 5,
      tsb: 0,
      phase: 'base',
      mesocycleWeek: 1,
      goals: [{ title: 'Gewicht: 75 kg', targetDate: '2026-06-30', category: 'weight' }],
    });

    expect(decision.selectedDays).toHaveLength(3);
    expect(decision.skippedAvailableDays.length).toBeGreaterThan(0);
    expect(decision.reasons.join(' ')).toContain('Gewichtsziel');
  });

  it('reduces frequency when fatigue is high', () => {
    const decision = decidePlanDays({
      availableDays: [0, 1, 2, 3, 4],
      weeklyHoursTarget: 8,
      tsb: -18,
      phase: 'base',
      mesocycleWeek: 2,
      goals: [],
    });

    expect(decision.selectedDays.length).toBeLessThan(5);
    expect(decision.reasons.join(' ')).toContain('TSB negativ');
  });
});

describe('generateScientificWeekPlan', () => {
  it('does not fill every available day for weight-focused low-volume weeks', async () => {
    const workouts = await generateScientificWeekPlan({
      weekStart: '2026-05-04',
      phase: 'base',
      weeklyHoursTarget: 5,
      availableDays: [0, 1, 4, 5, 6],
      ctl: 15,
      atl: 18,
      tsb: 0,
      ftpWatts: 171,
      maxHrBpm: 175,
      recentActivities: [],
      goals: [{ title: 'Gewicht: 75 kg', targetDate: '2026-06-30', category: 'weight' }],
    });

    expect(workouts).toHaveLength(3);
    expect(workouts.every(w => w.zone <= 2)).toBe(true);
    expect(workouts.some(w => w.activityType === 'strength')).toBe(false);
  });
});
