import assert from 'node:assert/strict';
import test from 'node:test';

import type {
  PulseDailyDecisionQualityResponse,
  PulseFuelingOutcomeBaseline,
  PulseGoalProjectionResponse,
  PulsePersonalResponseResponse,
  PulsePlanTrace,
  PulseTrainingAnalyticsResponse,
} from '../shared/types/pulse/index.ts';
import { buildAnalysisTranslation } from '../frontend/src/features/data/analysis/analysis-translation-model.ts';

const quietGoalProjection: PulseGoalProjectionResponse = {
  generatedAt: '2026-05-19T06:00:00.000Z',
  horizonDays: 180,
  headline: 'Zielprojektion ruhig.',
  projections: [],
  missingEvidence: [],
};

const helpfulDecisionQuality: PulseDailyDecisionQualityResponse = {
  range: { from: '2026-05-05', to: '2026-05-19', days: 14 },
  qualityScore: 82,
  status: 'helpful',
  statusLabel: 'Hilfreich',
  repeatedThemes: [],
  bestEvidence: ['Mobility nach Stress senkt Folgetag-RPE.'],
  evidence: [],
  suggestedAdjustment: 'Stress-Tage mit kurzer Mobility schließen.',
};

const watchDecisionQuality: PulseDailyDecisionQualityResponse = {
  range: { from: '2026-05-05', to: '2026-05-19', days: 14 },
  qualityScore: 58,
  status: 'watch',
  statusLabel: 'Beobachten',
  repeatedThemes: [{ theme: 'Fueling nach langen Einheiten', count: 2, lastSeen: '2026-05-18', status: 'watch', evidence: ['2x ohne kompletten During-Log'] }],
  bestEvidence: ['Fueling-Entscheidungen wiederholen sich, aber Outcome-Evidenz ist noch offen.'],
  evidence: [],
  suggestedAdjustment: 'Noch nicht hochregeln; erst komplette Fueling-Logs schließen.',
};

const quietTrainingAnalytics: PulseTrainingAnalyticsResponse = {
  weeks: 12,
  tssHeatmap: [],
  zoneDistribution: [],
  vo2maxTrend: [],
  rpeByZone: { totalRated: 0, zones: [] },
  capabilitySummary: {
    generatedAt: '2026-05-19T06:00:00.000Z',
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
    updatedAt: '2026-05-19T06:00:00.000Z',
  },
  powerDuration: {
    bestEfforts: [],
    durability: {
      rating: 'strong',
      powerDropPct: -3,
      hrDriftBpm: 1,
      evidence: ['Power stabil'],
      activityId: 'activity-1',
      activityDate: '2026-05-19',
      qualitySource: 'stream',
      qualityStatus: 'trusted',
    },
    bestEffortLine: 'Power-Evidenz stabil.',
    durabilityLine: 'Durability stabil.',
    updatedAt: '2026-05-19T06:00:00.000Z',
  },
};

function goalProjection(targetPath = '/plan?tab=training'): PulseGoalProjectionResponse {
  return {
    generatedAt: '2026-05-19T06:00:00.000Z',
    horizonDays: 180,
    headline: '70.3 braucht Fueling-Praxis.',
    projections: [{
      goalId: 'race-1',
      title: '70.3 Kraichgau',
      category: 'race',
      targetDate: '2026-07-11',
      daysUntil: 53,
      probabilityPct: 61,
      status: 'watch',
      confidence: 'medium',
      summary: 'Ziel ist erreichbar, aber Fueling bleibt der Limiter.',
      limiterRisk: {
        status: 'watch',
        label: 'Long Endurance + Fueling',
        summary: 'Fueling-Vertraeglichkeit ist noch nicht stabil.',
        evidence: ['1/3 komplette During-Logs'],
      },
      nextBestIntervention: {
        kind: 'fueling_practice',
        title: 'Fueling-Praxis absichern',
        summary: 'Die naechste lange Einheit sollte kontrolliert Fueling und GI-Komfort schliessen.',
        actionLabel: 'Plan pruefen',
        targetPath,
        evidence: ['Long-Endurance-Level 3.1', 'Fueling-Vertraeglichkeit lernt'],
      },
      evidence: ['A-Race in 53 Tagen'],
      missingEvidence: ['Wiederholte stabile Fueling-/GI-Logs fehlen.'],
    }],
    missingEvidence: ['Wiederholte stabile Fueling-/GI-Logs fehlen.'],
  };
}

function personalResponse(kind: 'mental_response' | 'fueling_response'): PulsePersonalResponseResponse {
  return {
    summary: {
      generatedAt: '2026-05-19T06:00:00.000Z',
      range: { from: '2026-04-07', to: '2026-05-19', days: 42 },
      strength: 'learning',
      headline: kind === 'fueling_response' ? 'Pulse lernt Fueling-Reaktionen.' : 'Pulse lernt Reaktionsmuster.',
      signals: [{
        kind,
        label: kind === 'fueling_response' ? 'Fueling-Baseline offen' : 'Mentale Last begrenzt Ausführung',
        strength: 'learning',
        summary: kind === 'fueling_response'
          ? 'Lange Einheiten brauchen vollstaendige During-Logs.'
          : 'Stressreiche Tage brauchen klarere Boundaries.',
        evidence: kind === 'fueling_response'
          ? ['Noch zwei komplette During-Logs fehlen.']
          : ['2 Check-ins mit Stress >=7'],
        nextAdjustment: kind === 'fueling_response'
          ? 'Naechste lange Einheit mit Carbs, Dauer und GI-Komfort loggen.'
          : 'Vor harten Einheiten zuerst Boundary und Warm-up pruefen.',
      }],
      missingEvidence: [],
    },
  };
}

function fuelingBaseline(overrides: Partial<PulseFuelingOutcomeBaseline> = {}): PulseFuelingOutcomeBaseline {
  return {
    status: 'learning',
    label: 'Fueling-Baseline lernt',
    summary: 'Lange Einheiten brauchen vergleichbare During-Logs.',
    latestLogDate: '2026-05-18',
    observedCarbsPerHour: 48,
    targetCarbsPerHour: { min: 55, max: 65 },
    bottles750Ml: 3,
    powderG: 210,
    fluidMlPerHour: 680,
    sodiumMgPerHour: null,
    hydrationContextSummary: null,
    hydrationEvidenceGaps: ['Hitze nicht gemessen'],
    trendSummary: 'Fueling-Trend: 3/3 komplette During-Logs, Schnitt 58 g/h; GI stabil.',
    evidence: ['2 lange During-Logs vollständig'],
    learningReadiness: {
      comparableCompleteLogs: 2,
      requiredComparableCompleteLogs: 3,
      readyForTrendSummary: false,
      missingEvidence: ['GI-Komfort fehlt strukturiert beim vorhandenen Carb-Log.'],
      nextAction: {
        kind: 'complete_gi_comfort',
        label: 'GI-Komfort ergänzen',
        detail: 'GI-Komfort am vorhandenen Long-Run-Log ergänzen.',
        activityId: 'activity-fueling-gap',
      },
    },
    ...overrides,
  };
}

function powerAnalytics(status: 'usable_with_caution' | 'blocked', durability: 'strong' | 'watch' | 'limited'): PulseTrainingAnalyticsResponse {
  return {
    ...quietTrainingAnalytics,
    powerDataQuality: {
      source: status === 'blocked' ? 'unavailable' : 'lap_approximation',
      status,
      coveragePct: status === 'blocked' ? 0 : 64,
      spikeCount: status === 'blocked' ? 0 : 2,
      limitations: [status === 'blocked' ? 'Keine verwertbaren Power-Streams.' : 'Nur Lap-Approximation.'],
      updatedAt: '2026-05-19T06:00:00.000Z',
    },
    powerDuration: {
      bestEfforts: [],
      durability: durability === 'strong'
        ? null
        : {
          rating: durability,
          powerDropPct: -18,
          hrDriftBpm: 4,
          evidence: ['Power -18%', 'HR +4 bpm'],
          activityId: 'activity-duration',
          activityDate: '2026-05-19',
          qualitySource: 'lap_approximation',
          qualityStatus: 'usable_with_caution',
        },
      bestEffortLine: '20 min 215 W.',
      durabilityLine: 'Durability watch: Power -18% · HR +4 bpm.',
      updatedAt: '2026-05-19T06:00:00.000Z',
    },
  };
}

function planTrace(overrides: Partial<PulsePlanTrace['inputSnapshot']> = {}): PulsePlanTrace {
  return {
    id: 'trace-risk',
    userId: 'u1',
    weekStart: '2026-05-18',
    createdAt: '2026-05-18T06:00:00.000Z',
    inputSnapshot: {
      phase: 'build',
      mesocycleWeek: 2,
      weeklyHoursTarget: 8,
      availableDays: [1, 3, 5],
      load: { ctl: 52, atl: 70, tsb: -18, date: '2026-05-18' },
      profile: { ftpWatts: 245, maxHrBpm: 190, lthrBpm: 172 },
      goals: [],
      riskSignals: [{ ruleId: 'sleep_debt_5d', severity: 'warn', title: 'Schlafschuld' }],
      healthStates: [],
      recentRpe: [],
      rpeReasons: [],
      dataWarnings: [],
      recentSportMix: {},
      goalLimiter: null,
      ...overrides,
    },
    planDecision: {
      selectedDays: [1, 5],
      skippedAvailableDays: [3],
      targetSessionCount: 2,
      primaryGoal: null,
      reasons: [],
    },
    sportMix: {},
    hardDays: [],
    generatedSummary: [],
  };
}

test('plan goal interventions are classified as plan decisions', () => {
  const translation = buildAnalysisTranslation({
    decisionQuality: null,
    goalProjection: goalProjection('/plan?tab=training'),
    personalResponse: null,
    planTrace: null,
    trainingAnalytics: quietTrainingAnalytics,
  });

  assert.equal(translation.primary.effect, 'plan_decision');
  assert.equal(translation.primary.effectLabel, 'Planentscheidung');
  assert.match(translation.primary.resultPreview ?? '', /Planentscheidung/);
});

test('non-plan goal interventions are classified as today actions', () => {
  const translation = buildAnalysisTranslation({
    decisionQuality: null,
    goalProjection: goalProjection('/data?tab=quality#data-garmin-quality'),
    personalResponse: null,
    planTrace: null,
    trainingAnalytics: quietTrainingAnalytics,
  });

  assert.equal(translation.primary.effect, 'today_action');
  assert.equal(translation.primary.effectLabel, 'Tageshandlung');
  assert.match(translation.primary.resultPreview ?? '', /Tageshandlung/);
});

test('decision quality and personal response expose today-action learning loops', () => {
  const decisionQualityTranslation = buildAnalysisTranslation({
    decisionQuality: helpfulDecisionQuality,
    goalProjection: quietGoalProjection,
    personalResponse: null,
    planTrace: null,
    trainingAnalytics: quietTrainingAnalytics,
  });
  const responseTranslation = buildAnalysisTranslation({
    decisionQuality: null,
    goalProjection: quietGoalProjection,
    personalResponse: personalResponse('mental_response'),
    planTrace: null,
    trainingAnalytics: quietTrainingAnalytics,
  });

  assert.equal(decisionQualityTranslation.primary.effect, 'today_action');
  assert.equal(responseTranslation.primary.effect, 'today_action');
  assert.match(decisionQualityTranslation.primary.resultPreview ?? '', /Lernschleife/);
  assert.match(responseTranslation.primary.resultPreview ?? '', /Reaktionsmuster/);
});

test('fueling response becomes an explicit fueling learning loop', () => {
  const translation = buildAnalysisTranslation({
    decisionQuality: null,
    goalProjection: quietGoalProjection,
    personalResponse: personalResponse('fueling_response'),
    planTrace: null,
    trainingAnalytics: quietTrainingAnalytics,
  });

  assert.equal(translation.primary.label, 'Fueling-Lernschleife');
  assert.equal(translation.primary.actionLabel, 'Fueling-Evidenz prüfen');
  assert.equal(translation.primary.targetPath, '/data?tab=analysis#data-personal-response');
  assert.equal(translation.primary.effect, 'today_action');
  assert.match(translation.primary.resultPreview ?? '', /Fueling/);
});

test('learning calibration keeps weak fueling evidence as watch context and hides premature trend summaries', () => {
  const translation = buildAnalysisTranslation({
    decisionQuality: watchDecisionQuality,
    goalProjection: quietGoalProjection,
    personalResponse: personalResponse('fueling_response'),
    planTrace: null,
    trainingAnalytics: quietTrainingAnalytics,
    fuelingOutcomeBaseline: fuelingBaseline(),
  });

  assert.equal(translation.learning.label, 'Lernkalibrierung');
  assert.equal(translation.learning.effect, 'watch_context');
  assert.equal(translation.learning.effectLabel, 'Watch-Kontext');
  assert.equal(translation.learning.actionLabel, 'GI-Komfort ergänzen');
  assert.equal(translation.learning.targetPath, '/plan/activity/activity-fueling-gap#activity-fueling-log');
  assert.match(translation.learning.summary, /Trend-Evidenz 2\/3/);
  assert.match(translation.learning.summary, /GI-Komfort/);
  assert.doesNotMatch(translation.learning.summary, /Fueling-Trend:/);
  assert.match(translation.learning.resultPreview ?? '', /Fueling-Log/);
});

test('learning calibration changes the recommendation only after decision and fueling evidence gates are met', () => {
  const translation = buildAnalysisTranslation({
    decisionQuality: helpfulDecisionQuality,
    goalProjection: quietGoalProjection,
    personalResponse: {
      summary: {
        ...personalResponse('fueling_response').summary,
        strength: 'useful',
        signals: [{
          ...personalResponse('fueling_response').summary.signals[0]!,
          strength: 'useful',
          evidence: ['3 lange Fueling-Logs mit GI-Komfort', '2x stabile Folgetag-RPE'],
        }],
      },
    },
    planTrace: null,
    trainingAnalytics: quietTrainingAnalytics,
    fuelingOutcomeBaseline: fuelingBaseline({
      status: 'stable',
      evidence: ['3 lange During-Logs vollständig'],
      learningReadiness: {
        comparableCompleteLogs: 3,
        requiredComparableCompleteLogs: 3,
        readyForTrendSummary: true,
        missingEvidence: [],
      },
    }),
  });

  assert.equal(translation.learning.effect, 'today_action');
  assert.equal(translation.learning.effectLabel, 'Tageshandlung');
  assert.equal(translation.learning.actionLabel, 'Kalibrierung prüfen');
  assert.equal(translation.learning.targetPath, '/data?tab=analysis#data-decision-quality');
  assert.match(translation.learning.summary, /Empfehlung darf lernen/);
  assert.match(translation.learning.summary, /Fueling-Trend:/);
  assert.match(translation.learning.resultPreview ?? '', /Plan und Garmin bleiben unverändert/);
});

test('learning calibration still gates fueling trends when readiness is true but fewer than three complete logs exist', () => {
  const translation = buildAnalysisTranslation({
    decisionQuality: null,
    goalProjection: quietGoalProjection,
    personalResponse: personalResponse('fueling_response'),
    planTrace: null,
    trainingAnalytics: quietTrainingAnalytics,
    fuelingOutcomeBaseline: fuelingBaseline({
      learningReadiness: {
        comparableCompleteLogs: 2,
        requiredComparableCompleteLogs: 2,
        readyForTrendSummary: true,
        missingEvidence: [],
      },
    }),
  });

  assert.equal(translation.learning.effect, 'watch_context');
  assert.match(translation.learning.summary, /Trend-Evidenz 2\/3/);
  assert.doesNotMatch(translation.learning.summary, /Fueling-Trend:/);
});

test('training risk contract routes plan and load risk to the weekly decision', () => {
  const translation = buildAnalysisTranslation({
    decisionQuality: null,
    goalProjection: quietGoalProjection,
    personalResponse: null,
    planTrace: planTrace(),
    trainingAnalytics: quietTrainingAnalytics,
  });

  assert.equal(translation.trainingRisk.tone, 'amber');
  assert.equal(translation.trainingRisk.actionLabel, 'Wochenentscheidung prüfen');
  assert.equal(translation.trainingRisk.targetPath, '/plan?tab=training&source=data-load#plan-weekly-decision');
  assert.match(translation.trainingRisk.summary, /Schlafschuld/);
  assert.match(translation.trainingRisk.summary, /TSB -18\.0/);
  assert.match(translation.trainingRisk.resultPreview ?? '', /Plan und Garmin bleiben unverändert/);
});

test('training risk contract routes blocked power quality to data evidence', () => {
  const translation = buildAnalysisTranslation({
    decisionQuality: null,
    goalProjection: quietGoalProjection,
    personalResponse: null,
    planTrace: planTrace({
      load: { ctl: 52, atl: 55, tsb: -3, date: '2026-05-18' },
      riskSignals: [],
    }),
    trainingAnalytics: powerAnalytics('blocked', 'strong'),
  });

  assert.equal(translation.trainingRisk.tone, 'rose');
  assert.equal(translation.trainingRisk.actionLabel, 'Power-Daten prüfen');
  assert.equal(translation.trainingRisk.targetPath, '/data?tab=analysis#data-power-quality');
  assert.match(translation.trainingRisk.summary, /Power-Daten blockieren/);
  assert.match(translation.trainingRisk.resultPreview ?? '', /Tageshandlung/);
});

test('training risk contract stays watch context when risk evidence is stable', () => {
  const translation = buildAnalysisTranslation({
    decisionQuality: null,
    goalProjection: quietGoalProjection,
    personalResponse: null,
    planTrace: planTrace({
      load: { ctl: 52, atl: 48, tsb: 4, date: '2026-05-18' },
      riskSignals: [],
    }),
    trainingAnalytics: quietTrainingAnalytics,
  });

  assert.equal(translation.trainingRisk.tone, 'green');
  assert.equal(translation.trainingRisk.effect, 'watch_context');
  assert.equal(translation.trainingRisk.actionLabel, undefined);
  assert.match(translation.trainingRisk.summary, /keinen harten Trainingsrisiko-Hebel/);
});

test('power quality and durability stay watch context unless they block the day', () => {
  const powerTranslation = buildAnalysisTranslation({
    decisionQuality: null,
    goalProjection: quietGoalProjection,
    personalResponse: null,
    planTrace: null,
    trainingAnalytics: powerAnalytics('usable_with_caution', 'strong'),
  });
  const durabilityTranslation = buildAnalysisTranslation({
    decisionQuality: null,
    goalProjection: quietGoalProjection,
    personalResponse: null,
    planTrace: null,
    trainingAnalytics: powerAnalytics('usable_with_caution', 'limited'),
  });

  assert.equal(powerTranslation.watch.effect, 'watch_context');
  assert.equal(durabilityTranslation.watch.effect, 'watch_context');
  assert.match(powerTranslation.watch.resultPreview ?? '', /Watch-Kontext/);
  assert.match(durabilityTranslation.watch.resultPreview ?? '', /Watch-Kontext/);
});
