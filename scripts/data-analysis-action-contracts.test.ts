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

function tradeoffDecisionQuality(overrides: Partial<PulseDailyDecisionQualityResponse> = {}): PulseDailyDecisionQualityResponse {
  return {
    range: { from: '2026-05-05', to: '2026-05-19', days: 14 },
    qualityScore: 48,
    status: 'watch',
    statusLabel: 'Tageskonflikt beobachten',
    repeatedThemes: [{
      theme: 'Tageskonflikt: Koerper, Ziel und Alltag',
      count: 1,
      lastSeen: '2026-05-18',
      status: 'watch',
      evidence: ['1x Tageskonflikt mit kleinerer Alltagsoption'],
    }],
    bestEvidence: ['1x Tageskonflikt mit kleinerer Alltagsoption'],
    evidence: [],
    suggestedAdjustment: 'Erst Wiederholung abwarten, bevor Plan oder Heute anders entscheiden.',
    ...overrides,
  };
}

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

test('tradeoff pattern classification keeps isolated evidence as watch context', () => {
  const translation = buildAnalysisTranslation({
    decisionQuality: tradeoffDecisionQuality(),
    goalProjection: quietGoalProjection,
    personalResponse: null,
    planTrace: null,
    trainingAnalytics: quietTrainingAnalytics,
  });

  assert.equal(translation.primary.label, 'Tradeoff-Muster');
  assert.equal(translation.primary.effect, 'watch_context');
  assert.equal(translation.primary.effectLabel, 'Watch-Kontext');
  assert.equal(translation.primary.actionLabel, 'Muster prüfen');
  assert.equal(translation.primary.targetPath, '/data?tab=analysis#data-decision-quality');
  assert.match(translation.primary.title, /Tageskonflikt beobachten/);
  assert.match(translation.primary.summary, /einzelner Tageskonflikt/i);
  assert.match(translation.primary.summary, /keine Planentscheidung/i);
  assert.match(translation.primary.resultPreview ?? '', /Watch-Kontext/);
});

test('tradeoff pattern classification keeps weak repeated evidence as watch context', () => {
  const translation = buildAnalysisTranslation({
    decisionQuality: tradeoffDecisionQuality({
      qualityScore: 52,
      status: 'watch',
      statusLabel: 'Tageskonflikt noch unsicher',
      repeatedThemes: [{
        theme: 'Tageskonflikt: Koerper, Ziel und Alltag',
        count: 2,
        lastSeen: '2026-05-19',
        status: 'watch',
        evidence: ['2x Tageskonflikt, aber Feedback nur einmal geschlossen'],
      }],
      bestEvidence: ['2x Tageskonflikt, aber Feedback nur einmal geschlossen'],
      suggestedAdjustment: 'Noch ein abgeschlossenes Feedback fehlt, bevor die Woche veraendert wird.',
    }),
    goalProjection: quietGoalProjection,
    personalResponse: null,
    planTrace: null,
    trainingAnalytics: quietTrainingAnalytics,
  });

  assert.equal(translation.primary.label, 'Tradeoff-Muster');
  assert.equal(translation.primary.effect, 'watch_context');
  assert.equal(translation.primary.actionLabel, 'Muster prüfen');
  assert.match(translation.primary.summary, /Noch nicht stark genug/);
  assert.match(translation.primary.summary, /Feedback fehlt/);
  assert.match(translation.primary.resultPreview ?? '', /Watch-Kontext/);
});

test('tradeoff pattern classification keeps resolved tradeoff history quiet', () => {
  const translation = buildAnalysisTranslation({
    decisionQuality: tradeoffDecisionQuality({
      qualityScore: 79,
      status: 'helpful',
      statusLabel: 'Tageskonflikt bereits eingeordnet',
      repeatedThemes: [{
        theme: 'Tageskonflikt: Koerper, Ziel und Alltag',
        count: 3,
        lastSeen: '2026-05-19',
        status: 'useful_repetition',
        evidence: [
          'Wochenentscheidung gemerkt: Beibehalten trotz Tageskonflikt',
          'Tradeoff bereits in Plan eingeordnet',
        ],
      }],
      bestEvidence: ['Tageskonflikt bereits in Plan eingeordnet und als Beibehalten gemerkt'],
      suggestedAdjustment: 'Bereits gehandhabt: ruhig lassen, bis frische Evidenz Plan oder Heute erneut veraendert.',
    }),
    goalProjection: quietGoalProjection,
    personalResponse: null,
    planTrace: null,
    trainingAnalytics: quietTrainingAnalytics,
  });

  assert.equal(translation.primary.label, 'Tradeoff-Muster');
  assert.equal(translation.primary.effect, 'watch_context');
  assert.equal(translation.primary.effectLabel, 'Watch-Kontext');
  assert.equal(translation.primary.actionLabel, 'Muster prüfen');
  assert.equal(translation.primary.targetPath, '/data?tab=analysis#data-decision-quality');
  assert.match(translation.primary.title, /eingeordnet|ruhig/i);
  assert.match(translation.primary.summary, /Bereits eingeordnet|bereits gehandhabt/i);
  assert.match(translation.primary.summary, /frische Evidenz/i);
  assert.doesNotMatch(translation.primary.targetPath ?? '', /data-tradeoff|source=data-tradeoff/);
  assert.match(translation.primary.resultPreview ?? '', /Watch-Kontext/);
  assert.equal(translation.learning.effect, 'watch_context');
  assert.doesNotMatch(translation.learning.summary, /Empfehlung darf lernen/);
});

test('tradeoff reopen explains fresh Home evidence while older resolved history stays context', () => {
  const translation = buildAnalysisTranslation({
    decisionQuality: tradeoffDecisionQuality({
      qualityScore: 80,
      status: 'helpful',
      statusLabel: 'Tageskonflikt mit neuer heutiger Evidenz',
      repeatedThemes: [{
        theme: 'Tageskonflikt: Koerper, Ziel und Alltag',
        count: 3,
        lastSeen: '2026-05-19',
        status: 'useful_repetition',
        evidence: [
          'Tageskonflikt bereits in Plan eingeordnet',
          'Neue Evidenz seit gemerkter Tagesentscheidung: Recovery niedrig und Alltag nur 45 Minuten frei',
        ],
      }],
      bestEvidence: [
        'Neue Evidenz seit gemerkter Tagesentscheidung: leichtere Option senkt Folgetag-RPE bei niedriger Recovery',
      ],
      suggestedAdjustment: 'Heute erneut leichtere Option bestaetigen und alte Plan-Entscheidung nur als Kontext behalten.',
    }),
    goalProjection: quietGoalProjection,
    personalResponse: null,
    planTrace: null,
    trainingAnalytics: quietTrainingAnalytics,
  });

  assert.equal(translation.primary.label, 'Tradeoff-Muster');
  assert.equal(translation.primary.effect, 'today_action');
  assert.equal(translation.primary.actionLabel, 'Heute einordnen');
  assert.equal(translation.primary.targetPath, '/?source=data-tradeoff');
  assert.match(translation.primary.title, /Neue Evidenz|Heute/);
  assert.match(translation.primary.summary, /Frische Heute-Evidenz/);
  assert.match(translation.primary.summary, /Recovery niedrig/);
  assert.match(translation.primary.summary, /Alltag nur 45 Minuten/);
  assert.match(translation.primary.summary, /bereits in Plan eingeordnet/);
  assert.match(translation.primary.summary, /alter Kontext|bleibt Kontext/i);
  assert.match(translation.primary.resultPreview ?? '', /heutige Entscheidung/);
});

test('tradeoff reopen explains fresh Plan evidence while older resolved history stays context', () => {
  const translation = buildAnalysisTranslation({
    decisionQuality: tradeoffDecisionQuality({
      qualityScore: 30,
      status: 'needs_strategy_change',
      statusLabel: 'Tageskonflikt mit neuer Wochenwirkung',
      repeatedThemes: [{
        theme: 'Tageskonflikt: Koerper, Ziel und Alltag',
        count: 4,
        lastSeen: '2026-05-19',
        status: 'stale',
        evidence: [
          'Wochenentscheidung gemerkt: Beibehalten trotz Tageskonflikt',
          'Neue Evidenz seit gemerkter Wochenentscheidung: Planlast kollidiert erneut mit Recovery und Garmin-Ausfuehrung',
        ],
      }],
      bestEvidence: [
        'Neue Evidenz seit gemerkter Wochenentscheidung: 2x Garmin-Ausfuehrung abgebrochen bei hoher Planlast',
      ],
      suggestedAdjustment: 'Jetzt wieder Wochenentscheidung oeffnen: Planlast reduzieren oder leichtere Wochenoption vorab festlegen.',
    }),
    goalProjection: quietGoalProjection,
    personalResponse: null,
    planTrace: null,
    trainingAnalytics: quietTrainingAnalytics,
  });

  assert.equal(translation.primary.label, 'Tradeoff-Muster');
  assert.equal(translation.primary.effect, 'plan_decision');
  assert.equal(translation.primary.actionLabel, 'Wochenentscheidung prüfen');
  assert.equal(translation.primary.targetPath, '/plan?tab=training&source=data-tradeoff#plan-weekly-decision');
  assert.match(translation.primary.title, /Neue Evidenz|Wochenentscheidung/);
  assert.match(translation.primary.summary, /Frische Wochen-Evidenz/);
  assert.match(translation.primary.summary, /Planlast/);
  assert.match(translation.primary.summary, /Recovery/);
  assert.match(translation.primary.summary, /Garmin-Ausfuehrung/);
  assert.match(translation.primary.summary, /Beibehalten trotz Tageskonflikt/);
  assert.match(translation.primary.summary, /alter Kontext|bleibt Kontext/i);
  assert.match(translation.primary.resultPreview ?? '', /Planentscheidung/);
});

test('tradeoff pattern classification routes useful repeated evidence to Home', () => {
  const translation = buildAnalysisTranslation({
    decisionQuality: tradeoffDecisionQuality({
      qualityScore: 76,
      status: 'helpful',
      statusLabel: 'Tageskonflikt hilft heute',
      repeatedThemes: [{
        theme: 'Tageskonflikt: Koerper, Ziel und Alltag',
        count: 2,
        lastSeen: '2026-05-19',
        status: 'useful_repetition',
        evidence: ['2x leichtere Option hat Folgetag-RPE gesenkt'],
      }],
      bestEvidence: ['2x leichtere Option hat Folgetag-RPE gesenkt'],
      suggestedAdjustment: 'Heute zuerst die leichtere Option bestaetigen, wenn Schlaf und Alltag eng sind.',
    }),
    goalProjection: quietGoalProjection,
    personalResponse: null,
    planTrace: null,
    trainingAnalytics: quietTrainingAnalytics,
  });

  assert.equal(translation.primary.label, 'Tradeoff-Muster');
  assert.equal(translation.primary.effect, 'today_action');
  assert.equal(translation.primary.effectLabel, 'Tageshandlung');
  assert.equal(translation.primary.actionLabel, 'Heute einordnen');
  assert.equal(translation.primary.targetPath, '/?source=data-tradeoff');
  assert.match(translation.primary.title, /Heute/);
  assert.match(translation.primary.summary, /2x Tageskonflikt/);
  assert.match(translation.primary.summary, /leichtere Option/);
  assert.match(translation.primary.resultPreview ?? '', /heutige Entscheidung/);
});

test('tradeoff pattern classification routes stale repeated evidence to the weekly decision', () => {
  const translation = buildAnalysisTranslation({
    decisionQuality: tradeoffDecisionQuality({
      qualityScore: 34,
      status: 'needs_strategy_change',
      statusLabel: 'Tageskonflikt wiederholt',
      repeatedThemes: [{
        theme: 'Tageskonflikt: Koerper, Ziel und Alltag',
        count: 3,
        lastSeen: '2026-05-19',
        status: 'stale',
        evidence: [
          '3x Tageskonflikt mit zu hartem Plan',
          '2x Abschluss als leichtere Option gelernt',
        ],
      }],
      bestEvidence: ['3x Tageskonflikt mit zu hartem Plan'],
      suggestedAdjustment: 'Diese Woche Intensitaet erst nach Warm-up freigeben und leichtere Option vorab festlegen.',
    }),
    goalProjection: quietGoalProjection,
    personalResponse: null,
    planTrace: null,
    trainingAnalytics: quietTrainingAnalytics,
  });

  assert.equal(translation.primary.label, 'Tradeoff-Muster');
  assert.equal(translation.primary.effect, 'plan_decision');
  assert.equal(translation.primary.effectLabel, 'Planentscheidung');
  assert.equal(translation.primary.actionLabel, 'Wochenentscheidung prüfen');
  assert.equal(translation.primary.targetPath, '/plan?tab=training&source=data-tradeoff#plan-weekly-decision');
  assert.match(translation.primary.title, /Wochenentscheidung/);
  assert.match(translation.primary.summary, /3x Tageskonflikt/);
  assert.match(translation.primary.summary, /Intensitaet erst nach Warm-up/);
  assert.match(translation.primary.resultPreview ?? '', /Planentscheidung/);
});

test('tradeoff pattern classification routes stale tradeoffs only when fresh evidence reopens the decision', () => {
  const translation = buildAnalysisTranslation({
    decisionQuality: tradeoffDecisionQuality({
      qualityScore: 29,
      status: 'needs_strategy_change',
      statusLabel: 'Tageskonflikt mit neuer Wochenwirkung',
      repeatedThemes: [{
        theme: 'Tageskonflikt: Koerper, Ziel und Alltag',
        count: 4,
        lastSeen: '2026-05-19',
        status: 'stale',
        evidence: [
          'Neue Evidenz seit gemerkter Wochenentscheidung: 2x zu harte Einheit trotz leichter Option',
          'Frische Planwirkung: Warm-up-Abbruch und hohe Folgetag-RPE',
        ],
      }],
      bestEvidence: ['Neue Evidenz seit gemerkter Wochenentscheidung: 2x zu harte Einheit'],
      suggestedAdjustment: 'Jetzt wieder Wochenentscheidung oeffnen: Intensitaet erst nach Warm-up freigeben und leichtere Option vorab festlegen.',
    }),
    goalProjection: quietGoalProjection,
    personalResponse: null,
    planTrace: null,
    trainingAnalytics: quietTrainingAnalytics,
  });

  assert.equal(translation.primary.label, 'Tradeoff-Muster');
  assert.equal(translation.primary.effect, 'plan_decision');
  assert.equal(translation.primary.actionLabel, 'Wochenentscheidung prüfen');
  assert.equal(translation.primary.targetPath, '/plan?tab=training&source=data-tradeoff#plan-weekly-decision');
  assert.match(translation.primary.title, /Wochenentscheidung/);
  assert.match(translation.primary.summary, /Neue Evidenz/);
  assert.match(translation.primary.resultPreview ?? '', /Planentscheidung/);
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
