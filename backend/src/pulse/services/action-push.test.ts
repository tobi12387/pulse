import { describe, expect, it } from 'vitest';
import type { PulseNextBestAction } from '@coaching-os/shared/pulse';
import { buildActionPushUrl, selectPushJourneyAction } from './action-push.js';

const checkinAction: PulseNextBestAction = {
  id: 'checkin:/coach:0',
  source: 'checkin',
  priority: 'high',
  title: 'Check-in eintragen',
  reason: 'Heute fehlt dein subjektives Signal.',
  cta: 'Zum Coach',
  targetPath: '/coach',
  openedAt: '2026-05-02',
  resolvedBy: 'Check-in speichern.',
};

describe('action push journeys', () => {
  it('builds target urls with explicit action and decision ids', () => {
    expect(buildActionPushUrl(checkinAction, '11111111-1111-4111-8111-111111111111'))
      .toBe('/coach?actionId=checkin%3A%2Fcoach%3A0&decisionId=11111111-1111-4111-8111-111111111111');
  });

  it('selects critical and high actions before normal nudges', () => {
    const selected = selectPushJourneyAction([
      {
        id: 'plan:/plan:1',
        source: 'plan',
        priority: 'normal',
        title: 'Plan erzeugen',
        reason: 'Kein Plan vorhanden.',
        cta: 'Zum Plan',
        targetPath: '/plan',
      },
      checkinAction,
    ]);

    expect(selected).toBe(checkinAction);
  });

  it('does not create a push journey for normal-only nudges', () => {
    expect(selectPushJourneyAction([{
      id: 'plan:/plan:1',
      source: 'plan',
      priority: 'normal',
      title: 'Plan erzeugen',
      reason: 'Kein Plan vorhanden.',
      cta: 'Zum Plan',
      targetPath: '/plan',
    }])).toBeNull();
  });
});
