import { describe, expect, it } from 'vitest';
import { classifyAdaptationEvents } from './adaptation-events.js';

describe('classifyAdaptationEvents', () => {
  it('turns a completed long off-plan ride with GI issue into recovery and fueling actions', () => {
    const events = classifyAdaptationEvents({
      today: '2026-05-10',
      completedActivities: [{
        id: 'a1',
        date: '2026-05-09',
        activityType: 'bike',
        durationMin: 430,
        tss: 310,
        rpe: 7,
        plannedWorkoutId: null,
      }],
      missedWorkouts: [],
      mental: null,
      readinessScore: 68,
      tsb: -18,
      fuelingHistory: [{
        date: '2026-05-09',
        giComfort: 'mild_issue',
        durationMin: 430,
        carbsG: 360,
      }],
      fuelingDebt: {
        status: 'open_gi_issue',
        hasOpenDebt: true,
        label: 'GI-Schutz offen',
        summary: 'GI-/Magenhinweis ist offen.',
        closureCondition: 'Schließen: 75-120 min locker mit frühem Fueling und danach Magen ok loggen.',
        evidence: ['GI-Hinweis: 2026-05-09'],
        openIssueDate: '2026-05-09',
        controlledWorkoutId: null,
        followUpActivityId: null,
        updatedAt: '2026-05-10T12:00:00.000Z',
      },
      syncDebtCount: 0,
    });

    expect(events.map(event => event.recommendation)).toEqual(expect.arrayContaining([
      'protect_recovery',
      'reduce_volume',
    ]));
    expect(events.map(event => event.kind)).toEqual(expect.arrayContaining([
      'activity_completed',
      'fueling_limiter',
    ]));
    expect(events.find(event => event.kind === 'fueling_limiter')?.evidence).toContain(
      'Schließen: 75-120 min locker mit frühem Fueling und danach Magen ok loggen.',
    );
  });

  it('does not keep a fueling limiter after a tolerated follow-up closes the debt', () => {
    const events = classifyAdaptationEvents({
      today: '2026-05-13',
      completedActivities: [],
      missedWorkouts: [],
      mental: { energy: 7, stress: 3, mood: 7, motivation: 7 },
      readinessScore: 82,
      tsb: 4,
      fuelingHistory: [{
        date: '2026-05-09',
        giComfort: 'mild_issue',
        durationMin: 430,
        carbsG: 300,
      }],
      fuelingDebt: {
        status: 'tolerated_follow_up',
        hasOpenDebt: false,
        label: 'Toleranz bestätigt',
        summary: 'GI-Hinweis ist geschlossen.',
        closureCondition: 'Blocker geschlossen.',
        evidence: ['Follow-up ok'],
        openIssueDate: '2026-05-09',
        controlledWorkoutId: null,
        followUpActivityId: 'activity-follow-up',
        updatedAt: '2026-05-13T12:00:00.000Z',
      },
      syncDebtCount: 0,
    });

    expect(events.some(event => event.kind === 'fueling_limiter')).toBe(false);
  });

  it('keeps the plan when signals are green and no sync debt exists', () => {
    const events = classifyAdaptationEvents({
      today: '2026-05-10',
      completedActivities: [],
      missedWorkouts: [],
      mental: { energy: 7, stress: 3, mood: 7, motivation: 7 },
      readinessScore: 82,
      tsb: 4,
      fuelingHistory: [],
      syncDebtCount: 0,
    });

    expect(events).toEqual([
      expect.objectContaining({ recommendation: 'keep_plan', severity: 'info' }),
    ]);
  });

  it('turns missed workouts and Garmin sync debt into explicit actions', () => {
    const events = classifyAdaptationEvents({
      today: '2026-05-10',
      completedActivities: [],
      missedWorkouts: [{ id: 'w1', plannedDate: '2026-05-09', activityType: 'run', durationMin: 45, zone: 2 }],
      mental: { energy: 6, stress: 4, mood: 6, motivation: 6 },
      readinessScore: 78,
      tsb: 2,
      fuelingHistory: [],
      syncDebtCount: 2,
    });

    expect(events).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'planned_workout_missed', recommendation: 'move_workout' }),
      expect.objectContaining({ kind: 'sync_debt', recommendation: 'sync_garmin', severity: 'action' }),
    ]));
  });
});
