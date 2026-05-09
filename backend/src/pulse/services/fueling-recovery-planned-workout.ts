import type { PulseFuelingRecoveryGuidanceResponse } from '@coaching-os/shared/pulse';
import { and, desc, eq, gte, inArray, isNull, or } from 'drizzle-orm';
import {
  pulseActivities,
  pulseNutritionLogs,
  type pulsePlannedWorkouts,
} from '../../db/pulse-schema.js';
import { db } from '../../lib/db.js';
import { buildCachedPulseContextFor } from '../lib/pulse-context.js';
import { buildFuelingRecoveryGuidance } from './fueling-recovery-guidance.js';

type PlannedWorkoutForFueling = Pick<
  typeof pulsePlannedWorkouts.$inferSelect,
  'id' | 'plannedDate' | 'activityType' | 'zone' | 'durationMin' | 'targetTss' | 'description'
>;

function shiftIsoDate(date: string, days: number): string {
  const current = new Date(`${date}T00:00:00Z`);
  current.setUTCDate(current.getUTCDate() + days);
  return current.toISOString().split('T')[0]!;
}

async function loadRecentFuelingHistory(userId: string, plannedDate: string) {
  const since = shiftIsoDate(plannedDate, -120);
  const logs = await db.select({
    date: pulseNutritionLogs.date,
    context: pulseNutritionLogs.context,
    activityId: pulseNutritionLogs.activityId,
    carbsG: pulseNutritionLogs.carbsG,
    drinksMl: pulseNutritionLogs.drinksMl,
    bottles750Ml: pulseNutritionLogs.bottles750Ml,
    powderG: pulseNutritionLogs.powderG,
    giComfort: pulseNutritionLogs.giComfort,
    notes: pulseNutritionLogs.notes,
  }).from(pulseNutritionLogs)
    .where(and(
      eq(pulseNutritionLogs.userId, userId),
      gte(pulseNutritionLogs.date, since),
      or(eq(pulseNutritionLogs.context, 'during'), isNull(pulseNutritionLogs.context)),
    ))
    .orderBy(desc(pulseNutritionLogs.date), desc(pulseNutritionLogs.createdAt))
    .limit(8);

  const activityIds = logs
    .map(log => log.activityId)
    .filter((id): id is string => id != null);
  const activities = activityIds.length > 0
    ? await db.select({
        id: pulseActivities.id,
        activityType: pulseActivities.activityType,
        durationSec: pulseActivities.durationSec,
      }).from(pulseActivities)
        .where(and(eq(pulseActivities.userId, userId), inArray(pulseActivities.id, activityIds)))
    : [];
  const activityById = new Map(activities.map(activity => [activity.id, activity]));

  return logs.map(log => {
    const activity = log.activityId ? activityById.get(log.activityId) : null;
    return {
      date: log.date,
      context: log.context,
      activityType: activity?.activityType ?? null,
      durationMin: activity?.durationSec != null ? Math.round(activity.durationSec / 60) : null,
      carbsG: log.carbsG,
      drinksMl: log.drinksMl,
      bottles750Ml: log.bottles750Ml,
      powderG: log.powderG,
      giComfort: log.giComfort,
      notes: log.notes,
    };
  });
}

export async function buildFuelingRecoveryGuidanceForPlannedWorkout(
  userId: string,
  workout: PlannedWorkoutForFueling,
): Promise<PulseFuelingRecoveryGuidanceResponse> {
  const ctx = await buildCachedPulseContextFor(userId, workout.plannedDate);
  const profile = ctx.profile;
  const fuelingHistory = await loadRecentFuelingHistory(userId, workout.plannedDate);

  return buildFuelingRecoveryGuidance({
    workout: {
      id: workout.id,
      plannedDate: workout.plannedDate,
      activityType: workout.activityType,
      zone: workout.zone,
      durationMin: workout.durationMin,
      targetTss: workout.targetTss,
      description: workout.description,
    },
    preferences: {
      fuelingEnabled: profile?.fuelingEnabled ?? true,
      dietaryConstraints: profile?.dietaryConstraints ?? [],
      preferredFuelingProducts: profile?.preferredFuelingProducts ?? 'Ministry',
      carbGuidanceStyle: profile?.carbGuidanceStyle ?? 'suggest_ranges',
      sodiumGuidanceStyle: profile?.sodiumGuidanceStyle ?? 'suggest_ranges',
      bodyWeightGuidanceEnabled: profile?.bodyWeightGuidanceEnabled ?? true,
    },
    profile: {
      weightKg: profile?.weightKg ?? ctx.latestWeight?.weightKg ?? null,
    },
    recovery: {
      readinessScore: ctx.readiness.score,
      sleepDebt7dH: ctx.recovery?.sleepDebt7d.hours ?? null,
      hrvStatus: ctx.recovery?.hrvDeviation7d.status ?? ctx.todayMetrics?.hrvStatus ?? null,
      bodyBatteryMax: ctx.todayMetrics?.bodyBatteryMax ?? null,
    },
    race: ctx.nextRace ? {
      title: ctx.nextRace.title,
      phase: ctx.nextRace.phase,
      daysUntil: ctx.nextRace.daysUntil,
    } : null,
    fuelingHistory,
  });
}
