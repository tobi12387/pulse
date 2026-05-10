import { describe, expect, it } from 'vitest';
import { classifyAdaptationEvents } from './adaptation-events.js';

describe('classifyAdaptationEvents', () => {
  it('turns a completed long off-plan ride with GI issue into recovery and fueling actions', () => {
    const events = classifyAdaptationEvents({
      today: '2026-05-10',
      completedActivities: [{
        id: 'a1',
        date: '2026-05-09',
        activityType: 'bike',
        durationMin: 430,
        tss: 310,
        rpe: 7,
        plannedWorkoutId: null,
      }],
      missedWorkouts: [],
      mental: null,
      readinessScore: 68,
      tsb: -18,
      fuelingHistory: [{
        date: '2026-05-09',
        giComfort: 'mild_issue',
        durationMin: 430,
        carbsG: 360,
      }],
      syncDebtCount: 0,
    });

    expect(events.map(event => event.recommendation)).toEqual(expect.arrayContaining([
      'protect_recovery',
      'reduce_volume',
    ]));
    expect(events.map(event => event.kind)).toEqual(expect.arrayContaining([
      'activity_completed',
      'fueling_limiter',
    ]));
  });

  it('keeps the plan when signals are green and no sync debt exists', () => {
    const events = classifyAdaptationEvents({
      today: '2026-05-10',
      completedActivities: [],
      missedWorkouts: [],
      mental: { energy: 7, stress: 3, mood: 7, motivation: 7 },
      readinessScore: 82,
      tsb: 4,
      fuelingHistory: [],
      syncDebtCount: 0,
    });

    expect(events).toEqual([
      expect.objectContaining({ recommendation: 'keep_plan', severity: 'info' }),
    ]);
  });

  it('turns missed workouts and Garmin sync debt into explicit actions', () => {
    const events = classifyAdaptationEvents({
      today: '2026-05-10',
      completedActivities: [],
      missedWorkouts: [{ id: 'w1', plannedDate: '2026-05-09', activityType: 'run', durationMin: 45, zone: 2 }],
      mental: { energy: 6, stress: 4, mood: 6, motivation: 6 },
      readinessScore: 78,
      tsb: 2,
      fuelingHistory: [],
      syncDebtCount: 2,
    });

    expect(events).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'planned_workout_missed', recommendation: 'move_workout' }),
      expect.objectContaining({ kind: 'sync_debt', recommendation: 'sync_garmin', severity: 'action' }),
    ]));
  });
});
