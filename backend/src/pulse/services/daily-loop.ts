import type {
  PulseActionsResponse,
  PulseActionState,
  PulseDailyDecisionQualityResponse,
  PulseDataStatus,
  PulseFitnessLoad,
  PulseRecentActionDecision,
} from '@coaching-os/shared/pulse';
import { and, desc, eq, gte, or, sql } from 'drizzle-orm';
import {
  pulseActionDecisions,
  pulseActivities,
  pulseDailyMetrics,
  pulseMentalCheckins,
  pulsePlanGenerations,
  pulsePlannedWorkouts,
  pulseUserProfile,
} from '../../db/pulse-schema.js';
import { users } from '../../db/schema.js';
import { db } from '../../lib/db.js';
import { buildPulseContextFor } from '../lib/pulse-context.js';
import { getCached, setCached } from '../lib/pulse-cache.js';
import {
  actionStateFromDecision,
  ensureActionDecisionForAction,
  listActionDecisionRows,
  selectRecentResolvedActionDecisions,
  type ActionDecisionRow,
} from './action-push.js';
import { buildDailyDecisionQuality, type DailyDecisionQualityActionDecision } from './daily-decision-quality.js';
import { buildDailyOutcomeLearning, type DailyOutcomeLearningActionDecision } from './daily-outcome-learning.js';
import { computeFitnessLoad } from './load-engine.js';

export function addDateDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function toIsoDate(date: Date): string {
  return date.toISOString().split('T')[0]!;
}

export async function getFitnessLoadCached(userId: string, date: string): Promise<PulseFitnessLoad> {
  const cached = await getCached<PulseFitnessLoad>('fitness-load', userId, date);
  if (cached) return cached;

  const load = await computeFitnessLoad(userId, date);
  await setCached('fitness-load', userId, date, load);
  return load;
}

function calcStreak(dates: string[], today: string): number {
  if (dates.length === 0) return 0;
  const sorted = [...new Set(dates)].sort().reverse();
  let streak = 0;
  let expected = today;
  for (const d of sorted) {
    if (d === expected) {
      streak++;
      const prev = new Date(expected);
      prev.setDate(prev.getDate() - 1);
      expected = prev.toISOString().split('T')[0]!;
    } else if (d < expected) {
      break;
    }
  }
  return streak;
}

export async function computeStreaks(userId: string, today: string): Promise<{ checkinStreakDays: number; workoutStreakDays: number }> {
  const since = new Date(Date.now() - 60 * 86_400_000).toISOString().split('T')[0]!;
  const [checkins, workouts] = await Promise.all([
    db.select({ date: pulseMentalCheckins.date })
      .from(pulseMentalCheckins)
      .where(and(eq(pulseMentalCheckins.userId, userId), gte(pulseMentalCheckins.date, since))),
    db.select({ date: pulsePlannedWorkouts.plannedDate })
      .from(pulsePlannedWorkouts)
      .where(and(
        eq(pulsePlannedWorkouts.userId, userId),
        eq(pulsePlannedWorkouts.status, 'completed'),
        gte(pulsePlannedWorkouts.plannedDate, since),
      )),
  ]);
  return {
    checkinStreakDays: calcStreak(checkins.map(c => c.date), today),
    workoutStreakDays: calcStreak(workouts.map(w => w.date), today),
  };
}

export async function getPulseDataStatus(userId: string, today: string): Promise<PulseDataStatus> {
  const since14d = new Date(Date.now() - 14 * 86_400_000).toISOString().split('T')[0]!;

  const [
    [user],
    [profile],
    [latestMetric],
    [latestActivity],
    [metricCount],
    [activityCount],
  ] = await Promise.all([
    db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1),
    db.select({ userId: pulseUserProfile.userId }).from(pulseUserProfile).where(eq(pulseUserProfile.userId, userId)).limit(1),
    db.select({
      date: pulseDailyMetrics.date,
      syncedAt: pulseDailyMetrics.syncedAt,
    }).from(pulseDailyMetrics)
      .where(eq(pulseDailyMetrics.userId, userId))
      .orderBy(desc(pulseDailyMetrics.date))
      .limit(1),
    db.select({ startTime: pulseActivities.startTime }).from(pulseActivities)
      .where(eq(pulseActivities.userId, userId))
      .orderBy(desc(pulseActivities.startTime))
      .limit(1),
    db.select({ count: sql<number>`count(*)::int` }).from(pulseDailyMetrics)
      .where(and(eq(pulseDailyMetrics.userId, userId), gte(pulseDailyMetrics.date, since14d))),
    db.select({ count: sql<number>`count(*)::int` }).from(pulseActivities)
      .where(and(eq(pulseActivities.userId, userId), gte(pulseActivities.startTime, new Date(`${since14d}T00:00:00.000Z`)))),
  ]);

  const issues: string[] = [];
  if (!user) issues.push('single_user_missing');
  if (!profile) issues.push('profile_missing');
  if (!latestMetric) issues.push('no_daily_metrics');
  if (!latestActivity) issues.push('no_activities');

  let status: PulseDataStatus['garmin']['status'] = 'ready';
  if (!latestMetric && !latestActivity) {
    status = 'empty';
  } else if (latestMetric?.date !== today) {
    status = 'stale';
    issues.push('today_metrics_missing');
  } else if (!latestActivity) {
    status = 'partial';
  }

  return {
    userReady: !!user,
    profileReady: !!profile,
    garmin: {
      status,
      lastMetricDate: latestMetric?.date ?? null,
      lastMetricSyncAt: latestMetric?.syncedAt?.toISOString() ?? null,
      lastActivityAt: latestActivity?.startTime?.toISOString() ?? null,
      metricsDays14: Number(metricCount?.count ?? 0),
      activitiesDays14: Number(activityCount?.count ?? 0),
      issues,
    },
  };
}

function recentDecisionFromRow(row: ActionDecisionRow): PulseRecentActionDecision {
  return {
    decisionId: row.id,
    source: row.source,
    kind: row.kind,
    title: row.title,
    status: row.status as PulseRecentActionDecision['status'],
    targetRoute: row.targetRoute,
    createdAt: row.createdAt.toISOString(),
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    resolutionReason: row.resolutionReason ?? null,
  };
}

export async function listCurrentActionStates(userId: string, date: string, includeHistory = false): Promise<PulseActionsResponse> {
  const context = await buildPulseContextFor(userId, date);
  const existingRows = await listActionDecisionRows(userId);
  const states: PulseActionState[] = [];

  for (const action of context.nextBestActions) {
    const decision = await ensureActionDecisionForAction(userId, action, existingRows);
    existingRows.unshift(decision);
    states.push(actionStateFromDecision(action, decision));
  }

  if (!includeHistory) {
    return { actions: states };
  }

  return {
    actions: states,
    suppressed: context.suppressedNextBestActions,
    recentDecisions: selectRecentResolvedActionDecisions(existingRows, date).map(recentDecisionFromRow),
  };
}

export async function loadDailyDecisionQuality(userId: string, days: number): Promise<PulseDailyDecisionQualityResponse> {
  const today = toIsoDate(new Date());
  const sinceDate = addDateDays(new Date(`${today}T00:00:00.000Z`), -days);
  const since = toIsoDate(sinceDate);

  const [actionRows, checkins, plannedWorkouts, activities, dailyMetrics, planGenerations] = await Promise.all([
    db.select({
      id: pulseActionDecisions.id,
      source: pulseActionDecisions.source,
      sourceId: pulseActionDecisions.sourceId,
      kind: pulseActionDecisions.kind,
      title: pulseActionDecisions.title,
      status: pulseActionDecisions.status,
      targetRoute: pulseActionDecisions.targetRoute,
      createdAt: pulseActionDecisions.createdAt,
      resolvedAt: pulseActionDecisions.resolvedAt,
      resolutionReason: pulseActionDecisions.resolutionReason,
    }).from(pulseActionDecisions)
      .where(and(
        eq(pulseActionDecisions.userId, userId),
        or(gte(pulseActionDecisions.createdAt, sinceDate), gte(pulseActionDecisions.resolvedAt, sinceDate)),
      ))
      .orderBy(desc(pulseActionDecisions.createdAt))
      .limit(200),
    db.select({
      date: pulseMentalCheckins.date,
      mood: pulseMentalCheckins.mood,
      energy: pulseMentalCheckins.energy,
      stress: pulseMentalCheckins.stress,
      motivation: pulseMentalCheckins.motivation,
    }).from(pulseMentalCheckins)
      .where(and(eq(pulseMentalCheckins.userId, userId), gte(pulseMentalCheckins.date, since))),
    db.select({
      id: pulsePlannedWorkouts.id,
      plannedDate: pulsePlannedWorkouts.plannedDate,
      activityType: pulsePlannedWorkouts.activityType,
      zone: pulsePlannedWorkouts.zone,
      durationMin: pulsePlannedWorkouts.durationMin,
      status: pulsePlannedWorkouts.status,
      completedActivityId: pulsePlannedWorkouts.completedActivityId,
      executionStatus: pulsePlannedWorkouts.executionStatus,
    }).from(pulsePlannedWorkouts)
      .where(and(eq(pulsePlannedWorkouts.userId, userId), gte(pulsePlannedWorkouts.plannedDate, since))),
    db.select({
      id: pulseActivities.id,
      startTime: pulseActivities.startTime,
      activityType: pulseActivities.activityType,
      durationSec: pulseActivities.durationSec,
      rpe: pulseActivities.rpe,
    }).from(pulseActivities)
      .where(and(eq(pulseActivities.userId, userId), gte(pulseActivities.startTime, sinceDate)))
      .orderBy(desc(pulseActivities.startTime)),
    db.select({
      date: pulseDailyMetrics.date,
      sleepHours: pulseDailyMetrics.sleepHours,
      hrvStatus: pulseDailyMetrics.hrvStatus,
      bodyBatteryMax: pulseDailyMetrics.bodyBatteryMax,
      bodyBatteryAtWake: pulseDailyMetrics.bodyBatteryAtWake,
      stressAvg: pulseDailyMetrics.stressAvg,
      highStressSec: pulseDailyMetrics.highStressSec,
      avgWakingRespiration: pulseDailyMetrics.avgWakingRespiration,
      latestSpo2: pulseDailyMetrics.latestSpo2,
    }).from(pulseDailyMetrics)
      .where(and(eq(pulseDailyMetrics.userId, userId), gte(pulseDailyMetrics.date, since)))
      .orderBy(pulseDailyMetrics.date),
    db.select({
      weekStart: pulsePlanGenerations.weekStart,
      createdAt: pulsePlanGenerations.createdAt,
      planDecision: pulsePlanGenerations.planDecision,
    }).from(pulsePlanGenerations)
      .where(and(eq(pulsePlanGenerations.userId, userId), gte(pulsePlanGenerations.createdAt, sinceDate)))
      .orderBy(desc(pulsePlanGenerations.createdAt))
      .limit(8),
  ]);

  const actionDecisions = actionRows.map((row): DailyDecisionQualityActionDecision => ({
    ...row,
    status: row.status as DailyDecisionQualityActionDecision['status'],
    createdAt: row.createdAt.toISOString(),
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
  }));
  const plannedWorkoutInput = plannedWorkouts.map(row => ({
    ...row,
    executionStatus: row.executionStatus ?? null,
  }));
  const dailyOutcomeInput = dailyMetrics.map(row => ({
    date: row.date,
    sleepHours: row.sleepHours,
    hrvStatus: row.hrvStatus ?? null,
    bodyBatteryMax: row.bodyBatteryMax,
    stressAvg: row.stressAvg,
  }));

  return buildDailyDecisionQuality({
    today,
    days,
    actionDecisions,
    outcomes: buildDailyOutcomeLearning({
      today,
      days,
      actionDecisions: actionDecisions.map((action): DailyOutcomeLearningActionDecision => action),
      checkins,
      plannedWorkouts: plannedWorkoutInput,
      activities: activities.map(row => ({
        id: row.id,
        source: 'garmin',
        startTime: row.startTime.toISOString(),
        activityType: row.activityType,
        durationSec: row.durationSec,
      })),
      dailyMetrics: dailyOutcomeInput,
    }),
    checkins,
    plannedWorkouts: plannedWorkoutInput,
    activities: activities.map(row => ({
      ...row,
      startTime: row.startTime.toISOString(),
    })),
    dailyMetrics: dailyMetrics.map(row => ({
      ...row,
      hrvStatus: row.hrvStatus ?? null,
    })),
    planGenerations: planGenerations.map(row => ({
      weekStart: row.weekStart,
      createdAt: row.createdAt?.toISOString() ?? `${row.weekStart}T00:00:00.000Z`,
      targetSessionCount: row.planDecision.targetSessionCount,
      skippedAvailableDays: row.planDecision.skippedAvailableDays,
      reasons: row.planDecision.reasons,
    })),
  });
}
