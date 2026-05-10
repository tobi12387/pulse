import { describe, expect, it } from 'vitest';
import { deriveTrainingCapabilities } from './training-capabilities.js';
import {
  buildWorkoutLibraryPrescription,
  selectWorkoutArchetype,
} from './workout-library.js';
import { previewGarminSyncContract } from './garmin-workout.js';

function stepMinutes(step: { type: string; durationMin: number; reps?: number; restMin?: number }): number {
  return step.type === 'interval'
    ? (step.reps ?? 1) * step.durationMin + Math.max(0, (step.reps ?? 1) - 1) * (step.restMin ?? 0)
    : step.durationMin;
}

describe('workout library', () => {
  it('materializes threshold workouts with stable archetype, interval steps and fit label', () => {
    const capabilities = deriveTrainingCapabilities({
      completedWorkouts: [{
        activityType: 'bike',
        zone: 4,
        durationMin: 80,
        targetTss: 92,
        complianceScore: 0.94,
        rpe: 7,
        status: 'completed_matched',
      }],
      recentActivities: [],
    });

    const prescription = buildWorkoutLibraryPrescription({
      activityType: 'bike',
      zone: 4,
      durationMin: 70,
      targetTss: 82,
    }, capabilities);

    expect(prescription.metadata.archetypeId).toBe('threshold_intervals');
    expect(prescription.metadata.difficultyEnergySystem).toBe('threshold');
    expect(prescription.metadata.capabilityFit).toMatch(/productive|stretch/);
    expect(prescription.steps.some(step => step.type === 'interval' && (step.reps ?? 0) > 1)).toBe(true);
    expect(prescription.description).toContain('Archetyp Threshold Intervals');
  });

  it('keeps purpose stable but updates sport copy when sport changes', () => {
    const bike = buildWorkoutLibraryPrescription({
      activityType: 'bike',
      zone: 3,
      durationMin: 75,
      targetTss: 80,
    });
    const run = buildWorkoutLibraryPrescription({
      activityType: 'run',
      zone: 3,
      durationMin: 55,
      targetTss: 60,
    });

    expect(bike.metadata.archetypeId).toBe('tempo_sustained');
    expect(run.metadata.archetypeId).toBe('tempo_sustained');
    expect(bike.description).toContain('Radeinheit');
    expect(run.description).toContain('Lauf');
    expect(run.description).not.toContain('Radeinheit');
  });

  it('treats very long endurance as fueling-sensitive library work', () => {
    const archetype = selectWorkoutArchetype({
      activityType: 'bike',
      zone: 2,
      durationMin: 300,
    });
    const prescription = buildWorkoutLibraryPrescription({
      activityType: 'bike',
      zone: 2,
      durationMin: 300,
      targetTss: 230,
    });

    expect(archetype.id).toBe('long_endurance');
    expect(prescription.metadata.difficultyEnergySystem).toBe('long_endurance');
    expect(prescription.description).toContain('Fueling');
    expect(prescription.steps.map(step => step.type)).toEqual(['warmup', 'steady', 'cooldown']);
  });

  it('rotates endurance variants when the previous archetype should be avoided', () => {
    const next = selectWorkoutArchetype({
      activityType: 'bike',
      zone: 2,
      durationMin: 75,
      avoidRepeatArchetypeIds: ['endurance_steady'],
    });

    expect(next.id).not.toBe('endurance_steady');
    expect(next.progressionFamily).toBe('endurance');
  });

  it('uses limiter context to pick long fueling practice when it fits', () => {
    const next = selectWorkoutArchetype({
      activityType: 'bike',
      zone: 2,
      durationMin: 180,
      goalLimiterKind: 'long_endurance_fueling',
    });

    expect(next.id).toBe('long_endurance_fueling_practice');
  });

  it('builds threshold cruise as Garmin-safe repeat groups', () => {
    const prescription = buildWorkoutLibraryPrescription({
      activityType: 'bike',
      zone: 4,
      durationMin: 75,
      targetTss: 88,
      preferredFamily: 'threshold',
    }, null, { forcedArchetypeId: 'threshold_cruise' });

    expect(prescription.metadata.archetypeId).toBe('threshold_cruise');
    expect(prescription.steps.some(step => step.type === 'interval' && (step.reps ?? 0) > 1)).toBe(true);
    expect(previewGarminSyncContract({
      activityType: 'bike',
      zone: 4,
      durationMin: 75,
      description: prescription.description,
      steps: prescription.steps,
    }).status).toBe('ready');
  });

  it('keeps strength prehab as support notes without fake interval repeats', () => {
    const prescription = buildWorkoutLibraryPrescription({
      activityType: 'strength',
      zone: 1,
      durationMin: 35,
      targetTss: 15,
    }, null, { forcedArchetypeId: 'strength_prehab' });

    expect(prescription.metadata.archetypeId).toBe('strength_prehab');
    expect(prescription.steps.every(step => step.type !== 'interval')).toBe(true);
    expect(prescription.steps.map(step => step.description).join(' ')).toContain('Mobility');
  });

  it('turns strength support into concrete blocks instead of a generic note', () => {
    const prescription = buildWorkoutLibraryPrescription({
      activityType: 'strength',
      zone: 1,
      durationMin: 25,
      targetTss: 15,
    }, null, { forcedArchetypeId: 'strength_support' });

    expect(prescription.steps.length).toBeGreaterThanOrEqual(3);
    expect(prescription.steps.every(step => step.type !== 'interval')).toBe(true);
    expect(prescription.steps.map(step => step.description).join(' ')).toContain('Core');
    expect(prescription.description).toContain('Unterstuetzt Haltung');
  });

  it('keeps short high-intensity activations inside the planned duration', () => {
    const shortActivation = buildWorkoutLibraryPrescription({
      activityType: 'run',
      zone: 5,
      durationMin: 18,
      targetTss: 35,
    });
    const compactIntervals = buildWorkoutLibraryPrescription({
      activityType: 'run',
      zone: 5,
      durationMin: 30,
      targetTss: 55,
    });

    expect(shortActivation.metadata.archetypeId).toBe('anaerobic_sharpening');
    expect(shortActivation.steps).toEqual([expect.objectContaining({
      type: 'steady',
      durationMin: 18,
      zone: 5,
    })]);
    expect(compactIntervals.steps.reduce((sum, step) => sum + stepMinutes(step), 0)).toBeLessThanOrEqual(32);
  });
});
