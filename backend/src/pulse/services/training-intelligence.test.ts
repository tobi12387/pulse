import { describe, expect, it } from 'vitest';
import {
  computeWorkoutDifficulty,
  deriveAthleteProgression,
  evaluatePlanQuality,
  trainingArchetypes,
} from './training-intelligence.js';

describe('computeWorkoutDifficulty', () => {
  it('rates interval structure harder than steady work at similar duration', () => {
    const steady = computeWorkoutDifficulty({
      activityType: 'bike',
      zone: 2,
      durationMin: 90,
      targetTss: 74,
      steps: [
        { type: 'warmup', durationMin: 10, zone: 1 },
        { type: 'steady', durationMin: 70, zone: 2 },
        { type: 'cooldown', durationMin: 10, zone: 1 },
      ],
    });
    const intervals = computeWorkoutDifficulty({
      activityType: 'bike',
      zone: 4,
      durationMin: 90,
      targetTss: 78,
      steps: [
        { type: 'warmup', durationMin: 15, zone: 1 },
        { type: 'interval', durationMin: 8, zone: 4, reps: 4, restMin: 3 },
        { type: 'cooldown', durationMin: 10, zone: 1 },
      ],
    });

    expect(intervals.energySystem).toBe('threshold');
    expect(intervals.level).toBeGreaterThan(steady.level + 1);
    expect(intervals.drivers).toEqual(expect.arrayContaining(['interval_repetition', 'quality_intensity']));
  });

  it('marks very long endurance sessions as fueling-sensitive even without high intensity', () => {
    const difficulty = computeWorkoutDifficulty({
      activityType: 'bike',
      zone: 2,
      durationMin: 360,
      targetTss: 294,
      steps: [{ type: 'steady', durationMin: 360, zone: 2 }],
    });

    expect(difficulty.energySystem).toBe('long_endurance');
    expect(difficulty.level).toBeGreaterThanOrEqual(7);
    expect(difficulty.drivers).toEqual(expect.arrayContaining(['long_duration', 'fueling_sensitive']));
  });
});

describe('deriveAthleteProgression', () => {
  it('learns confidence from completed quality work and protects recovery after long off-plan rides', () => {
    const progression = deriveAthleteProgression({
      completedWorkouts: [
        {
          activityType: 'bike',
          zone: 4,
          durationMin: 75,
          targetTss: 90,
          complianceScore: 0.94,
          rpe: 7,
          status: 'completed_matched',
        },
      ],
      recentActivities: [
        {
          activityType: 'bike',
          durationMin: 430,
          tss: 310,
          rpe: 7,
          source: 'off_plan',
        },
      ],
    });

    expect(progression.levels.threshold.level).toBeGreaterThan(3);
    expect(progression.signals).toEqual(expect.arrayContaining(['long_off_plan_load', 'protect_recovery']));
    expect(progression.recommendations.join(' ')).toContain('lange ungeplante');
  });

  it('does not reward failed high-intensity sessions as progression', () => {
    const progression = deriveAthleteProgression({
      completedWorkouts: [
        {
          activityType: 'run',
          zone: 5,
          durationMin: 45,
          targetTss: 85,
          complianceScore: 0.45,
          rpe: 9,
          status: 'completed_matched',
        },
      ],
      recentActivities: [],
    });

    expect(progression.levels.vo2.level).toBeLessThanOrEqual(2.5);
    expect(progression.signals).toEqual(expect.arrayContaining(['reduce_next_intensity']));
  });
});

describe('evaluatePlanQuality', () => {
  it('flags a repeated generic week instead of accepting identical plans silently', () => {
    const currentPlan = [
      { plannedDate: '2026-05-11', activityType: 'bike', zone: 2, durationMin: 90, targetTss: 74 },
      { plannedDate: '2026-05-13', activityType: 'bike', zone: 4, durationMin: 75, targetTss: 90 },
      { plannedDate: '2026-05-16', activityType: 'bike', zone: 2, durationMin: 150, targetTss: 123 },
    ];
    const previousPlan = [
      { plannedDate: '2026-05-04', activityType: 'bike', zone: 2, durationMin: 90, targetTss: 74 },
      { plannedDate: '2026-05-06', activityType: 'bike', zone: 4, durationMin: 75, targetTss: 90 },
      { plannedDate: '2026-05-09', activityType: 'bike', zone: 2, durationMin: 150, targetTss: 123 },
    ];

    const quality = evaluatePlanQuality({
      currentPlan,
      previousPlans: [previousPlan],
      availableDays: [0, 1, 2, 3, 4, 5],
      weeklyHoursTarget: 7,
      goals: [{ category: 'ftp', title: 'FTP steigern' }],
      recentActivities: [],
    });

    expect(quality.score).toBeLessThan(80);
    expect(quality.issues.map(issue => issue.code)).toContain('repeated_generic_week');
    expect(quality.recommendations.join(' ')).toContain('Workout-Archetypen');
  });

  it('flags plans that fill every available day without a strong reason', () => {
    const quality = evaluatePlanQuality({
      currentPlan: [
        { plannedDate: '2026-05-11', activityType: 'bike', zone: 2, durationMin: 60, targetTss: 49 },
        { plannedDate: '2026-05-12', activityType: 'run', zone: 2, durationMin: 45, targetTss: 37 },
        { plannedDate: '2026-05-13', activityType: 'bike', zone: 4, durationMin: 60, targetTss: 86 },
        { plannedDate: '2026-05-14', activityType: 'strength', zone: 1, durationMin: 45, targetTss: 20 },
        { plannedDate: '2026-05-15', activityType: 'bike', zone: 2, durationMin: 90, targetTss: 74 },
      ],
      previousPlans: [],
      availableDays: [0, 1, 2, 3, 4],
      weeklyHoursTarget: 5,
      goals: [{ category: 'weight', title: 'Alltagstauglich fitter werden' }],
      recentActivities: [],
    });

    expect(quality.issues.map(issue => issue.code)).toContain('fills_all_available_days');
  });
});

describe('trainingArchetypes', () => {
  it('contains the core library needed for road/gravel/century planning', () => {
    const ids = trainingArchetypes.map(archetype => archetype.id);

    expect(ids).toEqual(expect.arrayContaining([
      'endurance_steady',
      'long_endurance',
      'tempo_sustained',
      'threshold_intervals',
      'vo2_repeats',
      'gravel_specificity',
      'strength_support',
    ]));
  });

  it('keeps workout library archetype ids unique and Garmin-structure aware', () => {
    const ids = trainingArchetypes.map(archetype => archetype.id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(trainingArchetypes).toHaveLength(20);
    expect(trainingArchetypes.every(archetype => archetype.garminStructure)).toBe(true);
    expect(trainingArchetypes.filter(archetype => archetype.progressionFamily === 'endurance').length).toBeGreaterThanOrEqual(4);
    expect(trainingArchetypes.filter(archetype => archetype.progressionFamily === 'long').length).toBeGreaterThanOrEqual(3);
  });
});
