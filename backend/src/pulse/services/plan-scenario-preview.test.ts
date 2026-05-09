import { describe, expect, it } from 'vitest';
import { buildPlanScenarioPreview } from './plan-scenario-preview.js';

const baseWorkout = {
  id: 'workout-1',
  plannedDate: '2026-05-10',
  activityType: 'bike' as const,
  zone: 2,
  durationMin: 90,
  targetTss: 68,
  userLocked: false,
  status: 'planned',
};

describe('buildPlanScenarioPreview', () => {
  it('previews a relaxed 155 km tour with next-day recovery and fueling impact', () => {
    const preview = buildPlanScenarioPreview({
      today: '2026-05-09',
      workouts: [baseWorkout],
      scenario: {
        type: 'add_custom_tour',
        workout: {
          plannedDate: '2026-05-11',
          activityType: 'bike',
          zone: 2,
          durationMin: 430,
          distanceKm: 155,
          expectedSpeedKmh: 21.6,
          description: 'Entspannte 155 km Rennradtour mit Stops.',
        },
      },
    });

    expect(preview.changedDays.map(day => day.date)).toEqual(['2026-05-11', '2026-05-12']);
    expect(preview.loadImpact.tssDelta).toBeGreaterThan(250);
    expect(preview.reasons).toEqual(expect.arrayContaining([
      'Lange Tour: Fueling und GI-Komfort werden zur Akzeptanzbedingung.',
      'Folgetag als Recovery/Feedback-Fenster schützen.',
    ]));
    expect(preview.warnings.join(' ')).toContain('155');
    expect(preview.applySupported).toBe(true);
  });

  it('moves a workout without creating or deleting other workouts in preview', () => {
    const preview = buildPlanScenarioPreview({
      today: '2026-05-09',
      workouts: [baseWorkout],
      scenario: {
        type: 'move_workout',
        workoutId: 'workout-1',
        targetDate: '2026-05-12',
      },
    });

    expect(preview.projectedWorkouts).toHaveLength(1);
    expect(preview.projectedWorkouts[0]?.plannedDate).toBe('2026-05-12');
    expect(preview.changedDays.map(day => day.date)).toEqual(['2026-05-10', '2026-05-12']);
    expect(preview.loadImpact.tssDelta).toBe(0);
  });

  it('reduces non-locked future workouts but preserves user-locked workouts', () => {
    const preview = buildPlanScenarioPreview({
      today: '2026-05-09',
      workouts: [
        baseWorkout,
        { ...baseWorkout, id: 'locked', plannedDate: '2026-05-12', durationMin: 240, targetTss: 180, userLocked: true },
      ],
      scenario: { type: 'reduce_volume', factor: 0.75 },
    });

    const normal = preview.projectedWorkouts.find(workout => workout.id === 'workout-1');
    const locked = preview.projectedWorkouts.find(workout => workout.id === 'locked');

    expect(normal?.durationMin).toBe(70);
    expect(locked?.durationMin).toBe(240);
    expect(preview.reasons).toContain('User-locked Workouts bleiben unverändert.');
  });
});
