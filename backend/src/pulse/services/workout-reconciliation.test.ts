import { describe, expect, it } from 'vitest';
import {
  deriveWorkoutExecutionState,
  scoreActivityWorkoutMatch,
  summarizeExecutionState,
} from './workout-reconciliation.js';

const baseWorkout = {
  id: 'workout-1',
  plannedDate: '2026-05-01',
  activityType: 'bike' as const,
  status: 'planned',
  garminWorkoutId: null,
  garminScheduledId: null,
  completedActivityId: null,
  durationMin: 90,
};

describe('deriveWorkoutExecutionState', () => {
  it('summarizes Garmin confidence states for planned workouts', () => {
    expect(summarizeExecutionState('local_planned')).toBe('Lokal');
    expect(summarizeExecutionState('garmin_template')).toBe('Garmin');
    expect(summarizeExecutionState('garmin_scheduled')).toBe('Kalender');
    expect(summarizeExecutionState('completed_matched')).toBe('Erledigt');
    expect(summarizeExecutionState('missed')).toBe('Verpasst');
    expect(summarizeExecutionState('replaced_or_off_plan')).toBe('Ersetzt');
  });

  it('marks a local future workout without Garmin ids as local_planned', () => {
    const state = deriveWorkoutExecutionState(baseWorkout, null, null, new Date('2026-05-01T06:00:00.000Z'));
    expect(state.status).toBe('local_planned');
    expect(summarizeExecutionState(state.status)).toBe('Lokal');
  });

  it('distinguishes Garmin template and scheduled states', () => {
    expect(deriveWorkoutExecutionState({
      ...baseWorkout,
      garminWorkoutId: 'garmin-workout-1',
    }, null, null, new Date('2026-05-01T06:00:00.000Z')).status).toBe('garmin_template');

    const scheduled = deriveWorkoutExecutionState({
      ...baseWorkout,
      garminWorkoutId: 'garmin-workout-1',
      garminScheduledId: 'schedule-1',
    }, null, null, new Date('2026-05-01T06:00:00.000Z'));
    expect(scheduled.status).toBe('garmin_scheduled');
    expect(summarizeExecutionState(scheduled.status)).toBe('Kalender');
  });

  it('marks a completed matching activity as completed_matched', () => {
    const state = deriveWorkoutExecutionState({
      ...baseWorkout,
      status: 'completed',
      completedActivityId: 'activity-1',
    }, null, {
      id: 'activity-1',
      startTime: '2026-05-01T09:00:00.000Z',
      activityType: 'bike',
      durationSec: 5_200,
    }, new Date('2026-05-01T12:00:00.000Z'));

    expect(state.status).toBe('completed_matched');
    expect(state.confidence).toBeGreaterThanOrEqual(0.8);
    expect(summarizeExecutionState(state.status)).toBe('Erledigt');
  });

  it('marks a past planned workout without activity as missed', () => {
    const state = deriveWorkoutExecutionState(baseWorkout, null, null, new Date('2026-05-02T06:00:00.000Z'));
    expect(state.status).toBe('missed');
    expect(summarizeExecutionState(state.status)).toBe('Verpasst');
  });

  it('marks a same-day activity with a different type as replaced_or_off_plan', () => {
    const state = deriveWorkoutExecutionState(baseWorkout, null, {
      id: 'activity-2',
      startTime: '2026-05-01T09:00:00.000Z',
      activityType: 'run',
      durationSec: 2_700,
    }, new Date('2026-05-01T12:00:00.000Z'));

    expect(scoreActivityWorkoutMatch(baseWorkout, {
      startTime: '2026-05-01T09:00:00.000Z',
      activityType: 'run',
      durationSec: 2_700,
    })).toBeLessThan(0.6);
    expect(state.status).toBe('replaced_or_off_plan');
    expect(summarizeExecutionState(state.status)).toBe('Ersetzt');
  });
});
