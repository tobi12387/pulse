import assert from 'node:assert/strict';
import test from 'node:test';

import type { PulseMentalCheckin } from '../shared/types/pulse/index.ts';
import { buildResilienceGuidance } from '../frontend/src/features/data/resilience/resilience-guidance-model.ts';

function checkin(overrides: Partial<PulseMentalCheckin>): PulseMentalCheckin {
  return {
    id: overrides.id ?? 'checkin-1',
    userId: 'u1',
    date: overrides.date ?? '2026-05-12',
    mood: overrides.mood ?? 7,
    energy: overrides.energy ?? 7,
    stress: overrides.stress ?? 3,
    motivation: overrides.motivation ?? 7,
    notes: overrides.notes ?? null,
    themes: overrides.themes ?? null,
    source: overrides.source ?? 'manual',
    coachQuestions: overrides.coachQuestions ?? null,
    createdAt: overrides.createdAt ?? '2026-05-12T06:00:00.000Z',
  };
}

function home(overrides: Parameters<typeof buildResilienceGuidance>[0]['home'] = {}) {
  return {
    readiness: { score: 78, label: 'gut', shortLabel: 'Gut', color: 'green' },
    fitnessLoad: { tsb: 4 },
    recovery: {
      sleepDebt7d: { hours: 0.8, targetH: 7.5, baselineSource: 'garmin_sleep_need', status: 'ok' },
      hrvDeviation7d: { pct: 2, recentMs: 48, baselineMs: 47, status: 'stable' },
      rhrDrift7d: { bpmAboveBaseline: 1, recent: 50, baseline: 49, status: 'normal' },
      recoveryScore: 82,
      recommendation: 'Trainieren ist plausibel.',
    },
    ...overrides,
  };
}

test('protects the day when mental stress is high or recovery is constrained', () => {
  const guidance = buildResilienceGuidance({
    home: home({ readiness: { score: 48, label: 'erholen', shortLabel: 'Erholen', color: 'rose' } }),
    checkin: checkin({ mood: 5, energy: 3, stress: 8, motivation: 4 }),
  });

  assert.equal(guidance.state, 'protect');
  assert.equal(guidance.primaryAction.kind, 'open_plan');
  assert.match(guidance.title, /Schutz/i);
  assert.match(guidance.lanes.find(lane => lane.id === 'boundary')?.body ?? '', /kleiner|Grenze|schützen/i);
  assert.ok(guidance.evidence.some(item => item.includes('Stress 8/10')));
});

test('keeps a steady boundary when signals are mixed but not a hard stop', () => {
  const guidance = buildResilienceGuidance({
    home: home({
      fitnessLoad: { tsb: -6 },
      recovery: {
        sleepDebt7d: { hours: 1.8, targetH: 7.5, baselineSource: 'garmin_sleep_need', status: 'mild' },
        hrvDeviation7d: { pct: -3, recentMs: 45, baselineMs: 47, status: 'recovering' },
        rhrDrift7d: { bpmAboveBaseline: 2, recent: 51, baseline: 49, status: 'normal' },
        recoveryScore: 66,
        recommendation: 'Ruhig starten.',
      },
    }),
    checkin: checkin({ mood: 6, energy: 5, stress: 5, motivation: 6 }),
  });

  assert.equal(guidance.state, 'steady');
  assert.equal(guidance.primaryAction.kind, 'open_recovery');
  assert.match(guidance.summary, /Rahmen|ruhig|dosiert/i);
  assert.match(guidance.lanes.find(lane => lane.id === 'plan')?.body ?? '', /Plan|Intensität|Belastung/i);
});

test('allows normal readiness when recovery and mental signals are calm', () => {
  const guidance = buildResilienceGuidance({
    home: home(),
    checkin: checkin({ mood: 8, energy: 8, stress: 2, motivation: 8 }),
  });

  assert.equal(guidance.state, 'ready');
  assert.equal(guidance.primaryAction.kind, 'open_plan');
  assert.match(guidance.title, /normal/i);
  assert.match(guidance.lanes.find(lane => lane.id === 'quality')?.body ?? '', /nutzbar/i);
});

test('treats missing check-in as signal quality instead of failure', () => {
  const guidance = buildResilienceGuidance({
    home: null,
    checkin: null,
  });

  assert.equal(guidance.state, 'unknown');
  assert.equal(guidance.primaryAction.kind, 'check_in');
  assert.match(guidance.title, /Signal/i);
  assert.match(guidance.lanes.find(lane => lane.id === 'quality')?.body ?? '', /Check-in|Garmin|offen/i);
  assert.ok(!/krankheit|diagnose|depression/i.test(`${guidance.title} ${guidance.summary}`));
});
