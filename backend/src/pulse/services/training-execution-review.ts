import type {
  PulseActivityType,
  PulseTrainingExecutionReview,
  PulseTrainingExecutionReviewIntent,
  PulseTrainingExecutionReviewSignal,
  RpeSorenessArea,
} from '@coaching-os/shared/pulse';
import { scoreActivityWorkoutMatch } from './workout-reconciliation.js';

export type TrainingExecutionReviewSignal = PulseTrainingExecutionReviewSignal;
export type TrainingExecutionReviewIntent = PulseTrainingExecutionReviewIntent;

export interface TrainingExecutionPlannedWorkout {
  id: string;
  plannedDate: string;
  activityType: PulseActivityType;
  zone: number;
  durationMin: number;
  status: string;
  completedActivityId?: string | null;
  complianceScore?: number | null;
}

export interface TrainingExecutionActivity {
  id: string;
  startTime: string | Date;
  activityType: PulseActivityType;
  durationSec: number | null;
  tss?: number | null;
  rpe?: number | null;
  sorenessAreas?: RpeSorenessArea[] | null;
}

export interface TrainingExecutionRecovery {
  readinessScore?: number | null;
  hrvStatus?: 'poor' | 'below_normal' | 'normal' | 'above_normal' | string | null;
  bodyBatteryMin?: number | null;
  bodyBatteryMax?: number | null;
}

export interface BuildTrainingExecutionReviewInput {
  weekStart: string;
  plannedWorkouts: TrainingExecutionPlannedWorkout[];
  activities: TrainingExecutionActivity[];
  availableDays?: number[];
  today?: string | Date;
  recovery?: TrainingExecutionRecovery | null;
}

export type TrainingExecutionReview = PulseTrainingExecutionReview;

interface MatchResult {
  workout: TrainingExecutionPlannedWorkout;
  activity: TrainingExecutionActivity | null;
  state: 'matched' | 'missed' | 'replaced' | 'pending';
  score: number | null;
}

const SIGNAL_ORDER: TrainingExecutionReviewSignal[] = [
  'matched',
  'missed',
  'replaced',
  'reduce_next_intensity',
  'maintain_structure',
  'protect_recovery',
];

const INTENT_ORDER: TrainingExecutionReviewIntent[] = ['repeat', 'reduce', 'rotate', 'rest', 'stable'];

function isoDate(date: Date): string {
  return date.toISOString().split('T')[0]!;
}

function dateOnly(value: string | Date): string {
  return value instanceof Date ? isoDate(value) : value.slice(0, 10);
}

function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return isoDate(d);
}

function dayOffsetFromWeekStart(weekStart: string, date: string): number | null {
  const start = Date.parse(`${weekStart}T00:00:00Z`);
  const current = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(current)) return null;
  const offset = Math.round((current - start) / 86_400_000);
  return offset >= 0 && offset <= 6 ? offset : null;
}

function addOrdered<T extends string>(set: Set<T>, order: T[]): T[] {
  return order.filter(item => set.has(item));
}

function isGoodRecovery(recovery: TrainingExecutionRecovery | null | undefined): boolean {
  if (!recovery) return false;
  if (recovery.readinessScore != null && recovery.readinessScore >= 75) return true;
  return recovery.hrvStatus === 'normal' || recovery.hrvStatus === 'above_normal';
}

function isWeakRecovery(recovery: TrainingExecutionRecovery | null | undefined): boolean {
  if (!recovery) return false;
  if (recovery.readinessScore != null && recovery.readinessScore < 45) return true;
  if (recovery.bodyBatteryMax != null && recovery.bodyBatteryMax < 45) return true;
  return recovery.hrvStatus === 'poor' || recovery.hrvStatus === 'below_normal';
}

function matchPlannedToActivities(input: BuildTrainingExecutionReviewInput, today: string): MatchResult[] {
  const usedActivities = new Set<string>();
  const workouts = [...input.plannedWorkouts].sort((a, b) => a.plannedDate.localeCompare(b.plannedDate));
  const activities = [...input.activities].sort((a, b) => dateOnly(a.startTime).localeCompare(dateOnly(b.startTime)));

  return workouts.map((workout): MatchResult => {
    const explicit = workout.completedActivityId
      ? activities.find(activity => activity.id === workout.completedActivityId && !usedActivities.has(activity.id))
      : null;
    if (explicit) {
      usedActivities.add(explicit.id);
      return { workout, activity: explicit, state: 'matched', score: 1 };
    }

    const scored = activities
      .filter(activity => !usedActivities.has(activity.id))
      .map(activity => ({
        activity,
        score: scoreActivityWorkoutMatch(workout, activity),
      }))
      .sort((a, b) => b.score - a.score);
    const bestMatch = scored.find(item => item.score >= 0.6);
    if (bestMatch) {
      usedActivities.add(bestMatch.activity.id);
      return { workout, activity: bestMatch.activity, state: 'matched', score: bestMatch.score };
    }

    const sameDayReplacement = activities.find(activity => !usedActivities.has(activity.id) && dateOnly(activity.startTime) === workout.plannedDate);
    if (sameDayReplacement) {
      usedActivities.add(sameDayReplacement.id);
      return { workout, activity: sameDayReplacement, state: 'replaced', score: scoreActivityWorkoutMatch(workout, sameDayReplacement) };
    }

    if ((workout.status === 'completed' || workout.status === 'skipped') && workout.plannedDate < today) {
      return { workout, activity: null, state: workout.status === 'completed' ? 'matched' : 'missed', score: null };
    }

    if (workout.plannedDate < today && workout.status === 'planned') {
      return { workout, activity: null, state: 'missed', score: null };
    }

    return { workout, activity: null, state: 'pending', score: null };
  });
}

function freeAvailableDates(weekStart: string, availableDays: number[], workouts: TrainingExecutionPlannedWorkout[]): string[] {
  const plannedDates = new Set(workouts.map(workout => workout.plannedDate));
  return [...new Set(availableDays)]
    .sort((a, b) => a - b)
    .map(day => shiftDate(weekStart, day))
    .filter(date => !plannedDates.has(date));
}

export function buildTrainingExecutionReview(input: BuildTrainingExecutionReviewInput): TrainingExecutionReview {
  const today = input.today ? dateOnly(input.today) : isoDate(new Date());
  const matches = matchPlannedToActivities(input, today);
  const signals = new Set<TrainingExecutionReviewSignal>();
  const intents = new Set<TrainingExecutionReviewIntent>();
  const avoidHardDays = new Set<number>();
  const learned: string[] = [];
  const variation: string[] = [];

  const matched = matches.filter(match => match.state === 'matched');
  const missed = matches.filter(match => match.state === 'missed');
  const replaced = matches.filter(match => match.state === 'replaced');

  if (matched.length > 0) signals.add('matched');
  if (missed.length > 0) {
    signals.add('missed');
    intents.add('repeat');
    learned.push(`${missed.length} geplante Einheit(en) wurden verpasst; naechste Woche den Reiz vorsichtig neu einplanen.`);
  }
  if (replaced.length > 0) {
    signals.add('replaced');
    intents.add('rotate');
    variation.push(`${replaced.length} Einheit(en) wurden durch andere Aktivitäten ersetzt; Sportmix und Platzierung bewusst prüfen.`);
  }

  for (const match of matches) {
    const activity = match.activity;
    const rpe = activity?.rpe ?? null;
    const sorenessAreas = activity?.sorenessAreas ?? [];
    const hardWorkout = match.workout.zone >= 4;
    if (rpe != null && (rpe >= 9 || (hardWorkout && rpe >= 8))) {
      signals.add('reduce_next_intensity');
      intents.add('reduce');
      learned.push(`Subjektive Belastung war hoch (RPE ${rpe}/10 nach ${match.workout.activityType}).`);
      const offset = dayOffsetFromWeekStart(input.weekStart, match.workout.plannedDate);
      if (offset != null && hardWorkout) avoidHardDays.add(offset);
    }
    if (isWeakRecovery(input.recovery) || (rpe != null && rpe >= 9) || sorenessAreas.includes('general_fatigue')) {
      signals.add('protect_recovery');
      intents.add('rest');
      const offset = dayOffsetFromWeekStart(input.weekStart, match.workout.plannedDate);
      if (offset != null && hardWorkout) avoidHardDays.add(offset);
    }
  }

  for (const match of missed) {
    if (match.workout.zone < 4) continue;
    const offset = dayOffsetFromWeekStart(input.weekStart, match.workout.plannedDate);
    if (offset != null) avoidHardDays.add(offset);
  }

  const negativeSignals = missed.length + replaced.length > 0 || signals.has('reduce_next_intensity') || signals.has('protect_recovery');
  const stableExecution = matched.length > 0 && !negativeSignals;
  if (matched.length > 0) {
    learned.unshift(`${matched.length}/${Math.max(1, matches.filter(match => match.state !== 'pending').length)} geplante Einheit(en) wurden mit Ausführung abgeglichen.`);
  }
  if (stableExecution) {
    intents.add('stable');
  }

  const restDayRationale: Array<{ date: string; reason: string }> = [];
  if (stableExecution && isGoodRecovery(input.recovery) && input.availableDays?.length) {
    signals.add('maintain_structure');
    variation.push('Planstruktur bleibt bewusst ähnlich, weil Ausführung und Erholung stabil waren.');
    for (const date of freeAvailableDates(input.weekStart, input.availableDays, input.plannedWorkouts)) {
      restDayRationale.push({
        date,
        reason: 'Bewusster freier Tag: stabile Ausführung und gute Erholung lassen Struktur statt Zusatzumfang zu.',
      });
    }
  } else if (stableExecution && variation.length === 0) {
    variation.push('Planstruktur kann stabil bleiben; keine klare Ausführungsabweichung erkannt.');
  }

  if (learned.length === 0) {
    learned.push('Noch kein belastbares Ausführungslernen für diese Woche.');
  }
  if (variation.length === 0) {
    variation.push('Keine zusätzliche Variation aus Ausführungsdaten erforderlich.');
  }

  return {
    signals: addOrdered(signals, SIGNAL_ORDER),
    learnedFromLastWeek: learned.slice(0, 5),
    variationComparedToLastWeek: variation.slice(0, 5),
    restDayRationale,
    recommendedHardDayAvoidance: [...avoidHardDays].sort((a, b) => a - b),
    intents: addOrdered(intents, INTENT_ORDER),
  };
}
