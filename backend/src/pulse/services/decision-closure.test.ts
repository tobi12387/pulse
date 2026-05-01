import { describe, expect, it } from 'vitest';
import type { PulseNextBestAction } from '@coaching-os/shared/pulse';
import {
  deriveDecisionStatus,
  shouldSuppressAction,
  type ActionDecisionRecord,
} from './decision-closure.js';

function openDecision(overrides: Partial<ActionDecisionRecord> = {}): ActionDecisionRecord {
  return {
    id: 'decision-1',
    userId: 'user-1',
    source: 'next_best_action',
    sourceId: 'checkin:/coach:0',
    kind: 'checkin',
    title: 'Check-in eintragen',
    status: 'open',
    createdAt: '2026-05-01T07:00:00.000Z',
    resolvedAt: null,
    resolutionReason: null,
    targetRoute: '/coach',
    rawContext: {},
    ...overrides,
  };
}

function action(overrides: Partial<PulseNextBestAction> = {}): PulseNextBestAction {
  return {
    id: 'checkin:/coach:0',
    source: 'checkin',
    priority: 'high',
    title: 'Check-in eintragen',
    reason: 'Heute fehlt dein subjektives Signal.',
    cta: 'Zum Coach',
    targetPath: '/coach',
    openedAt: '2026-05-01',
    resolvedBy: 'Check-in speichern.',
    evidence: [],
    ...overrides,
  };
}

describe('deriveDecisionStatus', () => {
  it('moves an open decision to completed when the user completes it', () => {
    expect(deriveDecisionStatus(openDecision(), {
      transition: {
        status: 'completed',
        at: '2026-05-01T08:00:00.000Z',
        reason: 'Manuell erledigt.',
      },
    })).toEqual({
      status: 'completed',
      resolvedAt: '2026-05-01T08:00:00.000Z',
      resolutionReason: 'Manuell erledigt.',
    });
  });

  it('moves an open decision to deferred when the user defers it', () => {
    expect(deriveDecisionStatus(openDecision(), {
      transition: {
        status: 'deferred',
        at: '2026-05-01T08:15:00.000Z',
        reason: 'Heute Abend erneut ansehen.',
      },
    })).toMatchObject({
      status: 'deferred',
      resolvedAt: '2026-05-01T08:15:00.000Z',
      resolutionReason: 'Heute Abend erneut ansehen.',
    });
  });

  it('moves an open decision to superseded when newer data replaces it', () => {
    expect(deriveDecisionStatus(openDecision(), {
      transition: {
        status: 'superseded',
        at: '2026-05-01T09:00:00.000Z',
        reason: 'Neue Garmin-Daten haben die Empfehlung ersetzt.',
      },
    })).toMatchObject({
      status: 'superseded',
      resolvedAt: '2026-05-01T09:00:00.000Z',
      resolutionReason: 'Neue Garmin-Daten haben die Empfehlung ersetzt.',
    });
  });

  it('closes an open workout decision when Garmin matches the planned workout', () => {
    expect(deriveDecisionStatus(openDecision({
      source: 'planned_workout',
      sourceId: 'workout-1',
      kind: 'workout',
      title: 'Z2-Rad fahren',
      targetRoute: '/plan',
      rawContext: { plannedWorkoutId: 'workout-1' },
    }), {
      signals: {
        matchedWorkoutActivity: {
          plannedWorkoutId: 'workout-1',
          activityId: 'activity-42',
          matchedAt: '2026-05-01T18:00:00.000Z',
        },
      },
    })).toEqual({
      status: 'completed',
      resolvedAt: '2026-05-01T18:00:00.000Z',
      resolutionReason: 'Garmin-Aktivität activity-42 wurde dem geplanten Workout zugeordnet.',
    });
  });
});

describe('shouldSuppressAction', () => {
  it('suppresses stale check-in actions once a check-in exists for that date', () => {
    expect(shouldSuppressAction(action(), [], {
      today: '2026-05-01',
      checkinDates: ['2026-05-01'],
    })).toBe(true);
  });

  it('suppresses actions whose matching decision is no longer open', () => {
    expect(shouldSuppressAction(action(), [
      openDecision({
        status: 'completed',
        resolvedAt: '2026-05-01T08:00:00.000Z',
        resolutionReason: 'Schon erledigt.',
      }),
    ], {
      today: '2026-05-01',
      checkinDates: [],
    })).toBe(true);
  });

  it('keeps actions visible while the matching decision is open', () => {
    expect(shouldSuppressAction(action(), [openDecision()], {
      today: '2026-05-01',
      checkinDates: [],
    })).toBe(false);
  });
});
