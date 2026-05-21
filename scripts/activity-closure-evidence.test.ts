import assert from 'node:assert/strict';
import test from 'node:test';

import type { PulseFuelingOutcomeBaseline } from '../shared/types/pulse/index.ts';
import {
  fuelingBaselineNextLearningLogText,
  fuelingBaselineReadinessGap,
  fuelingBaselineTrendEvidenceValue,
} from '../frontend/src/components/FuelingOutcomeBaseline.tsx';
import type { NutritionLog } from '../frontend/src/pulse/api-client.ts';
import {
  buildFuelingEvidenceQuality,
  fuelingTrendEvidenceLabel,
} from '../frontend/src/features/activity/activity-closure-evidence.ts';

function log(overrides: Partial<NutritionLog> = {}): NutritionLog {
  return {
    id: 'nutrition-1',
    userId: 'user-1',
    date: '2026-05-01',
    workoutId: null,
    activityId: 'activity-1',
    context: 'during',
    mealType: null,
    description: 'During-Fueling',
    calories: null,
    proteinG: null,
    carbsG: 242,
    fatG: null,
    gelsCount: null,
    drinksMl: 3000,
    sodiumMg: 1300,
    ambientTempC: 28,
    sweatRateLPerHour: 0.9,
    bottles750Ml: 4,
    powderG: 300,
    fuelingProducts: ['mnstry-power-carb-sour-cherry-1-0-8'],
    giComfort: null,
    notes: null,
    createdAt: '2026-05-01T13:15:00.000Z',
    ...overrides,
  };
}

function fuelingBaseline(overrides: Partial<PulseFuelingOutcomeBaseline> = {}): PulseFuelingOutcomeBaseline {
  return {
    status: 'learning',
    label: 'Fueling-Baseline lernt',
    summary: 'Pulse sammelt vergleichbare During-Logs mit Carbs und GI-Komfort.',
    latestLogDate: null,
    observedCarbsPerHour: 52,
    targetCarbsPerHour: { min: 50, max: 65 },
    bottles750Ml: null,
    powderG: null,
    fluidMlPerHour: null,
    sodiumMgPerHour: null,
    trendSummary: null,
    evidence: ['Fueling-Evidence offen.'],
    learningReadiness: {
      comparableCompleteLogs: 1,
      requiredComparableCompleteLogs: 3,
      readyForTrendSummary: false,
      missingEvidence: ['Noch zwei vergleichbare During-Logs mit Dauer, Carbs und GI-Komfort fehlen.'],
      nextAction: {
        kind: 'log_next_long_session',
        label: 'Naechsten Lernlog vollstaendig erfassen',
        detail: 'Naechste lange Einheit mit Dauer, Carbs und GI-Komfort zusammen erfassen.',
        activityId: null,
      },
    },
    ...overrides,
  };
}

test('long-session closure evidence mirrors Home fueling and feedback language', () => {
  const quality = buildFuelingEvidenceQuality({
    logs: [log()],
    activityType: 'bike',
    durationMin: 240,
    feedbackCaptured: false,
    trendEvidence: 'Trend-Evidenz 1/3',
  });

  assert.ok(quality);
  assert.equal(quality.label, 'Fueling-Evidence zuerst schließen');
  assert.match(quality.detail, /Fueling-Evidence zuerst schließen/);
  assert.match(quality.detail, /Dauer, Carbs und GI-Komfort zusammen/);
  assert.match(quality.detail, /Feedback danach kurz erfassen/);
  assert.deepEqual(quality.items, [
    'RPE fehlt',
    'Dauer 240 min',
    'Carbs erfasst · 61 g/h',
    'GI-Komfort fehlt',
    'Hydration-Kontext gemessen',
    'Sodium ca. 325 mg/h',
    '28°C',
    'Schweißrate 0.9 l/h',
    'Trend-Evidenz 1/3',
  ]);
  assert.equal(
    quality.giComfortCompletionDetail,
    'Wähle die echte Magenreaktion; nicht aus Notizen, Route, RPE, g/h oder Ergebnis ableiten. Danach kann dieser vorhandene Carb-Log in die Trend-Evidenz einfließen; aktuell Trend-Evidenz 1/3. Plan und Garmin bleiben unverändert.',
  );
});

test('GI comfort must stay an explicit choice even when notes mention the stomach', () => {
  const quality = buildFuelingEvidenceQuality({
    logs: [log({
      notes: 'Magen ok, Beine gut.',
      drinksMl: null,
      sodiumMg: null,
      ambientTempC: null,
      sweatRateLPerHour: null,
      bottles750Ml: null,
      powderG: null,
      fuelingProducts: [],
    })],
    activityType: 'bike',
    durationMin: 240,
    feedbackCaptured: true,
    trendEvidence: 'Trend-Evidenz 1/3',
  });

  assert.ok(quality);
  assert.equal(quality.giComfortCompletionLogId, 'nutrition-1');
  assert.equal(quality.detailCompletionLogId, null);
  assert.deepEqual(quality.detailCompletions, []);
  assert.ok(!quality.detailCompletions.some(completion => completion.patch.giComfort != null));
  assert.match(quality.giComfortCompletionDetail ?? '', /nicht aus Notizen, Route, RPE, g\/h oder Ergebnis ableiten/);
});

test('complete long-session evidence keeps measured context and feedback closed', () => {
  const quality = buildFuelingEvidenceQuality({
    logs: [log({ giComfort: 'ok' })],
    activityType: 'bike',
    durationMin: 240,
    feedbackCaptured: true,
    trendEvidence: 'Trend-Evidenz 2/3',
  });

  assert.ok(quality);
  assert.equal(quality.label, 'Lernevidenz vollständig');
  assert.match(quality.detail, /Fueling-Evidence geschlossen/);
  assert.equal(quality.giComfortCompletionDetail, null);
  assert.deepEqual(quality.items, [
    'RPE erfasst',
    'Dauer 240 min',
    'Carbs erfasst · 61 g/h',
    'GI-Komfort erfasst',
    'Hydration-Kontext gemessen',
    'Sodium ca. 325 mg/h',
    '28°C',
    'Schweißrate 0.9 l/h',
    'Trend-Evidenz 2/3',
  ]);
});

test('long sessions without measured hydration avoid invented sodium or sweat claims', () => {
  const quality = buildFuelingEvidenceQuality({
    logs: [log({
      sodiumMg: null,
      ambientTempC: null,
      sweatRateLPerHour: null,
      giComfort: 'ok',
    })],
    activityType: 'bike',
    durationMin: 240,
    feedbackCaptured: true,
    trendEvidence: 'Trend-Evidenz 1/3',
  });

  assert.ok(quality);
  assert.ok(quality.items.includes('Hydration-Kontext offen'));
  assert.match(quality.detail, /Sodium, Hitze und Schweißrate nur ergänzen, wenn du sie wirklich gemessen hast/);
  assert.ok(!quality.items.some(item => item.includes('mg/h')));
  assert.ok(!quality.items.some(item => item.includes('Schweißrate')));
});

test('activity fueling trend evidence label enforces the central three-log floor', () => {
  const label = fuelingTrendEvidenceLabel(fuelingBaseline({
    learningReadiness: {
      comparableCompleteLogs: 2,
      requiredComparableCompleteLogs: 2,
      readyForTrendSummary: true,
      missingEvidence: ['Noch ein vergleichbarer During-Log mit Dauer, Carbs und GI-Komfort fehlt.'],
      nextAction: null,
    },
  }));

  assert.equal(label, 'Trend-Evidenz 2/3');
});

test('fueling baseline block copy keeps malformed two-log readiness in learning mode', () => {
  const baseline = fuelingBaseline({
    trendSummary: 'Fueling-Trend: 2/2 sollte der Baseline-Block noch nicht zeigen.',
    learningReadiness: {
      comparableCompleteLogs: 2,
      requiredComparableCompleteLogs: 2,
      readyForTrendSummary: true,
      missingEvidence: ['Noch ein vergleichbarer During-Log mit Dauer, Carbs und GI-Komfort fehlt.'],
      nextAction: {
        kind: 'log_next_long_session',
        label: 'Naechsten Lernlog vollstaendig erfassen',
        detail: 'Naechste lange Einheit mit Dauer, Carbs und GI-Komfort zusammen erfassen.',
        activityId: null,
      },
    },
  });

  assert.equal(fuelingBaselineTrendEvidenceValue(baseline), '2/3');
  assert.match(fuelingBaselineReadinessGap(baseline) ?? '', /Noch ein vergleichbarer During-Log/);
  assert.match(fuelingBaselineNextLearningLogText(baseline) ?? '', /Nächster Lernlog/);
});
