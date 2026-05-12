import assert from 'node:assert/strict';
import test from 'node:test';

import type { PulsePlannedWorkout } from '../shared/types/pulse/index.ts';
import { buildWorkoutProgressionInsight } from '../frontend/src/features/plan/workout-progression-model.ts';

function workout(overrides: Partial<PulsePlannedWorkout>): PulsePlannedWorkout {
  return {
    id: overrides.id ?? 'w1',
    userId: 'u1',
    plannedDate: overrides.plannedDate ?? '2026-05-13',
    activityType: overrides.activityType ?? 'bike',
    zone: overrides.zone ?? 2,
    durationMin: overrides.durationMin ?? 90,
    distanceKm: null,
    targetTss: overrides.targetTss ?? 60,
    archetypeId: overrides.archetypeId ?? 'endurance_cadence',
    difficultyLevel: overrides.difficultyLevel ?? 3.8,
    difficultyEnergySystem: overrides.difficultyEnergySystem ?? 'endurance',
    capabilityFit: overrides.capabilityFit ?? 'productive',
    description: overrides.description ?? null,
    steps: overrides.steps ?? null,
    garminWorkoutId: null,
    garminScheduledId: null,
    garminSyncContract: null,
    status: overrides.status ?? 'planned',
    workoutFeedback: null,
    complianceScore: null,
    origin: 'generated',
    userLocked: false,
    completedActivityId: null,
    executionStatus: overrides.executionStatus ?? 'local_planned',
    executionMatchedAt: null,
    executionMatchConfidence: null,
    executionNotes: null,
    ...overrides,
  };
}

test('explains productive workouts with role, calibration and change trigger', () => {
  const target = workout({
    id: 'productive',
    archetypeId: 'threshold_intervals',
    difficultyEnergySystem: 'threshold',
    difficultyLevel: 4.2,
    capabilityFit: 'productive',
    zone: 4,
  });

  const insight = buildWorkoutProgressionInsight({
    today: '2026-05-12',
    workout: target,
    workouts: [target],
  });

  assert.equal(insight.label, 'Produktiver Fortschrittsreiz');
  assert.equal(insight.tone, 'green');
  assert.match(insight.role, /Threshold Intervals/);
  assert.match(insight.calibration, /Workout-Level 4\.2/);
  assert.match(insight.calibration, /Produktiv/);
  assert.match(insight.repetition, /einzeln/);
  assert.match(insight.changeTrigger, /Warm-up|Fueling/);
  assert.ok(insight.evidence.includes('System: threshold'));
});

test('marks repeated maintenance workouts as deliberate consolidation', () => {
  const target = workout({
    id: 'repeat-2',
    plannedDate: '2026-05-15',
    archetypeId: 'endurance_steady',
    difficultyEnergySystem: 'endurance',
    difficultyLevel: 3.1,
    capabilityFit: 'maintenance',
  });
  const earlier = workout({
    id: 'repeat-1',
    plannedDate: '2026-05-13',
    archetypeId: 'endurance_steady',
    difficultyEnergySystem: 'endurance',
    difficultyLevel: 3.1,
    capabilityFit: 'maintenance',
  });

  const insight = buildWorkoutProgressionInsight({
    today: '2026-05-12',
    workout: target,
    workouts: [earlier, target],
  });

  assert.equal(insight.label, 'Bewusste Konsolidierung');
  assert.equal(insight.tone, 'text');
  assert.match(insight.role, /Steady Endurance/);
  assert.match(insight.repetition, /2x/);
  assert.match(insight.repetition, /bewusst/);
  assert.match(insight.changeTrigger, /langweilig|zu leicht|Ermüdung/);
});

test('treats stretch and too-hard workouts as change candidates', () => {
  const target = workout({
    id: 'stretch',
    archetypeId: 'vo2_repeats',
    difficultyEnergySystem: 'vo2',
    difficultyLevel: 5.0,
    capabilityFit: 'stretch',
    zone: 5,
  });

  const insight = buildWorkoutProgressionInsight({
    today: '2026-05-12',
    workout: target,
    workouts: [target],
  });

  assert.equal(insight.label, 'Grenzreiz kontrollieren');
  assert.equal(insight.tone, 'amber');
  assert.match(insight.role, /VO2 Repeats/);
  assert.match(insight.changeTrigger, /entschärfen|verschieben/);
  assert.ok(insight.evidence.includes('Fit: Stretch'));
});

test('falls back to same energy-system repetition when archetype id is missing', () => {
  const target = workout({
    id: 'system-repeat-2',
    archetypeId: null,
    difficultyEnergySystem: 'tempo',
    difficultyLevel: 3.2,
    capabilityFit: 'maintenance',
    plannedDate: '2026-05-15',
  });
  const earlier = workout({
    id: 'system-repeat-1',
    archetypeId: null,
    difficultyEnergySystem: 'tempo',
    difficultyLevel: 3.0,
    capabilityFit: 'maintenance',
    plannedDate: '2026-05-13',
  });

  const insight = buildWorkoutProgressionInsight({
    today: '2026-05-12',
    workout: target,
    workouts: [earlier, target],
  });

  assert.equal(insight.label, 'Bewusste Konsolidierung');
  assert.match(insight.role, /tempo/);
  assert.match(insight.repetition, /2x/);
  assert.ok(insight.evidence.includes('System: tempo'));
});

test('groups different archetype variants when they train the same energy system', () => {
  const target = workout({
    id: 'endurance-variant-2',
    archetypeId: 'endurance_cadence',
    difficultyEnergySystem: 'endurance',
    difficultyLevel: 3.2,
    capabilityFit: 'maintenance',
    plannedDate: '2026-05-15',
  });
  const earlier = workout({
    id: 'endurance-variant-1',
    archetypeId: 'endurance_steady',
    difficultyEnergySystem: 'endurance',
    difficultyLevel: 3.1,
    capabilityFit: 'maintenance',
    plannedDate: '2026-05-13',
  });

  const insight = buildWorkoutProgressionInsight({
    today: '2026-05-12',
    workout: target,
    workouts: [earlier, target],
  });

  assert.equal(insight.label, 'Bewusste Konsolidierung');
  assert.match(insight.role, /Endurance Cadence/);
  assert.match(insight.repetition, /2x/);
  assert.ok(insight.evidence.includes('System: endurance'));
});
