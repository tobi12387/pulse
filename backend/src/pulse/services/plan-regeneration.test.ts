import { describe, expect, it } from 'vitest';
import {
  deriveExecutionReviewAvailability,
  determinePlanReplacementCutoff,
  mergeRegeneratedWorkoutsForTrace,
  recoveryFromFitnessLoad,
} from './plan-regeneration.js';

describe('plan regeneration helpers', () => {
  it('uses today as replacement cutoff for in-progress weeks and weekStart for future weeks', () => {
    expect(determinePlanReplacementCutoff('2026-04-27', '2026-05-01')).toBe('2026-05-01');
    expect(determinePlanReplacementCutoff('2026-05-04', '2026-05-01')).toBe('2026-05-04');
  });

  it('keeps preserved same-week workouts in the trace alongside newly inserted workouts', () => {
    const trace = mergeRegeneratedWorkoutsForTrace(
      [{
        plannedDate: '2026-04-28',
        activityType: 'bike',
        zone: 2,
        durationMin: 60,
        targetTss: 40,
        adjustedReason: null,
      }],
      [{
        plannedDate: '2026-05-01',
        activityType: 'run',
        zone: 4,
        durationMin: 45,
        targetTss: 70,
        adjustedReason: 'fatigue',
      }],
    );

    expect(trace.map(workout => workout.plannedDate)).toEqual(['2026-04-28', '2026-05-01']);
    expect(trace[0]).toMatchObject({ activityType: 'bike', targetTss: 40 });
    expect(trace[1]).toMatchObject({ activityType: 'run', adjustedReason: 'fatigue' });
  });

  it('derives previous-week availability from planned offsets plus skipped available days', () => {
    expect(deriveExecutionReviewAvailability({
      weekStart: '2026-04-27',
      plannedWorkouts: [
        { plannedDate: '2026-04-27' },
        { plannedDate: '2026-04-29' },
      ],
      skippedAvailableDays: [1, 3],
    })).toEqual([0, 1, 2, 3]);
  });

  it('maps positive load balance to good recovery and deep fatigue to weak recovery', () => {
    expect(recoveryFromFitnessLoad({ ctl: 40, atl: 35, tsb: 5, date: '2026-05-04' })).toMatchObject({ readinessScore: 82 });
    expect(recoveryFromFitnessLoad({ ctl: 40, atl: 68, tsb: -28, date: '2026-05-04' })).toMatchObject({ readinessScore: 35 });
  });
});
