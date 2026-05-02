import { describe, expect, it } from 'vitest';
import { rankNextBestActions, rankNextBestActionVisibility, type NextBestActionsInput } from './next-best-actions.js';

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
        rawContext: { openedAt: '2026-05-01' },
      }],
    }));

    expect(actions).not.toContainEqual(expect.objectContaining({ source: 'checkin' }));
  });

  it('explains why completed check-in actions are hidden', () => {
    const visibility = rankNextBestActionVisibility(baseInput({
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
        rawContext: { openedAt: '2026-05-01' },
      }],
    }));

    expect(visibility.visible).not.toContainEqual(expect.objectContaining({ source: 'checkin' }));
    expect(visibility.suppressed).toContainEqual(expect.objectContaining({
      source: 'checkin',
      suppressedReason: 'already_completed_today',
      decisionId: 'decision-1',
      status: 'completed',
    }));
  });

  it('explains deferred actions without hiding unrelated visible actions', () => {
    const visibility = rankNextBestActionVisibility(baseInput({
      upcomingWorkouts: [],
      push: { configured: true, activeSubscriptions: 0 },
      actionDecisions: [{
        id: 'decision-plan',
        userId: 'user-1',
        source: 'next_best_action',
        sourceId: 'plan:/plan:0',
        kind: 'plan',
        title: 'Plan erzeugen',
        status: 'deferred',
        createdAt: '2026-05-01T07:00:00.000Z',
        resolvedAt: '2026-05-01T08:00:00.000Z',
        resolutionReason: 'Heute Abend erneut ansehen.',
        targetRoute: '/plan',
        rawContext: {},
      }],
    }));

    expect(visibility.suppressed).toContainEqual(expect.objectContaining({
      source: 'plan',
      suppressedReason: 'deferred',
      suppressedUntil: '2026-05-01T08:00:00.000Z',
    }));
    expect(visibility.visible).toContainEqual(expect.objectContaining({ source: 'push' }));
  });

  it('does not hide today’s check-in because yesterday was completed', () => {
    const visibility = rankNextBestActionVisibility(baseInput({
      today: '2026-05-02',
      todayCheckin: null,
      actionDecisions: [{
        id: 'decision-yesterday',
        userId: 'user-1',
        source: 'next_best_action',
        sourceId: 'checkin:/coach:0',
        kind: 'checkin',
        title: 'Check-in eintragen',
        status: 'completed',
        createdAt: '2026-05-01T07:00:00.000Z',
        resolvedAt: '2026-05-01T08:00:00.000Z',
        resolutionReason: 'Check-in für 2026-05-01 wurde gespeichert.',
        targetRoute: '/coach',
        rawContext: { openedAt: '2026-05-01' },
      }],
    }));

    expect(visibility.visible).toContainEqual(expect.objectContaining({ source: 'checkin' }));
    expect(visibility.suppressed).not.toContainEqual(expect.objectContaining({
      decisionId: 'decision-yesterday',
      source: 'checkin',
    }));
  });

  it('adds a closable mental support action from guided check-in guidance', () => {
    const visibility = rankNextBestActionVisibility(baseInput({
      guidedCheckin: {
        date: '2026-05-01',
        questions: [{
          id: 'stress-boundary',
          label: 'Was darf heute bewusst kleiner bleiben?',
          rationale: 'Stresssignal ist erhöht; ein kleinerer Anspruch schützt Stabilität.',
          answerMode: 'short_text',
        }],
        action: {
          id: 'mental-boundary',
          label: 'Eine Grenze für heute setzen',
          rationale: 'Stress ist hoch und Motivation niedrig; ein kleiner Schutzrahmen ist heute hilfreicher als mehr Druck.',
          targetRoute: '/coach',
          closureKind: 'boundary',
        },
      },
    }));

    expect(visibility.visible).toContainEqual(expect.objectContaining({
      source: 'mental',
      priority: 'normal',
      title: 'Eine Grenze für heute setzen',
      targetPath: '/coach',
      resolvedBy: 'Mentale Support-Aktion abschließen, verschieben oder bewusst verwerfen.',
      evidence: expect.arrayContaining(['boundary', 'stress-boundary']),
    }));
  });

  it('does not hide today’s mental action because yesterday was completed', () => {
    const visibility = rankNextBestActionVisibility(baseInput({
      today: '2026-05-02',
      guidedCheckin: {
        date: '2026-05-02',
        questions: [{
          id: 'stress-boundary',
          label: 'Was darf heute bewusst kleiner bleiben?',
          rationale: 'Stresssignal ist erhöht; ein kleinerer Anspruch schützt Stabilität.',
          answerMode: 'short_text',
        }],
        action: {
          id: 'mental-boundary',
          label: 'Eine Grenze für heute setzen',
          rationale: 'Stress ist hoch und Motivation niedrig; ein kleiner Schutzrahmen ist heute hilfreicher als mehr Druck.',
          targetRoute: '/coach',
          closureKind: 'boundary',
        },
      },
      actionDecisions: [{
        id: 'decision-yesterday-mental',
        userId: 'user-1',
        source: 'next_best_action',
        sourceId: 'mental:/coach:0',
        kind: 'mental',
        title: 'Eine Grenze für heute setzen',
        status: 'completed',
        createdAt: '2026-05-01T07:00:00.000Z',
        resolvedAt: '2026-05-01T08:00:00.000Z',
        resolutionReason: 'Mentale Grenze gesetzt.',
        targetRoute: '/coach',
        rawContext: { openedAt: '2026-05-01' },
      }],
    }));

    expect(visibility.visible).toContainEqual(expect.objectContaining({ source: 'mental' }));
    expect(visibility.suppressed).not.toContainEqual(expect.objectContaining({
      decisionId: 'decision-yesterday-mental',
      source: 'mental',
    }));
  });
});
