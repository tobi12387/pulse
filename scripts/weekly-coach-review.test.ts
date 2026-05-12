import assert from 'node:assert/strict';
import test from 'node:test';

import type {
  PulseAdaptationEvent,
  PulseGoalProjectionResponse,
  PulsePersonalResponseResponse,
  PulseSeasonStrategyResponse,
  PulseWeeklyReview,
} from '../shared/types/pulse/index.ts';
import { buildWeeklyCoachReview } from '../frontend/src/features/plan/weekly-coach-review-model.ts';

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

const review: PulseWeeklyReview = {
  id: 'review-1',
  userId: 'u1',
  weekStart: '2026-05-11',
  weekEnd: '2026-05-17',
  narrative: 'Die Woche war solide. Halte den langen Reiz kontrolliert.',
  metrics: {},
  recommendations: ['Lange Einheit mit Fueling-Log abschließen.', 'Harten Tag nur bei gutem Check-in fahren.'],
  createdAt: '2026-05-12T06:00:00.000Z',
};

const personalResponse: PulsePersonalResponseResponse = {
  summary: {
    generatedAt: '2026-05-12T06:00:00.000Z',
    range: { from: '2026-04-01', to: '2026-05-12', days: 42 },
    strength: 'learning',
    headline: 'Pulse lernt: mentale Last verändert deine Trainingsentscheidung.',
    signals: [{
      kind: 'mental_response',
      label: 'Mentale Last einbeziehen',
      strength: 'learning',
      summary: 'Stressreiche Tage brauchen klarere Boundaries.',
      evidence: ['2 Check-ins mit Stress >=7'],
      nextAdjustment: 'Vor harten Einheiten zuerst Boundary und Warm-up prüfen.',
    }],
    missingEvidence: ['Mehr vollständige Fueling-Logs fehlen.'],
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

const seasonStrategy: PulseSeasonStrategyResponse = {
  strategy: {
    horizonWeeks: 12,
    primaryGoal: { id: 'goal-1', title: '70.3 Kraichgau', category: 'race', targetDate: '2026-07-11', priority: 'A' },
    currentBlock: { kind: 'build', label: 'Build', startWeek: '2026-05-11', endWeek: '2026-06-01', focus: 'Spezifität aufbauen, aber freie Tage schützen.' },
    upcomingBlocks: [],
    guardrails: {
      targetSessions: 4,
      maxHardDays: 1,
      deload: false,
      freeDayRationale: 'Mindestens ein freier Tag bleibt geschützt.',
      rationale: ['Verfügbarkeit ist größer als sinnvolle Trainingsdichte.'],
      nextBoundary: { label: 'Taper', date: '2026-06-29' },
    },
    loadModel: {
      method: 'weekly_hours_tss_ctl',
      rampRateCapPct: 8,
      deloadEveryWeeks: 4,
      taperWeeks: 2,
      annualTargetHours: null,
      annualTargetTss: null,
      eventPriorityBias: 'a_event',
      missedLoadCompensation: { missedTssLast14d: 0, compensationTssNext14d: 0, capReason: 'Keine Kompensation nötig.' },
      currentWeek: { weekStart: '2026-05-11', kind: 'build', targetHours: 8, targetTss: 384, ctlTarget: 55, rampPct: 5, note: 'Build ruhig halten.' },
      forecast: [],
      warnings: [],
    },
    evidence: ['A-Race in 60 Tagen'],
  },
};

test('prioritizes unresolved action events as the weekly coach decision', () => {
  const summary = buildWeeklyCoachReview({
    review,
    adaptationEvents: [event({ summary: 'Gestern wurde die harte Einheit ersetzt.' })],
    personalResponse,
    goalProjection,
    seasonStrategy,
  });

  assert.equal(summary.tone, 'attention');
  assert.equal(summary.primaryAction.kind, 'open_plan_inbox');
  assert.equal(summary.primaryAction.label, 'Planpunkte prüfen');
  assert.match(summary.title, /Wochenentscheidung offen/);
  assert.match(summary.lanes.find(lane => lane.id === 'learned')?.body ?? '', /mentale Last/i);
  assert.match(summary.lanes.find(lane => lane.id === 'plan_change')?.body ?? '', /harte Einheit ersetzt/);
  assert.match(summary.lanes.find(lane => lane.id === 'decision')?.body ?? '', /prüfen/i);
});

test('summarizes a stable week from review recommendations and season focus', () => {
  const summary = buildWeeklyCoachReview({
    review,
    adaptationEvents: [],
    personalResponse,
    goalProjection,
    seasonStrategy,
  });

  assert.equal(summary.tone, 'ok');
  assert.equal(summary.primaryAction.kind, 'read_review');
  assert.match(summary.title, /Woche stabil/);
  assert.match(summary.summary, /70\.3 Kraichgau/);
  assert.match(summary.lanes.find(lane => lane.id === 'plan_change')?.body ?? '', /Lange Einheit/);
  assert.match(summary.lanes.find(lane => lane.id === 'decision')?.body ?? '', /beibehalten/i);
});

test('asks for explicit generation when no weekly review exists yet', () => {
  const summary = buildWeeklyCoachReview({
    review: null,
    adaptationEvents: [],
    personalResponse: null,
    goalProjection: null,
    seasonStrategy: null,
  });

  assert.equal(summary.tone, 'info');
  assert.equal(summary.primaryAction.kind, 'generate_review');
  assert.match(summary.title, /Review fehlt/);
  assert.match(summary.lanes.find(lane => lane.id === 'learned')?.body ?? '', /nicht genug/i);
});
