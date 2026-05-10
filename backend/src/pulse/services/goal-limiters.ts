import type {
  PulseGoalLimiter,
  PulseTrainingCapabilitySummary,
  PulseTrainingEnergySystem,
} from '@coaching-os/shared/pulse';

interface GoalLimiterGoal {
  title: string;
  category: string | null;
  targetDate: string | null;
  raceDiscipline: string | null;
  raceDistanceKm: number | null;
  racePriority: 'A' | 'B' | 'C' | null;
}

interface GoalLimiterRecentActivity {
  date: string;
  activityType: string;
  durationMin: number;
  tss: number;
  rpe?: number | null;
  plannedZone?: number | null;
}

interface GoalLimiterFuelingHistory {
  date: string;
  activityType?: string | null;
  durationMin?: number | null;
  giComfort?: string | null;
  powderG?: number | null;
  notes?: string | null;
}

export interface DeriveGoalLimiterInput {
  goals: GoalLimiterGoal[];
  trainingCapabilities: PulseTrainingCapabilitySummary | null;
  recentActivities: GoalLimiterRecentActivity[];
  fuelingHistory: GoalLimiterFuelingHistory[];
  durability?: {
    rating: 'strong' | 'watch' | 'limited';
    evidence: string[];
    qualitySource: 'stream' | 'lap_approximation';
    qualityStatus: 'trusted' | 'usable_with_caution';
  } | null;
}

function capabilityLevel(summary: PulseTrainingCapabilitySummary | null, system: PulseTrainingEnergySystem): number | null {
  return summary?.levels.find(level => level.energySystem === system)?.level ?? null;
}

function confidenceFor(summary: PulseTrainingCapabilitySummary | null, systems: PulseTrainingEnergySystem[]): PulseGoalLimiter['confidence'] {
  const confidences = systems
    .map(system => summary?.levels.find(level => level.energySystem === system)?.confidence)
    .filter((value): value is PulseGoalLimiter['confidence'] => value != null);
  if (confidences.includes('high')) return 'high';
  if (confidences.includes('medium')) return 'medium';
  return 'low';
}

function primaryGoal(goals: GoalLimiterGoal[]): GoalLimiterGoal | null {
  return [...goals]
    .sort((a, b) => priorityScore(b.racePriority) - priorityScore(a.racePriority))[0] ?? null;
}

function priorityScore(priority: 'A' | 'B' | 'C' | null): number {
  if (priority === 'A') return 3;
  if (priority === 'B') return 2;
  if (priority === 'C') return 1;
  return 0;
}

function isLongEvent(goal: GoalLimiterGoal | null): boolean {
  if (!goal) return false;
  const discipline = goal.raceDiscipline ?? '';
  return (goal.raceDistanceKm ?? 0) >= 100
    || discipline === 'triathlon_70_3'
    || discipline === 'triathlon_140_6';
}

function hasFuelingIssue(history: GoalLimiterFuelingHistory[]): boolean {
  return history.some(log => {
    const text = `${log.giComfort ?? ''} ${log.notes ?? ''}`.toLowerCase();
    return text.includes('issue')
      || text.includes('problem')
      || text.includes('magen')
      || text.includes('gi')
      || text.includes('uncomfortable');
  });
}

function isIntensityGoal(goal: GoalLimiterGoal | null): boolean {
  if (!goal) return false;
  const text = `${goal.category ?? ''} ${goal.title}`.toLowerCase();
  return text.includes('ftp')
    || text.includes('vo2')
    || text.includes('schwelle')
    || text.includes('threshold')
    || text.includes('leistung');
}

export function deriveGoalLimiter(input: DeriveGoalLimiterInput): PulseGoalLimiter | null {
  const goal = primaryGoal(input.goals);
  if (!goal || !input.trainingCapabilities) return null;

  const longEndurance = capabilityLevel(input.trainingCapabilities, 'long_endurance');
  const endurance = capabilityLevel(input.trainingCapabilities, 'endurance');
  const threshold = capabilityLevel(input.trainingCapabilities, 'threshold');
  const vo2 = capabilityLevel(input.trainingCapabilities, 'vo2');
  const longestRecent = input.recentActivities.reduce((max, activity) => Math.max(max, activity.durationMin), 0);
  const hardRpe = input.recentActivities.some(activity => (activity.plannedZone ?? 0) >= 4 && (activity.rpe ?? 0) >= 8);
  const fuelingIssue = hasFuelingIssue(input.fuelingHistory);

  if (input.durability?.rating === 'limited') {
    return {
      kind: 'durability',
      label: 'Durability',
      confidence: input.durability.qualitySource === 'stream' ? 'high' : 'medium',
      evidence: [...input.durability.evidence, `Quelle: ${input.durability.qualitySource}`],
      planBias: 'lange Ausdauer progressiv verlaengern und Spaetleistungsabfall reduzieren',
      workoutFocus: ['long_endurance', 'endurance'],
    };
  }

  if (isLongEvent(goal) && ((longEndurance ?? 0) < 3.5 || fuelingIssue || longestRecent >= 180)) {
    const evidence = [
      goal.raceDistanceKm ? `${goal.raceDistanceKm} km Zieldistanz` : `${goal.title} als langes Ziel`,
      longEndurance != null ? `Long-Endurance-Level ${longEndurance.toFixed(1)}` : null,
      fuelingIssue ? 'GI-/Fueling-Verträglichkeit als Limitersignal' : null,
      longestRecent >= 180 ? `letzte lange Einheit ${Math.round(longestRecent / 60)} h` : null,
    ].filter((item): item is string => item != null);
    return {
      kind: 'long_endurance_fueling',
      label: 'Long Endurance + Fueling',
      confidence: confidenceFor(input.trainingCapabilities, ['long_endurance', 'endurance']),
      evidence,
      planBias: 'lange Ausdauer kontrolliert aufbauen und Fueling-Verträglichkeit absichern',
      workoutFocus: ['long_endurance', 'endurance'],
    };
  }

  const intensityLag = endurance != null && threshold != null && vo2 != null
    ? Math.min(threshold, vo2) <= endurance - 1
    : false;
  if (isIntensityGoal(goal) && (intensityLag || hardRpe)) {
    const evidence = [
      `Ziel: ${goal.title}`,
      threshold != null && vo2 != null ? `Schwelle/VO2 ${threshold.toFixed(1)}/${vo2.toFixed(1)}` : 'Schwelle/VO2 ohne stabile Evidenz',
      endurance != null ? `Endurance ${endurance.toFixed(1)}` : null,
      hardRpe ? 'harte Einheit zuletzt RPE 8+' : null,
    ].filter((item): item is string => item != null);
    return {
      kind: 'threshold_vo2',
      label: 'Schwelle + VO2',
      confidence: confidenceFor(input.trainingCapabilities, ['threshold', 'vo2']),
      evidence,
      planBias: 'eine kontrollierte Schwellen-/VO2-Schlüsseleinheit setzen, ohne Hard-Day-Caps zu erhöhen',
      workoutFocus: ['threshold', 'vo2'],
    };
  }

  return null;
}
