import type { FastifyInstance } from 'fastify';
import { and, eq, inArray } from 'drizzle-orm';
import { RPE_SORENESS_AREAS } from '@coaching-os/shared/pulse';
import type {
  PulseActivityType as SharedPulseActivityType,
  PulsePlanDecision,
  PulsePlanTrace,
  PulseTrainingExecutionReview,
  RpeSorenessArea,
} from '@coaching-os/shared/pulse';
import {
  pulsePlanGenerations,
  pulsePlannedWorkouts,
} from '../../db/pulse-schema.js';
import { db } from '../../lib/db.js';
import type { recoveryFromFitnessLoad } from './plan-regeneration.js';
import { buildTrainingExecutionReview } from './training-execution-review.js';

type PlanTraceRow = typeof pulsePlanGenerations.$inferSelect;

type TraceWorkout = {
  plannedDate: string;
  activityType: string;
  zone: number;
  durationMin: number;
  targetTss: number | null;
  adjustedReason?: string | null;
};

type ExecutionWorkoutRow = {
  id: string;
  plannedDate: string;
  activityType: SharedPulseActivityType;
  zone: number;
  durationMin: number;
  status: string;
  completedActivityId: string | null;
  complianceScore: number | null;
};

type ExecutionActivityRow = {
  id: string;
  startTime: Date;
  activityType: SharedPulseActivityType;
  durationSec: number | null;
  tss: number | null;
  rpe: number | null;
  sorenessAreas: string[] | null;
};

export async function getPlannedZoneByActivityId(userId: string, activityIds: string[]): Promise<Map<string, number>> {
  const uniqueIds = [...new Set(activityIds)].filter(id => id.length > 0);
  if (uniqueIds.length === 0) return new Map();

  const rows = await db.select({
    completedActivityId: pulsePlannedWorkouts.completedActivityId,
    zone: pulsePlannedWorkouts.zone,
  }).from(pulsePlannedWorkouts)
    .where(and(
      eq(pulsePlannedWorkouts.userId, userId),
      inArray(pulsePlannedWorkouts.completedActivityId, uniqueIds),
    ));

  return new Map(
    rows
      .filter((row): row is { completedActivityId: string; zone: number } => row.completedActivityId != null)
      .map(row => [row.completedActivityId, row.zone]),
  );
}

export function normalizeRacePriority(value: string | null): 'A' | 'B' | 'C' | null {
  return value === 'A' || value === 'B' || value === 'C' ? value : null;
}

export function shiftIsoDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split('T')[0]!;
}

export function currentWeekStartIso(now = new Date()): string {
  const weekStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = weekStart.getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  weekStart.setUTCDate(weekStart.getUTCDate() + mondayOffset);
  return weekStart.toISOString().split('T')[0]!;
}

function normalizeSorenessAreas(areas: string[] | null): RpeSorenessArea[] | null {
  if (!areas || areas.length === 0) return null;
  const allowed = new Set<string>(RPE_SORENESS_AREAS);
  const normalized = areas.filter((area): area is RpeSorenessArea => allowed.has(area));
  return normalized.length > 0 ? normalized : null;
}

export function buildExecutionReviewForPreviousWeek(params: {
  currentWeekStart: string;
  previousWorkouts: ExecutionWorkoutRow[];
  activities: ExecutionActivityRow[];
  availableDays: number[];
  recovery: ReturnType<typeof recoveryFromFitnessLoad>;
  today: string;
}): PulseTrainingExecutionReview | null {
  if (params.previousWorkouts.length === 0) return null;
  const previousWeekStart = shiftIsoDate(params.currentWeekStart, -7);
  const previousActivities = params.activities.filter(activity => {
    const date = activity.startTime.toISOString().split('T')[0]!;
    return date >= previousWeekStart && date < params.currentWeekStart;
  });

  return buildTrainingExecutionReview({
    weekStart: previousWeekStart,
    plannedWorkouts: params.previousWorkouts.map(workout => ({
      id: workout.id,
      plannedDate: workout.plannedDate,
      activityType: workout.activityType,
      zone: workout.zone,
      durationMin: workout.durationMin,
      status: workout.status,
      completedActivityId: workout.completedActivityId,
      complianceScore: workout.complianceScore,
    })),
    activities: previousActivities.map(activity => ({
      id: activity.id,
      startTime: activity.startTime,
      activityType: activity.activityType,
      durationSec: activity.durationSec,
      tss: activity.tss,
      rpe: activity.rpe,
      sorenessAreas: normalizeSorenessAreas(activity.sorenessAreas),
    })),
    availableDays: params.availableDays,
    recovery: params.recovery,
    today: params.today,
  });
}

export function mapPlanTrace(row: PlanTraceRow): PulsePlanTrace {
  const adaptation = row.inputSnapshot.adaptation ?? null;
  const restDayRationale = row.inputSnapshot.restDayRationale ?? [];
  return {
    id: row.id,
    userId: row.userId,
    weekStart: row.weekStart,
    createdAt: row.createdAt?.toISOString() ?? new Date(0).toISOString(),
    inputSnapshot: row.inputSnapshot,
    planDecision: row.planDecision,
    sportMix: row.sportMix,
    hardDays: row.hardDays,
    generatedSummary: row.generatedSummary ?? [],
    adaptation,
    restDayRationale,
  };
}

function dayOffsetFromWeekStart(weekStart: string, plannedDate: string): number | null {
  const start = Date.parse(`${weekStart}T00:00:00Z`);
  const date = Date.parse(`${plannedDate}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(date)) return null;
  const offset = Math.round((date - start) / 86_400_000);
  return offset >= 0 && offset <= 6 ? offset : null;
}

export function reconcilePlanDecisionWithWorkouts(params: {
  decision: PulsePlanDecision;
  weekStart: string;
  availableDays: number[];
  workouts: TraceWorkout[];
}): PulsePlanDecision {
  const selectedDays = [...new Set(params.workouts
    .map(workout => dayOffsetFromWeekStart(params.weekStart, workout.plannedDate))
    .filter((day): day is number => day != null))]
    .sort((a, b) => a - b);
  const availableDays = [...new Set(params.availableDays)].sort((a, b) => a - b);
  const skippedAvailableDays = availableDays.filter(day => !selectedDays.includes(day));
  const changed = (
    selectedDays.join(',') !== params.decision.selectedDays.join(',') ||
    skippedAvailableDays.join(',') !== params.decision.skippedAvailableDays.join(',')
  );

  return {
    ...params.decision,
    selectedDays,
    skippedAvailableDays,
    targetSessionCount: selectedDays.length,
    reasons: changed
      ? [...params.decision.reasons, 'Finale Health-/Race-Constraints haben die Trainingstage nach der Grundentscheidung angepasst.']
      : params.decision.reasons,
  };
}

export async function persistPlanTrace(
  app: FastifyInstance,
  values: typeof pulsePlanGenerations.$inferInsert,
): Promise<PulsePlanTrace | null> {
  try {
    const [row] = await db.insert(pulsePlanGenerations).values(values).returning();
    return row ? mapPlanTrace(row) : null;
  } catch (err) {
    app.log.warn(`[plan] Plan trace persistence failed (non-fatal): ${err}`);
    return null;
  }
}
