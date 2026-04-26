import { describe, it, expect } from 'vitest';
import { generateWeekWorkouts, adaptIntensityForReadiness } from './plan-engine.js';

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
