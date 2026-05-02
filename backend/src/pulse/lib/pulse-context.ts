import { and, desc, eq, gte, inArray, isNull, lte, or, sql } from 'drizzle-orm';
import { db } from '../../lib/db.js';
import {
  pulseActivities,
  pulseActionDecisions,
  pulseCoachPreferences,
  pulseDailyMetrics,
  pulseHealthState,
  pulseMentalCheckins,
  pulsePlannedWorkouts,
  pulsePushSubscriptions,
  pulseUserProfile,
  pulseWeightLog,
} from '../../db/pulse-schema.js';
import { isPushConfigured } from '../../lib/push.js';
import { computeRecovery } from '../../lib/recovery-metrics.js';
import { computeFitnessLoad, computeReadinessScore } from '../services/load-engine.js';
import { selectMentalCompanionGuidance } from '../services/mental-companion.js';
import { rankNextBestActionVisibility } from '../services/next-best-actions.js';
import type { ActionDecisionRecord } from '../services/decision-closure.js';
import { getActiveRaces, type RaceContext } from '../services/race-engine.js';
import { getActiveRiskSignals } from '../services/risk-engine.js';
import { listEquipment, listStrengthSessions } from '../services/strength-equipment.js';
import type { CoachFullContext } from '../services/coach-engine.js';
import type { PulseCoachPreferences, PulseFitnessLoad, PulseGuidedCheckinResponse, PulseNextBestAction, PulseReadiness, PulseRecoveryMetrics, PulseRiskSignal, PulseSuppressedActionState } from '@coaching-os/shared/pulse';
import { getCached, setCached } from './pulse-cache.js';

export type PulseDailyMetricsRow = typeof pulseDailyMetrics.$inferSelect;
export type PulseMentalCheckinRow = typeof pulseMentalCheckins.$inferSelect;
export type PulseUserProfileRow = typeof pulseUserProfile.$inferSelect;
export type PulseHealthStateRow = typeof pulseHealthState.$inferSelect;
export type PulseActivityRow = typeof pulseActivities.$inferSelect;
export type PulsePlannedWorkoutRow = typeof pulsePlannedWorkouts.$inferSelect;

export interface PulseActivitySummary {
  id: string;
  startTime: Date;
  activityType: string;
  durationSec: number | null;
  tss: number | null;
  normalizedPowerW: number | null;
  avgHr: number | null;
  rpe: number | null;
  rpeNote: string | null;
  plannedZone: number | null;
}

export interface PulsePlannedWorkoutSummary {
  plannedDate: string;
  activityType: string;
  zone: number;
  durationMin: number;
  description: string | null;
}

export interface PulseContext {
  userId: string;
  date: string;
  todayMetrics: PulseDailyMetricsRow | null;
  todayCheckin: PulseMentalCheckinRow | null;
  fitnessLoad: PulseFitnessLoad;
  readiness: PulseReadiness;
  recovery: PulseRecoveryMetrics | null;
  profile: PulseUserProfileRow | null;
  coachPreferences: PulseCoachPreferences | null;
  activeHealthStates: PulseHealthStateRow[];
  recentActivities: PulseActivitySummary[];
  upcomingWorkouts: PulsePlannedWorkoutSummary[];
  metrics14d: Array<{
    date: string;
    sleepHours: number | null;
    hrvRmssd: number | null;
    bodyBatteryMax: number | null;
    stressAvg: number | null;
  }>;
  checkins14d: Array<{
    date: string;
    mood: number;
    energy: number;
    stress: number;
    motivation: number;
    themes: string[] | null;
  }>;
  latestWeight: { weightKg: number; date: string; trend30d: number | null } | null;
  nextRace: RaceContext | null;
  activeRiskSignals: PulseRiskSignal[];
  push: {
    configured: boolean;
    activeSubscriptions: number;
  };
  guidedCheckin: PulseGuidedCheckinResponse;
  nextBestActions: PulseNextBestAction[];
  suppressedNextBestActions: PulseSuppressedActionState[];
  recentStrengthSessions: Array<{
    date: string;
    sessionId: string;
    durationMin: number | null;
    topLifts: Array<{
      exercise: string;
      bestSet: { reps: number; weightKg: number | null; rpe: number | null; e1rmKg: number | null };
    }>;
  }>;
  equipmentDueForReplacement: Array<{
    name: string;
    category: string;
    kmCurrent: number;
    kmRetirement: number;
    pctConsumed: number;
  }>;
}

function daysBefore(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().split('T')[0]!;
}

function weightTrend30d(rows: Array<{ date: string; weightKg: number }>): PulseContext['latestWeight'] {
  const latest = rows[0] ?? null;
  if (!latest) return null;

  const cutoff30 = daysBefore(latest.date, 30);
  const w30ago = rows.find(w => w.date <= cutoff30) ?? null;
  const trend30d = w30ago
    ? Math.round((latest.weightKg - w30ago.weightKg) * 10) / 10
    : null;

  return { weightKg: latest.weightKg, date: latest.date, trend30d };
}

function recentMentalThemes(rows: PulseContext['checkins14d']): Array<{ theme: string; count: number; lastSeen: string }> {
  const byTheme = new Map<string, { theme: string; count: number; lastSeen: string }>();

  for (const row of rows) {
    for (const rawTheme of row.themes ?? []) {
      const theme = rawTheme.trim();
      if (!theme) continue;
      const key = theme.toLowerCase();
      const current = byTheme.get(key);
      if (!current) {
        byTheme.set(key, { theme, count: 1, lastSeen: row.date });
        continue;
      }
      current.count += 1;
      if (row.date > current.lastSeen) current.lastSeen = row.date;
    }
  }

  return [...byTheme.values()]
    .filter(theme => theme.count >= 2)
    .sort((a, b) => b.count - a.count || b.lastSeen.localeCompare(a.lastSeen) || a.theme.localeCompare(b.theme));
}

export async function buildPulseContextFor(userId: string, date: string): Promise<PulseContext> {
  const since14 = daysBefore(date, 13);
  const since60 = daysBefore(date, 59);
  const since35 = daysBefore(date, 34);
  const fitnessLoadPromise = computeFitnessLoad(userId, date);

  const [
    [todayMetrics],
    [todayCheckin],
    fitnessLoad,
    [profile],
    [coachPreferencesRow],
    activeHealthStates,
    recentActivities,
    upcomingWorkouts,
    metrics14d,
    checkins14d,
    weightRows,
    dailyHistory,
    races,
    riskSignalRows,
    [pushSubscriptionCount],
    strengthData,
    equipmentData,
  ] = await Promise.all([
    db.select().from(pulseDailyMetrics)
      .where(and(eq(pulseDailyMetrics.userId, userId), eq(pulseDailyMetrics.date, date)))
      .limit(1),
    db.select().from(pulseMentalCheckins)
      .where(and(eq(pulseMentalCheckins.userId, userId), eq(pulseMentalCheckins.date, date)))
      .limit(1),
    fitnessLoadPromise,
    db.select().from(pulseUserProfile)
      .where(eq(pulseUserProfile.userId, userId))
      .limit(1),
    db.select().from(pulseCoachPreferences)
      .where(eq(pulseCoachPreferences.userId, userId))
      .limit(1),
    db.select().from(pulseHealthState)
      .where(and(
        eq(pulseHealthState.userId, userId),
        isNull(pulseHealthState.resolvedAt),
        lte(pulseHealthState.startDate, date),
        or(isNull(pulseHealthState.endDate), gte(pulseHealthState.endDate, date)),
      ))
      .orderBy(desc(pulseHealthState.startDate)),
    db.select({
      id: pulseActivities.id,
      startTime: pulseActivities.startTime,
      activityType: pulseActivities.activityType,
      durationSec: pulseActivities.durationSec,
      tss: pulseActivities.tss,
      normalizedPowerW: pulseActivities.normalizedPowerW,
      avgHr: pulseActivities.avgHr,
      rpe: pulseActivities.rpe,
      rpeNote: pulseActivities.rpeNote,
    }).from(pulseActivities)
      .where(eq(pulseActivities.userId, userId))
      .orderBy(desc(pulseActivities.startTime))
      .limit(10),
    db.select({
      plannedDate: pulsePlannedWorkouts.plannedDate,
      activityType: pulsePlannedWorkouts.activityType,
      zone: pulsePlannedWorkouts.zone,
      durationMin: pulsePlannedWorkouts.durationMin,
      description: pulsePlannedWorkouts.description,
    }).from(pulsePlannedWorkouts)
      .where(and(
        eq(pulsePlannedWorkouts.userId, userId),
        eq(pulsePlannedWorkouts.status, 'planned'),
        gte(pulsePlannedWorkouts.plannedDate, date),
      ))
      .orderBy(pulsePlannedWorkouts.plannedDate)
      .limit(3),
    db.select({
      date: pulseDailyMetrics.date,
      sleepHours: pulseDailyMetrics.sleepHours,
      hrvRmssd: pulseDailyMetrics.hrvRmssd,
      bodyBatteryMax: pulseDailyMetrics.bodyBatteryMax,
      stressAvg: pulseDailyMetrics.stressAvg,
    }).from(pulseDailyMetrics)
      .where(and(eq(pulseDailyMetrics.userId, userId), gte(pulseDailyMetrics.date, since14)))
      .orderBy(pulseDailyMetrics.date),
    db.select({
      date: pulseMentalCheckins.date,
      mood: pulseMentalCheckins.mood,
      energy: pulseMentalCheckins.energy,
      stress: pulseMentalCheckins.stress,
      motivation: pulseMentalCheckins.motivation,
      themes: pulseMentalCheckins.themes,
    }).from(pulseMentalCheckins)
      .where(and(eq(pulseMentalCheckins.userId, userId), gte(pulseMentalCheckins.date, since14)))
      .orderBy(pulseMentalCheckins.date),
    db.select({ date: pulseWeightLog.date, weightKg: pulseWeightLog.weightKg })
      .from(pulseWeightLog)
      .where(and(eq(pulseWeightLog.userId, userId), gte(pulseWeightLog.date, since35)))
      .orderBy(desc(pulseWeightLog.date)),
    db.select({
      sleepHours: pulseDailyMetrics.sleepHours,
      hrvRmssd: pulseDailyMetrics.hrvRmssd,
      restingHr: pulseDailyMetrics.restingHr,
    }).from(pulseDailyMetrics)
      .where(and(eq(pulseDailyMetrics.userId, userId), gte(pulseDailyMetrics.date, since60)))
      .orderBy(desc(pulseDailyMetrics.date)),
    fitnessLoadPromise.then(load => getActiveRaces(userId, date, { ctl: load.ctl })),
    getActiveRiskSignals(userId),
    db.select({ activeSubscriptions: sql<number>`cast(count(*) as int)` })
      .from(pulsePushSubscriptions)
      .where(and(eq(pulsePushSubscriptions.userId, userId), eq(pulsePushSubscriptions.enabled, true))),
    listStrengthSessions(userId, { days: 90 }),
    listEquipment(userId),
  ]);

  const activityIds = recentActivities.map(a => a.id);
  const completedPlans = activityIds.length > 0
    ? await db.select({
        completedActivityId: pulsePlannedWorkouts.completedActivityId,
        zone: pulsePlannedWorkouts.zone,
      }).from(pulsePlannedWorkouts)
        .where(and(
          eq(pulsePlannedWorkouts.userId, userId),
          inArray(pulsePlannedWorkouts.completedActivityId, activityIds),
        ))
    : [];
  const plannedZoneByActivityId = new Map(completedPlans.map(p => [p.completedActivityId, p.zone]));
  const recentActivitySummaries = recentActivities.map(a => ({
    ...a,
    plannedZone: plannedZoneByActivityId.get(a.id) ?? null,
  }));

  const mentalScore = todayCheckin
    ? ((todayCheckin.mood + todayCheckin.energy + todayCheckin.motivation) / 3) * 10
    : null;

  const readiness = computeReadinessScore({
    sleepHours: todayMetrics?.sleepHours ?? null,
    hrvStatus: todayMetrics?.hrvStatus ?? null,
    bodyBatteryMax: todayMetrics?.bodyBatteryMax ?? null,
    stressAvg: todayMetrics?.stressAvg ?? null,
    mentalScore,
    tsb: fitnessLoad.tsb,
  });

  const recentStrengthSessions = strengthData.sessions.slice(0, 5).map(session => {
    const bestByExercise = new Map<string, typeof session.sets[number]>();
    for (const set of session.sets) {
      const current = bestByExercise.get(set.exercise);
      if (!current || (set.e1rmKg ?? 0) > (current.e1rmKg ?? 0)) {
        bestByExercise.set(set.exercise, set);
      }
    }
    return {
      date: session.date,
      sessionId: session.id,
      durationMin: session.durationMin,
      topLifts: [...bestByExercise.values()].slice(0, 5).map(set => ({
        exercise: set.exercise,
        bestSet: {
          reps: set.reps,
          weightKg: set.weightKg,
          rpe: set.rpe,
          e1rmKg: set.e1rmKg,
        },
      })),
    };
  });

  const equipmentDueForReplacement = equipmentData.equipment
    .filter(item => item.retirementKm != null && item.pctConsumed != null && item.pctConsumed >= 90)
    .map(item => ({
      name: item.name,
      category: item.category,
      kmCurrent: item.totalKm,
      kmRetirement: item.retirementKm!,
      pctConsumed: item.pctConsumed!,
    }));

  const activeRiskSignals = riskSignalRows.map(r => ({
    id: r.id,
    ruleId: r.ruleId,
    severity: r.severity as PulseRiskSignal['severity'],
    status: r.status as PulseRiskSignal['status'],
    title: r.title,
    description: r.description,
    recommendation: r.recommendation,
    metric: r.metricSnapshot as Record<string, unknown>,
    triggeredAt: r.triggeredAt.toISOString(),
    resolvedAt: r.resolvedAt?.toISOString() ?? null,
    snoozedUntil: r.snoozedUntil?.toISOString() ?? null,
  }));
  const push = {
    configured: isPushConfigured(),
    activeSubscriptions: Number(pushSubscriptionCount?.activeSubscriptions ?? 0),
  };
  const guidedCore = selectMentalCompanionGuidance({
    today: date,
    todayWorkout: upcomingWorkouts.find(workout => workout.plannedDate === date) ?? null,
    nextWorkout: upcomingWorkouts[0] ?? null,
    readinessScore: readiness.score,
    stressAvg: todayMetrics?.stressAvg ?? null,
    recentThemes: recentMentalThemes(checkins14d),
    recentCheckins: checkins14d.map(checkin => ({
      date: checkin.date,
      mood: checkin.mood,
      energy: checkin.energy,
      stress: checkin.stress,
      motivation: checkin.motivation,
      themes: checkin.themes,
    })),
  });
  const guidedCheckin: PulseGuidedCheckinResponse = {
    date,
    questions: guidedCore.questions,
    action: guidedCore.action,
  };
  const actionDecisionRows = await db.select().from(pulseActionDecisions)
    .where(eq(pulseActionDecisions.userId, userId))
    .orderBy(desc(pulseActionDecisions.createdAt))
    .limit(100);
  const actionDecisions: ActionDecisionRecord[] = actionDecisionRows.map(row => ({
    id: row.id,
    userId: row.userId,
    source: row.source,
    sourceId: row.sourceId,
    kind: row.kind,
    title: row.title,
    status: row.status as ActionDecisionRecord['status'],
    createdAt: row.createdAt.toISOString(),
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    resolutionReason: row.resolutionReason,
    targetRoute: row.targetRoute,
    rawContext: row.rawContext,
  }));
  const actionVisibility = rankNextBestActionVisibility({
    today: date,
    todayCheckin: todayCheckin ?? null,
    activeRiskSignals,
    recentActivities: recentActivitySummaries,
    upcomingWorkouts,
    push,
    equipmentDueForReplacement,
    guidedCheckin,
    actionDecisions,
  });
  const nextBestActions = actionVisibility.visible;

  return {
    userId,
    date,
    todayMetrics: todayMetrics ?? null,
    todayCheckin: todayCheckin ?? null,
    fitnessLoad,
    readiness,
    recovery: dailyHistory.length >= 3 ? computeRecovery({ daily: dailyHistory }) : null,
    profile: profile ?? null,
    coachPreferences: coachPreferencesRow ? {
      timeWindows: coachPreferencesRow.timeWindows,
      dislikedWorkoutPatterns: coachPreferencesRow.dislikedWorkoutPatterns,
      preferredLongDays: coachPreferencesRow.preferredLongDays,
      injurySensitiveConstraints: coachPreferencesRow.injurySensitiveConstraints,
      communicationStyle: coachPreferencesRow.communicationStyle,
      updatedAt: coachPreferencesRow.updatedAt.toISOString(),
    } : null,
    activeHealthStates,
    recentActivities: recentActivitySummaries,
    upcomingWorkouts,
    metrics14d,
    checkins14d,
    latestWeight: weightTrend30d(weightRows),
    nextRace: races[0] ?? null,
    activeRiskSignals,
    push,
    guidedCheckin,
    nextBestActions,
    suppressedNextBestActions: actionVisibility.suppressed,
    recentStrengthSessions,
    equipmentDueForReplacement,
  };
}

interface CachedPulseContext extends Omit<PulseContext, 'recentActivities'> {
  recentActivities: Array<Omit<PulseContext['recentActivities'][number], 'startTime'> & { startTime: string }>;
}

function revivePulseContext(ctx: CachedPulseContext): PulseContext {
  return {
    ...ctx,
    activeRiskSignals: ctx.activeRiskSignals ?? [],
    coachPreferences: ctx.coachPreferences ?? null,
    push: ctx.push ?? { configured: false, activeSubscriptions: 0 },
    guidedCheckin: ctx.guidedCheckin ?? { date: ctx.date, questions: [], action: null },
    nextBestActions: ctx.nextBestActions ?? [],
    suppressedNextBestActions: ctx.suppressedNextBestActions ?? [],
    recentStrengthSessions: ctx.recentStrengthSessions ?? [],
    equipmentDueForReplacement: ctx.equipmentDueForReplacement ?? [],
    recentActivities: ctx.recentActivities.map(a => ({ ...a, startTime: new Date(a.startTime) })),
  };
}

export async function buildCachedPulseContextFor(userId: string, date: string): Promise<PulseContext> {
  const cached = await getCached<CachedPulseContext>('context-v3', userId, date);
  if (cached) return revivePulseContext(cached);

  const ctx = await buildPulseContextFor(userId, date);
  await setCached('context-v3', userId, date, ctx);
  return ctx;
}

export function mapPulseContextToCoachContext(ctx: PulseContext): CoachFullContext {
  return {
    today: ctx.date,
    readiness: { score: ctx.readiness.score, label: ctx.readiness.label },
    todayMetrics: ctx.todayMetrics ? {
      sleepHours: ctx.todayMetrics.sleepHours,
      sleepScore: ctx.todayMetrics.sleepScore,
      hrvRmssd: ctx.todayMetrics.hrvRmssd,
      hrvStatus: ctx.todayMetrics.hrvStatus,
      restingHr: ctx.todayMetrics.restingHr,
      bodyBatteryMax: ctx.todayMetrics.bodyBatteryMax,
      stressAvg: ctx.todayMetrics.stressAvg,
      steps: ctx.todayMetrics.steps,
    } : null,
    todayCheckin: ctx.todayCheckin ? {
      mood: ctx.todayCheckin.mood,
      energy: ctx.todayCheckin.energy,
      stress: ctx.todayCheckin.stress,
      motivation: ctx.todayCheckin.motivation,
      notes: ctx.todayCheckin.notes,
    } : null,
    load: { ctl: ctx.fitnessLoad.ctl, atl: ctx.fitnessLoad.atl, tsb: ctx.fitnessLoad.tsb },
    profile: ctx.profile ? {
      ftpWatts: ctx.profile.ftpWatts,
      maxHrBpm: ctx.profile.maxHrBpm,
      vo2max: ctx.profile.vo2max,
      trainingPhase: ctx.profile.trainingPhase,
    } : null,
    coachPreferences: ctx.coachPreferences,
    activeHealthStates: ctx.activeHealthStates.map(s => ({
      type: s.type,
      severity: s.severity,
      bodyPart: s.bodyPart,
      notes: s.notes,
      startDate: s.startDate,
      endDate: s.endDate,
    })),
    recentActivities: ctx.recentActivities.map(a => ({
      date: a.startTime.toISOString().split('T')[0]!,
      activityType: a.activityType,
      durationSec: a.durationSec,
      tss: a.tss,
      normalizedPowerW: a.normalizedPowerW,
      avgHr: a.avgHr,
      rpe: a.rpe,
      rpeNote: a.rpeNote,
      plannedZone: a.plannedZone,
    })),
    upcomingWorkouts: ctx.upcomingWorkouts,
    metrics14: ctx.metrics14d,
    checkins14: ctx.checkins14d,
    latestWeight: ctx.latestWeight,
    activeRiskSignals: ctx.activeRiskSignals,
    nextBestActions: ctx.nextBestActions,
    suppressedNextBestActions: ctx.suppressedNextBestActions,
    guidedCheckin: ctx.guidedCheckin,
    recentStrengthSessions: ctx.recentStrengthSessions,
    equipmentDueForReplacement: ctx.equipmentDueForReplacement,
    recovery: ctx.recovery ? {
      sleepDebt7dH: ctx.recovery.sleepDebt7d.hours,
      sleepDebtStatus: ctx.recovery.sleepDebt7d.status,
      hrvDeviationPct: ctx.recovery.hrvDeviation7d.pct,
      hrvStatus: ctx.recovery.hrvDeviation7d.status,
      rhrDriftBpm: ctx.recovery.rhrDrift7d.bpmAboveBaseline,
      rhrStatus: ctx.recovery.rhrDrift7d.status,
      recoveryScore: ctx.recovery.recoveryScore,
      recommendation: ctx.recovery.recommendation,
    } : null,
  };
}
