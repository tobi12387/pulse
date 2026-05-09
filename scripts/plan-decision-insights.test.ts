import assert from 'node:assert/strict';
import test from 'node:test';

import { buildPlanDecisionEvidence } from '../frontend/src/features/plan/strategy/plan-decision-insights.ts';

test('groups plan decision reasons into daily decision evidence categories', () => {
  const evidence = buildPlanDecisionEvidence({
    selectedDays: [1, 4],
    skippedAvailableDays: [3],
    targetSessionCount: 2,
    primaryGoal: 'Radgrundlage',
    reasons: [
      'Fueling-Toleranz: Magenprobleme nach langen Einheiten -> lange Ausdauerreize deckeln.',
      'TSB -14.2 und RPE 7 -> Erholung schützen.',
      'Variation zur Vorwoche: Bike bleibt, Intensität rotiert.',
      'Mi verfügbar, bleibt frei als Reserve.',
    ],
  });

  assert.deepEqual(evidence.groups.map(group => group.id), ['fueling', 'recovery', 'variation', 'availability']);
  assert.equal(evidence.groups[0]?.label, 'Fueling');
  assert.equal(evidence.groups[1]?.label, 'Erholung');
  assert.equal(evidence.groups[2]?.label, 'Variation');
  assert.equal(evidence.groups[3]?.label, 'Freie Tage');
  assert.equal(evidence.summary, '2 Einheiten · Ziel: Radgrundlage · 1 freier verfügbarer Tag');
});

test('keeps uncategorized plan reasons visible instead of dropping them', () => {
  const evidence = buildPlanDecisionEvidence({
    selectedDays: [2],
    skippedAvailableDays: [],
    targetSessionCount: 1,
    primaryGoal: null,
    reasons: [
      'Wochenziel bewusst konservativ gesetzt.',
      'Zieltermin rückt näher, aber keine harte Einheit nötig.',
    ],
  });

  assert.deepEqual(evidence.groups.map(group => group.id), ['goal', 'other']);
  assert.equal(evidence.groups[0]?.reasons[0], 'Zieltermin rückt näher, aber keine harte Einheit nötig.');
  assert.equal(evidence.groups[1]?.reasons[0], 'Wochenziel bewusst konservativ gesetzt.');
});
