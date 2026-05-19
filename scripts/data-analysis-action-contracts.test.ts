import assert from 'node:assert/strict';
import test from 'node:test';

import type {
  PulseDailyDecisionQualityResponse,
  PulseGoalProjectionResponse,
  PulsePersonalResponseResponse,
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
