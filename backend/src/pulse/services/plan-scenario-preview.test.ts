import { describe, expect, it } from 'vitest';
import type { PulseTrainingCapabilitySummary, PulseTrainingEnergySystem } from '@coaching-os/shared/pulse';
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

const ENERGY_SYSTEMS: PulseTrainingEnergySystem[] = [
  'recovery',
  'endurance',
  'long_endurance',
  'tempo',
  'threshold',
  'vo2',
  'anaerobic',
  'strength',
];

function capabilitySummary(overrides: Partial<Record<PulseTrainingEnergySystem, number>> = {}): PulseTrainingCapabilitySummary {
  return {
    generatedAt: '2026-05-01T08:00:00.000Z',
    lookbackDays: 90,
    signals: [],
    recommendations: [],
    fitLegend: {
      recovery: 'Aktive Erholung',
      maintenance: 'Erhaltung',
      productive: 'Produktiv',
      stretch: 'Stretch',
      too_hard_today: 'Zu hart heute',
    },
    levels: ENERGY_SYSTEMS.map(energySystem => ({
      energySystem,
      label: energySystem,
      level: overrides[energySystem] ?? 4.2,
      nextRecommendedWorkoutLevel: (overrides[energySystem] ?? 4.2) + 0.3,
      lastProgressionReason: null,
      staleReason: null,
      confidence: 'high',
      evidence: [`${energySystem} evidence`],
      updatedAt: '2026-05-01T08:00:00.000Z',
    })),
  };
}

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
    expect(preview.summary).toBe('Eigene Einheit wird als user-locked Workout simuliert, ohne den Plan oder Garmin zu verändern.');
    expect(preview.loadImpact.tssDelta).toBeGreaterThan(250);
    expect(preview.reasons).toEqual(expect.arrayContaining([
      'Eigene Einheit bleibt user-locked und wird nicht von der Wochenlogik ueberschrieben.',
      'Lange Tour: Fueling und GI-Komfort werden zur Akzeptanzbedingung.',
      'Folgetag als Recovery/Feedback-Fenster schützen.',
    ]));
    expect(preview.warnings.join(' ')).toContain('155');
    expect(preview.applySupported).toBe(true);
    expect(preview.garminImpact).toMatchObject({ creates: 1, updates: 0, deletes: 0 });
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
    expect(preview.garminImpact).toMatchObject({ creates: 0, updates: 1, deletes: 0 });
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
    expect(preview.garminImpact).toMatchObject({ creates: 0, updates: 1, deletes: 0 });
  });

  it('annotates projected custom workouts with capability fit before apply', () => {
    const preview = buildPlanScenarioPreview({
      today: '2026-05-09',
      workouts: [baseWorkout],
      capabilitySummary: capabilitySummary({ threshold: 4.1 }),
      scenario: {
        type: 'add_custom_tour',
        workout: {
          plannedDate: '2026-05-11',
          activityType: 'bike',
          zone: 4,
          durationMin: 75,
          description: 'Kontrollierte Schwellenarbeit.',
          archetypeId: 'threshold_cruise',
        },
      },
    });

    const projected = preview.projectedWorkouts.find(workout => workout.id === 'preview-custom-tour');

    expect(projected).toMatchObject({
      archetypeId: 'threshold_cruise',
      archetypeLabel: 'Threshold Cruise',
      difficultyEnergySystem: 'threshold',
      capabilityFit: expect.any(String),
    });
    expect(projected?.difficultyLevel).toBeGreaterThan(4);
    expect(projected?.capabilityFitDetail).toMatchObject({
      energySystem: 'threshold',
      capabilityLevel: 4.1,
      displayLabel: expect.any(String),
      recommendation: expect.any(String),
    });
  });
});
