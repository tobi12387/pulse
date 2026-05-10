import { describe, expect, it } from 'vitest';
import { buildGarminWorkoutJson, summarizeGarminPayloadSnapshot } from './garmin-workout.js';

describe('Garmin payload snapshot', () => {
  it('counts repeat groups and HR targets from the generated Garmin payload', () => {
    const payload = buildGarminWorkoutJson({
      activityType: 'bike',
      zone: 4,
      durationMin: 60,
      description: 'Schwelle',
      steps: [
        { type: 'warmup', durationMin: 10, zone: 1 },
        { type: 'interval', durationMin: 8, reps: 3, restMin: 3, zone: 4 },
        { type: 'cooldown', durationMin: 10, zone: 1 },
      ],
    });

    const snapshot = summarizeGarminPayloadSnapshot(payload, {
      workoutId: 'w1',
      scheduledId: 's1',
      checkedAt: '2026-05-10T10:00:00.000Z',
    });

    expect(snapshot).toMatchObject({
      workoutId: 'w1',
      scheduledId: 's1',
      stepCount: 5,
      repeatGroupCount: 1,
      invalidRepeatCount: 0,
      hrTargetStepCount: 4,
    });
  });
});
