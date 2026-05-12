import assert from 'node:assert/strict';
import test from 'node:test';

import type { PulseAdaptationEvent, PulsePlanRefreshPreview, PulsePlannedWorkout } from '../shared/types/pulse/index.ts';
import { buildPlanChangeInbox } from '../frontend/src/features/plan/change-inbox-model.ts';

function workout(overrides: Partial<PulsePlannedWorkout>): PulsePlannedWorkout {
  return {
    id: overrides.id ?? 'w1',
    userId: 'u1',
    plannedDate: overrides.plannedDate ?? '2026-05-13',
    activityType: overrides.activityType ?? 'bike',
    zone: overrides.zone ?? 2,
    durationMin: overrides.durationMin ?? 90,
    distanceKm: null,
    targetTss: overrides.targetTss ?? 60,
    archetypeId: null,
    difficultyLevel: null,
    difficultyEnergySystem: null,
    capabilityFit: null,
    description: null,
    steps: null,
    garminWorkoutId: null,
    garminScheduledId: null,
    garminSyncContract: null,
    status: overrides.status ?? 'planned',
    workoutFeedback: null,
    complianceScore: null,
    origin: 'generated',
    userLocked: false,
    completedActivityId: null,
    executionStatus: overrides.executionStatus ?? null,
    executionMatchedAt: null,
    executionMatchConfidence: null,
    executionNotes: null,
    ...overrides,
  };
}

function event(overrides: Partial<PulseAdaptationEvent>): PulseAdaptationEvent {
  return {
    id: overrides.id ?? 'event-1',
    userId: 'u1',
    eventDate: overrides.eventDate ?? '2026-05-12',
    kind: overrides.kind ?? 'planned_workout_missed',
    sourceId: null,
    severity: overrides.severity ?? 'action',
    recommendation: overrides.recommendation ?? 'regenerate_week',
    summary: overrides.summary ?? 'Gestern wurde eine harte Einheit verpasst.',
    evidence: overrides.evidence ?? ['Garmin meldet keine passende Ausführung'],
    resolvedAt: null,
    createdAt: overrides.createdAt ?? '2026-05-12T06:00:00.000Z',
    ...overrides,
  };
}

function refreshPreview(overrides: Partial<PulsePlanRefreshPreview>): PulsePlanRefreshPreview {
  return {
    weekStart: '2026-05-11',
    generatedAt: '2026-05-12T06:00:00.000Z',
    stale: true,
    summary: 'Neue Garmin-Ausführung und Recovery-Daten würden zwei Tage verändern.',
    triggers: [{
      kind: 'missed_or_replaced',
      label: 'Ausführung anders',
      detail: 'Eine geplante Einheit wurde ersetzt.',
      severity: 'action',
      evidence: ['Garmin-Aktivität weicht vom Plan ab'],
    }],
    comparisons: [{
      date: '2026-05-13',
      current: {
        id: 'w1',
        plannedDate: '2026-05-13',
        activityType: 'bike',
        zone: 4,
        durationMin: 75,
        targetTss: 90,
        archetypeId: null,
        why: 'Schwelle geplant',
        userLocked: false,
      },
      proposed: {
        id: 'w1',
        plannedDate: '2026-05-13',
        activityType: 'bike',
        zone: 2,
        durationMin: 60,
        targetTss: 45,
        archetypeId: null,
        why: 'Recovery schützen',
        userLocked: false,
      },
      changes: ['zone', 'duration'],
      reason: 'Recovery-Schutz nach Ausführungsabweichung.',
    }],
    loadImpact: { tssDelta: -45, durationDeltaMin: -15 },
    garminImpact: { creates: 0, updates: 1, deletes: 0, unchanged: 2, summary: 'Garmin würde eine Einheit aktualisieren.' },
    applySupported: true,
    mutationBoundary: 'Die Vorschau schreibt nichts in Plan oder Garmin.',
    ...overrides,
  };
}

test('builds a prioritized plan change inbox from refresh, adaptation and Garmin debt signals', () => {
  const inbox = buildPlanChangeInbox({
    today: '2026-05-12',
    workouts: [
      workout({ id: 'local', executionStatus: 'local_planned' }),
      workout({ id: 'template', executionStatus: 'garmin_template' }),
      workout({ id: 'ready', executionStatus: 'garmin_scheduled' }),
    ],
    adaptationEvents: [
      event({ id: 'sync', recommendation: 'sync_garmin', severity: 'watch', summary: 'Eine Einheit fehlt auf Garmin.' }),
      event({ id: 'regen', recommendation: 'regenerate_week', severity: 'action' }),
    ],
    refreshPreview: refreshPreview({}),
  });

  assert.equal(inbox.items.length, 4);
  assert.equal(inbox.summary, '4 offene Planpunkte: Wochenplan prüfen, Planabweichung bewerten, Garmin absichern.');
  assert.deepEqual(inbox.items.map(item => item.id), [
    'refresh-preview',
    'adaptation-regen',
    'garmin-sync-debt',
    'adaptation-sync',
  ]);
  assert.equal(inbox.items[0]?.action, 'open_refresh_preview');
  assert.equal(inbox.items[1]?.action, 'review_scenario');
  assert.equal(inbox.items[2]?.action, 'open_execution');
  assert.equal(inbox.items[2]?.resultPreview, 'Du öffnest den Ausführungs-Check; Reparatur-Buttons schreiben erst nach deinem Klick zu Garmin.');
});

test('returns an all-clear inbox when the plan has no actionable change signals', () => {
  const inbox = buildPlanChangeInbox({
    today: '2026-05-12',
    workouts: [
      workout({ id: 'done', plannedDate: '2026-05-11', executionStatus: 'completed_matched', status: 'completed' }),
      workout({ id: 'ready', plannedDate: '2026-05-13', executionStatus: 'garmin_scheduled' }),
    ],
    adaptationEvents: [event({ id: 'info', severity: 'info', recommendation: 'keep_plan' })],
    refreshPreview: refreshPreview({ stale: false, triggers: [], comparisons: [] }),
  });

  assert.equal(inbox.items.length, 0);
  assert.equal(inbox.summary, 'Keine offenen Planänderungen. Woche, Garmin-Handoff und Adaptionssignale wirken aktuell geschlossen.');
  assert.equal(inbox.hasAction, false);
});

test('does not count intentionally skipped future workouts as Garmin sync debt', () => {
  const inbox = buildPlanChangeInbox({
    today: '2026-05-12',
    workouts: [
      workout({ id: 'skipped-local', plannedDate: '2026-05-13', status: 'skipped', executionStatus: 'local_planned' }),
      workout({ id: 'ready', plannedDate: '2026-05-14', status: 'planned', executionStatus: 'garmin_scheduled' }),
    ],
    adaptationEvents: [],
    refreshPreview: null,
  });

  assert.equal(inbox.items.find(item => item.id === 'garmin-sync-debt'), undefined);
  assert.equal(inbox.items.length, 0);
});
