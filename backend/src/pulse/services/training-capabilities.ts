import type {
  PulseCapabilityConfidence,
  PulseTrainingCapabilityLevel,
  PulseTrainingCapabilitySummary,
  PulseTrainingEnergySystem,
  PulseTrainingProgressionSignal,
  PulseWorkoutCapabilityFit,
  PulseWorkoutFitLabel,
} from '@coaching-os/shared/pulse';
import {
  computeWorkoutDifficulty,
  deriveAthleteProgression,
  type CompletedProgressionWorkout,
  type ProgressionRecentActivity,
  type TrainingEnergySystem,
  type WorkoutDifficultyInput,
} from './training-intelligence.js';

export type CapabilityCompletedWorkout = CompletedProgressionWorkout;
export type CapabilityRecentActivity = ProgressionRecentActivity;

export const CAPABILITY_LOOKBACK_DAYS = 90;

const CAPABILITY_ORDER: PulseTrainingEnergySystem[] = [
  'long_endurance',
  'endurance',
  'tempo',
  'threshold',
  'vo2',
  'anaerobic',
  'recovery',
  'strength',
];

const CAPABILITY_LABELS: Record<PulseTrainingEnergySystem, string> = {
  recovery: 'Recovery',
  endurance: 'Endurance',
  long_endurance: 'Long Endurance',
  tempo: 'Tempo',
  threshold: 'Threshold',
  vo2: 'VO2',
  anaerobic: 'Anaerobic',
  strength: 'Strength',
};

export const WORKOUT_FIT_LEGEND: Record<PulseWorkoutFitLabel, string> = {
  recovery: 'Aktive Erholung',
  maintenance: 'Erhaltung',
  productive: 'Produktiv',
  stretch: 'Stretch',
  too_hard_today: 'Zu hart heute',
};

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function emptyLevel(energySystem: PulseTrainingEnergySystem): PulseTrainingCapabilityLevel {
  return {
    energySystem,
    label: CAPABILITY_LABELS[energySystem],
    level: 2,
    nextRecommendedWorkoutLevel: 2,
    lastProgressionReason: null,
    staleReason: null,
    confidence: 'low',
    evidence: [],
    updatedAt: null,
  };
}

function addSignal(signals: PulseTrainingProgressionSignal[], signal: PulseTrainingProgressionSignal): void {
  if (!signals.includes(signal)) signals.push(signal);
}

function addEvidence(level: PulseTrainingCapabilityLevel, evidence: string): void {
  if (!level.evidence.includes(evidence)) level.evidence.push(evidence);
}

function setConfidence(current: PulseCapabilityConfidence, next: PulseCapabilityConfidence): PulseCapabilityConfidence {
  const rank = { low: 0, medium: 1, high: 2 } satisfies Record<PulseCapabilityConfidence, number>;
  return rank[next] > rank[current] ? next : current;
}

function pulseEnergySystem(system: TrainingEnergySystem): PulseTrainingEnergySystem {
  return system as PulseTrainingEnergySystem;
}

export function deriveTrainingCapabilities(input: {
  completedWorkouts: CapabilityCompletedWorkout[];
  recentActivities: CapabilityRecentActivity[];
  lookbackDays?: number;
  generatedAt?: Date;
}): PulseTrainingCapabilitySummary {
  const base = deriveAthleteProgression({
    completedWorkouts: input.completedWorkouts,
    recentActivities: input.recentActivities,
  });
  const levels = Object.fromEntries(
    CAPABILITY_ORDER.map(system => [system, emptyLevel(system)]),
  ) as Record<PulseTrainingEnergySystem, PulseTrainingCapabilityLevel>;
  const signals = [...base.signals] as PulseTrainingProgressionSignal[];
  const recommendations = [...base.recommendations];

  for (const system of CAPABILITY_ORDER) {
    const baseLevel = base.levels[system as TrainingEnergySystem];
    levels[system] = {
      ...levels[system],
      level: baseLevel.level,
      confidence: baseLevel.confidence,
      evidence: [...baseLevel.evidence],
    };
  }

  for (const workout of input.completedWorkouts) {
    const difficulty = computeWorkoutDifficulty(workout);
    const system = pulseEnergySystem(difficulty.energySystem);
    const target = levels[system];
    const compliance = workout.complianceScore ?? 0.75;
    const rpe = workout.rpe ?? null;
    const success = compliance >= 0.82 && (rpe == null || rpe <= 8);
    const struggle = compliance < 0.65 || (rpe != null && rpe >= 9);

    if (success) {
      target.level = Math.max(target.level, round1(difficulty.level * (compliance >= 0.9 ? 0.82 : 0.75)));
      target.confidence = setConfidence(target.confidence, compliance >= 0.9 ? 'high' : 'medium');
      addEvidence(target, `${workout.activityType} Z${workout.zone} ${workout.durationMin}min mit gutem Fit abgeschlossen.`);
      target.lastProgressionReason = `${CAPABILITY_LABELS[system]} sauber abgeschlossen; nächster produktiver Reiz darf leicht steigen.`;
      addSignal(signals, 'quality_progress');
    } else if (struggle) {
      target.level = Math.min(target.level, 2.5);
      target.confidence = setConfidence(target.confidence, 'medium');
      addEvidence(target, `${workout.activityType} Z${workout.zone} war kein Progressionssignal.`);
      target.lastProgressionReason = `${CAPABILITY_LABELS[system]} vorsichtig halten: hohe Anstrengung oder niedrige Compliance.`;
      addSignal(signals, 'reduce_next_intensity');
    }
  }

  for (const activity of input.recentActivities) {
    const longOffPlan = activity.source === 'off_plan'
      && (activity.durationMin >= 240 || (activity.tss ?? 0) >= 250);
    if (!longOffPlan) continue;

    const difficulty = computeWorkoutDifficulty({
      activityType: activity.activityType,
      zone: 2,
      durationMin: activity.durationMin,
      targetTss: activity.tss ?? null,
    });
    const longLevel = levels.long_endurance;
    longLevel.level = Math.max(longLevel.level, round1(difficulty.level * 0.6));
    longLevel.confidence = setConfidence(longLevel.confidence, 'medium');
    addEvidence(longLevel, `ungeplante lange ${activity.activityType}-Einheit ${activity.durationMin}min erkannt.`);
    longLevel.lastProgressionReason = 'Long Endurance geschützt nach langer ungeplanter Belastung; erst Erholung und Fueling schließen.';

    const endurance = levels.endurance;
    endurance.level = Math.max(endurance.level, round1(Math.min(longLevel.level - 0.4, 4.2)));
    endurance.confidence = setConfidence(endurance.confidence, 'medium');
    addEvidence(endurance, 'lange Ausdauer wurde real ausgefuehrt, aber nicht als Freifahrtschein fuer Zusatzstress gewertet.');
    endurance.lastProgressionReason = 'Endurance vorsichtig angehoben, weil die lange Einheit real ausgeführt wurde.';

    addSignal(signals, 'long_off_plan_load');
    addSignal(signals, 'protect_recovery');
  }

  if (signals.includes('protect_recovery')) {
    const message = 'Fueling und Erholung nach langer ungeplanter Belastung aktiv pruefen, bevor wieder lange oder harte Reize geplant werden.';
    if (!recommendations.includes(message)) recommendations.push(message);
  }
  if (signals.includes('missing_history') && recommendations.length === 0) {
    recommendations.push('Capability-Level konservativ halten, bis mehr geplante und bewertete Einheiten vorliegen.');
  }

  return {
    generatedAt: (input.generatedAt ?? new Date()).toISOString(),
    lookbackDays: input.lookbackDays ?? CAPABILITY_LOOKBACK_DAYS,
    levels: CAPABILITY_ORDER.map(system => ({
      ...(() => {
        const level = clamp(round1(levels[system].level), 1, 10);
        const isHardSystem = ['tempo', 'threshold', 'vo2', 'anaerobic'].includes(system);
        const recoveryProtected = signals.includes('protect_recovery')
          && (system === 'long_endurance' || isHardSystem);
        const intensityReduced = signals.includes('reduce_next_intensity') && isHardSystem;
        const hasEvidence = levels[system].evidence.length > 0;
        const nextRecommendedWorkoutLevel = recoveryProtected
          ? level
          : intensityReduced
            ? clamp(round1(level - 0.2), 1, 10)
            : hasEvidence
              ? clamp(round1(level + 0.3), 1, 10)
              : level;
        const fallbackReason = recoveryProtected
          ? `${CAPABILITY_LABELS[system]} geschützt: erst Erholung, Fueling und Tagesform prüfen.`
          : intensityReduced
            ? `${CAPABILITY_LABELS[system]} vorsichtig halten: letzte harte Ausführung war zu schwer.`
            : hasEvidence
              ? `${CAPABILITY_LABELS[system]} stabil; nächster produktiver Reiz darf leicht steigen.`
              : null;
        return {
          ...levels[system],
          level,
          nextRecommendedWorkoutLevel,
          lastProgressionReason: levels[system].lastProgressionReason ?? fallbackReason,
          staleReason: hasEvidence ? null : `${CAPABILITY_LABELS[system]} hat noch keine belastbare Evidenz im ${input.lookbackDays ?? CAPABILITY_LOOKBACK_DAYS}-Tage-Fenster.`,
          evidence: levels[system].evidence.slice(0, 4),
        };
      })(),
    })),
    signals,
    recommendations: recommendations.slice(0, 4),
    fitLegend: WORKOUT_FIT_LEGEND,
  };
}

function capabilityFor(
  summary: PulseTrainingCapabilitySummary,
  energySystem: PulseTrainingEnergySystem,
): PulseTrainingCapabilityLevel {
  return summary.levels.find(level => level.energySystem === energySystem) ?? emptyLevel(energySystem);
}

function fitLabelFor(delta: number, difficulty: ReturnType<typeof computeWorkoutDifficulty>, summary: PulseTrainingCapabilitySummary): PulseWorkoutFitLabel {
  const capability = capabilityFor(summary, pulseEnergySystem(difficulty.energySystem));
  if (difficulty.energySystem === 'recovery') return 'recovery';
  if (
    summary.signals.includes('protect_recovery')
    && (difficulty.level >= 5.8 || difficulty.energySystem === 'long_endurance')
  ) return 'too_hard_today';
  if (summary.signals.includes('reduce_next_intensity') && difficulty.level >= 5.8) return 'too_hard_today';
  if (difficulty.energySystem === 'endurance' && difficulty.level <= 3.2) return 'maintenance';
  if (capability.confidence === 'low' && summary.signals.includes('missing_history') && difficulty.level >= 5) return 'stretch';
  if (delta <= -1) return 'maintenance';
  if (delta <= 0.8) return 'productive';
  if (delta <= 1.4) return 'stretch';
  return 'too_hard_today';
}

function fitMessage(label: PulseWorkoutFitLabel, difficulty: ReturnType<typeof computeWorkoutDifficulty>, capabilityLevel: number): Pick<PulseWorkoutCapabilityFit, 'message' | 'recommendation'> {
  if (label === 'recovery') {
    return {
      message: 'Sehr leichter Reiz, passend als aktive Erholung.',
      recommendation: 'Ausfuehren, wenn du dich danach frischer fuehlst als vorher.',
    };
  }
  if (label === 'maintenance') {
    return {
      message: `Workout-Level ${difficulty.level.toFixed(1)} liegt klar unter deinem aktuellen Bereich ${capabilityLevel.toFixed(1)}.`,
      recommendation: 'Gut fuer Erhaltung, Technik oder ruhige Alltagskonsistenz.',
    };
  }
  if (label === 'productive') {
    return {
      message: `Workout-Level ${difficulty.level.toFixed(1)} passt zu deinem aktuellen Bereich ${capabilityLevel.toFixed(1)}.`,
      recommendation: 'Sinnvoller Progressionsreiz, wenn Tagesform und Fueling stimmen.',
    };
  }
  if (label === 'stretch') {
    return {
      message: `Workout-Level ${difficulty.level.toFixed(1)} liegt ueber deinem aktuellen Bereich ${capabilityLevel.toFixed(1)}.`,
      recommendation: 'Nur mit guter Erholung, genug Zeit und sauberer Verpflegung ausfuehren.',
    };
  }
  return {
    message: `Workout-Level ${difficulty.level.toFixed(1)} ist fuer heute deutlich ueber deinem Bereich ${capabilityLevel.toFixed(1)}.`,
    recommendation: 'Besser kuerzen, in aerobe Arbeit tauschen oder verschieben.',
  };
}

export function fitWorkoutToCapabilities(
  workout: WorkoutDifficultyInput,
  summary: PulseTrainingCapabilitySummary,
): PulseWorkoutCapabilityFit {
  const difficulty = computeWorkoutDifficulty(workout);
  const energySystem = pulseEnergySystem(difficulty.energySystem);
  const capability = capabilityFor(summary, energySystem);
  const delta = difficulty.level - capability.level;
  const label = fitLabelFor(delta, difficulty, summary);
  const copy = fitMessage(label, difficulty, capability.level);

  return {
    energySystem,
    workoutLevel: difficulty.level,
    capabilityLevel: capability.level,
    label,
    displayLabel: WORKOUT_FIT_LEGEND[label],
    confidence: capability.confidence,
    ...copy,
  };
}

export function summarizePlanCapabilityFit(
  workouts: WorkoutDifficultyInput[],
  summary: PulseTrainingCapabilitySummary,
): string[] {
  const fits = workouts.map(workout => fitWorkoutToCapabilities(workout, summary));
  if (fits.length === 0) return [];

  const priority: Record<PulseWorkoutFitLabel, number> = {
    too_hard_today: 5,
    stretch: 4,
    productive: 3,
    maintenance: 2,
    recovery: 1,
  };
  const keyFit = [...fits].sort((a, b) => priority[b.label] - priority[a.label])[0]!;
  const messages = [`Level-Fit: ${keyFit.displayLabel} fuer ${CAPABILITY_LABELS[keyFit.energySystem]} (${keyFit.workoutLevel.toFixed(1)} vs ${keyFit.capabilityLevel.toFixed(1)}).`];

  if (summary.signals.includes('protect_recovery')) {
    messages.push('Level-Fit: lange ungeplante Belastung ist eingepreist; Erholung und Fueling haben Vorrang.');
  }
  return messages;
}
