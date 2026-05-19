import assert from 'node:assert/strict';
import test from 'node:test';

import type { NutritionLog } from '../frontend/src/pulse/api-client.ts';
import { buildFuelingEvidenceQuality } from '../frontend/src/features/activity/activity-closure-evidence.ts';

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
