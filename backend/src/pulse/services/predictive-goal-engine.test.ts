import { describe, expect, it } from 'vitest';
import type {
  PulseFuelingOutcomeBaseline,
  PulsePersonalResponseSummary,
  PulseTrainingCapabilitySummary,
  PulseTrainingEnergySystem,
} from '@coaching-os/shared/pulse';
import { buildGoalProjectionSummary, type BuildGoalProjectionInput } from './predictive-goal-engine.js';

function capabilitySummary(levels: Partial<Record<PulseTrainingEnergySystem, number>> = {}): PulseTrainingCapabilitySummary {
  const systems: PulseTrainingEnergySystem[] = ['recovery', 'endurance', 'long_endurance', 'tempo', 'threshold', 'vo2', 'anaerobic', 'strength'];
  return {
    generatedAt: '2026-05-11T00:00:00.000Z',
    lookbackDays: 90,
    signals: [],
    recommendations: [],
    fitLegend: {
      recovery: 'Erholung',
      maintenance: 'Erhalten',
      productive: 'Produktiv',
      stretch: 'Stretch',
      too_hard_today: 'Zu hart heute',
    },
    levels: systems.map(system => ({
      energySystem: system,
      label: system,
      level: levels[system] ?? 3.4,
      nextRecommendedWorkoutLevel: levels[system] ?? 3.4,
      lastProgressionReason: null,
      staleReason: null,
      confidence: 'medium',
      evidence: [`${system} Level ${(levels[system] ?? 3.4).toFixed(1)}`],
      updatedAt: '2026-05-10T00:00:00.000Z',
    })),
  };
}

function personalResponse(strength: PulsePersonalResponseSummary['strength']): PulsePersonalResponseSummary {
  return {
    generatedAt: '2026-05-11T00:00:00.000Z',
    range: { from: '2026-03-30', to: '2026-05-11', days: 42 },
    strength,
    headline: strength === 'useful' ? 'Pulse erkennt Muster.' : 'Pulse lernt Muster.',
    signals: [
      {
        kind: 'execution_response',
        label: 'Ausführung',
        strength,
        summary: 'Entscheidungen haben Folgeevidenz.',
        evidence: ['4 bestätigte Entscheidungen'],
        nextAdjustment: 'Muster weiter nutzen.',
      },
    ],
    missingEvidence: strength === 'useful' ? [] : ['Mehr Folgeevidenz fehlt.'],
  };
}

const fuelingBaseline: PulseFuelingOutcomeBaseline = {
  status: 'learning',
  label: 'Fueling lernt',
  summary: 'Ein langer Log ist nutzbar, aber noch kein Trend.',
  latestLogDate: '2026-05-10',
  observedCarbsPerHour: 55,
  targetCarbsPerHour: { min: 50, max: 70 },
  bottles750Ml: 4,
  powderG: 300,
  fluidMlPerHour: 620,
  sodiumMgPerHour: null,
  evidence: ['1 kontrollierter During-Log'],
};

const baseInput: BuildGoalProjectionInput = {
  today: '2026-05-11',
  horizonDays: 180,
  goals: [],
  fitnessLoad: { ctl: 48, atl: 55, tsb: -7 },
  trainingCapabilities: capabilitySummary(),
  goalLimiter: null,
  seasonStrategy: null,
  personalResponse: personalResponse('learning'),
  fuelingBaseline,
  riskSignals: [],
  healthStates: [],
  weightTrend: [],
  plannedWorkouts: [],
};

describe('buildGoalProjectionSummary', () => {
  it('flags a 70.3 race as watch when long-endurance and fueling evidence are still limiting', () => {
    const result = buildGoalProjectionSummary({
      ...baseInput,
      goals: [{
        id: 'race-1',
        title: '70.3 Kraichgau',
        category: 'race',
        targetDate: '2026-07-19',
        progress: 0,
        metrics: {},
        raceDiscipline: 'triathlon_70_3',
        raceDistanceKm: 113,
        raceTargetTimeSec: null,
        racePriority: 'A',
      }],
      trainingCapabilities: capabilitySummary({ long_endurance: 2.4, endurance: 3.1, threshold: 3.2, vo2: 3.0 }),
      goalLimiter: {
        kind: 'long_endurance_fueling',
        label: 'Long Endurance + Fueling',
        confidence: 'medium',
        evidence: ['Long-Endurance-Level 2.4', 'GI-/Fueling-Verträglichkeit als Limitersignal'],
        planBias: 'lange Ausdauer kontrolliert aufbauen und Fueling-Verträglichkeit absichern',
        workoutFocus: ['long_endurance', 'endurance'],
      },
    });

    expect(result.projections).toHaveLength(1);
    expect(result.projections[0]).toMatchObject({
      goalId: 'race-1',
      status: 'watch',
      limiterRisk: { status: 'watch', label: 'Long Endurance + Fueling' },
      nextBestIntervention: { kind: 'fueling_practice' },
    });
    expect(result.projections[0]!.probabilityPct).toBeLessThan(70);
    expect(result.projections[0]!.evidence).toEqual(expect.arrayContaining([
      expect.stringContaining('Long-Endurance-Level 2.4'),
    ]));
  });

  it('keeps body-composition projections insufficient when recent weight evidence is missing', () => {
    const result = buildGoalProjectionSummary({
      ...baseInput,
      goals: [{
        id: 'weight-1',
        title: 'Gewicht: 78 kg',
        category: 'weight',
        targetDate: '2026-08-01',
        progress: 0,
        metrics: { targetKg: 78 },
        raceDiscipline: null,
        raceDistanceKm: null,
        raceTargetTimeSec: null,
        racePriority: null,
      }],
      weightTrend: [{ date: '2026-04-01', weightKg: 83.2, bodyFatPct: null, muscleMassKg: null }],
    });

    expect(result.projections[0]).toMatchObject({
      status: 'insufficient_evidence',
      confidence: 'low',
      nextBestIntervention: { kind: 'data_quality', targetPath: '/data?tab=weight#data-weight' },
    });
    expect(result.missingEvidence).toEqual(expect.arrayContaining([
      expect.stringContaining('Gewichts- oder Körperdaten'),
    ]));
  });

  it('shows an intensity goal as on track when capability and response evidence are useful', () => {
    const result = buildGoalProjectionSummary({
      ...baseInput,
      goals: [{
        id: 'ftp-1',
        title: 'FTP: 290 W',
        category: 'ftp',
        targetDate: '2026-09-01',
        progress: 0,
        metrics: { targetFtp: 290 },
        raceDiscipline: null,
        raceDistanceKm: null,
        raceTargetTimeSec: null,
        racePriority: null,
      }],
      fitnessLoad: { ctl: 58, atl: 55, tsb: 3 },
      trainingCapabilities: capabilitySummary({ endurance: 4.0, threshold: 4.2, vo2: 4.0 }),
      personalResponse: personalResponse('useful'),
      plannedWorkouts: [
        { plannedDate: '2026-05-13', zone: 4, durationMin: 60, targetTss: 78, capabilityFit: 'productive', status: 'planned' },
      ],
    });

    expect(result.projections[0]).toMatchObject({
      status: 'on_track',
      confidence: 'medium',
      nextBestIntervention: { kind: 'threshold_vo2' },
    });
    expect(result.projections[0]!.probabilityPct).toBeGreaterThanOrEqual(70);
  });
});
