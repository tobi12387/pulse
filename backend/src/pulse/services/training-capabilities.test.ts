import { describe, expect, it } from 'vitest';
import {
  deriveTrainingCapabilities,
  fitWorkoutToCapabilities,
} from './training-capabilities.js';

describe('deriveTrainingCapabilities', () => {
  it('does not raise a failed hard workout and marks the next hard workout as too hard today', () => {
    const summary = deriveTrainingCapabilities({
      completedWorkouts: [
        {
          activityType: 'bike',
          zone: 5,
          durationMin: 55,
          targetTss: 95,
          complianceScore: 0.48,
          rpe: 9,
          status: 'completed_matched',
        },
      ],
      recentActivities: [],
    });

    const vo2 = summary.levels.find(level => level.energySystem === 'vo2');
    expect(vo2?.level).toBeLessThanOrEqual(2.5);
    expect(summary.signals).toContain('reduce_next_intensity');

    const fit = fitWorkoutToCapabilities({
      activityType: 'bike',
      zone: 5,
      durationMin: 60,
      targetTss: 100,
    }, summary);
    expect(fit.label).toBe('too_hard_today');
    expect(fit.displayLabel).toBe('Zu hart heute');
  });

  it('raises long-endurance evidence after a long off-plan ride and keeps recovery/fueling caution', () => {
    const summary = deriveTrainingCapabilities({
      completedWorkouts: [],
      recentActivities: [
        {
          activityType: 'bike',
          durationMin: 395,
          tss: 285,
          rpe: 7,
          source: 'off_plan',
        },
      ],
    });

    const longEndurance = summary.levels.find(level => level.energySystem === 'long_endurance');
    expect(longEndurance?.level).toBeGreaterThan(3);
    expect(longEndurance?.evidence.join(' ')).toContain('ungeplante lange');
    expect(summary.signals).toEqual(expect.arrayContaining(['long_off_plan_load', 'protect_recovery']));
    expect(summary.recommendations.join(' ')).toContain('Fueling');
  });

  it('labels workout fit as maintenance, productive, stretch or too hard from capability delta', () => {
    const summary = deriveTrainingCapabilities({
      completedWorkouts: [
        {
          activityType: 'bike',
          zone: 4,
          durationMin: 75,
          targetTss: 88,
          complianceScore: 0.94,
          rpe: 7,
          status: 'completed_matched',
        },
      ],
      recentActivities: [],
    });

    expect(fitWorkoutToCapabilities({
      activityType: 'bike',
      zone: 2,
      durationMin: 60,
      targetTss: 45,
    }, summary).label).toBe('maintenance');

    expect(fitWorkoutToCapabilities({
      activityType: 'bike',
      zone: 4,
      durationMin: 45,
      targetTss: 52,
    }, summary).label).toBe('productive');

    expect(fitWorkoutToCapabilities({
      activityType: 'bike',
      zone: 4,
      durationMin: 80,
      targetTss: 88,
    }, summary).label).toBe('stretch');

    expect(fitWorkoutToCapabilities({
      activityType: 'bike',
      zone: 4,
      durationMin: 120,
      targetTss: 150,
    }, summary).label).toBe('too_hard_today');
  });

  it('treats missing history as cautious stretch instead of pretending hard work is known to be impossible', () => {
    const summary = deriveTrainingCapabilities({
      completedWorkouts: [],
      recentActivities: [],
    });

    const fit = fitWorkoutToCapabilities({
      activityType: 'bike',
      zone: 4,
      durationMin: 60,
      targetTss: 80,
    }, summary);

    expect(summary.signals).toContain('missing_history');
    expect(fit.confidence).toBe('low');
    expect(fit.label).toBe('stretch');
  });
});
