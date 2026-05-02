import type { PulseFitnessLoad } from '@coaching-os/shared/pulse';
import type { TrainingExecutionRecovery } from './training-execution-review.js';

export interface PlanRegenerationWorkoutLike {
  plannedDate: string;
  activityType: string;
  zone: number;
  durationMin: number;
  targetTss?: number | null;
  adjustedReason?: string | null;
}

export interface PlanTraceWorkoutLike {
  plannedDate: string;
  activityType: string;
  zone: number;
  durationMin: number;
  targetTss: number | null;
  adjustedReason: string | null;
}

function dayOffsetFromWeekStart(weekStart: string, date: string): number | null {
  const start = Date.parse(`${weekStart}T00:00:00Z`);
  const current = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(current)) return null;
  const offset = Math.round((current - start) / 86_400_000);
  return offset >= 0 && offset <= 6 ? offset : null;
}

function toTraceWorkout(workout: PlanRegenerationWorkoutLike): PlanTraceWorkoutLike {
  return {
    plannedDate: workout.plannedDate,
    activityType: workout.activityType,
    zone: workout.zone,
    durationMin: workout.durationMin,
    targetTss: workout.targetTss ?? null,
    adjustedReason: workout.adjustedReason ?? null,
  };
}

export function determinePlanReplacementCutoff(weekStart: string, today: string): string {
  return weekStart < today ? today : weekStart;
}

export function mergeRegeneratedWorkoutsForTrace(
  preservedWorkouts: PlanRegenerationWorkoutLike[],
  regeneratedWorkouts: PlanRegenerationWorkoutLike[],
): PlanTraceWorkoutLike[] {
  return [...preservedWorkouts, ...regeneratedWorkouts]
    .map(toTraceWorkout)
    .sort((a, b) => a.plannedDate.localeCompare(b.plannedDate));
}

export function deriveExecutionReviewAvailability(params: {
  weekStart: string;
  plannedWorkouts: Array<{ plannedDate: string }>;
  skippedAvailableDays?: number[] | null;
}): number[] {
  const plannedOffsets = params.plannedWorkouts
    .map(workout => dayOffsetFromWeekStart(params.weekStart, workout.plannedDate))
    .filter((offset): offset is number => offset != null);
  return [...new Set([...plannedOffsets, ...(params.skippedAvailableDays ?? [])])]
    .filter(day => day >= 0 && day <= 6)
    .sort((a, b) => a - b);
}

export function recoveryFromFitnessLoad(load: PulseFitnessLoad): TrainingExecutionRecovery {
  if (load.tsb >= 0) return { readinessScore: 82, hrvStatus: 'normal' };
  if (load.tsb <= -25) return { readinessScore: 35, hrvStatus: 'below_normal' };
  if (load.tsb <= -12) return { readinessScore: 45, hrvStatus: 'below_normal' };
  return { readinessScore: 68, hrvStatus: null };
}
