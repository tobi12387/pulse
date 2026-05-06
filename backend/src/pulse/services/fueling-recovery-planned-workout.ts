import type { PulseFuelingRecoveryGuidanceResponse } from '@coaching-os/shared/pulse';
import type { pulsePlannedWorkouts } from '../../db/pulse-schema.js';
import { buildCachedPulseContextFor } from '../lib/pulse-context.js';
import { buildFuelingRecoveryGuidance } from './fueling-recovery-guidance.js';

type PlannedWorkoutForFueling = Pick<
  typeof pulsePlannedWorkouts.$inferSelect,
  'id' | 'plannedDate' | 'activityType' | 'zone' | 'durationMin' | 'targetTss' | 'description'
>;

export async function buildFuelingRecoveryGuidanceForPlannedWorkout(
  userId: string,
  workout: PlannedWorkoutForFueling,
): Promise<PulseFuelingRecoveryGuidanceResponse> {
  const ctx = await buildCachedPulseContextFor(userId, workout.plannedDate);
  const profile = ctx.profile;

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
  });
}
