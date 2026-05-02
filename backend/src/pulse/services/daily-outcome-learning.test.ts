import { describe, expect, it } from 'vitest';
import { buildDailyOutcomeLearning } from './daily-outcome-learning.js';

type OutcomeInput = Parameters<typeof buildDailyOutcomeLearning>[0];

function action(overrides: Partial<OutcomeInput['actionDecisions'][number]> = {}): OutcomeInput['actionDecisions'][number] {
  return {
    id: 'action-1',
    source: 'next_best_action',
    sourceId: 'checkin',
    kind: 'checkin',
    title: 'Daily Check-in machen',
    status: 'completed',
    targetRoute: '/data',
    createdAt: '2026-05-01T07:00:00.000Z',
    resolvedAt: '2026-05-01T08:00:00.000Z',
    resolutionReason: null,
    ...overrides,
  };
}

function baseInput(overrides: Partial<OutcomeInput> = {}): OutcomeInput {
  return {
    today: '2026-05-02',
    days: 7,
    actionDecisions: [],
    checkins: [],
    plannedWorkouts: [],
    activities: [],
    dailyMetrics: [],
    ...overrides,
  };
}

describe('buildDailyOutcomeLearning', () => {
  it('reinforces a completed check-in action when the same-day check-in exists', () => {
    const outcomes = buildDailyOutcomeLearning(baseInput({
      actionDecisions: [action()],
      checkins: [{ date: '2026-05-01', mood: 7, energy: 6, stress: 4, motivation: 8 }],
    }));

    expect(outcomes).toHaveLength(1);
    expect(outcomes[0]).toMatchObject({
      date: '2026-05-01',
      status: 'reinforced',
      suggestedAdjustment: expect.stringContaining('Check-in'),
    });
    expect(outcomes[0]?.evidence).toContain('Check-in am selben Tag vorhanden');
  });

  it('marks a dismissed workout action as superseded when Garmin shows completed activity data', () => {
    const outcomes = buildDailyOutcomeLearning(baseInput({
      actionDecisions: [action({
        id: 'action-workout',
        sourceId: 'plan-2026-05-01',
        kind: 'workout',
        title: 'Bike Einheit heute ausführen',
        status: 'dismissed',
        targetRoute: '/plan',
      })],
      activities: [{
        id: 'activity-1',
        source: 'garmin',
        startTime: '2026-05-01T16:30:00.000Z',
        activityType: 'bike',
        durationSec: 4_200,
      }],
    }));

    expect(outcomes).toHaveLength(1);
    expect(outcomes[0]).toMatchObject({
      date: '2026-05-01',
      status: 'superseded_by_data',
      title: expect.stringContaining('Garmin'),
    });
    expect(outcomes[0]?.evidence.join(' ')).toContain('Garmin-Aktivität');
  });

  it('detects a stale pattern after the same action was deferred on three days', () => {
    const outcomes = buildDailyOutcomeLearning(baseInput({
      actionDecisions: [
        action({ id: 'a1', status: 'deferred', title: 'Mobilität 10 Minuten', kind: 'mental', sourceId: 'mobility', createdAt: '2026-04-29T07:00:00.000Z', resolvedAt: '2026-04-29T07:05:00.000Z' }),
        action({ id: 'a2', status: 'deferred', title: 'Mobilität 10 Minuten', kind: 'mental', sourceId: 'mobility', createdAt: '2026-04-30T07:00:00.000Z', resolvedAt: '2026-04-30T07:05:00.000Z' }),
        action({ id: 'a3', status: 'deferred', title: 'Mobilität 10 Minuten', kind: 'mental', sourceId: 'mobility', createdAt: '2026-05-01T07:00:00.000Z', resolvedAt: '2026-05-01T07:05:00.000Z' }),
      ],
    }));

    expect(outcomes[0]).toMatchObject({
      date: '2026-05-01',
      status: 'stale_pattern',
      reason: expect.stringContaining('dreimal'),
    });
    expect(outcomes[0]?.evidence).toContain('3x verschoben');
  });

  it('keeps the outcome as insufficient evidence when no follow-up data exists', () => {
    const outcomes = buildDailyOutcomeLearning(baseInput({
      actionDecisions: [action({
        title: 'Heute locker bleiben',
        status: 'completed',
        kind: 'plan',
        targetRoute: '/plan',
      })],
    }));

    expect(outcomes).toHaveLength(1);
    expect(outcomes[0]).toMatchObject({
      date: '2026-05-01',
      status: 'insufficient_evidence',
    });
    expect(outcomes[0]?.suggestedAdjustment).toContain('nicht wiederholen');
  });
});
