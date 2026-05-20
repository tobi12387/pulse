import assert from 'node:assert/strict';
import test from 'node:test';

import type {
  PulseActivity,
  PulseDailyDecisionQualityResponse,
  PulseDailyDeltaItem,
  PulseFuelingOutcomeBaseline,
  PulseGoalProjectionResponse,
  PulseHomeScreenData,
  PulsePersonalResponseResponse,
  PulsePlannedWorkout,
  PulseTodayOptionsResponse,
  PulseTrainingAnalyticsResponse,
} from '../shared/types/pulse/index.ts';
import { deriveDailyDecision, type DailyDecision } from '../frontend/src/pulse/daily-decision.ts';

const TODAY = '2026-05-01';

type HomeRecovery = NonNullable<PulseHomeScreenData['recovery']>;

function recovery(overrides: Partial<HomeRecovery> = {}): HomeRecovery {
  return {
    sleepDebt7d: { hours: 1.2, targetH: 7.5, baselineSource: 'fixed_default', status: 'ok' },
    hrvDeviation7d: { pct: 2, recentMs: 51, baselineMs: 50, status: 'stable' },
    rhrDrift7d: { bpmAboveBaseline: 1, recent: 49, baseline: 48, status: 'normal' },
    recoveryScore: 78,
    recommendation: 'Normale Belastung ist vertretbar.',
    ...overrides,
  };
}

function home(overrides: Partial<PulseHomeScreenData> = {}): PulseHomeScreenData {
  return {
    date: TODAY,
    readiness: {
      score: 78,
      label: 'gut',
      shortLabel: 'gut',
      color: 'green',
      components: {
        sleep: 80,
        hrv: 74,
        tsb: 76,
        battery: 72,
        mental: 82,
        stress: 78,
      },
    },
    todayMetrics: null,
    fitnessLoad: {
      date: TODAY,
      ctl: 42.4,
      atl: 48.1,
      tsb: -5.7,
    },
    todayWorkout: null,
    todayActivities: [],
    recentActivities: [],
    nextWorkout: null,
    prognosis: {
      alert: false,
      message: 'Stabiler Trainingstag.',
      horizon_days: 3,
      factors: ['HRV stabil', 'Schlaf solide'],
    },
    streaks: {
      checkinStreakDays: 4,
      workoutStreakDays: 2,
    },
    recovery: recovery(),
    dataStatus: {
      userReady: true,
      profileReady: true,
      garmin: {
        status: 'ready',
        lastMetricDate: TODAY,
        lastMetricSyncAt: `${TODAY}T05:00:00.000Z`,
        lastActivityAt: `${TODAY}T06:00:00.000Z`,
        metricsDays14: 14,
        activitiesDays14: 5,
        issues: [],
      },
    },
    nextBestActions: [],
    ...overrides,
  };
}

function activity(overrides: Partial<PulseActivity> = {}): PulseActivity {
  return {
    id: 'activity-1',
    userId: 'user-1',
    externalId: 'garmin-activity-1',
    source: 'garmin',
    startTime: `${TODAY}T08:00:00.000Z`,
    activityType: 'bike',
    name: 'Rennrad Tour',
    durationSec: 60 * 60,
    distanceM: 28000,
    avgHr: 136,
    maxHr: 162,
    avgPowerW: 172,
    normalizedPowerW: 184,
    tss: 55,
    calories: 720,
    elevationGainM: 220,
    trainingEffectAerobic: 2.8,
    trainingEffectAnaerobic: 0.1,
    vo2maxEstimate: null,
    rpe: null,
    rpeNote: null,
    sorenessAreas: null,
    feedbackLoggedAt: null,
    plannedWorkoutId: 'planned-1',
    ...overrides,
  };
}

function workout(overrides: Partial<PulsePlannedWorkout> = {}): PulsePlannedWorkout {
  return {
    id: 'planned-1',
    userId: 'user-1',
    plannedDate: TODAY,
    activityType: 'bike',
    zone: 2,
    durationMin: 60,
    distanceKm: null,
    targetTss: 55,
    archetypeId: 'endurance_steady',
    difficultyLevel: 3.1,
    difficultyEnergySystem: 'endurance',
    capabilityFit: 'productive',
    description: 'Ruhige Ausdauer.',
    steps: null,
    garminWorkoutId: 'garmin-workout-1',
    garminScheduledId: 'garmin-scheduled-1',
    garminSyncContract: null,
    status: 'planned',
    workoutFeedback: null,
    complianceScore: null,
    origin: 'generated',
    userLocked: false,
    completedActivityId: null,
    executionStatus: 'garmin_scheduled',
    executionMatchedAt: null,
    executionMatchConfidence: null,
    executionNotes: null,
    ...overrides,
  };
}

function fuelingBaseline(activityId: string): PulseFuelingOutcomeBaseline {
  return {
    status: 'insufficient_data',
    label: 'Fueling-Baseline offen',
    summary: 'Noch kein langer Fueling-Log mit Dauer, Carbs und Vertraeglichkeit als Baseline.',
    latestLogDate: null,
    observedCarbsPerHour: null,
    targetCarbsPerHour: null,
    bottles750Ml: null,
    powderG: null,
    fluidMlPerHour: null,
    sodiumMgPerHour: null,
    evidence: ['Lange Einheiten nachtraeglich mit Carbs, Flaschen, Pulver und GI-Komfort loggen.'],
    learningReadiness: {
      comparableCompleteLogs: 1,
      requiredComparableCompleteLogs: 3,
      readyForTrendSummary: false,
      missingEvidence: [
        'Noch zwei vergleichbare During-Logs mit Dauer, Carbs und GI-Komfort fehlen.',
        'GI-Komfort fehlt strukturiert fuer mindestens einen langen During-Log.',
      ],
      nextAction: {
        kind: 'complete_gi_comfort',
        label: 'GI-Komfort ergänzen',
        detail: 'GI-Komfort am vorhandenen langen During-Log ergänzen, damit der vorhandene Carb-Log fuer die Fueling-Baseline zählt.',
        activityId,
      },
    },
  };
}

function goalProjection(): PulseGoalProjectionResponse {
  return {
    generatedAt: `${TODAY}T08:00:00.000Z`,
    horizonDays: 180,
    headline: '70.3 Kraichgau braucht Fueling-Praxis.',
    projections: [{
      goalId: 'goal-703',
      title: '70.3 Kraichgau',
      category: 'race',
      targetDate: '2026-06-14',
      daysUntil: 44,
      probabilityPct: 48,
      status: 'at_risk',
      confidence: 'medium',
      summary: 'Long-Endurance und Fueling sind noch nicht belastbar genug.',
      limiterRisk: {
        status: 'blocked',
        label: 'Fueling-Limiter',
        summary: 'GI- und During-Logs fehlen fuer lange Einheiten.',
        evidence: ['1/3 vergleichbare Logs'],
      },
      nextBestIntervention: {
        kind: 'fueling_practice',
        title: 'Fueling-Praxis absichern',
        summary: 'Die naechste lange Einheit sollte kontrolliert Fueling und GI-Vertraeglichkeit schliessen.',
        actionLabel: 'Plan prüfen',
        targetPath: '/plan?tab=training#goal-projection',
        evidence: ['Long-Endurance-Level 3.1', '1 kontrollierter During-Log'],
      },
      evidence: ['Ziel in 44 Tagen'],
      missingEvidence: ['Fueling-Vertraeglichkeit offen'],
    }],
    missingEvidence: [],
  };
}

function plannedTodayOptions(workoutId = 'planned-1'): PulseTodayOptionsResponse {
  return {
    date: TODAY,
    state: 'planned_workout',
    summary: 'Heute ist Training geplant; Pulse zeigt Plan und alltagstaugliche Ausweichoption.',
    signature: `${TODAY}|planned-workout|tradeoff`,
    options: [
      {
        id: 'planned-default',
        kind: 'workout',
        priority: 'primary',
        title: 'Plan ausführen',
        detail: '75 min Z4. Nur sinnvoll, wenn Warm-up und Tagesfenster passen.',
        cta: 'Workout öffnen',
        targetPath: '/plan?tab=training',
        evidence: ['Zielreiz geplant'],
        activityType: 'bike',
        zone: 4,
        durationMin: 75,
        archetypeId: 'threshold_build',
        capabilityFit: 'too_hard_today',
        signalLabels: [{
          kind: 'fit_too_hard_today',
          label: 'Zu hart heute',
          detail: 'Warm-up und Recovery muessen die Freigabe liefern',
          tone: 'rose',
        }],
      },
      {
        id: 'planned-easier',
        kind: 'workout',
        priority: 'secondary',
        title: '45 min Z2 statt Schwelle',
        detail: 'Erhaelt Routine und Zielkontakt, ohne den Tag zu ueberziehen.',
        cta: 'Alternative prüfen',
        targetPath: `/plan?tab=training&source=today-change&intent=easier&workoutId=${workoutId}#next-training-decision`,
        evidence: ['Schlafdefizit', 'Alltagsfenster kleiner'],
        activityType: 'bike',
        zone: 2,
        durationMin: 45,
        archetypeId: 'recovery_spin',
        capabilityFit: 'maintenance',
        signalLabels: [{
          kind: 'fit_maintenance',
          label: 'Machbar',
          detail: 'Erhaltung statt Progression',
          tone: 'green',
        }],
      },
    ],
  };
}

function decisionQuality() {
  return {
    range: { from: '2026-04-18', to: TODAY, days: 14 },
    qualityScore: 42,
    status: 'stale' as const,
    statusLabel: 'Wiederholung prüfen',
    repeatedThemes: [{
      theme: 'Mobilität 10 Minuten',
      count: 3,
      lastSeen: TODAY,
      status: 'stale' as const,
      evidence: ['3x wiederholt ohne Abschluss-/Outcome-Evidenz'],
    }],
    bestEvidence: ['Mobilität 10 Minuten: 3x wiederholt ohne Abschluss-/Outcome-Evidenz'],
    evidence: [],
    suggestedAdjustment: 'Wiederkehrende Empfehlung kleiner, anders getaktet oder vorerst unterdrückt anbieten.',
  };
}

function strongDecisionQuality(overrides: Partial<PulseDailyDecisionQualityResponse> = {}): PulseDailyDecisionQualityResponse {
  return {
    range: { from: '2026-04-18', to: TODAY, days: 14 },
    qualityScore: 34,
    status: 'needs_strategy_change',
    statusLabel: 'Strategie ändern',
    repeatedThemes: [{
      theme: 'Zu spaet intensive Optionen gewählt',
      count: 3,
      lastSeen: TODAY,
      status: 'stale',
      evidence: ['3x harte Alternative nach schlechtem Warm-up gewaehlt'],
    }],
    bestEvidence: ['3x harte Alternative nach schlechtem Warm-up gewaehlt'],
    evidence: [],
    suggestedAdjustment: 'Heute zuerst kleinere Option festlegen und Intensität erst nach Warm-up freigeben.',
    ...overrides,
  };
}

function tradeoffDecisionQuality(overrides: Partial<PulseDailyDecisionQualityResponse> = {}): PulseDailyDecisionQualityResponse {
  return strongDecisionQuality({
    qualityScore: 76,
    status: 'helpful',
    statusLabel: 'Tageskonflikt hilfreich',
    repeatedThemes: [{
      theme: 'Tageskonflikt: Koerper, Ziel und Alltag',
      count: 2,
      lastSeen: TODAY,
      status: 'useful_repetition',
      evidence: ['2x leichtere Option hat Folgetag-RPE gesenkt'],
    }],
    bestEvidence: ['2x leichtere Option hat Folgetag-RPE gesenkt'],
    evidence: [],
    suggestedAdjustment: 'Heute zuerst die leichtere Option bestaetigen, wenn Schlaf und Alltag eng sind.',
    ...overrides,
  });
}

function personalResponse(): PulsePersonalResponseResponse {
  return {
    summary: {
      generatedAt: `${TODAY}T00:00:00.000Z`,
      range: { from: '2026-03-20', to: TODAY, days: 42 },
      strength: 'useful',
      headline: 'Mentale Belastung veraendert deine Trainingsantwort sichtbar.',
      signals: [{
        kind: 'mental_response',
        label: 'Mentale Last begrenzt Ausführung',
        strength: 'useful',
        summary: 'Niedrige Energie oder hoher Stress kippen geplante Einheiten haeufig in kleinere Ausfuehrung.',
        evidence: ['5 Check-ins mit Energie <=4 oder Stress >=7', '3 bestaetigte kleinere Ausfuehrungen'],
        nextAdjustment: 'Heute zuerst Boundary setzen und die Einheit bewusst klein halten.',
      }],
      missingEvidence: [],
    },
  };
}

function trainingAnalyticsWithDurability(): PulseTrainingAnalyticsResponse {
  return {
    weeks: 6,
    tssHeatmap: [],
    zoneDistribution: [],
    vo2maxTrend: [],
    rpeByZone: { totalRated: 0, zones: [] },
    capabilitySummary: {
      generatedAt: `${TODAY}T06:00:00.000Z`,
      lookbackDays: 42,
      levels: [],
      signals: [],
      recommendations: [],
      fitLegend: {
        recovery: 'Recovery',
        maintenance: 'Maintenance',
        productive: 'Productive',
        stretch: 'Stretch',
        too_hard_today: 'Too hard today',
      },
    },
    powerDataQuality: {
      source: 'stream',
      status: 'trusted',
      coveragePct: 98,
      spikeCount: 0,
      limitations: [],
      updatedAt: `${TODAY}T06:00:00.000Z`,
    },
    powerDuration: {
      bestEfforts: [],
      durability: {
        rating: 'limited',
        powerDropPct: -21,
        hrDriftBpm: 3,
        evidence: ['Power -21%', 'HR +3 bpm', '240 min'],
        activityId: 'activity-durability',
        activityDate: TODAY,
        qualitySource: 'stream',
        qualityStatus: 'trusted',
      },
      bestEffortLine: '20 min 215 W',
      durabilityLine: 'Durability limited: Power -21% · HR +3 bpm · 240 min',
      updatedAt: `${TODAY}T06:00:00.000Z`,
    },
  };
}

function dailyDelta(overrides: Partial<PulseDailyDeltaItem> = {}): PulseDailyDeltaItem {
  return {
    date: TODAY,
    status: 'matched',
    title: 'Plan und Ausführung passen zusammen',
    summary: 'Die echte Belastung lag nah am Plan.',
    score: 88,
    loadDeltaTss: 4,
    recoveryDelta: null,
    nextPlanEffect: 'Plan kann diesen Reiz als erledigt behandeln und die nächste Empfehlung darauf aufbauen.',
    evidence: ['Geplant: Rad Z2 60 min', 'Garmin: Rad 62 min'],
    targetPath: '/plan/activity/activity-1',
    ...overrides,
  };
}

function decisionFor(data: PulseHomeScreenData, context: Parameters<typeof deriveDailyDecision>[1] = {}): DailyDecision {
  const decision = deriveDailyDecision(data, context);
  assert.ok(decision);
  return decision;
}

function assertSignalBefore(decision: DailyDecision, first: string, second: string) {
  const labels = decision.contract.signals.map(signal => signal.label);
  const firstIndex = labels.indexOf(first);
  const secondIndex = labels.indexOf(second);
  assert.notEqual(firstIndex, -1, `${first} should be present in ${labels.join(', ')}`);
  assert.notEqual(secondIndex, -1, `${second} should be present in ${labels.join(', ')}`);
  assert.ok(firstIndex < secondIndex, `${first} should come before ${second}: ${labels.join(', ')}`);
}

test('completed planned workouts route missing feedback before the day can close', () => {
  const completed = activity({ id: 'activity-feedback-open', plannedWorkoutId: 'planned-feedback-open' });
  const planned = workout({
    id: 'planned-feedback-open',
    status: 'completed',
    completedActivityId: completed.id,
    executionStatus: 'completed_matched',
    executionMatchedAt: `${TODAY}T09:05:00.000Z`,
    executionMatchConfidence: 0.95,
  });

  const decision = decisionFor(home({
    todayWorkout: planned,
    todayActivities: [completed],
    recentActivities: [completed],
  }));

  assert.equal(decision.cta, 'Feedback erfassen');
  assert.equal(decision.targetPath, '/plan/activity/activity-feedback-open');
  assert.match(decision.resultPreview ?? '', /Feedback verbessert die nächste Planentscheidung/);
  assert.match(decision.contract.leadingFactor, /^Feedback: RPE fehlt/);
  assert.match(decision.contract.safestAlternative, /Feedback zuerst erfassen/);
  assert.match(decision.contract.goalImpact, /Feedback macht die naechste Planung genauer/);
  assert.match(decision.contract.garminExecution, /geplante Einheit erledigt/);
  assert.equal(decision.steps?.find(step => step.status === 'open')?.label, 'Feedback erfassen');
});

test('completed long workouts close fueling learning before generic feedback', () => {
  const completed = activity({
    id: 'activity-post-fueling',
    durationSec: 3 * 3600,
    distanceM: 78000,
    tss: 168,
    plannedWorkoutId: 'planned-post-fueling',
  });
  const planned = workout({
    id: 'planned-post-fueling',
    status: 'completed',
    durationMin: 180,
    targetTss: 155,
    archetypeId: 'long_endurance_fueling_practice',
    difficultyEnergySystem: 'long_endurance',
    description: 'Lange Ausfahrt mit bewusstem Fueling als Lernziel.',
    completedActivityId: completed.id,
    executionStatus: 'completed_matched',
    executionMatchedAt: `${TODAY}T12:05:00.000Z`,
    executionMatchConfidence: 0.94,
  });

  const decision = decisionFor(home({
    todayWorkout: planned,
    todayActivities: [completed],
    recentActivities: [completed],
  }), {
    fuelingOutcomeBaseline: fuelingBaseline(completed.id),
  });

  assert.equal(decision.cta, 'GI-Komfort ergänzen');
  assert.equal(decision.targetPath, '/plan/activity/activity-post-fueling#activity-fueling-log');
  assert.match(decision.resultPreview ?? '', /Fueling-Log/);
  assert.match(decision.contract.leadingFactor, /^Fueling-Lernen:/);
  assert.match(decision.contract.safestAlternative, /Fueling-Evidence zuerst schließen: GI-Komfort ergänzen/);
  assert.match(decision.contract.safestAlternative, /Feedback danach kurz erfassen/);
  assertSignalBefore(decision, 'Fueling-Lernen', 'Feedback');
});

test('durability watch context does not steal the leading factor from fueling learning', () => {
  const planned = workout({
    id: 'planned-fueling-before-analysis',
    durationMin: 150,
    archetypeId: 'long_endurance_fueling_practice',
    difficultyEnergySystem: 'long_endurance',
    description: 'Lange Ausfahrt mit bewusstem Fueling als Lernziel.',
  });

  const decision = decisionFor(home({ todayWorkout: planned }), {
    fuelingOutcomeBaseline: fuelingBaseline('activity-fueling-before-analysis'),
    trainingAnalytics: trainingAnalyticsWithDurability(),
  });

  assert.match(decision.contract.leadingFactor, /^Fueling-Lernen:/);
  assert.equal(decision.cta, 'Fueling vorbereiten');
  assert.match(decision.contract.safestAlternative, /Fueling-Lernlog vollständig erfassen/);
  assertSignalBefore(decision, 'Fueling-Lernen', 'Analyse');
});

test('durability watch context does not steal the leading factor from Garmin execution debt', () => {
  const planned = workout({
    id: 'planned-garmin-before-analysis',
    garminWorkoutId: null,
    garminScheduledId: null,
    executionStatus: 'local_planned',
  });

  const decision = decisionFor(home({ todayWorkout: planned }), {
    trainingAnalytics: trainingAnalyticsWithDurability(),
  });

  assert.match(decision.contract.leadingFactor, /^Garmin: Nur lokal geplant/);
  assert.equal(decision.cta, 'Garmin prüfen');
  assert.equal(decision.targetPath, '/plan?tab=execution&source=daily-garmin&workoutId=planned-garmin-before-analysis');
  assert.match(decision.contract.safestAlternative, /Garmin zuerst schließen/);
  assertSignalBefore(decision, 'Garmin', 'Analyse');
});

test('recovery pressure outranks a normal productive workout and owns the safe option', () => {
  const planned = workout({ id: 'planned-recovery-pressure' });
  const decision = decisionFor(home({
    todayWorkout: planned,
    recovery: recovery({
      sleepDebt7d: { hours: 3.2, targetH: 7.5, baselineSource: 'garmin_sleep_need', status: 'severe' },
      hrvDeviation7d: { pct: -9, recentMs: 42, baselineMs: 50, status: 'declining' },
      rhrDrift7d: { bpmAboveBaseline: 5, recent: 54, baseline: 49, status: 'elevated' },
      recoveryScore: 38,
      recommendation: 'Heute nur sehr locker bewegen.',
    }),
  }));

  assert.match(decision.contract.leadingFactor, /^Recovery:/);
  assert.equal(decision.cta, 'Recovery ansehen');
  assert.equal(decision.targetPath, '/data?tab=trends#data-recovery');
  assert.match(decision.resultPreview ?? '', /Plan und Garmin bleiben unverändert/);
  assert.match(decision.contract.safestAlternative, /Recovery schützen: Schlafdefizit schwer/);
  assert.match(decision.contract.goalImpact, /produktiver Trainingsreiz/);
  assertSignalBefore(decision, 'Recovery', 'Training');
});

test('load pressure opens the shared Plan weekly decision before raw data trace', () => {
  const decision = decisionFor(home({
    fitnessLoad: {
      date: TODAY,
      ctl: 42.4,
      atl: 58.8,
      tsb: -16.4,
    },
  }));

  assert.match(decision.contract.leadingFactor, /^Belastung: TSB -16\.4/);
  assert.equal(decision.cta, 'Belastung prüfen');
  assert.equal(decision.targetPath, '/plan?tab=training&source=home-load#plan-weekly-decision');
  assert.match(decision.resultPreview ?? '', /Planprüfung/);
  assert.equal(
    decision.contract.signals.find(signal => signal.label === 'Belastung')?.targetPath,
    '/plan?tab=training&source=home-load#plan-weekly-decision',
  );
});

test('at-risk goals can become the primary intervention when no stronger blocker exists', () => {
  const planned = workout({ id: 'planned-goal-risk' });
  const decision = decisionFor(home({ todayWorkout: planned }), {
    goalProjection: goalProjection(),
  });

  assert.match(decision.contract.leadingFactor, /^Ziel: 70\.3 Kraichgau: 48% · Fueling-Praxis absichern/);
  assert.equal(decision.cta, 'Plan prüfen');
  assert.equal(decision.targetPath, '/plan?tab=training#goal-projection');
  assert.match(decision.resultPreview ?? '', /Plan oder Garmin ändern sich erst nach einem bewussten Klick/);
  assert.match(decision.contract.safestAlternative, /Zielintervention: Fueling-Praxis absichern/);
  assert.match(decision.contract.goalImpact, /70\.3 Kraichgau: 48% · Fueling-Praxis absichern/);
  assertSignalBefore(decision, 'Ziel', 'Training');
});

test('daily decision names the body goal and everyday tradeoff before the safe action', () => {
  const planned = workout({
    id: 'planned-body-goal-day',
    zone: 4,
    durationMin: 75,
    targetTss: 96,
    capabilityFit: 'too_hard_today',
    archetypeId: 'threshold_build',
    difficultyEnergySystem: 'threshold',
    description: 'Schwellenreiz fuer das Ziel.',
  });
  const decision = decisionFor(home({
    todayWorkout: planned,
    recovery: recovery({
      sleepDebt7d: { hours: 2.4, targetH: 7.5, baselineSource: 'garmin_sleep_need', status: 'mild' },
      recoveryScore: 62,
      recommendation: 'Heute Grenze klein halten.',
    }),
  }), {
    goalProjection: goalProjection(),
    todayOptions: plannedTodayOptions(planned.id),
  });

  assert.match(decision.contract.leadingFactor, /^Tageskonflikt:/);
  assert.match(decision.contract.leadingFactor, /Koerper: Schlafdefizit: 2\.4 h/);
  assert.match(decision.contract.leadingFactor, /Ziel: 70\.3 Kraichgau: 48%/);
  assert.match(decision.contract.leadingFactor, /Alltag: 45 min Z2 statt Schwelle/);
  assert.equal(decision.cta, 'Alternative prüfen');
  assert.equal(decision.targetPath, '/plan?tab=training&source=today-change&intent=easier&workoutId=planned-body-goal-day#next-training-decision');
  assert.match(decision.resultPreview ?? '', /leichtere Tagesoption/);
  assert.match(decision.resultPreview ?? '', /Plan oder Garmin ändern sich erst nach einem bewussten Klick/);
  assert.match(decision.contract.safestAlternative, /Tageskonflikt zuerst lösen/);
  assert.match(decision.contract.safestAlternative, /Koerper: Schlafdefizit: 2\.4 h/);
  assert.match(decision.contract.safestAlternative, /Ziel: 70\.3 Kraichgau: 48%/);
  assert.match(decision.contract.safestAlternative, /Alltag: 45 min Z2 statt Schwelle/);
  assertSignalBefore(decision, 'Tageskonflikt', 'Training');
  assertSignalBefore(decision, 'Tageskonflikt', 'Ziel');
});

test('completed body goal everyday tradeoffs become a learnable closure step', () => {
  const completed = activity({
    id: 'activity-tradeoff-closure',
    plannedWorkoutId: 'planned-tradeoff-closure',
    durationSec: 45 * 60,
    distanceM: 21000,
    tss: 38,
    name: '45 min Z2 statt Schwelle',
  });
  const planned = workout({
    id: 'planned-tradeoff-closure',
    status: 'completed',
    zone: 4,
    durationMin: 75,
    targetTss: 96,
    capabilityFit: 'too_hard_today',
    archetypeId: 'threshold_build',
    difficultyEnergySystem: 'threshold',
    description: 'Schwellenreiz fuer das Ziel.',
    completedActivityId: completed.id,
    executionStatus: 'completed_matched',
    executionMatchedAt: `${TODAY}T08:55:00.000Z`,
    executionMatchConfidence: 0.92,
  });

  const decision = decisionFor(home({
    todayWorkout: planned,
    todayActivities: [completed],
    recentActivities: [completed],
    recovery: recovery({
      sleepDebt7d: { hours: 2.4, targetH: 7.5, baselineSource: 'garmin_sleep_need', status: 'mild' },
      recoveryScore: 62,
      recommendation: 'Heute Grenze klein halten.',
    }),
  }), {
    goalProjection: goalProjection(),
    todayOptions: plannedTodayOptions(planned.id),
    dailyDelta: dailyDelta({
      status: 'replaced',
      title: 'Schwelle wurde als 45 min Z2 geschlossen',
      summary: 'Die alltagstaugliche Alternative wurde statt des harten Reizes erledigt.',
      score: 72,
      loadDeltaTss: -58,
      nextPlanEffect: 'Plan kann den Zielkontakt halten, muss aber die naechste Intensitaet bewusst bestaetigen.',
      evidence: ['Geplant: Rad Z4 75 min', 'Garmin: Rad Z2 45 min'],
      targetPath: '/plan/activity/activity-tradeoff-closure',
    }),
  });

  assert.match(decision.contract.leadingFactor, /^Tageskonflikt: Abschluss lernbar/);
  assert.match(decision.contract.leadingFactor, /Schwelle wurde als 45 min Z2 geschlossen/);
  assert.match(decision.contract.leadingFactor, /Koerper: Schlafdefizit: 2\.4 h/);
  assert.equal(decision.cta, 'Feedback erfassen');
  assert.equal(decision.targetPath, '/plan/activity/activity-tradeoff-closure');
  assert.match(decision.resultPreview ?? '', /Tageskonflikt/);
  assert.match(decision.resultPreview ?? '', /nächste Empfehlung/);
  assert.match(decision.resultPreview ?? '', /Plan und Garmin bleiben unverändert/);
  assert.match(decision.contract.safestAlternative, /Tageskonflikt-Abschluss zuerst schließen/);
  assert.match(decision.contract.safestAlternative, /Feedback zuerst erfassen/);
  assert.match(decision.completionCriterion, /Tageskonflikt-Abschluss/);
  assert.ok(decision.evidence.some(item => typeof item !== 'string' && /Tageskonflikt lernbar/.test(item.label)));
  assertSignalBefore(decision, 'Tageskonflikt', 'Feedback');
  assertSignalBefore(decision, 'Tageskonflikt', 'Folge');
  assertSignalBefore(decision, 'Tageskonflikt', 'Ziel');
});

test('blocked Garmin execution beats normal training without creating a hidden write', () => {
  const planned = workout({
    id: 'planned-garmin-blocked',
    garminWorkoutId: null,
    garminScheduledId: null,
    executionStatus: 'local_planned',
    garminSyncContract: {
      version: 1,
      status: 'blocked',
      payloadReady: false,
      checkedAt: `${TODAY}T07:00:00.000Z`,
      summary: 'Repeat-Gruppen blockiert; Vorlage muss zuerst geprüft werden.',
      issues: [{
        code: 'repeat_iterations_invalid',
        severity: 'error',
        message: 'Repeat-Gruppe kann nicht sicher nach Garmin geschrieben werden.',
      }],
    },
  });

  const decision = decisionFor(home({ todayWorkout: planned }));

  assert.match(decision.contract.leadingFactor, /^Garmin: Sync blockiert: Repeat-Gruppen blockiert/);
  assert.equal(decision.cta, 'Garmin prüfen');
  assert.equal(decision.targetPath, '/plan?tab=execution&source=daily-garmin&workoutId=planned-garmin-blocked');
  assert.match(decision.resultPreview ?? '', /Plan oder Garmin ändern sich erst nach einem bewussten Klick/);
  assert.match(decision.contract.safestAlternative, /Garmin zuerst schließen/);
  assert.match(decision.contract.garminExecution, /kein automatischer Geraete-Write/);
  assertSignalBefore(decision, 'Garmin', 'Training');
});

test('changed daily delta becomes the next Home follow-up before normal training', () => {
  const planned = workout({ id: 'planned-after-replaced-delta' });
  const decision = decisionFor(home({ todayWorkout: planned }), {
    dailyDelta: dailyDelta({
      status: 'replaced',
      title: 'Langer Lauf wurde durch lockere Ausfahrt ersetzt',
      summary: 'Der geplante Laufreiz fehlt, echte Belastung war niedriger.',
      score: 41,
      loadDeltaTss: -34,
      nextPlanEffect: 'Restwoche braucht einen kleineren Planabgleich, bevor neue Intensität bestätigt wird.',
      evidence: ['Geplant: Lauf Z3 70 min', 'Garmin: Rad Z1 45 min'],
      targetPath: '/plan/activity/activity-replaced-delta',
    }),
  });

  assert.match(decision.contract.leadingFactor, /^Folge: Geändert seit letzter Entscheidung: Langer Lauf wurde durch lockere Ausfahrt ersetzt/);
  assert.equal(decision.cta, 'Planfolge prüfen');
  assert.equal(decision.targetPath, '/plan/activity/activity-replaced-delta');
  assert.match(decision.resultPreview ?? '', /Plan-vs-Ausführung-Abgleich/);
  assert.match(decision.resultPreview ?? '', /Plan und Garmin bleiben unverändert/);
  assert.match(decision.contract.continuity, /Geändert: Langer Lauf wurde durch lockere Ausfahrt ersetzt/);
  assert.match(decision.contract.safestAlternative, /Planfolge zuerst prüfen/);
  assert.match(decision.contract.safestAlternative, /Restwoche braucht einen kleineren Planabgleich/);
  assert.match(decision.contract.safestAlternative, /bevor du neuen Zusatzumfang oder Ausführung bestätigst/);
  assert.equal(decision.steps?.find(step => step.status === 'open')?.label, 'Planfolge prüfen');
  assert.equal(decision.steps?.find(step => step.status === 'open')?.targetPath, '/plan/activity/activity-replaced-delta');
  assertSignalBefore(decision, 'Folge', 'Training');
});

test('decision quality result preview explains how the next check changes', () => {
  const decision = decisionFor(home(), {
    decisionQuality: strongDecisionQuality(),
  });

  assert.match(decision.contract.leadingFactor, /^Lernkalibrierung: Entscheidungsmuster ändern/);
  assert.doesNotMatch(decision.contract.leadingFactor, /Empfehlung darf lernen/);
  assert.equal(decision.cta, 'Kalibrierung prüfen');
  assert.equal(decision.targetPath, '/data?tab=analysis#data-decision-quality');
  assert.match(decision.resultPreview ?? '', /Lern-Evidenz als Tageshandlung/);
  assert.match(decision.resultPreview ?? '', /keine neue Empfehlung ohne deinen nächsten expliziten Schritt/);
  assert.match(decision.resultPreview ?? '', /Plan und Garmin bleiben unverändert/);
  assert.match(decision.contract.safestAlternative, /Lernkalibrierung zuerst prüfen: kleinere Option zuerst festlegen/);
  assert.doesNotMatch(decision.contract.safestAlternative, /Watch-Kontext bleibt/);
});

test('helpful learning calibration stays short in the Home daily answer', () => {
  const decision = decisionFor(home(), {
    decisionQuality: strongDecisionQuality({
      qualityScore: 82,
      status: 'helpful',
      statusLabel: 'Hilfreich',
      bestEvidence: ['3x gute Entscheidung bestätigt'],
      suggestedAdjustment: 'Diesen Entscheidungstyp beibehalten und weiter mit aktueller Evidenz begründen.',
    }),
  });

  assert.match(decision.contract.leadingFactor, /^Lernkalibrierung: Entscheidungsmuster bestätigt/);
  assert.doesNotMatch(decision.contract.leadingFactor, /Empfehlung darf lernen/);
  assert.ok(decision.contract.leadingFactor.length < 150);
  assert.match(decision.contract.safestAlternative, /Lernkalibrierung zuerst prüfen: bestätigte Entscheidungsmuster beibehalten/);
  assert.ok(decision.contract.safestAlternative.length < 190);
});

test('repeated tradeoff learning changes Home only when todays adaptive option exists', () => {
  const planned = workout({ id: 'planned-tradeoff-learning' });
  const decision = decisionFor(home({ todayWorkout: planned }), {
    decisionQuality: tradeoffDecisionQuality(),
    todayOptions: plannedTodayOptions(planned.id),
  });

  assert.match(decision.contract.leadingFactor, /^Tageskonflikt: Lernmuster/);
  assert.match(decision.contract.leadingFactor, /2x Tageskonflikt/);
  assert.equal(decision.cta, 'Alternative prüfen');
  assert.equal(decision.targetPath, '/plan?tab=training&source=today-change&intent=easier&workoutId=planned-tradeoff-learning#next-training-decision');
  assert.match(decision.resultPreview ?? '', /leichtere Tagesoption/);
  assert.match(decision.resultPreview ?? '', /Plan oder Garmin ändern sich erst nach einem bewussten Klick/);
  assert.match(decision.contract.safestAlternative, /Tageskonflikt-Lernen heute nutzen/);
  assert.match(decision.contract.safestAlternative, /leichtere Option/);
  assertSignalBefore(decision, 'Tageskonflikt', 'Training');
});

test('plan-classified repeated tradeoff learning stays below current-day training in Home', () => {
  const planned = workout({ id: 'planned-tradeoff-plan-context' });
  const decision = decisionFor(home({ todayWorkout: planned }), {
    decisionQuality: tradeoffDecisionQuality({
      qualityScore: 34,
      status: 'needs_strategy_change',
      statusLabel: 'Tageskonflikt wiederholt',
      repeatedThemes: [{
        theme: 'Tageskonflikt: Koerper, Ziel und Alltag',
        count: 3,
        lastSeen: TODAY,
        status: 'stale',
        evidence: ['3x Tageskonflikt mit zu hartem Plan'],
      }],
      bestEvidence: ['3x Tageskonflikt mit zu hartem Plan'],
      suggestedAdjustment: 'Diese Woche Intensitaet erst nach Warm-up freigeben und leichtere Option vorab festlegen.',
    }),
    todayOptions: plannedTodayOptions(planned.id),
  });

  assert.match(decision.contract.leadingFactor, /^Training:/);
  assert.equal(decision.cta, 'Workout öffnen');
  assert.equal(decision.targetPath, '/plan?tab=training');
  const tradeoff = decision.contract.signals.find(signal => signal.label === 'Tageskonflikt');
  assert.ok(tradeoff);
  assert.equal(tradeoff.tone, 'muted');
  assert.equal(tradeoff.targetPath, '/plan?tab=training&source=home-tradeoff#plan-weekly-decision');
  assert.match(tradeoff.detail, /Wochenentscheidung/);
  assertSignalBefore(decision, 'Training', 'Tageskonflikt');
});

test('watch tradeoff learning stays quiet below current-day training in Home', () => {
  const planned = workout({ id: 'planned-tradeoff-watch-context' });
  const decision = decisionFor(home({ todayWorkout: planned }), {
    decisionQuality: tradeoffDecisionQuality({
      qualityScore: 52,
      status: 'watch',
      statusLabel: 'Tageskonflikt noch unsicher',
      repeatedThemes: [{
        theme: 'Tageskonflikt: Koerper, Ziel und Alltag',
        count: 2,
        lastSeen: TODAY,
        status: 'watch',
        evidence: ['2x Tageskonflikt, aber Feedback nur einmal geschlossen'],
      }],
      bestEvidence: ['2x Tageskonflikt, aber Feedback nur einmal geschlossen'],
      suggestedAdjustment: 'Noch ein abgeschlossenes Feedback fehlt, bevor Heute anders entscheidet.',
    }),
    todayOptions: plannedTodayOptions(planned.id),
  });

  assert.match(decision.contract.leadingFactor, /^Training:/);
  assert.equal(decision.cta, 'Workout öffnen');
  assert.equal(decision.targetPath, '/plan?tab=training');
  const tradeoff = decision.contract.signals.find(signal => signal.label === 'Tageskonflikt');
  assert.ok(tradeoff);
  assert.equal(tradeoff.tone, 'muted');
  assert.equal(tradeoff.targetPath, '/data?tab=analysis#data-decision-quality');
  assert.match(tradeoff.detail, /Watch-Kontext/);
  assert.match(tradeoff.detail, /Feedback fehlt/);
  assertSignalBefore(decision, 'Training', 'Tageskonflikt');
});

test('resolved tradeoff learning stays continuity only in Home', () => {
  const planned = workout({ id: 'planned-resolved-tradeoff-learning' });
  const decision = decisionFor(home({ todayWorkout: planned }), {
    decisionQuality: tradeoffDecisionQuality({
      qualityScore: 79,
      status: 'helpful',
      statusLabel: 'Tageskonflikt bereits eingeordnet',
      repeatedThemes: [{
        theme: 'Tageskonflikt: Koerper, Ziel und Alltag',
        count: 3,
        lastSeen: TODAY,
        status: 'useful_repetition',
        evidence: [
          'Wochenentscheidung gemerkt: Beibehalten trotz Tageskonflikt',
          'Tradeoff bereits in Plan eingeordnet',
        ],
      }],
      bestEvidence: ['Tageskonflikt bereits in Plan eingeordnet und als Beibehalten gemerkt'],
      suggestedAdjustment: 'Bereits gehandhabt: ruhig lassen, bis frische Evidenz Heute oder Plan erneut veraendert.',
    }),
    todayOptions: plannedTodayOptions(planned.id),
  });

  assert.match(decision.contract.leadingFactor, /^Training:/);
  assert.equal(decision.cta, 'Workout öffnen');
  assert.equal(decision.targetPath, '/plan?tab=training');
  assert.equal(decision.contract.signals.find(signal => signal.label === 'Tageskonflikt'), undefined);
  assert.equal(decision.contract.signals.find(signal => signal.label === 'Lernkalibrierung'), undefined);
  assert.match(decision.contract.continuity, /Geloester Tageskonflikt bleibt ruhig/);
  assert.doesNotMatch(decision.contract.safestAlternative, /Tageskonflikt-Lernen|Lernkalibrierung/);
  const tradeoffEvidence = decision.evidence.find(item => (
    typeof item !== 'string'
    && /Geloester Tageskonflikt/.test(item.label)
  ));
  assert.ok(tradeoffEvidence);
  assert.equal(typeof tradeoffEvidence !== 'string' ? tradeoffEvidence.targetPath : null, '/data?tab=analysis#data-decision-quality');
});

test('handled reopen-source trend stays quiet continuity in Home', () => {
  const planned = workout({ id: 'planned-handled-reopen-source-trend' });
  const decision = decisionFor(home({ todayWorkout: planned }), {
    decisionQuality: tradeoffDecisionQuality({
      qualityScore: 74,
      status: 'helpful',
      statusLabel: 'Reopen-Quellentrend bereits in Wochenentscheidung eingeordnet',
      repeatedThemes: [{
        theme: 'Tageskonflikt: Koerper, Ziel und Alltag',
        count: 5,
        lastSeen: TODAY,
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
      suggestedAdjustment: 'Bereits gehandhabt: Quellentrend als Kontinuitaet behalten, bis frische Heute- oder Wochen-Evidenz erneut wirkt.',
    }),
    todayOptions: plannedTodayOptions(planned.id),
  });

  assert.match(decision.contract.leadingFactor, /^Training:/);
  assert.doesNotMatch(decision.contract.leadingFactor, /Reopen-Quellentrend|Planlast 2x|Garmin-Ausfuehrung 2x/);
  assert.equal(decision.cta, 'Workout öffnen');
  assert.equal(decision.targetPath, '/plan?tab=training');
  assert.equal(decision.contract.signals.find(signal => signal.label === 'Tageskonflikt'), undefined);
  assert.match(decision.contract.continuity, /Wochenreceipt-Lernvertrauen bestaetigt/);
  assert.match(decision.contract.continuity, /Planlast 2x/);
  assert.match(decision.contract.continuity, /Garmin-Ausfuehrung 2x/);
  assert.match(decision.contract.continuity, /Plan-Receipt: Reopen-Quellentrend Planlast 2x und Garmin-Ausfuehrung 2x handled/);
  assert.match(decision.contract.continuity, /Wochenreceipt-Vertrauensdauer: 14 Tage/);
  assert.match(decision.contract.continuity, /Folgewirkung bestaetigt: 14 Tage ohne erneute Reopen-Quelle/);
  assert.match(decision.contract.continuity, /Wochenreceipt-Erneuerungscheck/);
  assert.match(decision.contract.continuity, /keine erneute Reopen-Quelle/);
  assert.doesNotMatch(decision.contract.leadingFactor, /Wochenreceipt|Lernvertrauen|Vertrauensdauer|Erneuerungscheck|Plan-Receipt/);
  assert.doesNotMatch(decision.contract.safestAlternative, /Reopen-Quellentrend|Planlast 2x|Garmin-Ausfuehrung 2x|Tageskonflikt-Lernen|Wochenreceipt|Lernvertrauen|Vertrauensdauer|Erneuerungscheck|Plan-Receipt/);
  const tradeoffEvidence = decision.evidence.find(item => (
    typeof item !== 'string'
    && /Wochenreceipt-Erneuerungscheck/.test(item.label)
  ));
  assert.ok(tradeoffEvidence);
  assert.match(typeof tradeoffEvidence !== 'string' ? tradeoffEvidence.label : '', /Planlast 2x.*Garmin-Ausfuehrung 2x/);
  assert.doesNotMatch(typeof tradeoffEvidence !== 'string' ? tradeoffEvidence.label : '', /Wochenentscheidung gemerkt/);
  assert.equal(typeof tradeoffEvidence !== 'string' ? tradeoffEvidence.targetPath : null, '/data?tab=analysis#data-decision-quality');
});

test('unrefreshed weekly receipt trust stays quiet continuity in Home', () => {
  const planned = workout({ id: 'planned-unrefreshed-receipt-trust' });
  const decision = decisionFor(home({ todayWorkout: planned }), {
    decisionQuality: tradeoffDecisionQuality({
      qualityScore: 68,
      status: 'helpful',
      statusLabel: 'Reopen-Quellentrend bereits in Wochenentscheidung eingeordnet',
      repeatedThemes: [{
        theme: 'Tageskonflikt: Koerper, Ziel und Alltag',
        count: 4,
        lastSeen: TODAY,
        status: 'useful_repetition',
        evidence: [
          'Wochenentscheidung gemerkt: Beibehalten wegen Reopen-Quellentrend Recovery 2x',
          'Reopen-Quellentrend Recovery 2x bereits in Plan eingeordnet',
        ],
      }],
      bestEvidence: [
        'Plan-Receipt: Reopen-Quellentrend Recovery 2x handled',
      ],
      suggestedAdjustment: 'Bereits gehandhabt: Quellentrend beobachten, bis frische Heute- oder Wochen-Evidenz erneut wirkt.',
    }),
    todayOptions: plannedTodayOptions(planned.id),
  });

  assert.match(decision.contract.leadingFactor, /^Training:/);
  assert.equal(decision.cta, 'Workout öffnen');
  assert.equal(decision.targetPath, '/plan?tab=training');
  assert.equal(decision.contract.signals.find(signal => signal.label === 'Tageskonflikt'), undefined);
  assert.match(decision.contract.continuity, /Wochenreceipt-Lernvertrauen unaufgefrischt/);
  assert.match(decision.contract.continuity, /Recovery 2x/);
  assert.match(decision.contract.continuity, /nicht neu bestaetigt/);
  assert.match(decision.contract.continuity, /Wochenreceipt-Erneuerungscheck offen/);
  assert.match(decision.contract.continuity, /naechste Heute- oder Wochen-Evidenz ohne erneute Reopen-Quelle/);
  assert.doesNotMatch(decision.contract.continuity, /braucht Review|Vertrauensdauer/);
  assert.doesNotMatch(decision.contract.leadingFactor, /Wochenreceipt|Lernvertrauen|Erneuerungscheck|Plan-Receipt|Recovery 2x/);
  assert.doesNotMatch(decision.contract.safestAlternative, /Wochenreceipt|Lernvertrauen|Erneuerungscheck|Plan-Receipt|Recovery 2x|Reopen-Quellentrend/);
  const tradeoffEvidence = decision.evidence.find(item => (
    typeof item !== 'string'
    && /Wochenreceipt-Erneuerungscheck offen/.test(item.label)
  ));
  assert.ok(tradeoffEvidence);
  assert.match(typeof tradeoffEvidence !== 'string' ? tradeoffEvidence.label : '', /Recovery 2x/);
  assert.equal(typeof tradeoffEvidence !== 'string' ? tradeoffEvidence.targetPath : null, '/data?tab=analysis#data-decision-quality');
});

test('fresh resolved tradeoff evidence can reopen todays adaptive option', () => {
  const planned = workout({ id: 'planned-fresh-tradeoff-learning' });
  const decision = decisionFor(home({ todayWorkout: planned }), {
    decisionQuality: tradeoffDecisionQuality({
      qualityScore: 82,
      status: 'helpful',
      statusLabel: 'Tageskonflikt mit neuer heutiger Evidenz',
      repeatedThemes: [{
        theme: 'Tageskonflikt: Koerper, Ziel und Alltag',
        count: 3,
        lastSeen: TODAY,
        status: 'useful_repetition',
        evidence: [
          'Tageskonflikt bereits in Plan eingeordnet',
          'Neue Evidenz seit gemerkter Tagesentscheidung: Recovery niedrig und Alltag nur 45 Minuten frei',
        ],
      }],
      bestEvidence: ['Neue Evidenz seit gemerkter Tagesentscheidung: leichtere Option senkte Folgetag-RPE bei niedriger Recovery'],
      suggestedAdjustment: 'Heute erneut leichtere Option bestaetigen; alte Plan-Einordnung nur als Kontext behalten.',
    }),
    todayOptions: plannedTodayOptions(planned.id),
  });

  assert.match(decision.contract.leadingFactor, /^Tageskonflikt: Frische Heute-Evidenz/);
  assert.match(decision.contract.leadingFactor, /Recovery niedrig/);
  assert.match(decision.contract.leadingFactor, /Alltag nur 45 Minuten/);
  assert.doesNotMatch(decision.contract.leadingFactor, /bereits in Plan eingeordnet|alte Plan-Einordnung|Beibehalten/);
  assert.equal(decision.cta, 'Alternative prüfen');
  assert.equal(decision.targetPath, '/plan?tab=training&source=today-change&intent=easier&workoutId=planned-fresh-tradeoff-learning#next-training-decision');
  assert.match(decision.resultPreview ?? '', /leichtere Tagesoption/);
  assert.match(decision.contract.safestAlternative, /Tageskonflikt-Lernen heute nutzen/);
  assert.doesNotMatch(decision.contract.safestAlternative, /bereits in Plan eingeordnet|alte Plan-Einordnung|Beibehalten/);
  assert.match(decision.contract.continuity, /Geloester Tageskonflikt bleibt Kontext/);
  assert.match(decision.contract.continuity, /Tageskonflikt bereits in Plan eingeordnet/);
  const tradeoffEvidence = decision.evidence.find(item => (
    typeof item !== 'string'
    && /Geloester Tageskonflikt als Kontext/.test(item.label)
  ));
  assert.ok(tradeoffEvidence);
  assert.equal(typeof tradeoffEvidence !== 'string' ? tradeoffEvidence.targetPath : null, '/data?tab=analysis#data-decision-quality');
  assertSignalBefore(decision, 'Tageskonflikt', 'Training');
});

test('fresh recurrence can reopen a handled source trend in Home', () => {
  const planned = workout({ id: 'planned-fresh-handled-source-trend' });
  const decision = decisionFor(home({ todayWorkout: planned }), {
    decisionQuality: tradeoffDecisionQuality({
      qualityScore: 82,
      status: 'helpful',
      statusLabel: 'Reopen-Quellentrend mit neuer heutiger Evidenz',
      repeatedThemes: [{
        theme: 'Tageskonflikt: Koerper, Ziel und Alltag',
        count: 6,
        lastSeen: TODAY,
        status: 'useful_repetition',
        evidence: [
          'Wochenentscheidung gemerkt: Anpassen wegen Reopen-Quellentrend Recovery 2x',
          'Reopen-Quellentrend Recovery 2x bereits in Plan eingeordnet',
          'Neue Evidenz seit gemerkter Tagesentscheidung: 2x Recovery erneut niedrig nach harter Einheit',
        ],
      }],
      bestEvidence: [
        'Plan-Receipt: Reopen-Quellentrend Recovery 2x handled',
        'Wochenreceipt-Erneuerungscheck offen: Recovery 2x - naechste Heute- oder Wochen-Evidenz ohne erneute Reopen-Quelle bestaetigt das Vertrauen neu',
        'Wiederholter Reopen-Grund: Recovery 2x erneut niedrig',
      ],
      suggestedAdjustment: 'Heute erneut leichtere Option bestaetigen; geschlossene Wochenentscheidung nur als Kontext behalten.',
    }),
    todayOptions: plannedTodayOptions(planned.id),
  });

  assert.match(decision.contract.leadingFactor, /^Tageskonflikt: Frische Heute-Evidenz/);
  assert.match(decision.contract.leadingFactor, /Recovery erneut niedrig nach harter Einheit/);
  assert.match(decision.contract.leadingFactor, /Reopen-Quellentrend: Recovery 2x/);
  assert.doesNotMatch(decision.contract.leadingFactor, /bereits in Plan eingeordnet|Wochenentscheidung gemerkt|Wochenreceipt|Lernvertrauen|Erneuerungscheck|Plan-Receipt/);
  assert.equal(decision.cta, 'Alternative prüfen');
  assert.equal(decision.targetPath, '/plan?tab=training&source=today-change&intent=easier&workoutId=planned-fresh-handled-source-trend#next-training-decision');
  assert.match(decision.contract.safestAlternative, /Tageskonflikt-Lernen heute nutzen/);
  assert.match(decision.contract.safestAlternative, /Reopen-Quellentrend: Recovery 2x/);
  assert.doesNotMatch(decision.contract.safestAlternative, /bereits in Plan eingeordnet|Wochenentscheidung gemerkt|Wochenreceipt|Lernvertrauen|Erneuerungscheck|Plan-Receipt/);
  assert.match(decision.contract.continuity, /Wochenreceipt-Lernvertrauen braucht Review/);
  assert.match(decision.contract.continuity, /Recovery 2x/);
  assert.doesNotMatch(decision.contract.continuity, /unaufgefrischt|Vertrauensdauer|Erneuerungscheck/);
  assert.doesNotMatch(decision.contract.continuity, /Wochenentscheidung gemerkt|Plan-Receipt:/);
  const tradeoffEvidence = decision.evidence.find(item => (
    typeof item !== 'string'
    && /Wochenreceipt-Lernvertrauen braucht Review/.test(item.label)
  ));
  assert.ok(tradeoffEvidence);
  assert.match(typeof tradeoffEvidence !== 'string' ? tradeoffEvidence.label : '', /Recovery 2x/);
  assert.doesNotMatch(typeof tradeoffEvidence !== 'string' ? tradeoffEvidence.label : '', /Wochenentscheidung gemerkt|Erneuerungscheck|Plan-Receipt:/);
  assert.equal(typeof tradeoffEvidence !== 'string' ? tradeoffEvidence.targetPath : null, '/data?tab=analysis#data-decision-quality');
  assertSignalBefore(decision, 'Tageskonflikt', 'Training');
});

test('isolated fresh tradeoff reopen stays current-day context in Home', () => {
  const planned = workout({ id: 'planned-isolated-reopen-source' });
  const decision = decisionFor(home({ todayWorkout: planned }), {
    decisionQuality: tradeoffDecisionQuality({
      qualityScore: 82,
      status: 'helpful',
      statusLabel: 'Tageskonflikt mit neuer heutiger Evidenz',
      repeatedThemes: [{
        theme: 'Tageskonflikt: Koerper, Ziel und Alltag',
        count: 3,
        lastSeen: TODAY,
        status: 'useful_repetition',
        evidence: [
          'Tageskonflikt bereits in Plan eingeordnet',
          'Neue Evidenz seit gemerkter Tagesentscheidung: Alltag nur 45 Minuten frei',
        ],
      }],
      bestEvidence: ['Neue Evidenz seit gemerkter Tagesentscheidung: leichtere Option passt ins heutige Alltagsfenster'],
      suggestedAdjustment: 'Heute erneut leichtere Option bestaetigen; alte Plan-Einordnung nur als Kontext behalten.',
    }),
    todayOptions: plannedTodayOptions(planned.id),
  });

  assert.match(decision.contract.leadingFactor, /^Tageskonflikt: Frische Heute-Evidenz/);
  assert.match(decision.contract.leadingFactor, /Alltag nur 45 Minuten/);
  assert.match(decision.contract.leadingFactor, /Reopen-Quelle heute isoliert/);
  assert.doesNotMatch(decision.contract.leadingFactor, /Reopen-Quellentrend|bereits in Plan eingeordnet|alte Plan-Einordnung/);
  assert.equal(decision.cta, 'Alternative prüfen');
  assert.equal(decision.targetPath, '/plan?tab=training&source=today-change&intent=easier&workoutId=planned-isolated-reopen-source#next-training-decision');
  assert.match(decision.contract.safestAlternative, /Tageskonflikt-Lernen heute nutzen/);
  assert.match(decision.contract.safestAlternative, /Reopen-Quelle heute isoliert/);
  assert.match(decision.contract.continuity, /Geloester Tageskonflikt bleibt Kontext/);
});

test('repeated reopen-source trend stays a concise daily hint in Home', () => {
  const planned = workout({ id: 'planned-reopen-source-trend' });
  const decision = decisionFor(home({ todayWorkout: planned }), {
    decisionQuality: tradeoffDecisionQuality({
      qualityScore: 82,
      status: 'helpful',
      statusLabel: 'Tageskonflikt mit neuer heutiger Evidenz',
      repeatedThemes: [{
        theme: 'Tageskonflikt: Koerper, Ziel und Alltag',
        count: 4,
        lastSeen: TODAY,
        status: 'useful_repetition',
        evidence: [
          'Tageskonflikt bereits in Plan eingeordnet',
          'Neue Evidenz seit gemerkter Tagesentscheidung: 2x Recovery nach harter Einheit niedrig',
        ],
      }],
      bestEvidence: ['Wiederholter Reopen-Grund: Recovery 2x mit niedrigem HRV und schlechtem Schlaf'],
      suggestedAdjustment: 'Heute leichtere Option wegen wiederholter Recovery-Reopens bestaetigen; alte Plan-Einordnung bleibt Kontext.',
    }),
    todayOptions: plannedTodayOptions(planned.id),
  });

  assert.match(decision.contract.leadingFactor, /^Tageskonflikt: Frische Heute-Evidenz/);
  assert.match(decision.contract.leadingFactor, /Recovery nach harter Einheit niedrig/);
  assert.match(decision.contract.leadingFactor, /Reopen-Quellentrend: Recovery 2x/);
  assert.doesNotMatch(decision.contract.leadingFactor, /bereits in Plan eingeordnet|alte Plan-Einordnung|Wiederholter Reopen-Grund/);
  assert.equal(decision.cta, 'Alternative prüfen');
  assert.equal(decision.targetPath, '/plan?tab=training&source=today-change&intent=easier&workoutId=planned-reopen-source-trend#next-training-decision');
  assert.match(decision.contract.safestAlternative, /Tageskonflikt-Lernen heute nutzen/);
  assert.match(decision.contract.safestAlternative, /Reopen-Quellentrend: Recovery 2x/);
  assert.match(decision.contract.continuity, /Geloester Tageskonflikt bleibt Kontext/);
  assert.match(decision.evidence.map(item => typeof item === 'string' ? item : item.label).join(' · '), /Geloester Tageskonflikt als Kontext/);
});

test('weak learning calibration stays watch context below a productive training decision', () => {
  const planned = workout({ id: 'planned-learning-watch' });
  const decision = decisionFor(home({ todayWorkout: planned }), {
    decisionQuality: decisionQuality(),
    fuelingOutcomeBaseline: fuelingBaseline('activity-learning-watch'),
  });

  assert.match(decision.contract.leadingFactor, /^Training:/);
  assert.equal(decision.cta, 'Workout öffnen');
  assert.equal(decision.targetPath, '/plan?tab=training');
  const calibration = decision.contract.signals.find(signal => signal.label === 'Lernkalibrierung');
  assert.ok(calibration);
  assert.equal(calibration.tone, 'muted');
  assert.match(calibration.detail, /Noch Watch-Kontext/);
  assert.match(calibration.detail, /Decision Quality: Wiederholung prüfen/);
  assert.match(calibration.detail, /Fueling: Trend-Evidenz 1\/3/);
  assertSignalBefore(decision, 'Training', 'Lernkalibrierung');
});

test('personal response calibration names the changed daily boundary without hidden writes', () => {
  const planned = workout({ id: 'planned-personal-response-preview' });
  const decision = decisionFor(home({ todayWorkout: planned }), {
    personalResponse: personalResponse(),
  });

  assert.match(decision.contract.leadingFactor, /^Lernkalibrierung: Reaktionsmuster kalibrieren/);
  assert.match(decision.contract.leadingFactor, /Heute zuerst Boundary setzen/);
  assert.equal(decision.cta, 'Kalibrierung prüfen');
  assert.equal(decision.targetPath, '/data?tab=analysis#data-personal-response');
  assert.match(decision.resultPreview ?? '', /Reaktionsmuster/);
  assert.match(decision.resultPreview ?? '', /Heute zuerst Boundary setzen/);
  assert.match(decision.resultPreview ?? '', /Plan und Garmin bleiben unverändert/);
});

test('matched daily delta stays continuity context without stealing the training action', () => {
  const planned = workout({ id: 'planned-after-matched-delta' });
  const decision = decisionFor(home({ todayWorkout: planned }), {
    dailyDelta: dailyDelta({
      status: 'matched',
      title: 'Plan und Ausführung passen zusammen',
      nextPlanEffect: 'Plan kann diesen Reiz als erledigt behandeln und die nächste Empfehlung darauf aufbauen.',
      targetPath: '/plan/activity/activity-matched-delta',
    }),
  });

  assert.match(decision.contract.leadingFactor, /^Training:/);
  assert.equal(decision.cta, 'Workout öffnen');
  assert.equal(decision.targetPath, '/plan?tab=training');
  assert.match(decision.contract.continuity, /Bleibt gültig: Plan und Ausführung passen zusammen/);
  assert.match(decision.contract.continuity, /Plan kann diesen Reiz als erledigt behandeln/);
  const followUpSignal = decision.contract.signals.find(signal => signal.label === 'Folge');
  assert.equal(followUpSignal?.tone, 'green');
  assert.equal(followUpSignal?.targetPath, '/plan/activity/activity-matched-delta');
  assert.equal(decision.steps, undefined);
  assertSignalBefore(decision, 'Training', 'Folge');
});
