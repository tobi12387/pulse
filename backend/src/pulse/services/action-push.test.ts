import { describe, expect, it } from 'vitest';
import type { PulseNextBestAction } from '@coaching-os/shared/pulse';
import {
  buildActionPushUrl,
  matchesActionDecision,
  selectPushJourneyAction,
  selectRecentResolvedActionDecisions,
  type ActionDecisionRow,
} from './action-push.js';

function action(overrides: Partial<PulseNextBestAction> = {}): PulseNextBestAction {
  return {
    id: 'checkin:/coach:0',
    source: 'checkin',
    priority: 'high',
    title: 'Check-in eintragen',
    reason: 'Heute fehlt dein subjektives Signal.',
    cta: 'Zum Coach',
    targetPath: '/coach',
    openedAt: '2026-05-02',
    resolvedBy: 'Check-in speichern.',
    evidence: [],
    ...overrides,
  };
}

function row(overrides: Partial<ActionDecisionRow> = {}): ActionDecisionRow {
  return {
    id: 'decision-1',
    userId: 'user-1',
    source: 'next_best_action',
    sourceId: 'checkin:/coach:0',
    kind: 'checkin',
    title: 'Check-in eintragen',
    status: 'completed',
    createdAt: new Date('2026-05-01T07:00:00.000Z'),
    resolvedAt: new Date('2026-05-01T08:00:00.000Z'),
    resolutionReason: 'Check-in für 2026-05-01 wurde gespeichert.',
    targetRoute: '/coach',
    rawContext: { openedAt: '2026-05-01' },
    ...overrides,
  };
}

const checkinAction = action();

describe('action push journeys', () => {
  it('builds target urls with explicit action and decision ids', () => {
    expect(buildActionPushUrl(checkinAction, '11111111-1111-4111-8111-111111111111'))
      .toBe('/coach?actionId=checkin%3A%2Fcoach%3A0&decisionId=11111111-1111-4111-8111-111111111111');
  });

  it('selects critical and high actions before normal nudges', () => {
    const selected = selectPushJourneyAction([
      action({
        id: 'plan:/plan:1',
        source: 'plan',
        priority: 'normal',
        title: 'Plan erzeugen',
        reason: 'Kein Plan vorhanden.',
        cta: 'Zum Plan',
        targetPath: '/plan',
      }),
      checkinAction,
    ]);

    expect(selected).toBe(checkinAction);
  });

  it('does not create a push journey for normal-only nudges', () => {
    expect(selectPushJourneyAction([action({
      id: 'plan:/plan:1',
      source: 'plan',
      priority: 'normal',
      title: 'Plan erzeugen',
      reason: 'Kein Plan vorhanden.',
      cta: 'Zum Plan',
      targetPath: '/plan',
    })])).toBeNull();
  });
});

describe('matchesActionDecision', () => {
  it('keeps daily check-in decisions scoped to their opened date', () => {
    expect(matchesActionDecision(action(), row())).toBe(false);
    expect(matchesActionDecision(action(), row({
      id: 'decision-today',
      createdAt: new Date('2026-05-02T07:00:00.000Z'),
      resolvedAt: null,
      rawContext: { openedAt: '2026-05-02' },
    }))).toBe(true);
  });
});

describe('selectRecentResolvedActionDecisions', () => {
  it('keeps only resolved decisions from the last 14 days', () => {
    const rows = [
      row({
        id: 'recent-resolved',
        createdAt: new Date('2026-04-30T07:00:00.000Z'),
        resolvedAt: new Date('2026-04-30T08:00:00.000Z'),
      }),
      row({
        id: 'too-old',
        createdAt: new Date('2026-04-10T07:00:00.000Z'),
        resolvedAt: new Date('2026-04-10T08:00:00.000Z'),
      }),
      row({
        id: 'still-open',
        status: 'open',
        createdAt: new Date('2026-05-02T07:00:00.000Z'),
        resolvedAt: null,
      }),
    ];

    expect(selectRecentResolvedActionDecisions(rows, '2026-05-02').map(candidate => candidate.id))
      .toEqual(['recent-resolved']);
  });
});
