import { describe, expect, it } from 'vitest';
import {
  buildGarminWorkoutJson,
  garminWorkoutHasBrokenRepeatIterations,
  workoutHasRepeatSteps,
} from './garmin-workout.js';

describe('buildGarminWorkoutJson', () => {
  it('exports interval repeats as Garmin iteration end conditions', () => {
    const payload = buildGarminWorkoutJson({
      activityType: 'bike',
      zone: 4,
      durationMin: 26,
      description: 'Repeat-Test',
      steps: [
        { type: 'warmup', durationMin: 8, zone: 1, description: 'Warmup' },
        { type: 'interval', durationMin: 5, zone: 4, reps: 2, restMin: 3, description: 'Z4' },
        { type: 'cooldown', durationMin: 5, zone: 1, description: 'Cooldown' },
      ],
    });

    const repeat = payload.workoutSegments[0]!.workoutSteps.find(step => step.type === 'RepeatGroupDTO');

    expect(repeat).toBeDefined();
    expect(repeat!.endCondition.conditionTypeKey).toBe('iterations');
    expect(repeat!.endConditionValue).toBe(2);
    expect(repeat!.numberOfIterations).toBe(2);
    expect(repeat!.workoutSteps?.map(step => step.stepType.stepTypeKey)).toEqual(['interval', 'recovery']);
  });

  it('detects local and remote workouts that need repeat repair', () => {
    expect(workoutHasRepeatSteps([
      { type: 'warmup', durationMin: 10, zone: 1 },
      { type: 'interval', durationMin: 5, zone: 4, reps: 2, restMin: 3 },
    ])).toBe(true);
    expect(workoutHasRepeatSteps([
      { type: 'steady', durationMin: 40, zone: 2 },
    ])).toBe(false);

    expect(garminWorkoutHasBrokenRepeatIterations({
      workoutSegments: [{
        workoutSteps: [{
          type: 'RepeatGroupDTO',
          numberOfIterations: null,
          endConditionValue: null,
          endCondition: { conditionTypeKey: 'lap.button' },
        }],
      }],
    })).toBe(true);
    expect(garminWorkoutHasBrokenRepeatIterations({
      workoutSegments: [{
        workoutSteps: [{
          type: 'RepeatGroupDTO',
          numberOfIterations: 0,
          endConditionValue: 0,
          endCondition: { conditionTypeKey: 'iterations' },
        }],
      }],
    })).toBe(true);
    expect(garminWorkoutHasBrokenRepeatIterations({
      workoutSegments: [{
        workoutSteps: [{
          type: 'RepeatGroupDTO',
          numberOfIterations: 2,
          endConditionValue: 2,
          endCondition: { conditionTypeKey: 'iterations' },
        }],
      }],
    })).toBe(false);
  });
});
