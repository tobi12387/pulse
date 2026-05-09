import { describe, expect, it } from 'vitest';
import {
  buildGarminWorkoutJson,
  buildGarminSyncContract,
  garminWorkoutHasBrokenRepeatIterations,
  workoutHasRepeatSteps,
} from './garmin-workout.js';

describe('buildGarminWorkoutJson', () => {
  it('adds concise fueling guidance to the Garmin workout description without duplicating old blocks', () => {
    const payload = buildGarminWorkoutJson({
      activityType: 'bike',
      zone: 3,
      durationMin: 180,
      description: 'Lange Ausfahrt.\n\nPulse Fueling:\n- alter Hinweis',
      steps: [
        { type: 'steady', durationMin: 180, zone: 3, description: 'Z3 Endurance' },
      ],
    } as Parameters<typeof buildGarminWorkoutJson>[0], {
      fuelingGuidance: {
        shouldShow: true,
        preferenceStatus: 'ready',
        before: [{ id: 'before', text: '2-3 h vorher normale Mahlzeit.' }],
        during: [
          { id: 'during-carbs', text: '60-90 g Kohlenhydrate pro Stunde; Ministry als Produktanker nutzen.' },
          { id: 'during-sodium', text: '400-800 mg Sodium pro Liter, an Hitze und Schweißrate anpassen.' },
        ],
        after: [{ id: 'after', text: 'Recovery innerhalb von 2 h starten.' }],
        recoveryCautions: ['HRV/Recovery schwach: eher untere Carb-Range nutzen.'],
        evidence: [],
      },
    } as never);

    expect(payload.description).toContain('Lange Ausfahrt.');
    expect(payload.description).toContain('Pulse Fueling:');
    expect(payload.description).toContain('Während: 60-90 g Kohlenhydrate pro Stunde');
    expect(payload.description).toContain('Sodium: 400-800 mg Sodium pro Liter');
    expect(payload.description).toContain('Danach: Recovery innerhalb von 2 h starten.');
    expect(payload.description).toContain('Achtung: HRV/Recovery schwach');
    expect(payload.description).not.toContain('alter Hinweis');
  });

  it('keeps the Garmin workout description unchanged when fueling guidance should stay quiet', () => {
    const payload = buildGarminWorkoutJson({
      activityType: 'run',
      zone: 2,
      durationMin: 45,
      description: 'Lockerer Lauf.',
      steps: [
        { type: 'steady', durationMin: 45, zone: 2, description: 'Aerob' },
      ],
    } as Parameters<typeof buildGarminWorkoutJson>[0], {
      fuelingGuidance: {
        shouldShow: false,
        preferenceStatus: 'ready',
        before: [],
        during: [],
        after: [],
        recoveryCautions: [],
        evidence: [],
      },
    } as never);

    expect(payload.description).toBe('Lockerer Lauf.');
  });

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

  it('blocks Garmin sync when a repeat payload would upload without iterations', () => {
    const workout = {
      id: 'planned-repeat',
      activityType: 'bike',
      zone: 4,
      durationMin: 26,
      description: 'Repeat-Test',
      steps: [
        { type: 'warmup', durationMin: 8, zone: 1, description: 'Warmup' },
        { type: 'interval', durationMin: 5, zone: 4, reps: 2, restMin: 3, description: 'Z4' },
      ],
    } as Parameters<typeof buildGarminWorkoutJson>[0] & { id: string };
    const payload = buildGarminWorkoutJson(workout);
    const repeat = payload.workoutSegments[0]!.workoutSteps.find(step => step.type === 'RepeatGroupDTO');
    if (repeat?.type === 'RepeatGroupDTO') {
      repeat.numberOfIterations = 0;
      repeat.endConditionValue = 0;
    }

    const contract = buildGarminSyncContract(workout, payload, { checkedAt: '2026-05-09T12:00:00.000Z' });

    expect(contract.status).toBe('blocked');
    expect(contract.payloadReady).toBe(false);
    expect(contract.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'repeat_iterations_invalid', severity: 'error' }),
    ]));
  });

  it('marks unsupported Garmin HR targets as degraded instead of hiding them', () => {
    const workout = {
      id: 'planned-swim',
      activityType: 'swim',
      zone: 3,
      durationMin: 45,
      description: 'Swim Z3',
      steps: [
        { type: 'steady', durationMin: 45, zone: 3, description: 'Z3 steady' },
      ],
    } as Parameters<typeof buildGarminWorkoutJson>[0] & { id: string };

    const contract = buildGarminSyncContract(workout, buildGarminWorkoutJson(workout), { checkedAt: '2026-05-09T12:00:00.000Z' });

    expect(contract.status).toBe('degraded');
    expect(contract.payloadReady).toBe(true);
    expect(contract.summary).toContain('ohne HR-Ziel');
    expect(contract.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'unsupported_hr_target', severity: 'warning' }),
    ]));
  });
});
