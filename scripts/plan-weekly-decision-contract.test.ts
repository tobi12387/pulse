import assert from 'node:assert/strict';
import test from 'node:test';

import type {
  PulseAdaptationEvent,
  PulseDailyDecisionQualityResponse,
  PulseFitnessLoad,
  PulseFuelingOutcomeBaseline,
  PulseGoalProjectionResponse,
  PulsePersonalResponseResponse,
  PulsePlanRefreshPreview,
  PulsePlannedWorkout,
  PulseWeeklyReview,
} from '../shared/types/pulse/index.ts';
import { buildWeeklyCoachReview } from '../frontend/src/features/plan/weekly-coach-review-model.ts';
import { buildPlanWeeklyDecisionContract, buildPlanWeeklyDecisionReceipt } from '../frontend/src/features/plan/weekly-decision-contract.ts';

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
    sourceId: overrides.sourceId ?? null,
    severity: overrides.severity ?? 'action',
    recommendation: overrides.recommendation ?? 'regenerate_week',
    summary: overrides.summary ?? 'Eine harte Einheit wurde verpasst.',
    evidence: overrides.evidence ?? ['Garmin fand keine passende Ausführung.'],
    resolvedAt: overrides.resolvedAt ?? null,
    createdAt: overrides.createdAt ?? '2026-05-12T06:00:00.000Z',
    ...overrides,
  };
}

function refreshPreview(overrides: Partial<PulsePlanRefreshPreview>): PulsePlanRefreshPreview {
  return {
    weekStart: '2026-05-11',
    generatedAt: '2026-05-12T06:00:00.000Z',
    stale: true,
    summary: 'Neue Garmin- und Recovery-Daten würden den Wochenplan verändern.',
    triggers: [{
      kind: 'missed_or_replaced',
      label: 'Ausführung anders',
      detail: 'Eine echte Einheit weicht vom Plan ab.',
      severity: 'action',
      evidence: ['Garmin'],
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

const personalResponse: PulsePersonalResponseResponse = {
  summary: {
    generatedAt: '2026-05-12T06:00:00.000Z',
    range: { from: '2026-04-01', to: '2026-05-12', days: 42 },
    strength: 'learning',
    headline: 'Pulse lernt dein Belastungsmuster.',
    signals: [{
      kind: 'mental_response',
      label: 'Mentale Last einbeziehen',
      strength: 'learning',
      summary: 'Stressreiche Tage brauchen klarere Boundaries.',
      evidence: ['2 Check-ins mit Stress >=7'],
      nextAdjustment: 'Vor harten Einheiten zuerst Boundary und Warm-up prüfen.',
    }],
    missingEvidence: [],
  },
};

const goalProjection: PulseGoalProjectionResponse = {
  generatedAt: '2026-05-12T06:00:00.000Z',
  horizonDays: 180,
  headline: 'Top-Ziel braucht Aufmerksamkeit.',
  projections: [{
    goalId: 'goal-1',
    title: '70.3 Kraichgau',
    category: 'race',
    targetDate: '2026-07-11',
    daysUntil: 60,
    probabilityPct: 64,
    status: 'watch',
    confidence: 'medium',
    summary: 'Ziel beobachtet bei 64%.',
    limiterRisk: { status: 'watch', label: 'Long Endurance', summary: 'Lange Ausdauer kontrolliert aufbauen.', evidence: ['Long-Endurance-Level 3.1'] },
    nextBestIntervention: {
      kind: 'fueling_practice',
      title: 'Fueling-Praxis absichern',
      summary: 'Lange Einheit mit sauberem Fueling-Log abschließen.',
      actionLabel: 'Fueling planen',
      targetPath: '/plan?tab=training',
      evidence: ['GI-Komfort noch Lernfeld'],
    },
    evidence: ['Ziel in 60 Tagen'],
    missingEvidence: [],
  }],
  missingEvidence: [],
};

const currentLoad: PulseFitnessLoad = {
  ctl: 55,
  atl: 83,
  tsb: -28,
  date: '2026-05-12',
};

const stableLoad: PulseFitnessLoad = {
  ctl: 55,
  atl: 58,
  tsb: -3,
  date: '2026-05-12',
};

function decisionQuality(overrides: Partial<PulseDailyDecisionQualityResponse> = {}): PulseDailyDecisionQualityResponse {
  return {
    range: { from: '2026-04-28', to: '2026-05-12', days: 14 },
    qualityScore: 42,
    status: 'stale',
    statusLabel: 'Wiederholung prüfen',
    repeatedThemes: [{
      theme: 'Fueling nach langen Einheiten',
      count: 2,
      lastSeen: '2026-05-12',
      status: 'watch',
      evidence: ['2x ohne kompletten During-Log'],
    }],
    bestEvidence: ['Fueling-Entscheidungen wiederholen sich, aber Outcome-Evidenz ist noch offen.'],
    evidence: [],
    suggestedAdjustment: 'Noch nicht hochregeln; erst komplette Fueling-Logs schließen.',
    ...overrides,
  };
}

function fuelingBaseline(overrides: Partial<PulseFuelingOutcomeBaseline> = {}): PulseFuelingOutcomeBaseline {
  return {
    status: 'learning',
    label: 'Fueling-Baseline lernt',
    summary: 'Fueling-Reaktionen werden gesammelt.',
    latestLogDate: '2026-05-10',
    observedCarbsPerHour: 58,
    targetCarbsPerHour: { min: 60, max: 75 },
    bottles750Ml: null,
    powderG: null,
    fluidMlPerHour: null,
    sodiumMgPerHour: null,
    trendSummary: 'Fueling-Trend: 3/3 komplette During-Logs, Schnitt 58 g/h; GI stabil.',
    evidence: ['Fueling-Trend: 3/3 komplette During-Logs, Schnitt 58 g/h; GI stabil.'],
    learningReadiness: {
      comparableCompleteLogs: 3,
      requiredComparableCompleteLogs: 3,
      readyForTrendSummary: true,
      missingEvidence: [],
    },
    ...overrides,
  };
}

const review: PulseWeeklyReview = {
  id: 'review-1',
  userId: 'u1',
  weekStart: '2026-05-11',
  weekEnd: '2026-05-17',
  narrative: 'Die Woche braucht einen ruhigeren langen Reiz.',
  metrics: {},
  recommendations: ['Lange Einheit defensiver planen.'],
  createdAt: '2026-05-12T06:00:00.000Z',
};

test('weekly decision uses strong learning calibration as explicit Plan evidence without hidden writes', () => {
  const contract = buildPlanWeeklyDecisionContract({
    today: '2026-05-12',
    workouts: [workout({ id: 'steady', executionStatus: 'garmin_scheduled' })],
    adaptationEvents: [],
    refreshPreview: null,
    currentLoad: stableLoad,
    goalProjection: { ...goalProjection, projections: [] },
    personalResponse: null,
    decisionQuality: decisionQuality({
      qualityScore: 31,
      status: 'needs_strategy_change',
      statusLabel: 'Strategie ändern',
      repeatedThemes: [{
        theme: 'Zu spät intensive Optionen gewählt',
        count: 3,
        lastSeen: '2026-05-12',
        status: 'stale',
        evidence: ['3x harte Alternative nach schlechtem Warm-up gewählt'],
      }],
      bestEvidence: ['3x harte Alternative nach schlechtem Warm-up gewählt'],
      suggestedAdjustment: 'Diese Woche zuerst kleinere Option festlegen und Intensität erst nach Warm-up freigeben.',
    }),
    fuelingOutcomeBaseline: fuelingBaseline(),
    review: null,
  });

  const learned = contract.sections.find(section => section.id === 'learned');
  const nextAction = contract.sections.find(section => section.id === 'next_action');

  assert.equal(contract.tone, 'attention');
  assert.equal(contract.title, 'Wochenentscheidung offen');
  assert.equal(contract.primaryOption, 'adapt_week');
  assert.match(learned?.title ?? '', /Lernkalibrierung/);
  assert.match(learned?.body ?? '', /Empfehlung darf lernen/);
  assert.match(learned?.body ?? '', /Diese Woche zuerst kleinere Option/);
  assert.match(learned?.body ?? '', /Plan und Garmin bleiben unverändert/);
  assert.match(nextAction?.body ?? '', /Lernkalibrierung explizit/);
  assert.match(nextAction?.body ?? '', /Beibehalten, Anpassen oder Spaeter/);
  assert.match(contract.evidence.join(' · '), /Lernkalibrierung/);
  assert.equal(contract.options.every(option => option.readOnly), true);
  assert.match(contract.options.find(option => option.kind === 'adapt_week')?.resultPreview ?? '', /erst ein explizites Anwenden/);
  assert.match(contract.options.find(option => option.kind === 'accept_current')?.resultPreview ?? '', /keine Plan- oder Garmin-Aenderung/);
});

test('weekly decision keeps weak learning calibration as watch context without opening a plan change', () => {
  const contract = buildPlanWeeklyDecisionContract({
    today: '2026-05-12',
    workouts: [workout({ id: 'steady-watch', executionStatus: 'garmin_scheduled' })],
    adaptationEvents: [],
    refreshPreview: null,
    currentLoad: stableLoad,
    goalProjection: { ...goalProjection, projections: [] },
    personalResponse: null,
    decisionQuality: decisionQuality(),
    fuelingOutcomeBaseline: fuelingBaseline({
      trendSummary: 'Fueling-Trend: 2/3 sollte noch nicht erscheinen.',
      evidence: ['2x ohne kompletten During-Log'],
      learningReadiness: {
        comparableCompleteLogs: 2,
        requiredComparableCompleteLogs: 3,
        readyForTrendSummary: false,
        missingEvidence: ['Noch ein kompletter During-Log mit GI-Komfort fehlt.'],
        nextAction: {
          kind: 'complete_gi_comfort',
          label: 'GI-Komfort ergänzen',
          detail: 'GI-Komfort am vorhandenen langen During-Log ergänzen.',
          activityId: 'activity-fueling-gap',
        },
      },
    }),
    review: null,
  });

  const learned = contract.sections.find(section => section.id === 'learned');
  const nextAction = contract.sections.find(section => section.id === 'next_action');

  assert.equal(contract.tone, 'ok');
  assert.equal(contract.title, 'Woche aktuell stabil');
  assert.equal(contract.primaryOption, 'accept_current');
  assert.match(learned?.title ?? '', /Watch-Kontext/);
  assert.match(learned?.body ?? '', /Noch Watch-Kontext/);
  assert.match(learned?.body ?? '', /Trend-Evidenz 2\/3/);
  assert.doesNotMatch(learned?.body ?? '', /Fueling-Trend:/);
  assert.match(nextAction?.body ?? '', /Aktuelle Woche beibehalten/);
  assert.match(contract.options.find(option => option.kind === 'defer_decision')?.weekImpact ?? '', /Pulse beobachtet weiter/);
  assert.equal(contract.options.every(option => option.readOnly), true);
});

test('builds one weekly decision contract from learning, plan change, goal, recovery and Garmin debt evidence', () => {
  const contract = buildPlanWeeklyDecisionContract({
    today: '2026-05-12',
    workouts: [
      workout({ id: 'local', executionStatus: 'local_planned' }),
      workout({ id: 'ready', executionStatus: 'garmin_scheduled' }),
    ],
    adaptationEvents: [
      event({ id: 'recovery', kind: 'recovery_risk', recommendation: 'protect_recovery', summary: 'Recovery-Druck ist hoch.' }),
    ],
    refreshPreview: refreshPreview({}),
    currentLoad,
    goalProjection,
    personalResponse,
    review,
  });

  assert.equal(contract.tone, 'attention');
  assert.equal(contract.sections.map(section => section.id).join(','), 'learned,changed,risk,next_action');
  assert.match(contract.sections.find(section => section.id === 'learned')?.body ?? '', /Boundary und Warm-up/);
  assert.match(contract.sections.find(section => section.id === 'changed')?.body ?? '', /Garmin- und Recovery-Daten/);
  assert.match(contract.sections.find(section => section.id === 'risk')?.body ?? '', /TSB -28/);
  assert.match(contract.sections.find(section => section.id === 'risk')?.body ?? '', /70\.3 Kraichgau/);
  assert.match(contract.sections.find(section => section.id === 'risk')?.body ?? '', /Garmin/);
  assert.match(contract.sections.find(section => section.id === 'next_action')?.body ?? '', /anpassen, beibehalten oder verschieben/);
});

test('previews accept, adapt and defer without implying hidden Plan or Garmin writes', () => {
  const contract = buildPlanWeeklyDecisionContract({
    today: '2026-05-12',
    workouts: [workout({ id: 'local', executionStatus: 'local_planned' })],
    adaptationEvents: [event({ recommendation: 'reduce_volume' })],
    refreshPreview: refreshPreview({}),
    currentLoad,
    goalProjection,
    personalResponse,
    review,
  });

  assert.deepEqual(contract.options.map(option => option.kind), ['accept_current', 'adapt_week', 'defer_decision']);
  assert.equal(contract.options.every(option => option.readOnly), true);
  assert.match(contract.options.find(option => option.kind === 'adapt_week')?.weekImpact ?? '', /TSS -45/);
  assert.match(contract.options.find(option => option.kind === 'adapt_week')?.resultPreview ?? '', /erst ein explizites Anwenden/);
  assert.match(contract.options.find(option => option.kind === 'accept_current')?.resultPreview ?? '', /keine Plan- oder Garmin-Aenderung/);
  assert.match(contract.options.find(option => option.kind === 'defer_decision')?.resultPreview ?? '', /keine Plan- oder Garmin-Aenderung/);
});

test('builds explicit weekly decision receipts without plan or Garmin writes', () => {
  const contract = buildPlanWeeklyDecisionContract({
    today: '2026-05-12',
    workouts: [workout({ id: 'local', executionStatus: 'local_planned' })],
    adaptationEvents: [event({ recommendation: 'reduce_volume' })],
    refreshPreview: refreshPreview({}),
    currentLoad,
    goalProjection,
    personalResponse,
    review,
  });

  const adapt = buildPlanWeeklyDecisionReceipt(contract, 'adapt_week', '2026-05-12T07:00:00.000Z');
  const accept = buildPlanWeeklyDecisionReceipt(contract, 'accept_current', '2026-05-12T07:05:00.000Z');
  const defer = buildPlanWeeklyDecisionReceipt(contract, 'defer_decision', '2026-05-12T07:10:00.000Z');

  assert.equal(adapt.optionKind, 'adapt_week');
  assert.equal(adapt.optionLabel, 'Anpassen');
  assert.match(adapt.title, /Anpassen gemerkt/);
  assert.match(adapt.weekImpact, /TSS -45/);
  assert.match(adapt.nextConsequence, /Vorschau/);
  assert.match(adapt.nextConsequence, /erst dort nach explizitem Klick/);
  assert.equal(adapt.targetPath, '#plan-refresh-preview-card');
  assert.match(adapt.mutationBoundary, /Keine Plan- oder Garmin-Aenderung gespeichert/);
  assert.equal(adapt.createdAt, '2026-05-12T07:00:00.000Z');
  assert.equal(typeof adapt.contractSignature, 'string');
  assert.ok(adapt.contractSignature.length > 20);

  assert.match(accept.nextConsequence, /Woche bleibt wie gewaehlt/);
  assert.match(accept.mutationBoundary, /Keine Plan- oder Garmin-Aenderung gespeichert/);
  assert.equal(accept.targetPath, null);

  assert.match(defer.nextConsequence, /Watch-Kontext/);
  assert.match(defer.mutationBoundary, /Keine Plan- oder Garmin-Aenderung gespeichert/);
});

test('weekly review exposes the same weekly decision contract used by the inbox', () => {
  const summary = buildWeeklyCoachReview({
    review,
    adaptationEvents: [event({ summary: 'Gestern wurde die harte Einheit ersetzt.' })],
    personalResponse,
    goalProjection,
    seasonStrategy: null,
    today: '2026-05-12',
    workouts: [workout({ executionStatus: 'local_planned' })],
    refreshPreview: refreshPreview({}),
    currentLoad,
  });

  assert.equal(summary.weeklyDecision.tone, 'attention');
  assert.equal(summary.weeklyDecision.sections.find(section => section.id === 'changed')?.body, 'Neue Garmin- und Recovery-Daten würden den Wochenplan verändern.');
  assert.equal(summary.weeklyDecision.options.find(option => option.kind === 'adapt_week')?.readOnly, true);
  assert.match(summary.lanes.find(lane => lane.id === 'decision')?.body ?? '', /anpassen, beibehalten oder verschieben/);
});
