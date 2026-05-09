import { and, desc, eq, gte, inArray } from 'drizzle-orm';
import type { PulseTrainingCapabilitySummary } from '@coaching-os/shared/pulse';
import { pulseActivities, pulsePlannedWorkouts, pulseTrainingCapabilityLevels } from '../../db/pulse-schema.js';
import { db } from '../../lib/db.js';
import {
  CAPABILITY_LOOKBACK_DAYS,
  deriveTrainingCapabilities,
  type CapabilityCompletedWorkout,
  type CapabilityRecentActivity,
} from './training-capabilities.js';

function lookbackStart(days: number): Date {
  return new Date(Date.now() - days * 86_400_000);
}

function isoDate(date: Date): string {
  return date.toISOString().split('T')[0]!;
}

async function persistTrainingCapabilities(userId: string, summary: PulseTrainingCapabilitySummary): Promise<PulseTrainingCapabilitySummary> {
  const updatedAt = new Date();
  await Promise.all(summary.levels.map(level =>
    db.insert(pulseTrainingCapabilityLevels).values({
      userId,
      energySystem: level.energySystem,
      label: level.label,
      level: level.level,
      confidence: level.confidence,
      evidence: level.evidence,
      signals: summary.signals,
      sourceWindowDays: summary.lookbackDays,
      updatedAt,
    }).onConflictDoUpdate({
      target: [pulseTrainingCapabilityLevels.userId, pulseTrainingCapabilityLevels.energySystem],
      set: {
        label: level.label,
        level: level.level,
        confidence: level.confidence,
        evidence: level.evidence,
        signals: summary.signals,
        sourceWindowDays: summary.lookbackDays,
        updatedAt,
      },
    }),
  ));

  return {
    ...summary,
    levels: summary.levels.map(level => ({ ...level, updatedAt: updatedAt.toISOString() })),
  };
}

export async function loadTrainingCapabilitySummary(
  userId: string,
  options: { lookbackDays?: number } = {},
): Promise<PulseTrainingCapabilitySummary> {
  const lookbackDays = Math.min(180, Math.max(28, options.lookbackDays ?? CAPABILITY_LOOKBACK_DAYS));
  const since = lookbackStart(lookbackDays);
  const sinceDate = isoDate(since);

  const [plannedRows, activityRows] = await Promise.all([
    db.select({
      activityType: pulsePlannedWorkouts.activityType,
      zone: pulsePlannedWorkouts.zone,
      durationMin: pulsePlannedWorkouts.durationMin,
      targetTss: pulsePlannedWorkouts.targetTss,
      steps: pulsePlannedWorkouts.steps,
      complianceScore: pulsePlannedWorkouts.complianceScore,
      executionStatus: pulsePlannedWorkouts.executionStatus,
      completedActivityId: pulsePlannedWorkouts.completedActivityId,
    })
      .from(pulsePlannedWorkouts)
      .where(and(
        eq(pulsePlannedWorkouts.userId, userId),
        eq(pulsePlannedWorkouts.status, 'completed'),
        gte(pulsePlannedWorkouts.plannedDate, sinceDate),
      ))
      .orderBy(desc(pulsePlannedWorkouts.plannedDate))
      .limit(80),
    db.select({
      id: pulseActivities.id,
      startTime: pulseActivities.startTime,
      activityType: pulseActivities.activityType,
      durationSec: pulseActivities.durationSec,
      tss: pulseActivities.tss,
      rpe: pulseActivities.rpe,
    })
      .from(pulseActivities)
      .where(and(eq(pulseActivities.userId, userId), gte(pulseActivities.startTime, since)))
      .orderBy(desc(pulseActivities.startTime))
      .limit(140),
  ]);

  const activityIds = activityRows.map(activity => activity.id);
  const completedActivityIds = plannedRows
    .map(row => row.completedActivityId)
    .filter((id): id is string => id != null);
  const activityRpeById = new Map(activityRows.map(activity => [activity.id, activity.rpe]));
  const plannedActivityIds = new Set(completedActivityIds);

  if (activityIds.length > 0) {
    const linked = await db.select({
      completedActivityId: pulsePlannedWorkouts.completedActivityId,
    })
      .from(pulsePlannedWorkouts)
      .where(and(
        eq(pulsePlannedWorkouts.userId, userId),
        inArray(pulsePlannedWorkouts.completedActivityId, activityIds),
      ));
    for (const row of linked) {
      if (row.completedActivityId) plannedActivityIds.add(row.completedActivityId);
    }
  }

  const completedWorkouts: CapabilityCompletedWorkout[] = plannedRows.map(row => ({
    activityType: row.activityType,
    zone: row.zone,
    durationMin: row.durationMin,
    targetTss: row.targetTss,
    steps: row.steps,
    complianceScore: row.complianceScore,
    rpe: row.completedActivityId ? activityRpeById.get(row.completedActivityId) ?? null : null,
    status: row.executionStatus ?? 'completed',
  }));

  const recentActivities: CapabilityRecentActivity[] = activityRows.map(row => ({
    activityType: row.activityType,
    durationMin: Math.round((row.durationSec ?? 0) / 60),
    tss: row.tss,
    rpe: row.rpe,
    source: plannedActivityIds.has(row.id) ? 'planned' : 'off_plan',
  }));

  const summary = deriveTrainingCapabilities({
    completedWorkouts,
    recentActivities,
    lookbackDays,
  });

  return persistTrainingCapabilities(userId, summary);
}
