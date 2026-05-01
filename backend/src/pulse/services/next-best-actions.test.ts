import { describe, expect, it } from 'vitest';
import { rankNextBestActions, type NextBestActionsInput } from './next-best-actions.js';

function baseInput(overrides: Partial<NextBestActionsInput> = {}): NextBestActionsInput {
  return {
    today: '2026-05-01',
    todayCheckin: { id: 'checkin-1' },
    activeRiskSignals: [],
    recentActivities: [],
    upcomingWorkouts: [{
      plannedDate: '2026-05-02',
      activityType: 'bike',
      zone: 2,
      durationMin: 60,
    }],
    push: { configured: false, activeSubscriptions: 0 },
    equipmentDueForReplacement: [],
    ...overrides,
  };
}

describe('rankNextBestActions', () => {
  it('prioritizes critical risk, missing check-in, and missing RPE', () => {
    const actions = rankNextBestActions(baseInput({
      todayCheckin: null,
      activeRiskSignals: [{
        severity: 'critical',
        title: 'Ruhepuls stark erhöht',
        recommendation: 'Heute trainingsfrei bleiben.',
        ruleId: 'rhr_drift_7d',
      }],
      recentActivities: [{
        id: 'activity-1',
        startTime: new Date('2026-04-30T18:00:00.000Z'),
        activityType: 'bike',
        durationSec: 3600,
        rpe: null,
        plannedZone: 2,
      }],
      upcomingWorkouts: [],
      push: { configured: true, activeSubscriptions: 0 },
    }));

    expect(actions).toHaveLength(3);
    expect(actions.map(action => action.source)).toEqual(['risk', 'checkin', 'rpe']);
    expect(actions[0]).toMatchObject({
      priority: 'critical',
      title: 'Kritisches Risk-Signal prüfen',
      targetPath: '/',
      resolvedBy: 'Risk-Signal snoozen oder auflösen.',
      evidence: ['rhr_drift_7d', 'critical'],
    });
    expect(actions[1]?.resolvedBy).toContain('Check-in');
    expect(actions[2]).toMatchObject({ source: 'rpe', evidence: expect.arrayContaining(['Plan-Zone 2']) });
  });

  it('adds push activation only when the server is configured and no device is active', () => {
    expect(rankNextBestActions(baseInput({
      push: { configured: true, activeSubscriptions: 0 },
    }))).toContainEqual(expect.objectContaining({
      source: 'push',
      targetPath: '/settings',
    }));

    expect(rankNextBestActions(baseInput({
      push: { configured: true, activeSubscriptions: 1 },
    }))).not.toContainEqual(expect.objectContaining({ source: 'push' }));

    expect(rankNextBestActions(baseInput({
      push: { configured: false, activeSubscriptions: 0 },
    }))).not.toContainEqual(expect.objectContaining({ source: 'push' }));
  });

  it('does not nag for stale unrated activities beyond the recent window', () => {
    const actions = rankNextBestActions(baseInput({
      recentActivities: [{
        id: 'activity-old',
        startTime: new Date('2026-04-25T18:00:00.000Z'),
        activityType: 'run',
        durationSec: 2700,
        rpe: null,
        plannedZone: null,
      }],
    }));

    expect(actions).not.toContainEqual(expect.objectContaining({ source: 'rpe' }));
  });

  it('filters actions that have already been closed in decision history', () => {
    const actions = rankNextBestActions(baseInput({
      todayCheckin: null,
      actionDecisions: [{
        id: 'decision-1',
        userId: 'user-1',
        source: 'next_best_action',
        sourceId: 'checkin:/coach:0',
        kind: 'checkin',
        title: 'Check-in eintragen',
        status: 'completed',
        createdAt: '2026-05-01T07:00:00.000Z',
        resolvedAt: '2026-05-01T08:00:00.000Z',
        resolutionReason: 'Check-in gespeichert.',
        targetRoute: '/coach',
        rawContext: {},
      }],
    }));

    expect(actions).not.toContainEqual(expect.objectContaining({ source: 'checkin' }));
  });
});
