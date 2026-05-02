import { describe, expect, it } from 'vitest';
import { buildTrainingExecutionReview } from './training-execution-review.js';
import type { TrainingExecutionActivity, TrainingExecutionPlannedWorkout } from './training-execution-review.js';

const weekStart = '2026-04-27';

function workout(overrides: Partial<TrainingExecutionPlannedWorkout> = {}): TrainingExecutionPlannedWorkout {
  return {
    id: 'planned-1',
    plannedDate: '2026-04-28',
    activityType: 'bike',
    zone: 2,
    durationMin: 60,
    status: 'planned',
    completedActivityId: null,
    complianceScore: null,
    ...overrides,
  };
}

function activity(overrides: Partial<TrainingExecutionActivity> = {}): TrainingExecutionActivity {
  return {
    id: 'activity-1',
    startTime: '2026-04-28T07:30:00.000Z',
    activityType: 'bike',
    durationSec: 62 * 60,
    tss: 42,
    rpe: 5,
    sorenessAreas: null,
    ...overrides,
  };
}

describe('buildTrainingExecutionReview', () => {
  it('marks a completed workout within date, sport, and duration tolerance as matched', () => {
    const review = buildTrainingExecutionReview({
      weekStart,
      plannedWorkouts: [workout()],
      activities: [activity()],
      today: '2026-05-04',
    });

    expect(review.signals).toEqual(['matched']);
    expect(review.intents).toEqual(['stable']);
    expect(review.learnedFromLastWeek.join(' ')).toContain('abgeglichen');
    expect(review.recommendedHardDayAvoidance).toEqual([]);
  });

  it('marks a past planned workout without activity evidence as missed and recommends repeating the missed hard-day stimulus carefully', () => {
    const review = buildTrainingExecutionReview({
      weekStart,
      plannedWorkouts: [workout({ zone: 4, durationMin: 75 })],
      activities: [],
      today: '2026-05-04',
    });

    expect(review.signals).toContain('missed');
    expect(review.intents).toContain('repeat');
    expect(review.learnedFromLastWeek.join(' ')).toContain('verpasst');
    expect(review.recommendedHardDayAvoidance).toEqual([1]);
  });

  it('marks a different same-day activity as replacement and recommends rotating the next week', () => {
    const review = buildTrainingExecutionReview({
      weekStart,
      plannedWorkouts: [workout({ activityType: 'run', durationMin: 45 })],
      activities: [activity({ activityType: 'bike', durationSec: 48 * 60 })],
      today: '2026-05-04',
    });

    expect(review.signals).toContain('replaced');
    expect(review.intents).toContain('rotate');
    expect(review.variationComparedToLastWeek.join(' ')).toContain('ersetzt');
  });

  it('uses high RPE and soreness after a hard session as a recovery protection signal', () => {
    const review = buildTrainingExecutionReview({
      weekStart,
      plannedWorkouts: [workout({ zone: 4, durationMin: 70 })],
      activities: [activity({ rpe: 9, sorenessAreas: ['general_fatigue'], tss: 95 })],
      today: '2026-05-04',
    });

    expect(review.signals).toEqual(expect.arrayContaining(['matched', 'reduce_next_intensity', 'protect_recovery']));
    expect(review.intents).toEqual(expect.arrayContaining(['reduce', 'rest']));
    expect(review.learnedFromLastWeek.join(' ')).toContain('RPE 9');
    expect(review.recommendedHardDayAvoidance).toEqual([1]);
  });

  it('explains stable execution, good recovery, and deliberate free days instead of forcing variation', () => {
    const review = buildTrainingExecutionReview({
      weekStart,
      availableDays: [0, 1, 2, 3],
      recovery: { readinessScore: 82, hrvStatus: 'normal' },
      plannedWorkouts: [
        workout({ id: 'planned-1', plannedDate: '2026-04-27', zone: 2, durationMin: 60 }),
        workout({ id: 'planned-2', plannedDate: '2026-04-29', zone: 4, durationMin: 50 }),
      ],
      activities: [
        activity({ id: 'activity-1', startTime: '2026-04-27T08:00:00.000Z', rpe: 5 }),
        activity({ id: 'activity-2', startTime: '2026-04-29T08:00:00.000Z', rpe: 6, tss: 75 }),
      ],
      today: '2026-05-04',
    });

    expect(review.signals).toContain('maintain_structure');
    expect(review.intents).toContain('stable');
    expect(review.variationComparedToLastWeek.join(' ')).toContain('ähnlich');
    expect(review.restDayRationale).toEqual([
      { date: '2026-04-28', reason: 'Bewusster freier Tag: stabile Ausführung und gute Erholung lassen Struktur statt Zusatzumfang zu.' },
      { date: '2026-04-30', reason: 'Bewusster freier Tag: stabile Ausführung und gute Erholung lassen Struktur statt Zusatzumfang zu.' },
    ]);
  });
});
