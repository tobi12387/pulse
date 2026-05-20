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

function goalProjectionWith(overrides: {
  status?: PulseGoalProjectionResponse['projections'][number]['status'];
  limiterStatus?: PulseGoalProjectionResponse['projections'][number]['limiterRisk']['status'];
  probabilityPct?: number | null;
  summary?: string;
  limiterLabel?: string;
  limiterSummary?: string;
} = {}): PulseGoalProjectionResponse {
  const status = overrides.status ?? 'watch';
  const limiterStatus = overrides.limiterStatus ?? (status === 'at_risk' ? 'blocked' : status === 'on_track' ? 'clear' : 'watch');
  const base = goalProjection.projections[0];
  assert.ok(base);

  return {
    ...goalProjection,
    projections: [{
      ...base,
      probabilityPct: overrides.probabilityPct ?? (status === 'on_track' ? 78 : status === 'at_risk' ? 31 : 64),
      status,
      summary: overrides.summary ?? (status === 'on_track'
        ? 'Ziel ist auf Kurs; die aktuelle Woche haelt den Aufbau stabil.'
        : base.summary),
      limiterRisk: {
        ...base.limiterRisk,
        status: limiterStatus,
        label: overrides.limiterLabel ?? (limiterStatus === 'clear' ? 'Kein dominanter Limiter' : base.limiterRisk.label),
        summary: overrides.limiterSummary ?? (limiterStatus === 'clear'
          ? 'Kein dominanter Ziel-Limiter begrenzt die Projektion.'
          : base.limiterRisk.summary),
      },
    }],
  };
}

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
      }, {
        theme: 'Tageskonflikt: Koerper, Ziel und Alltag',
        count: 1,
        lastSeen: '2026-05-12',
        status: 'watch',
        evidence: ['1x Tageskonflikt mit kleinerer Alltagsoption'],
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

test('weekly decision keeps on-track goal progress as Plan confidence', () => {
  const contract = buildPlanWeeklyDecisionContract({
    today: '2026-05-12',
    workouts: [workout({ id: 'goal-on-track', executionStatus: 'garmin_scheduled' })],
    adaptationEvents: [],
    refreshPreview: null,
    currentLoad: stableLoad,
    goalProjection: goalProjectionWith({ status: 'on_track', limiterStatus: 'clear' }),
    personalResponse: null,
    decisionQuality: null,
    fuelingOutcomeBaseline: null,
    review: null,
  });

  const learned = contract.sections.find(section => section.id === 'learned');
  const risk = contract.sections.find(section => section.id === 'risk');
  const nextAction = contract.sections.find(section => section.id === 'next_action');
  const adapt = contract.options.find(option => option.kind === 'adapt_week');

  assert.equal(contract.tone, 'ok');
  assert.equal(contract.title, 'Woche aktuell stabil');
  assert.equal(contract.primaryOption, 'accept_current');
  assert.match(learned?.title ?? '', /Ziel-Fortschritt.*Beibehalten/);
  assert.match(learned?.body ?? '', /70\.3 Kraichgau/);
  assert.match(learned?.body ?? '', /78%/);
  assert.match(learned?.body ?? '', /Plan bleibt bei Beibehalten/);
  assert.match(risk?.body ?? '', /Risiko aktuell ruhig/);
  assert.doesNotMatch(risk?.body ?? '', /70\.3 Kraichgau|Ziel|Limiter|Fueling/);
  assert.match(nextAction?.body ?? '', /Aktuelle Woche beibehalten/);
  assert.doesNotMatch(adapt?.weekImpact ?? '', /Ziel|70\.3 Kraichgau|Fueling/);
  assert.match(contract.evidence.join(' · '), /Ziel-Fortschritt stabil: 70\.3 Kraichgau 78%/);
});

test('weekly decision keeps watch goal limiters as weekly confidence evidence', () => {
  const contract = buildPlanWeeklyDecisionContract({
    today: '2026-05-12',
    workouts: [workout({ id: 'goal-watch', executionStatus: 'garmin_scheduled' })],
    adaptationEvents: [],
    refreshPreview: null,
    currentLoad: stableLoad,
    goalProjection: goalProjectionWith({ status: 'watch', limiterStatus: 'watch', probabilityPct: 64 }),
    personalResponse: null,
    decisionQuality: null,
    fuelingOutcomeBaseline: null,
    review: null,
  });

  const learned = contract.sections.find(section => section.id === 'learned');
  const risk = contract.sections.find(section => section.id === 'risk');
  const adapt = contract.options.find(option => option.kind === 'adapt_week');

  assert.equal(contract.tone, 'ok');
  assert.equal(contract.title, 'Woche aktuell stabil');
  assert.equal(contract.primaryOption, 'accept_current');
  assert.match(learned?.title ?? '', /Ziel-Limiter beobachten/);
  assert.match(learned?.body ?? '', /70\.3 Kraichgau/);
  assert.match(learned?.body ?? '', /64%/);
  assert.match(learned?.body ?? '', /Plan bleibt bei Beibehalten/);
  assert.match(learned?.body ?? '', /Anpassen oeffnet erst wieder, wenn der Ziel-Limiter kritisch wird/);
  assert.match(risk?.body ?? '', /Risiko aktuell ruhig/);
  assert.doesNotMatch(risk?.body ?? '', /Long Endurance|Fueling-Praxis|70\.3 Kraichgau/);
  assert.doesNotMatch(adapt?.weekImpact ?? '', /Long Endurance|Fueling-Praxis|70\.3 Kraichgau/);
  assert.match(contract.evidence.join(' · '), /Ziel-Limiter beobachten: 70\.3 Kraichgau 64%/);
});

test('weekly decision opens only at-risk or blocked goal limiters as explicit Plan decisions', () => {
  const contract = buildPlanWeeklyDecisionContract({
    today: '2026-05-12',
    workouts: [workout({ id: 'goal-blocked', executionStatus: 'garmin_scheduled' })],
    adaptationEvents: [],
    refreshPreview: null,
    currentLoad: stableLoad,
    goalProjection: goalProjectionWith({ status: 'watch', limiterStatus: 'blocked', probabilityPct: 38 }),
    personalResponse: null,
    decisionQuality: null,
    fuelingOutcomeBaseline: null,
    review: null,
  });

  const learned = contract.sections.find(section => section.id === 'learned');
  const changed = contract.sections.find(section => section.id === 'changed');
  const risk = contract.sections.find(section => section.id === 'risk');
  const nextAction = contract.sections.find(section => section.id === 'next_action');
  const adapt = contract.options.find(option => option.kind === 'adapt_week');
  const accept = contract.options.find(option => option.kind === 'accept_current');
  const receipt = buildPlanWeeklyDecisionReceipt(contract, 'adapt_week', '2026-05-12T07:30:00.000Z');

  assert.equal(contract.tone, 'attention');
  assert.equal(contract.title, 'Wochenentscheidung offen');
  assert.equal(contract.primaryOption, 'adapt_week');
  assert.match(learned?.title ?? '', /Ziel-Limiter/);
  assert.match(learned?.body ?? '', /Beibehalten, Anpassen oder Spaeter/);
  assert.match(changed?.body ?? '', /Ziel-Limiter/);
  assert.match(changed?.body ?? '', /Fueling-Praxis absichern/);
  assert.match(risk?.body ?? '', /70\.3 Kraichgau/);
  assert.match(risk?.body ?? '', /38%/);
  assert.match(risk?.body ?? '', /Lange Einheit mit sauberem Fueling-Log/);
  assert.match(nextAction?.body ?? '', /Ziel-Limiter explizit/);
  assert.match(adapt?.weekImpact ?? '', /Ziel-Limiter/);
  assert.match(adapt?.weekImpact ?? '', /Fueling-Praxis absichern/);
  assert.match(accept?.weekImpact ?? '', /trotz Ziel-Limiter/);
  assert.equal(contract.options.every(option => option.readOnly), true);
  assert.match(receipt.nextConsequence, /Ziel-Limiter/);
  assert.match(receipt.mutationBoundary, /Keine Plan- oder Garmin-Aenderung gespeichert/);
});

test('weekly decision carries repeated daily tradeoffs into the Plan receipt without hidden writes', () => {
  const contract = buildPlanWeeklyDecisionContract({
    today: '2026-05-12',
    workouts: [workout({ id: 'steady-tradeoff', executionStatus: 'garmin_scheduled' })],
    adaptationEvents: [],
    refreshPreview: null,
    currentLoad: stableLoad,
    goalProjection: { ...goalProjection, projections: [] },
    personalResponse: null,
    decisionQuality: decisionQuality({
      qualityScore: 36,
      status: 'needs_strategy_change',
      statusLabel: 'Tageskonflikt wiederholt',
      repeatedThemes: [{
        theme: 'Tageskonflikt: Koerper, Ziel und Alltag',
        count: 3,
        lastSeen: '2026-05-12',
        status: 'stale',
        evidence: [
          '3x Tageskonflikt mit zu hartem Plan und kleinerem Alltagsfenster',
          '2x Abschluss als leichtere Option gelernt',
        ],
      }],
      bestEvidence: ['3x Tageskonflikt mit zu hartem Plan und kleinerem Alltagsfenster'],
      suggestedAdjustment: 'Diese Woche Intensitaet erst nach Warm-up freigeben und eine leichtere Option vorab festlegen.',
    }),
    fuelingOutcomeBaseline: null,
    review: null,
  });

  const learned = contract.sections.find(section => section.id === 'learned');
  const changed = contract.sections.find(section => section.id === 'changed');
  const nextAction = contract.sections.find(section => section.id === 'next_action');
  const adapt = contract.options.find(option => option.kind === 'adapt_week');
  const accept = contract.options.find(option => option.kind === 'accept_current');
  const receipt = buildPlanWeeklyDecisionReceipt(contract, 'adapt_week', '2026-05-12T07:15:00.000Z');

  assert.equal(contract.tone, 'attention');
  assert.equal(contract.title, 'Wochenentscheidung offen');
  assert.equal(contract.primaryOption, 'adapt_week');
  assert.match(learned?.title ?? '', /Tageskonflikte/);
  assert.match(learned?.body ?? '', /3x Tageskonflikt/);
  assert.match(learned?.body ?? '', /Intensitaet erst nach Warm-up/);
  assert.match(learned?.body ?? '', /Plan und Garmin bleiben unverändert/);
  assert.match(changed?.body ?? '', /bewusste Wochenentscheidung/);
  assert.match(nextAction?.body ?? '', /Beibehalten, Anpassen oder Spaeter/);
  assert.match(adapt?.weekImpact ?? '', /Tageskonflikte/);
  assert.match(adapt?.resultPreview ?? '', /erst ein explizites Anwenden/);
  assert.match(accept?.weekImpact ?? '', /trotz wiederholter Tageskonflikte/);
  assert.equal(contract.options.every(option => option.readOnly), true);
  assert.match(contract.evidence.join(' · '), /Tageskonflikt/);
  assert.match(receipt.nextConsequence, /Tradeoff-Evidenz/);
  assert.match(receipt.mutationBoundary, /Keine Plan- oder Garmin-Aenderung gespeichert/);
  assert.ok(receipt.evidence?.some(item => /Tageskonflikt/.test(item)));
});

test('weekly decision keeps today-classified repeated tradeoffs out of the weekly change', () => {
  const contract = buildPlanWeeklyDecisionContract({
    today: '2026-05-12',
    workouts: [workout({ id: 'today-tradeoff', executionStatus: 'garmin_scheduled' })],
    adaptationEvents: [],
    refreshPreview: null,
    currentLoad: stableLoad,
    goalProjection: { ...goalProjection, projections: [] },
    personalResponse: null,
    decisionQuality: decisionQuality({
      qualityScore: 78,
      status: 'helpful',
      statusLabel: 'Tageskonflikt hilft heute',
      repeatedThemes: [{
        theme: 'Tageskonflikt: Koerper, Ziel und Alltag',
        count: 2,
        lastSeen: '2026-05-12',
        status: 'useful_repetition',
        evidence: ['2x leichtere Option hat Folgetag-RPE gesenkt'],
      }],
      bestEvidence: ['2x leichtere Option hat Folgetag-RPE gesenkt'],
      suggestedAdjustment: 'Heute zuerst die leichtere Option bestaetigen, wenn Schlaf und Alltag eng sind.',
    }),
    fuelingOutcomeBaseline: null,
    review: null,
  });

  const learned = contract.sections.find(section => section.id === 'learned');
  const changed = contract.sections.find(section => section.id === 'changed');
  const nextAction = contract.sections.find(section => section.id === 'next_action');
  const adapt = contract.options.find(option => option.kind === 'adapt_week');
  const accept = contract.options.find(option => option.kind === 'accept_current');
  const receipt = buildPlanWeeklyDecisionReceipt(contract, 'accept_current', '2026-05-12T07:20:00.000Z');

  assert.equal(contract.tone, 'ok');
  assert.equal(contract.title, 'Woche aktuell stabil');
  assert.equal(contract.primaryOption, 'accept_current');
  assert.match(learned?.title ?? '', /Heute-Kontext/);
  assert.match(learned?.body ?? '', /Heute veraendert/);
  assert.match(learned?.body ?? '', /keine Wochenentscheidung/);
  assert.match(changed?.body ?? '', /Keine offene Planaenderung/);
  assert.match(nextAction?.body ?? '', /Aktuelle Woche beibehalten/);
  assert.doesNotMatch(adapt?.weekImpact ?? '', /Tageskonflikte/);
  assert.doesNotMatch(accept?.weekImpact ?? '', /trotz wiederholter Tageskonflikte/);
  assert.match(contract.evidence.join(' · '), /Tageskonflikt Watch-Kontext/);
  assert.ok(receipt.evidence?.some(item => /Tageskonflikt Watch-Kontext/.test(item)));
  assert.match(receipt.nextConsequence, /Woche bleibt/);
});

test('weekly decision keeps an isolated daily tradeoff as watch context', () => {
  const contract = buildPlanWeeklyDecisionContract({
    today: '2026-05-12',
    workouts: [workout({ id: 'isolated-tradeoff', executionStatus: 'garmin_scheduled' })],
    adaptationEvents: [],
    refreshPreview: null,
    currentLoad: stableLoad,
    goalProjection: { ...goalProjection, projections: [] },
    personalResponse: null,
    decisionQuality: decisionQuality({
      qualityScore: 72,
      status: 'watch',
      statusLabel: 'Einzelnen Tageskonflikt beobachten',
      repeatedThemes: [{
        theme: 'Tageskonflikt: Koerper, Ziel und Alltag',
        count: 1,
        lastSeen: '2026-05-12',
        status: 'watch',
        evidence: ['1x Tageskonflikt mit kleinerer Alltagsoption'],
      }],
      bestEvidence: ['1x Tageskonflikt mit kleinerer Alltagsoption'],
      suggestedAdjustment: 'Erst wiederholen lassen, bevor die Woche angepasst wird.',
    }),
    fuelingOutcomeBaseline: null,
    review: null,
  });

  const learned = contract.sections.find(section => section.id === 'learned');
  const nextAction = contract.sections.find(section => section.id === 'next_action');

  assert.equal(contract.tone, 'ok');
  assert.equal(contract.title, 'Woche aktuell stabil');
  assert.equal(contract.primaryOption, 'accept_current');
  assert.match(learned?.title ?? '', /Watch-Kontext/);
  assert.match(learned?.body ?? '', /Ein einzelner Tageskonflikt/);
  assert.match(learned?.body ?? '', /keine Wochenaenderung/);
  assert.match(nextAction?.body ?? '', /Aktuelle Woche beibehalten/);
  assert.doesNotMatch(contract.evidence.join(' · '), /Wochenentscheidung/);
  assert.equal(contract.options.every(option => option.readOnly), true);
});

test('weekly decision keeps repeated watch tradeoffs quiet until fresh weekly evidence appears', () => {
  const contract = buildPlanWeeklyDecisionContract({
    today: '2026-05-12',
    workouts: [workout({ id: 'watch-tradeoff', executionStatus: 'garmin_scheduled' })],
    adaptationEvents: [],
    refreshPreview: null,
    currentLoad: stableLoad,
    goalProjection: { ...goalProjection, projections: [] },
    personalResponse: null,
    decisionQuality: decisionQuality({
      qualityScore: 54,
      status: 'watch',
      statusLabel: 'Tageskonflikt noch unsicher',
      repeatedThemes: [{
        theme: 'Tageskonflikt: Koerper, Ziel und Alltag',
        count: 2,
        lastSeen: '2026-05-12',
        status: 'watch',
        evidence: ['2x Tageskonflikt, aber Feedback nur einmal geschlossen'],
      }],
      bestEvidence: ['2x Tageskonflikt, aber Feedback nur einmal geschlossen'],
      suggestedAdjustment: 'Noch ein abgeschlossenes Feedback fehlt, bevor die Woche angepasst wird.',
    }),
    fuelingOutcomeBaseline: null,
    review: null,
  });

  const learned = contract.sections.find(section => section.id === 'learned');
  const nextAction = contract.sections.find(section => section.id === 'next_action');
  const adapt = contract.options.find(option => option.kind === 'adapt_week');

  assert.equal(contract.tone, 'ok');
  assert.equal(contract.title, 'Woche aktuell stabil');
  assert.equal(contract.primaryOption, 'accept_current');
  assert.match(learned?.title ?? '', /Watch-Kontext/);
  assert.match(learned?.body ?? '', /Noch nicht stark genug/);
  assert.match(learned?.body ?? '', /Feedback fehlt/);
  assert.match(nextAction?.body ?? '', /Aktuelle Woche beibehalten/);
  assert.doesNotMatch(adapt?.weekImpact ?? '', /Tageskonflikte/);
  assert.match(contract.evidence.join(' · '), /Tageskonflikt Watch-Kontext/);
});

test('weekly decision keeps handled tradeoff receipts as quiet continuity', () => {
  const contract = buildPlanWeeklyDecisionContract({
    today: '2026-05-12',
    workouts: [workout({ id: 'handled-tradeoff-receipt', executionStatus: 'garmin_scheduled' })],
    adaptationEvents: [],
    refreshPreview: null,
    currentLoad: stableLoad,
    goalProjection: { ...goalProjection, projections: [] },
    personalResponse: null,
    decisionQuality: decisionQuality({
      qualityScore: 70,
      status: 'helpful',
      statusLabel: 'Tageskonflikt bereits eingeordnet',
      repeatedThemes: [{
        theme: 'Tageskonflikt: Koerper, Ziel und Alltag',
        count: 3,
        lastSeen: '2026-05-12',
        status: 'useful_repetition',
        evidence: [
          'Wochenentscheidung gemerkt: Beibehalten trotz Tageskonflikt',
          'Tradeoff bereits in Plan eingeordnet',
        ],
      }],
      bestEvidence: ['Tageskonflikt bereits in Plan eingeordnet und als Beibehalten gemerkt'],
      suggestedAdjustment: 'Bereits gehandhabt: ruhig lassen, bis frische Wochen-Evidenz die Woche erneut veraendert.',
    }),
    fuelingOutcomeBaseline: null,
    review: null,
  });

  const learned = contract.sections.find(section => section.id === 'learned');
  const changed = contract.sections.find(section => section.id === 'changed');
  const nextAction = contract.sections.find(section => section.id === 'next_action');
  const adapt = contract.options.find(option => option.kind === 'adapt_week');
  const receipt = buildPlanWeeklyDecisionReceipt(contract, 'accept_current', '2026-05-12T07:25:00.000Z');

  assert.equal(contract.tone, 'ok');
  assert.equal(contract.title, 'Woche aktuell stabil');
  assert.equal(contract.primaryOption, 'accept_current');
  assert.match(learned?.title ?? '', /Receipt bleibt ruhig/);
  assert.match(learned?.body ?? '', /bereits in Plan eingeordnet/);
  assert.match(learned?.body ?? '', /Beibehalten gemerkt/);
  assert.match(learned?.body ?? '', /frische Wochen-Evidenz/);
  assert.match(changed?.body ?? '', /Keine offene Planaenderung/);
  assert.match(nextAction?.body ?? '', /Aktuelle Woche beibehalten/);
  assert.doesNotMatch(adapt?.weekImpact ?? '', /Tageskonflikte|Tradeoff-Evidenz/);
  assert.match(contract.evidence.join(' · '), /Tageskonflikt erledigt/);
  assert.ok(receipt.evidence?.some(item => /Tageskonflikt erledigt/.test(item)));
  assert.match(receipt.nextConsequence, /Woche bleibt/);
});

test('weekly decision keeps handled reopen-source trends as quiet receipt continuity', () => {
  const contract = buildPlanWeeklyDecisionContract({
    today: '2026-05-12',
    workouts: [workout({ id: 'handled-reopen-source-receipt', executionStatus: 'garmin_scheduled' })],
    adaptationEvents: [],
    refreshPreview: null,
    currentLoad: stableLoad,
    goalProjection: { ...goalProjection, projections: [] },
    personalResponse: null,
    decisionQuality: decisionQuality({
      qualityScore: 74,
      status: 'helpful',
      statusLabel: 'Reopen-Quellentrend bereits in Wochenentscheidung eingeordnet',
      repeatedThemes: [{
        theme: 'Tageskonflikt: Koerper, Ziel und Alltag',
        count: 5,
        lastSeen: '2026-05-12',
        status: 'useful_repetition',
        evidence: [
          'Wochenentscheidung gemerkt: Anpassen wegen Reopen-Quellentrend Planlast 2x und Garmin-Ausfuehrung 2x',
          'Reopen-Quellentrend Planlast 2x bereits in Plan eingeordnet',
          'Reopen-Quellentrend Garmin-Ausfuehrung 2x bereits in Plan eingeordnet',
        ],
      }],
      bestEvidence: [
        'Plan-Receipt: Reopen-Quellentrend Planlast 2x und Garmin-Ausfuehrung 2x handled',
        'Folgewirkung bestaetigt: 7 Tage ohne erneute Reopen-Quelle nach Plan-Receipt',
        'Folgewirkung bestaetigt: 14 Tage ohne erneute Reopen-Quelle nach Plan-Receipt',
      ],
      suggestedAdjustment: 'Bereits gehandhabt: Quellentrend als Kontinuitaet behalten, bis frische Wochen-Evidenz erneut wirkt.',
    }),
    fuelingOutcomeBaseline: null,
    review: null,
  });

  const learned = contract.sections.find(section => section.id === 'learned');
  const changed = contract.sections.find(section => section.id === 'changed');
  const nextAction = contract.sections.find(section => section.id === 'next_action');
  const adapt = contract.options.find(option => option.kind === 'adapt_week');
  const receipt = buildPlanWeeklyDecisionReceipt(contract, 'accept_current', '2026-05-12T07:27:00.000Z');

  assert.equal(contract.tone, 'ok');
  assert.equal(contract.title, 'Woche aktuell stabil');
  assert.equal(contract.primaryOption, 'accept_current');
  assert.match(learned?.title ?? '', /Wochenreceipt-Lernvertrauen bestaetigt.*Beibehalten/);
  assert.match(learned?.body ?? '', /Planlast 2x.*Garmin-Ausfuehrung 2x/);
  assert.match(learned?.body ?? '', /Plan-Receipt: Reopen-Quellentrend Planlast 2x und Garmin-Ausfuehrung 2x handled/);
  assert.match(learned?.body ?? '', /Wochenreceipt-Vertrauensdauer: 14 Tage/);
  assert.match(learned?.body ?? '', /Folgewirkung bestaetigt: 14 Tage ohne erneute Reopen-Quelle/);
  assert.match(learned?.body ?? '', /Wochenreceipt-Erneuerungscheck/);
  assert.match(learned?.body ?? '', /keine erneute Reopen-Quelle/);
  assert.match(learned?.body ?? '', /Plan bleibt bei Beibehalten/);
  assert.match(learned?.body ?? '', /Kontinuitaet|ruhig/);
  assert.match(changed?.body ?? '', /Keine offene Planaenderung/);
  assert.match(nextAction?.body ?? '', /Aktuelle Woche beibehalten/);
  assert.doesNotMatch(adapt?.weekImpact ?? '', /Reopen-Quellentrend|Planlast 2x|Garmin-Ausfuehrung 2x|Wochenreceipt|Lernvertrauen|Vertrauensdauer|Erneuerungscheck|Plan-Receipt/);
  assert.match(contract.evidence.join(' · '), /Wochenreceipt-Lernvertrauen bestaetigt: Planlast 2x.*Garmin-Ausfuehrung 2x/);
  assert.match(contract.evidence.join(' · '), /Wochenreceipt-Vertrauensdauer: 14 Tage/);
  assert.match(contract.evidence.join(' · '), /Wochenreceipt-Erneuerungscheck: Planlast 2x.*Garmin-Ausfuehrung 2x/);
  assert.match(contract.evidence.join(' · '), /Wochenreceipt: Plan-Receipt: Reopen-Quellentrend Planlast 2x und Garmin-Ausfuehrung 2x handled/);
  assert.match(contract.evidence.join(' · '), /Reopen-Trend entschieden Planlast 2x/);
  assert.match(contract.evidence.join(' · '), /Reopen-Trend entschieden Garmin-Ausfuehrung 2x/);
  assert.ok(receipt.evidence?.some(item => /Wochenreceipt-Lernvertrauen bestaetigt/.test(item)));
  assert.ok(receipt.evidence?.some(item => /Wochenreceipt-Vertrauensdauer: 14 Tage/.test(item)));
  assert.ok(receipt.evidence?.some(item => /Wochenreceipt-Erneuerungscheck/.test(item)));
  assert.match(receipt.nextConsequence, /Woche bleibt/);
  assert.match(receipt.mutationBoundary, /Keine Plan- oder Garmin-Aenderung gespeichert/);
});

test('weekly decision keeps unrefreshed weekly receipt trust quiet in Plan', () => {
  const contract = buildPlanWeeklyDecisionContract({
    today: '2026-05-12',
    workouts: [workout({ id: 'unrefreshed-reopen-source-receipt', executionStatus: 'garmin_scheduled' })],
    adaptationEvents: [],
    refreshPreview: null,
    currentLoad: stableLoad,
    goalProjection: { ...goalProjection, projections: [] },
    personalResponse: null,
    decisionQuality: decisionQuality({
      qualityScore: 71,
      status: 'helpful',
      statusLabel: 'Reopen-Quellentrend bereits in Wochenentscheidung eingeordnet',
      repeatedThemes: [{
        theme: 'Tageskonflikt: Koerper, Ziel und Alltag',
        count: 4,
        lastSeen: '2026-05-12',
        status: 'useful_repetition',
        evidence: [
          'Wochenentscheidung gemerkt: Beibehalten wegen Reopen-Quellentrend Recovery 2x',
          'Reopen-Quellentrend Recovery 2x bereits in Plan eingeordnet',
        ],
      }],
      bestEvidence: [
        'Plan-Receipt: Reopen-Quellentrend Recovery 2x handled',
      ],
      suggestedAdjustment: 'Bereits gehandhabt: Quellentrend beobachten, bis frische Wochen-Evidenz erneut wirkt.',
    }),
    fuelingOutcomeBaseline: null,
    review: null,
  });

  const learned = contract.sections.find(section => section.id === 'learned');
  const changed = contract.sections.find(section => section.id === 'changed');
  const nextAction = contract.sections.find(section => section.id === 'next_action');
  const adapt = contract.options.find(option => option.kind === 'adapt_week');
  const receipt = buildPlanWeeklyDecisionReceipt(contract, 'accept_current', '2026-05-12T07:28:00.000Z');

  assert.equal(contract.tone, 'ok');
  assert.equal(contract.title, 'Woche aktuell stabil');
  assert.equal(contract.primaryOption, 'accept_current');
  assert.match(learned?.title ?? '', /Wochenreceipt-Lernvertrauen unaufgefrischt.*Beibehalten/);
  assert.match(learned?.body ?? '', /Wochenreceipt-Lernvertrauen unaufgefrischt: Recovery 2x/);
  assert.match(learned?.body ?? '', /nicht neu bestaetigt/);
  assert.match(learned?.body ?? '', /Wochenreceipt-Erneuerungscheck offen/);
  assert.match(learned?.body ?? '', /naechste Heute- oder Wochen-Evidenz ohne erneute Reopen-Quelle/);
  assert.match(learned?.body ?? '', /Plan bleibt bei Beibehalten/);
  assert.doesNotMatch(learned?.body ?? '', /braucht Review|Vertrauensdauer/);
  assert.match(changed?.body ?? '', /Keine offene Planaenderung/);
  assert.match(nextAction?.body ?? '', /Aktuelle Woche beibehalten/);
  assert.doesNotMatch(adapt?.weekImpact ?? '', /Reopen-Quellentrend|Recovery 2x|Wochenreceipt|Lernvertrauen|Vertrauensdauer|Erneuerungscheck|Plan-Receipt/);
  assert.match(contract.evidence.join(' · '), /Wochenreceipt-Lernvertrauen unaufgefrischt: Recovery 2x/);
  assert.match(contract.evidence.join(' · '), /Wochenreceipt-Erneuerungscheck offen: Recovery 2x/);
  assert.doesNotMatch(contract.evidence.join(' · '), /Vertrauensdauer|braucht Review/);
  assert.ok(receipt.evidence?.some(item => /Wochenreceipt-Lernvertrauen unaufgefrischt/.test(item)));
  assert.ok(receipt.evidence?.some(item => /Wochenreceipt-Erneuerungscheck offen/.test(item)));
  assert.match(receipt.nextConsequence, /Woche bleibt/);
  assert.match(receipt.mutationBoundary, /Keine Plan- oder Garmin-Aenderung gespeichert/);
});

test('weekly decision reopens handled tradeoff receipts only when fresh weekly evidence appears', () => {
  const contract = buildPlanWeeklyDecisionContract({
    today: '2026-05-12',
    workouts: [workout({ id: 'fresh-handled-tradeoff', executionStatus: 'garmin_scheduled' })],
    adaptationEvents: [],
    refreshPreview: null,
    currentLoad: stableLoad,
    goalProjection: { ...goalProjection, projections: [] },
    personalResponse: null,
    decisionQuality: decisionQuality({
      qualityScore: 34,
      status: 'needs_strategy_change',
      statusLabel: 'Tageskonflikt mit neuer Wochenwirkung',
      repeatedThemes: [{
        theme: 'Tageskonflikt: Koerper, Ziel und Alltag',
        count: 3,
        lastSeen: '2026-05-12',
        status: 'stale',
        evidence: [
          'Tageskonflikt bereits in Plan eingeordnet',
          'Neue Evidenz seit gemerkter Wochenentscheidung: Planlast kollidiert erneut mit Recovery und Garmin-Ausfuehrung',
        ],
      }],
      bestEvidence: ['Neue Evidenz seit gemerkter Wochenentscheidung veraendert die Wochenlast erneut'],
      suggestedAdjustment: 'Jetzt wieder Wochenentscheidung oeffnen: Planlast reduzieren oder leichtere Option fuer die Woche festlegen.',
    }),
    fuelingOutcomeBaseline: null,
    review: null,
  });

  const learned = contract.sections.find(section => section.id === 'learned');
  const changed = contract.sections.find(section => section.id === 'changed');
  const adapt = contract.options.find(option => option.kind === 'adapt_week');
  const receipt = buildPlanWeeklyDecisionReceipt(contract, 'adapt_week', '2026-05-12T07:30:00.000Z');

  assert.equal(contract.tone, 'attention');
  assert.equal(contract.title, 'Wochenentscheidung offen');
  assert.equal(contract.primaryOption, 'adapt_week');
  assert.match(learned?.title ?? '', /Tageskonflikte/);
  assert.match(learned?.body ?? '', /Frische Wochen-Evidenz aus Planlast, Recovery und Garmin-Ausfuehrung/);
  assert.match(learned?.body ?? '', /seit gemerkter Wochenentscheidung/);
  assert.match(learned?.body ?? '', /Aeltere Receipt-Evidenz bleibt Kontext: Tageskonflikt bereits in Plan eingeordnet/);
  assert.match(changed?.body ?? '', /Frische Wochen-Evidenz aus Planlast, Recovery und Garmin-Ausfuehrung/);
  assert.match(adapt?.weekImpact ?? '', /Frische Wochen-Evidenz aus Planlast, Recovery und Garmin-Ausfuehrung/);
  assert.match(adapt?.weekImpact ?? '', /Szenario-Vorschau/);
  assert.equal(adapt?.targetPath, '#plan-scenario-preview');
  assert.equal(adapt?.readOnly, true);
  assert.match(contract.evidence.join(' · '), /Tageskonflikt Wochenentscheidung/);
  assert.match(receipt.nextConsequence, /Tradeoff-Evidenz/);
});

test('weekly decision reopens handled source trends only with fresh weekly source evidence', () => {
  const contract = buildPlanWeeklyDecisionContract({
    today: '2026-05-12',
    workouts: [workout({ id: 'fresh-handled-source-trend', executionStatus: 'garmin_scheduled' })],
    adaptationEvents: [],
    refreshPreview: null,
    currentLoad: stableLoad,
    goalProjection: { ...goalProjection, projections: [] },
    personalResponse: null,
    decisionQuality: decisionQuality({
      qualityScore: 26,
      status: 'needs_strategy_change',
      statusLabel: 'Reopen-Quellentrend mit neuer Wochenwirkung',
      repeatedThemes: [{
        theme: 'Tageskonflikt: Koerper, Ziel und Alltag',
        count: 6,
        lastSeen: '2026-05-12',
        status: 'stale',
        evidence: [
          'Wochenentscheidung gemerkt: Anpassen wegen Reopen-Quellentrend Planlast 2x',
          'Reopen-Quellentrend Planlast 2x bereits in Plan eingeordnet',
          'Neue Evidenz seit gemerkter Wochenentscheidung: 2x Planlast erneut zu hoch nach verschobener Einheit',
        ],
      }],
      bestEvidence: [
        'Plan-Receipt: Reopen-Quellentrend Planlast 2x handled',
        'Folgewirkung bestaetigt: 14 Tage ohne erneute Reopen-Quelle nach Plan-Receipt',
        'Wochenreceipt-Erneuerungscheck: Planlast 2x bleibt bestaetigt, solange weiter keine erneute Reopen-Quelle auftaucht',
        'Wiederholter Reopen-Grund: Planlast 2x erneut zu hoch',
      ],
      suggestedAdjustment: 'Wochenentscheidung erneut aus Quellentrend oeffnen: Planlast kleiner vorschauen, bevor Garmin synchronisiert wird.',
    }),
    fuelingOutcomeBaseline: null,
    review: null,
  });

  const learned = contract.sections.find(section => section.id === 'learned');
  const changed = contract.sections.find(section => section.id === 'changed');
  const adapt = contract.options.find(option => option.kind === 'adapt_week');
  const accept = contract.options.find(option => option.kind === 'accept_current');
  const receipt = buildPlanWeeklyDecisionReceipt(contract, 'adapt_week', '2026-05-12T07:32:00.000Z');

  assert.equal(contract.tone, 'attention');
  assert.equal(contract.title, 'Wochenentscheidung offen');
  assert.equal(contract.primaryOption, 'adapt_week');
  assert.match(learned?.title ?? '', /Reopen-Quellentrend/);
  assert.match(learned?.body ?? '', /Reopen-Quellentrend: Planlast 2x/);
  assert.match(learned?.body ?? '', /Wochenreceipt-Lernvertrauen braucht Review: Planlast 2x/);
  assert.doesNotMatch(learned?.body ?? '', /unaufgefrischt|Vertrauensdauer|Erneuerungscheck/);
  assert.doesNotMatch(learned?.body ?? '', /Wochenentscheidung gemerkt|Plan-Receipt:/);
  assert.match(changed?.body ?? '', /Reopen-Quellentrend: Planlast 2x/);
  assert.match(adapt?.weekImpact ?? '', /Reopen-Quellentrend: Planlast 2x/);
  assert.match(adapt?.weekImpact ?? '', /Szenario-Vorschau/);
  assert.doesNotMatch(adapt?.weekImpact ?? '', /Wochenreceipt|Lernvertrauen|Vertrauensdauer|Erneuerungscheck|Plan-Receipt/);
  assert.match(accept?.weekImpact ?? '', /trotz Reopen-Quellentrend/);
  assert.equal(adapt?.targetPath, '#plan-scenario-preview');
  assert.equal(adapt?.readOnly, true);
  assert.match(contract.evidence.join(' · '), /Reopen-Trend Planlast 2x/);
  assert.match(contract.evidence.join(' · '), /Reopen-Trend entschieden Planlast 2x/);
  assert.match(contract.evidence.join(' · '), /Wochenreceipt-Lernvertrauen braucht Review: Planlast 2x/);
  assert.doesNotMatch(contract.evidence.join(' · '), /unaufgefrischt|Vertrauensdauer|Erneuerungscheck/);
  assert.match(receipt.nextConsequence, /Tradeoff-Evidenz/);
  assert.match(receipt.mutationBoundary, /Keine Plan- oder Garmin-Aenderung gespeichert/);
});

test('weekly decision names goal-pressure as the fresh tradeoff reopen source', () => {
  const contract = buildPlanWeeklyDecisionContract({
    today: '2026-05-12',
    workouts: [workout({ id: 'fresh-goal-tradeoff', executionStatus: 'garmin_scheduled' })],
    adaptationEvents: [],
    refreshPreview: null,
    currentLoad: stableLoad,
    goalProjection: {
      ...goalProjection,
      projections: [{
        ...goalProjection.projections[0],
        probabilityPct: 48,
        status: 'at_risk',
        nextBestIntervention: {
          ...goalProjection.projections[0].nextBestIntervention,
          summary: 'Long-Endurance-Reiz und Fueling-Praxis brauchen diese Woche eine bewusst kleinere Entscheidung.',
        },
      }],
    },
    personalResponse: null,
    decisionQuality: decisionQuality({
      qualityScore: 33,
      status: 'needs_strategy_change',
      statusLabel: 'Tageskonflikt mit neuer Wochenwirkung',
      repeatedThemes: [{
        theme: 'Tageskonflikt: Koerper, Ziel und Alltag',
        count: 3,
        lastSeen: '2026-05-12',
        status: 'stale',
        evidence: [
          'Wochenentscheidung gemerkt: Beibehalten trotz Tageskonflikt',
          'Neue Evidenz seit gemerkter Wochenentscheidung: Ziel 70.3 Kraichgau rutscht auf 48% und braucht kleinere Long-Endurance-Entscheidung',
        ],
      }],
      bestEvidence: ['Neue Evidenz seit gemerkter Wochenentscheidung: Zielrisiko veraendert die Wochenentscheidung erneut'],
      suggestedAdjustment: 'Jetzt wieder Wochenentscheidung oeffnen: Long-Endurance-Reiz kleiner vorschauen, bevor Garmin synchronisiert wird.',
    }),
    fuelingOutcomeBaseline: null,
    review: null,
  });

  const learned = contract.sections.find(section => section.id === 'learned');
  const changed = contract.sections.find(section => section.id === 'changed');
  const adapt = contract.options.find(option => option.kind === 'adapt_week');

  assert.equal(contract.tone, 'attention');
  assert.equal(contract.primaryOption, 'adapt_week');
  assert.match(learned?.body ?? '', /Frische Wochen-Evidenz aus Zielrisiko/);
  assert.doesNotMatch(learned?.body ?? '', /Reopen-Quellentrend/);
  assert.doesNotMatch(learned?.body ?? '', /Recovery|Garmin-Ausfuehrung/);
  assert.match(changed?.body ?? '', /Zielrisiko/);
  assert.match(adapt?.weekImpact ?? '', /Zielrisiko/);
  assert.match(adapt?.weekImpact ?? '', /Szenario-Vorschau/);
  assert.equal(adapt?.targetPath, '#plan-scenario-preview');
  assert.equal(adapt?.readOnly, true);
});

test('weekly decision turns repeated reopen-source trends into weekly Plan context', () => {
  const contract = buildPlanWeeklyDecisionContract({
    today: '2026-05-12',
    workouts: [workout({ id: 'reopen-source-trend-weekly', executionStatus: 'garmin_scheduled' })],
    adaptationEvents: [],
    refreshPreview: null,
    currentLoad: stableLoad,
    goalProjection: { ...goalProjection, projections: [] },
    personalResponse: null,
    decisionQuality: decisionQuality({
      qualityScore: 28,
      status: 'needs_strategy_change',
      statusLabel: 'Tageskonflikt mit neuer Wochenwirkung',
      repeatedThemes: [{
        theme: 'Tageskonflikt: Koerper, Ziel und Alltag',
        count: 5,
        lastSeen: '2026-05-12',
        status: 'stale',
        evidence: [
          'Wochenentscheidung gemerkt: Beibehalten trotz Tageskonflikt',
          'Neue Evidenz seit gemerkter Wochenentscheidung: 2x Planlast nach verschobener Einheit zu hoch',
          'Frische Wochen-Evidenz: 2x Garmin-Ausfuehrung nach leichter Option abgebrochen',
        ],
      }],
      bestEvidence: [
        'Wiederholter Reopen-Grund: Planlast 2x zu hoch',
        'Wiederholter Reopen-Grund: Garmin-Ausfuehrung 2x abgebrochen',
      ],
      suggestedAdjustment: 'Wochenentscheidung aus Quellentrend oeffnen: Planlast kleiner vorschauen, bevor Garmin synchronisiert wird.',
    }),
    fuelingOutcomeBaseline: null,
    review: null,
  });

  const learned = contract.sections.find(section => section.id === 'learned');
  const changed = contract.sections.find(section => section.id === 'changed');
  const adapt = contract.options.find(option => option.kind === 'adapt_week');
  const receipt = buildPlanWeeklyDecisionReceipt(contract, 'adapt_week', '2026-05-12T07:35:00.000Z');

  assert.equal(contract.tone, 'attention');
  assert.equal(contract.title, 'Wochenentscheidung offen');
  assert.equal(contract.primaryOption, 'adapt_week');
  assert.match(learned?.title ?? '', /Reopen-Quellentrend/);
  assert.match(learned?.body ?? '', /Reopen-Quellentrend: Planlast 2x.*Garmin-Ausfuehrung 2x/);
  assert.match(learned?.body ?? '', /Data hat die wiederholten Quellen gebuendelt/);
  assert.match(learned?.body ?? '', /Aeltere Receipt-Evidenz bleibt Kontext/);
  assert.doesNotMatch(learned?.body ?? '', /Neue Evidenz seit gemerkter Wochenentscheidung/);
  assert.match(changed?.body ?? '', /Reopen-Quellentrend: Planlast 2x.*Garmin-Ausfuehrung 2x/);
  assert.match(adapt?.weekImpact ?? '', /Reopen-Quellentrend: Planlast 2x.*Garmin-Ausfuehrung 2x/);
  assert.match(adapt?.weekImpact ?? '', /Szenario-Vorschau/);
  assert.equal(adapt?.targetPath, '#plan-scenario-preview');
  assert.equal(adapt?.readOnly, true);
  assert.match(contract.evidence.join(' · '), /Reopen-Trend Planlast 2x/);
  assert.match(contract.evidence.join(' · '), /Reopen-Trend Garmin-Ausfuehrung 2x/);
  assert.match(receipt.nextConsequence, /Tradeoff-Evidenz/);
  assert.match(receipt.mutationBoundary, /Keine Plan- oder Garmin-Aenderung gespeichert/);
});

test('weekly decision keeps reopen-source trends as watch context until they create weekly action', () => {
  const contract = buildPlanWeeklyDecisionContract({
    today: '2026-05-12',
    workouts: [workout({ id: 'reopen-source-trend-watch', executionStatus: 'garmin_scheduled' })],
    adaptationEvents: [],
    refreshPreview: null,
    currentLoad: stableLoad,
    goalProjection: { ...goalProjection, projections: [] },
    personalResponse: null,
    decisionQuality: decisionQuality({
      qualityScore: 62,
      status: 'watch',
      statusLabel: 'Tageskonflikt mit neuer Evidenz beobachten',
      repeatedThemes: [{
        theme: 'Tageskonflikt: Koerper, Ziel und Alltag',
        count: 4,
        lastSeen: '2026-05-12',
        status: 'watch',
        evidence: [
          'Tageskonflikt bereits in Plan eingeordnet',
          'Neue Evidenz seit gemerkter Wochenentscheidung: 2x Recovery nach harter Einheit niedrig',
        ],
      }],
      bestEvidence: [
        'Wiederholter Reopen-Grund: Recovery 2x mit niedrigem HRV und schlechtem Schlaf',
      ],
      suggestedAdjustment: 'Recovery-Quellentrend beobachten, aber erst bei Wochenwirkung die Planvorschau oeffnen.',
    }),
    fuelingOutcomeBaseline: null,
    review: null,
  });

  const learned = contract.sections.find(section => section.id === 'learned');
  const changed = contract.sections.find(section => section.id === 'changed');
  const adapt = contract.options.find(option => option.kind === 'adapt_week');

  assert.equal(contract.tone, 'ok');
  assert.equal(contract.title, 'Woche aktuell stabil');
  assert.equal(contract.primaryOption, 'accept_current');
  assert.match(learned?.title ?? '', /Reopen-Quellentrend.*Watch-Kontext/);
  assert.match(learned?.body ?? '', /Reopen-Quellentrend: Recovery 2x/);
  assert.match(learned?.body ?? '', /noch keine Wochenaenderung/);
  assert.match(changed?.body ?? '', /Keine offene Planaenderung/);
  assert.doesNotMatch(adapt?.weekImpact ?? '', /Reopen-Quellentrend|Recovery 2x/);
  assert.match(contract.evidence.join(' · '), /Reopen-Trend Recovery 2x/);
  assert.match(contract.evidence.join(' · '), /Tageskonflikt Watch-Kontext/);
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
  assert.doesNotMatch(contract.sections.find(section => section.id === 'risk')?.body ?? '', /70\.3 Kraichgau/);
  assert.match(contract.evidence.join(' · '), /Ziel-Limiter beobachten: 70\.3 Kraichgau 64%/);
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
