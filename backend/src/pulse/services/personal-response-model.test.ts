import type { PulseDailyOutcomeLearningItem, PulseFuelingOutcomeBaseline } from '@coaching-os/shared/pulse';
import { describe, expect, it } from 'vitest';
import { buildPersonalResponseSummary } from './personal-response-model.js';

function outcome(overrides: Partial<PulseDailyOutcomeLearningItem> = {}): PulseDailyOutcomeLearningItem {
  return {
    date: '2026-05-08',
    actionId: 'action-1',
    actionTitle: 'Training abschliessen',
    actionStatus: 'completed',
    status: 'reinforced',
    title: 'Empfehlung wurde durch Daten bestaetigt',
    reason: 'Die Aktion passt zu den erfassten Tagesdaten.',
    evidence: ['Geplante Einheit bike abgeschlossen'],
    suggestedAdjustment: 'Diesen Handlungstyp beibehalten.',
    ...overrides,
  };
}

const learningFuelingBaseline: PulseFuelingOutcomeBaseline = {
  status: 'learning',
  label: 'Fueling-Baseline lernen',
  summary: 'Letzter langer Log: 54 g/h, 4 x 750 ml; naechste Teststufe 50-70 g/h.',
  latestLogDate: '2026-05-09',
  observedCarbsPerHour: 54,
  targetCarbsPerHour: { min: 50, max: 70 },
  bottles750Ml: 4,
  powderG: 300,
  fluidMlPerHour: 452,
  sodiumMgPerHour: null,
  evidence: ['Letzter Log: 2026-05-09, 54 g/h', 'Sodium nicht geloggt'],
};

describe('buildPersonalResponseSummary', () => {
  it('reports insufficient evidence when comparable outcomes are missing', () => {
    const summary = buildPersonalResponseSummary({
      today: '2026-05-11',
      days: 42,
      dailyOutcomes: [],
      decisionQuality: null,
      fuelingBaseline: null,
      mentalCheckins: [],
      executionReviews: [],
    });

    expect(summary.strength).toBe('insufficient');
    expect(summary.headline).toBe('Pulse sammelt noch belastbare Reaktionsdaten.');
    expect(summary.missingEvidence).toContain('Mindestens drei abgeschlossene Trainings-/Recovery-Tage mit Folgeevidenz fehlen.');
    expect(summary.signals.map(signal => signal.kind)).toEqual(['execution_response', 'mental_response', 'fueling_response']);
  });

  it('summarizes learning patterns without overstating weak evidence', () => {
    const summary = buildPersonalResponseSummary({
      today: '2026-05-11',
      days: 42,
      dailyOutcomes: [
        outcome({ actionId: 'action-1', date: '2026-05-08' }),
        outcome({ actionId: 'action-2', date: '2026-05-07', status: 'superseded_by_data' }),
        outcome({ actionId: 'action-3', date: '2026-05-06', status: 'stale_pattern' }),
      ],
      decisionQuality: null,
      fuelingBaseline: learningFuelingBaseline,
      mentalCheckins: [
        { date: '2026-05-11', mood: 6, energy: 4, stress: 7, motivation: 5 },
        { date: '2026-05-10', mood: 7, energy: 5, stress: 6, motivation: 6 },
        { date: '2026-05-09', mood: 6, energy: 3, stress: 8, motivation: 5 },
      ],
      executionReviews: [],
    });

    expect(summary.strength).toBe('learning');
    expect(summary.headline).toBe('Pulse lernt deine Reaktionsmuster.');
    expect(summary.signals.map(signal => signal.kind)).toEqual(['execution_response', 'mental_response', 'fueling_response']);
    expect(summary.signals.find(signal => signal.kind === 'mental_response')?.nextAdjustment).toContain('Boundary');
    expect(summary.signals.find(signal => signal.kind === 'fueling_response')?.evidence).toContain('Sodium nicht geloggt');
    expect(summary.missingEvidence).toContain('Mindestens drei vergleichbare vollstaendige During-Fueling-Logs fehlen.');
  });
});
