import assert from 'node:assert/strict';
import test from 'node:test';

import { dailyDecisionSignalRegistry } from '../frontend/src/pulse/daily-decision.ts';

test('daily decision signal registry owns signal priority order in one table', () => {
  const priorities = Object.fromEntries(
    Object.entries(dailyDecisionSignalRegistry).map(([label, entry]) => [label, entry.priority]),
  );

  assert.deepEqual(priorities, {
    Mental: 0,
    Lernen: 0,
    Recovery: 0,
    Anpassung: 0,
    Daten: 1,
    Analyse: 1,
    Fueling: 2,
    'Fueling-Lernen': 2,
    Folge: 3,
    Feedback: 3,
    Ziel: 4,
    Training: 5,
    Alltag: 6,
    Garmin: 6,
    Reaktion: 7,
    Koerper: 7,
    Belastung: 8,
  });
});

test('daily decision signal registry owns default CTA copy', () => {
  assert.equal(dailyDecisionSignalRegistry.Daten.defaultActionLabel, 'Daten prüfen');
  assert.equal(dailyDecisionSignalRegistry.Recovery.defaultActionLabel, 'Recovery ansehen');
  assert.equal(dailyDecisionSignalRegistry.Feedback.defaultActionLabel, 'Feedback erfassen');
  assert.equal(dailyDecisionSignalRegistry.Folge.defaultActionLabel, 'Planfolge prüfen');
  assert.equal(dailyDecisionSignalRegistry.Garmin.defaultActionLabel, 'Garmin prüfen');
  assert.equal(dailyDecisionSignalRegistry.Koerper.defaultActionLabel, 'Readiness prüfen');
  assert.equal(dailyDecisionSignalRegistry.Belastung.defaultActionLabel, 'Belastung prüfen');
});

test('daily decision signal registry keeps conditional actions explicit', () => {
  assert.deepEqual(dailyDecisionSignalRegistry.Training.actionLabelByTone, {
    rose: 'Training anpassen',
    amber: 'Training prüfen',
  });
  assert.equal(dailyDecisionSignalRegistry.Ziel.requiredTone, 'rose');
  assert.equal(dailyDecisionSignalRegistry.Ziel.preferSignalActionLabel, true);
  assert.equal(dailyDecisionSignalRegistry.Analyse.preferSignalActionLabel, true);
  assert.equal(dailyDecisionSignalRegistry.Folge.preferSignalActionLabel, true);
  assert.equal(dailyDecisionSignalRegistry.Anpassung.actionFromDetailPrefix, true);
});
