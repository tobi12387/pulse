import type { WorkoutStep } from '@coaching-os/shared/pulse';

export type TrainingEnergySystem =
  | 'recovery'
  | 'endurance'
  | 'long_endurance'
  | 'tempo'
  | 'threshold'
  | 'vo2'
  | 'anaerobic'
  | 'strength';

export type TrainingProgressionSignal =
  | 'quality_progress'
  | 'reduce_next_intensity'
  | 'long_off_plan_load'
  | 'protect_recovery'
  | 'missing_history';

export interface TrainingArchetype {
  id: string;
  label: string;
  energySystem: TrainingEnergySystem;
  suitableFor: Array<'road' | 'gravel' | 'century' | 'fitness' | 'race' | 'recovery'>;
  phaseFit: Array<'base' | 'build' | 'peak' | 'taper' | 'maintenance'>;
  defaultZone: number;
  durationRangeMin: [number, number];
  difficultyBand: 'easy' | 'moderate' | 'productive' | 'stretch';
  progressionFamily: 'recovery' | 'endurance' | 'long' | 'tempo' | 'threshold' | 'vo2' | 'strength';
  garminStructure: 'steady' | 'intervals' | 'repeat_group' | 'strength_notes';
  description: string;
}

export interface WorkoutDifficultyInput {
  activityType: string;
  zone: number;
  durationMin: number;
  targetTss?: number | null;
  steps?: WorkoutStep[] | null;
}

export interface WorkoutDifficulty {
  energySystem: TrainingEnergySystem;
  level: number;
  drivers: string[];
}

export interface CompletedProgressionWorkout extends WorkoutDifficultyInput {
  complianceScore?: number | null;
  rpe?: number | null;
  status?: string | null;
}

export interface ProgressionRecentActivity {
  activityType: string;
  durationMin: number;
  tss?: number | null;
  rpe?: number | null;
  source?: 'planned' | 'off_plan' | string | null;
}

export interface EnergySystemProgression {
  energySystem: TrainingEnergySystem;
  level: number;
  confidence: 'low' | 'medium' | 'high';
  evidence: string[];
}

export interface AthleteProgression {
  levels: Record<TrainingEnergySystem, EnergySystemProgression>;
  signals: TrainingProgressionSignal[];
  recommendations: string[];
}

export interface PlanQualityWorkout extends WorkoutDifficultyInput {
  plannedDate: string;
}

export interface PlanQualityGoal {
  category?: string | null;
  title?: string | null;
}

export interface PlanQualityIssue {
  code:
    | 'repeated_generic_week'
    | 'fills_all_available_days'
    | 'too_many_hard_days'
    | 'long_off_plan_load_not_respected'
    | 'missing_goal_context';
  severity: 'high' | 'medium' | 'low';
  message: string;
}

export interface PlanQualityEvaluation {
  score: number;
  issues: PlanQualityIssue[];
  recommendations: string[];
}

const ENERGY_SYSTEMS: TrainingEnergySystem[] = [
  'recovery',
  'endurance',
  'long_endurance',
  'tempo',
  'threshold',
  'vo2',
  'anaerobic',
  'strength',
];

export const trainingArchetypes: TrainingArchetype[] = [
  {
    id: 'recovery_spin',
    label: 'Recovery Spin',
    energySystem: 'recovery',
    suitableFor: ['recovery', 'fitness'],
    phaseFit: ['base', 'build', 'peak', 'taper', 'maintenance'],
    defaultZone: 1,
    durationRangeMin: [25, 60],
    difficultyBand: 'easy',
    progressionFamily: 'recovery',
    garminStructure: 'steady',
    description: 'Sehr leichter Durchblutungsreiz ohne Trainingsdruck.',
  },
  {
    id: 'mobility_flush',
    label: 'Mobility Flush',
    energySystem: 'recovery',
    suitableFor: ['recovery', 'fitness'],
    phaseFit: ['base', 'build', 'peak', 'taper', 'maintenance'],
    defaultZone: 1,
    durationRangeMin: [20, 45],
    difficultyBand: 'easy',
    progressionFamily: 'recovery',
    garminStructure: 'steady',
    description: 'Beweglichkeit und lockere Durchblutung, ohne Ausdauerreiz zu erzwingen.',
  },
  {
    id: 'endurance_steady',
    label: 'Steady Endurance',
    energySystem: 'endurance',
    suitableFor: ['road', 'gravel', 'century', 'fitness'],
    phaseFit: ['base', 'build', 'maintenance'],
    defaultZone: 2,
    durationRangeMin: [60, 150],
    difficultyBand: 'moderate',
    progressionFamily: 'endurance',
    garminStructure: 'steady',
    description: 'Aerober Standardbaustein fuer ruhige, wiederholbare Wochen.',
  },
  {
    id: 'endurance_cadence',
    label: 'Endurance Cadence',
    energySystem: 'endurance',
    suitableFor: ['road', 'fitness'],
    phaseFit: ['base', 'build', 'maintenance'],
    defaultZone: 2,
    durationRangeMin: [45, 90],
    difficultyBand: 'moderate',
    progressionFamily: 'endurance',
    garminStructure: 'repeat_group',
    description: 'Aerober Reiz mit kurzen Kadenzfenstern, ohne echte Intensitaet.',
  },
  {
    id: 'endurance_progressive',
    label: 'Progressive Endurance',
    energySystem: 'endurance',
    suitableFor: ['road', 'century', 'fitness'],
    phaseFit: ['base', 'build', 'maintenance'],
    defaultZone: 2,
    durationRangeMin: [70, 130],
    difficultyBand: 'productive',
    progressionFamily: 'endurance',
    garminStructure: 'intervals',
    description: 'Ruhiger Start, spaeter stabiler Z2-Druck ohne Schwellenarbeit.',
  },
  {
    id: 'endurance_hills',
    label: 'Endurance Hills',
    energySystem: 'endurance',
    suitableFor: ['road', 'gravel', 'century'],
    phaseFit: ['base', 'build'],
    defaultZone: 2,
    durationRangeMin: [75, 140],
    difficultyBand: 'productive',
    progressionFamily: 'endurance',
    garminStructure: 'intervals',
    description: 'Aerober Ausdauerblock mit kurzen kontrollierten Anstiegen oder niedriger Kadenz.',
  },
  {
    id: 'long_endurance',
    label: 'Long Endurance',
    energySystem: 'long_endurance',
    suitableFor: ['road', 'gravel', 'century', 'race'],
    phaseFit: ['base', 'build', 'peak'],
    defaultZone: 2,
    durationRangeMin: [150, 420],
    difficultyBand: 'productive',
    progressionFamily: 'long',
    garminStructure: 'steady',
    description: 'Langer Ausdauerreiz mit Fueling- und Ermuedungsrelevanz.',
  },
  {
    id: 'long_endurance_fueling_practice',
    label: 'Long Fueling Practice',
    energySystem: 'long_endurance',
    suitableFor: ['road', 'gravel', 'century', 'race'],
    phaseFit: ['base', 'build', 'peak'],
    defaultZone: 2,
    durationRangeMin: [150, 360],
    difficultyBand: 'productive',
    progressionFamily: 'long',
    garminStructure: 'steady',
    description: 'Langer Z2-Reiz mit bewusst fruehem, gleichmaessigem Fueling als Lernziel.',
  },
  {
    id: 'long_endurance_durability',
    label: 'Long Durability',
    energySystem: 'long_endurance',
    suitableFor: ['road', 'gravel', 'century', 'race'],
    phaseFit: ['build', 'peak'],
    defaultZone: 2,
    durationRangeMin: [180, 420],
    difficultyBand: 'stretch',
    progressionFamily: 'long',
    garminStructure: 'intervals',
    description: 'Langer Ausdauerreiz mit spaetem stabilen Druck, nur bei gruener Erholung.',
  },
  {
    id: 'tempo_sustained',
    label: 'Sustained Tempo',
    energySystem: 'tempo',
    suitableFor: ['road', 'gravel', 'century', 'fitness'],
    phaseFit: ['base', 'build'],
    defaultZone: 3,
    durationRangeMin: [45, 100],
    difficultyBand: 'productive',
    progressionFamily: 'tempo',
    garminStructure: 'steady',
    description: 'Kontrollierter Dauerleistungsreiz unterhalb der Schwelle.',
  },
  {
    id: 'tempo_over_distance',
    label: 'Tempo Over Distance',
    energySystem: 'tempo',
    suitableFor: ['road', 'gravel', 'century', 'race'],
    phaseFit: ['build', 'peak'],
    defaultZone: 3,
    durationRangeMin: [80, 160],
    difficultyBand: 'stretch',
    progressionFamily: 'tempo',
    garminStructure: 'intervals',
    description: 'Laengerer Tempo-Reiz mit kontrollierter Ermuedung, nicht als Vollgasfahrt.',
  },
  {
    id: 'threshold_intervals',
    label: 'Threshold Intervals',
    energySystem: 'threshold',
    suitableFor: ['road', 'gravel', 'race'],
    phaseFit: ['build', 'peak'],
    defaultZone: 4,
    durationRangeMin: [45, 90],
    difficultyBand: 'productive',
    progressionFamily: 'threshold',
    garminStructure: 'repeat_group',
    description: 'Gezielte Schwellenarbeit mit klaren Erholungspausen.',
  },
  {
    id: 'threshold_cruise',
    label: 'Threshold Cruise',
    energySystem: 'threshold',
    suitableFor: ['road', 'gravel', 'race'],
    phaseFit: ['build', 'peak'],
    defaultZone: 4,
    durationRangeMin: [60, 100],
    difficultyBand: 'productive',
    progressionFamily: 'threshold',
    garminStructure: 'repeat_group',
    description: 'Laengere kontrollierte Schwellenabschnitte, sauber wiederholbar statt maximal.',
  },
  {
    id: 'sweet_spot_builder',
    label: 'Sweet Spot Builder',
    energySystem: 'threshold',
    suitableFor: ['road', 'gravel', 'century', 'fitness'],
    phaseFit: ['base', 'build'],
    defaultZone: 4,
    durationRangeMin: [50, 90],
    difficultyBand: 'moderate',
    progressionFamily: 'threshold',
    garminStructure: 'repeat_group',
    description: 'Z3/Z4-Mischreiz zum Aufbau der Schwellennaehe ohne aggressiven Spitzenreiz.',
  },
  {
    id: 'vo2_repeats',
    label: 'VO2 Repeats',
    energySystem: 'vo2',
    suitableFor: ['road', 'gravel', 'race'],
    phaseFit: ['build', 'peak'],
    defaultZone: 5,
    durationRangeMin: [35, 70],
    difficultyBand: 'stretch',
    progressionFamily: 'vo2',
    garminStructure: 'repeat_group',
    description: 'Kurze harte Wiederholungen fuer VO2max und hohe Sauerstoffaufnahme.',
  },
  {
    id: 'vo2_short_sharp',
    label: 'VO2 Short Sharp',
    energySystem: 'vo2',
    suitableFor: ['road', 'gravel', 'race'],
    phaseFit: ['build', 'peak', 'taper'],
    defaultZone: 5,
    durationRangeMin: [30, 55],
    difficultyBand: 'stretch',
    progressionFamily: 'vo2',
    garminStructure: 'repeat_group',
    description: 'Kurze VO2-Spitzen mit viel Kontrolle und wenig Zusatzumfang.',
  },
  {
    id: 'anaerobic_sharpening',
    label: 'Anaerobic Sharpening',
    energySystem: 'anaerobic',
    suitableFor: ['road', 'gravel', 'race'],
    phaseFit: ['peak', 'taper'],
    defaultZone: 5,
    durationRangeMin: [25, 55],
    difficultyBand: 'stretch',
    progressionFamily: 'vo2',
    garminStructure: 'repeat_group',
    description: 'Kurze Spitzen, nur bei guter Erholung und klarem Race-Bezug.',
  },
  {
    id: 'gravel_specificity',
    label: 'Gravel Specificity',
    energySystem: 'tempo',
    suitableFor: ['gravel', 'century', 'race'],
    phaseFit: ['build', 'peak'],
    defaultZone: 3,
    durationRangeMin: [90, 240],
    difficultyBand: 'stretch',
    progressionFamily: 'tempo',
    garminStructure: 'intervals',
    description: 'Lange variable Belastung mit Tempo, kurzen Druckphasen und Fueling-Praxis.',
  },
  {
    id: 'strength_support',
    label: 'Strength Support',
    energySystem: 'strength',
    suitableFor: ['road', 'gravel', 'century', 'fitness'],
    phaseFit: ['base', 'build', 'maintenance'],
    defaultZone: 1,
    durationRangeMin: [25, 55],
    difficultyBand: 'easy',
    progressionFamily: 'strength',
    garminStructure: 'strength_notes',
    description: 'Kraft- und Stabilitaetsbaustein zur Belastbarkeit, nicht als Zusatzstress.',
  },
  {
    id: 'strength_prehab',
    label: 'Strength Prehab',
    energySystem: 'strength',
    suitableFor: ['road', 'gravel', 'century', 'fitness', 'recovery'],
    phaseFit: ['base', 'build', 'peak', 'taper', 'maintenance'],
    defaultZone: 1,
    durationRangeMin: [20, 45],
    difficultyBand: 'easy',
    progressionFamily: 'strength',
    garminStructure: 'strength_notes',
    description: 'Mobility, Core und Prehab als Schutzbaustein ohne Trainingsstress.',
  },
];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function inferEnergySystem(input: Pick<WorkoutDifficultyInput, 'activityType' | 'zone' | 'durationMin'>): TrainingEnergySystem {
  if (input.activityType === 'strength') return 'strength';
  if (input.durationMin >= 180 && input.zone <= 3) return 'long_endurance';
  if (input.zone <= 1) return 'recovery';
  if (input.zone === 2) return 'endurance';
  if (input.zone === 3) return 'tempo';
  if (input.zone === 4) return 'threshold';
  if (input.durationMin <= 35) return 'anaerobic';
  return 'vo2';
}

function intervalStats(steps: WorkoutStep[] | null | undefined): {
  intervalWorkMin: number;
  repeatCount: number;
  shortestRestMin: number | null;
} {
  let intervalWorkMin = 0;
  let repeatCount = 0;
  let shortestRestMin: number | null = null;

  for (const step of steps ?? []) {
    const reps = Math.max(1, step.reps ?? 1);
    if (step.type === 'interval' || step.zone >= 4) {
      intervalWorkMin += step.durationMin * reps;
      repeatCount += reps;
    }
    if (step.restMin != null && step.restMin > 0) {
      shortestRestMin = shortestRestMin == null ? step.restMin : Math.min(shortestRestMin, step.restMin);
    }
  }

  return { intervalWorkMin, repeatCount, shortestRestMin };
}

export function computeWorkoutDifficulty(input: WorkoutDifficultyInput): WorkoutDifficulty {
  const zone = clamp(Math.round(input.zone), 1, 5);
  const durationMin = Math.max(0, input.durationMin);
  const energySystem = inferEnergySystem({ ...input, zone, durationMin });
  const { intervalWorkMin, repeatCount, shortestRestMin } = intervalStats(input.steps);
  const drivers: string[] = [];

  const zoneBase = ({ 1: 1.1, 2: 2.2, 3: 3.6, 4: 5.2, 5: 6.4 } as Record<number, number>)[zone] ?? 2.2;
  let level = zoneBase;

  level += clamp(durationMin / 120, 0, 3.2);
  if (input.targetTss != null && durationMin > 0) {
    level += clamp((input.targetTss / (durationMin / 60) - 55) / 35, 0, 2.2);
  }
  if (intervalWorkMin > 0) {
    level += clamp(intervalWorkMin / 28, 0.4, 2.4);
    drivers.push('interval_repetition');
  }
  if (repeatCount >= 4) level += 0.5;
  if (shortestRestMin != null && shortestRestMin <= 2 && repeatCount >= 3) level += 0.4;
  if (zone >= 4) drivers.push('quality_intensity');
  if (durationMin >= 150) {
    level += 1.1;
    drivers.push('long_duration');
  }
  if (durationMin >= 180 && (input.activityType === 'bike' || input.activityType === 'run' || input.activityType === 'hike')) {
    level += 0.7;
    drivers.push('fueling_sensitive');
  }
  if (input.activityType === 'strength') drivers.push('strength_load');

  if (drivers.length === 0) drivers.push(energySystem === 'recovery' ? 'recovery_control' : 'steady_load');

  return {
    energySystem,
    level: round1(clamp(level, 1, 10)),
    drivers,
  };
}

function emptyProgressionLevel(energySystem: TrainingEnergySystem): EnergySystemProgression {
  return {
    energySystem,
    level: 2,
    confidence: 'low',
    evidence: [],
  };
}

function addSignal(signals: TrainingProgressionSignal[], signal: TrainingProgressionSignal): void {
  if (!signals.includes(signal)) signals.push(signal);
}

export function deriveAthleteProgression(input: {
  completedWorkouts: CompletedProgressionWorkout[];
  recentActivities: ProgressionRecentActivity[];
}): AthleteProgression {
  const levels = Object.fromEntries(
    ENERGY_SYSTEMS.map(system => [system, emptyProgressionLevel(system)]),
  ) as Record<TrainingEnergySystem, EnergySystemProgression>;
  const signals: TrainingProgressionSignal[] = [];
  const recommendations: string[] = [];

  if (input.completedWorkouts.length === 0 && input.recentActivities.length === 0) {
    addSignal(signals, 'missing_history');
    recommendations.push('Mehr Ausfuehrungshistorie sammeln, bevor Progression aggressiv erhoeht wird.');
  }

  for (const workout of input.completedWorkouts) {
    const difficulty = computeWorkoutDifficulty(workout);
    const compliance = workout.complianceScore ?? 0.75;
    const rpe = workout.rpe ?? null;
    const target = levels[difficulty.energySystem];
    const success = compliance >= 0.82 && (rpe == null || rpe <= 8);
    const struggle = compliance < 0.65 || (rpe != null && rpe >= 9);

    if (success) {
      target.level = Math.max(target.level, round1(difficulty.level * 0.62));
      target.confidence = compliance >= 0.9 ? 'high' : 'medium';
      target.evidence.push(`${workout.activityType} Z${workout.zone} ${workout.durationMin}min erfolgreich.`);
      addSignal(signals, 'quality_progress');
    } else if (struggle) {
      target.level = Math.min(target.level, 2.5);
      target.confidence = 'medium';
      target.evidence.push(`${workout.activityType} Z${workout.zone} war zu hart oder unvollstaendig.`);
      addSignal(signals, 'reduce_next_intensity');
    } else {
      target.level = Math.max(target.level, round1(difficulty.level * 0.45));
      target.confidence = 'medium';
      target.evidence.push(`${workout.activityType} Z${workout.zone} neutral abgeschlossen.`);
    }
  }

  for (const activity of input.recentActivities) {
    const isLongOffPlan = activity.source === 'off_plan'
      && (activity.durationMin >= 240 || (activity.tss ?? 0) >= 250);
    if (!isLongOffPlan) continue;
    addSignal(signals, 'long_off_plan_load');
    addSignal(signals, 'protect_recovery');
    recommendations.push('lange ungeplante Einheit erkannt: naechste Woche Erholung schuetzen, lange Ausdauer nicht stumpf wiederholen und Fueling-Toleranz einbeziehen.');
  }

  if (signals.includes('reduce_next_intensity')) {
    recommendations.push('Naechsten Qualitaetsreiz um eine Stufe entschärfen oder in aerobe Arbeit tauschen.');
  }

  return { levels, signals, recommendations };
}

function normalizedWeekSignature(plan: PlanQualityWorkout[]): string {
  return plan
    .map(workout => `${workout.activityType}:z${workout.zone}:${Math.round(workout.durationMin / 5) * 5}`)
    .join('|');
}

function addIssue(issues: PlanQualityIssue[], issue: PlanQualityIssue): void {
  if (!issues.some(existing => existing.code === issue.code)) issues.push(issue);
}

function scorePenalty(severity: PlanQualityIssue['severity']): number {
  if (severity === 'high') return 25;
  if (severity === 'medium') return 14;
  return 7;
}

export function evaluatePlanQuality(input: {
  currentPlan: PlanQualityWorkout[];
  previousPlans: PlanQualityWorkout[][];
  availableDays: number[];
  weeklyHoursTarget: number;
  goals: PlanQualityGoal[];
  recentActivities: ProgressionRecentActivity[];
}): PlanQualityEvaluation {
  const issues: PlanQualityIssue[] = [];
  const recommendations: string[] = [];
  const goalCategory = input.goals[0]?.category ?? null;
  const currentSignature = normalizedWeekSignature(input.currentPlan);

  if (input.goals.length === 0) {
    addIssue(issues, {
      code: 'missing_goal_context',
      severity: 'low',
      message: 'Kein aktives Ziel im Plan-Kontext; Empfehlungen koennen dadurch generisch wirken.',
    });
  }

  if (input.previousPlans.some(plan => normalizedWeekSignature(plan) === currentSignature)) {
    addIssue(issues, {
      code: 'repeated_generic_week',
      severity: 'high',
      message: 'Die aktuelle Woche wiederholt Sportart, Zone und Dauer der Vorwoche nahezu identisch.',
    });
    recommendations.push('Workout-Archetypen rotieren: gleiche Trainingsabsicht behalten, aber Struktur, Platzierung oder Dauer gezielt variieren.');
  }

  const available = new Set(input.availableDays);
  if (
    available.size >= 4
    && input.currentPlan.length >= available.size
    && (input.weeklyHoursTarget <= 6 || goalCategory === 'weight' || goalCategory == null)
  ) {
    addIssue(issues, {
      code: 'fills_all_available_days',
      severity: 'medium',
      message: 'Der Plan nutzt alle verfuegbaren Tage, obwohl Ziel und Zeitbudget freie Reservetage nahelegen.',
    });
    recommendations.push('Mindestens einen verfuegbaren Tag als Reserve, Erholung oder Alltagspuffer freihalten.');
  }

  const hardDays = input.currentPlan.filter(workout => workout.zone >= 4).length;
  if (hardDays > 2 || (hardDays > 1 && input.weeklyHoursTarget <= 6)) {
    addIssue(issues, {
      code: 'too_many_hard_days',
      severity: 'medium',
      message: 'Die Woche enthaelt fuer das Zeitbudget zu viele harte Reize.',
    });
    recommendations.push('Harte Einheiten auf ein bis zwei klare Qualitaetsreize begrenzen.');
  }

  const longOffPlan = input.recentActivities.some(activity =>
    activity.source === 'off_plan' && (activity.durationMin >= 240 || (activity.tss ?? 0) >= 250),
  );
  const hasImmediateHardOrLong = input.currentPlan.some(workout => workout.zone >= 4 || workout.durationMin >= 180);
  if (longOffPlan && hasImmediateHardOrLong) {
    addIssue(issues, {
      code: 'long_off_plan_load_not_respected',
      severity: 'high',
      message: 'Eine lange ungeplante Einheit wurde nicht sichtbar in die Folgewoche eingepreist.',
    });
    recommendations.push('Nach sehr langen ungeplanten Einheiten zuerst absorbieren: keine direkte Wiederholung des langen Reizes ohne Recovery-Check.');
  }

  const score = clamp(
    100 - issues.reduce((sum, issue) => sum + scorePenalty(issue.severity), 0),
    0,
    100,
  );

  if (recommendations.length === 0) {
    recommendations.push('Planstruktur wirkt plausibel; weiter mit Ausfuehrung, RPE und Garmin-Abgleich lernen.');
  }

  return {
    score,
    issues,
    recommendations,
  };
}
