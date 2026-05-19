import assert from 'node:assert/strict';
import test from 'node:test';

import type { PulsePlanTrace } from '../shared/types/pulse/index.ts';
import { buildAnalysisTranslation } from '../frontend/src/features/data/analysis/analysis-translation-model.ts';

function planTraceWithLimiter(): PulsePlanTrace {
  return {
    id: 'trace-1',
    userId: 'u1',
    weekStart: '2026-05-11',
    createdAt: '2026-05-11T06:00:00.000Z',
    inputSnapshot: {
      phase: 'build',
      mesocycleWeek: 2,
      weeklyHoursTarget: 8,
      availableDays: [1, 3, 5],
      load: { ctl: 55, atl: 76, tsb: -21, date: '2026-05-11' },
      profile: { ftpWatts: 240, maxHrBpm: null, lthrBpm: null },
      goals: [{
        title: '70.3 Kraichgau',
        category: 'race',
        targetDate: '2026-07-11',
        raceDiscipline: 'triathlon_70_3',
        raceDistanceKm: null,
        racePriority: 'A',
      }],
      riskSignals: [{ ruleId: 'tsb', severity: 'watch', title: 'TSB beobachten' }],
      healthStates: [],
      recentRpe: [],
      rpeReasons: [],
      dataWarnings: [],
      recentSportMix: {},
      goalLimiter: {
        kind: 'long_endurance_fueling',
        label: 'Long Endurance + Fueling',
        confidence: 'medium',
        evidence: ['Long-Endurance-Level 3.1', 'Fueling-Verträglichkeit lernt'],
        planBias: 'Die Woche sollte den nächsten langen Fueling-Reiz kontrolliert prüfen.',
        workoutFocus: ['long_endurance', 'endurance'],
      },
    },
    planDecision: {
      selectedDays: [1, 5],
      skippedAvailableDays: [3],
      targetSessionCount: 2,
      primaryGoal: '70.3 Kraichgau',
      reasons: [],
    },
    sportMix: {},
    hardDays: [],
    generatedSummary: [],
  };
}

test('plan limiter analysis opens the shared Plan weekly decision before scenario tools', () => {
  const translation = buildAnalysisTranslation({
    decisionQuality: null,
    goalProjection: null,
    personalResponse: null,
    planTrace: planTraceWithLimiter(),
    trainingAnalytics: null,
  });

  assert.equal(translation.primary.label, 'Plan-Limiter');
  assert.equal(translation.primary.actionLabel, 'Wochenentscheidung prüfen');
  assert.equal(translation.primary.targetPath, '/plan?tab=training&source=data-load#plan-weekly-decision');
  assert.match(translation.primary.resultPreview ?? '', /Wochenentscheidung/);
  assert.match(translation.primary.resultPreview ?? '', /Plan und Garmin bleiben unverändert/);
});
