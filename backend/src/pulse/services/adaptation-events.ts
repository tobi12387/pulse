import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { and, desc, eq, gte, isNull, lt, or } from 'drizzle-orm';
import type {
  PulseAdaptationEvent,
  PulseAdaptationEventKind,
  PulseAdaptationRecommendation,
  PulseActivityType,
  PulseFuelingDebtSummary,
} from '@coaching-os/shared/pulse';
import {
  pulseActivities,
  pulseAdaptationEvents,
  pulseDailyMetrics,
  pulseGarminExecutionLedger,
  pulseMentalCheckins,
  pulseNutritionLogs,
  pulsePlannedWorkouts,
} from '../../db/pulse-schema.js';
import { computeFitnessLoad, computeReadinessScore } from './load-engine.js';
import { deriveWorkoutExecutionState, scoreActivityWorkoutMatch } from './workout-reconciliation.js';
import { loadFuelingDebtSummary, summarizeFuelingDebt } from './fueling-debt.js';

interface ClassifierActivity {
  id: string;
  date: string;
  activityType: string;
  durationMin: number;
  tss: number | null;
  rpe: number | null;
  plannedWorkoutId: string | null;
}

interface ClassifierFuelingLog {
  date: string;
  giComfort: string | null;
  durationMin: number | null;
  carbsG: number | null;
}

export interface ClassifyAdaptationEventsInput {
  today: string;
  completedActivities: ClassifierActivity[];
  missedWorkouts: Array<{ id: string; plannedDate: string; activityType: string; durationMin: number; zone: number }>;
  mental: { mood: number; energy: number; stress: number; motivation: number } | null;
  readinessScore: number;
  tsb: number;
  fuelingHistory: ClassifierFuelingLog[];
  fuelingDebt?: PulseFuelingDebtSummary | null;
  syncDebtCount: number;
}

function adaptationEvent(input: {
  kind: PulseAdaptationEventKind;
  sourceId?: string | null;
  severity: PulseAdaptationEvent['severity'];
  recommendation: PulseAdaptationRecommendation;
  summary: string;
  evidence: string[];
  today: string;
}): PulseAdaptationEvent {
  return {
    id: `${input.kind}:${input.sourceId ?? input.today}`,
    userId: '',
    eventDate: input.today,
    kind: input.kind,
    sourceId: input.sourceId ?? null,
    severity: input.severity,
    recommendation: input.recommendation,
    summary: input.summary,
    evidence: input.evidence,
    resolvedAt: null,
    createdAt: new Date(`${input.today}T12:00:00.000Z`).toISOString(),
  };
}

function hasGiIssue(log: ClassifierFuelingLog): boolean {
  return ['mild_issue', 'issue'].includes(log.giComfort ?? '');
}

export function classifyAdaptationEvents(input: ClassifyAdaptationEventsInput): PulseAdaptationEvent[] {
  const events: PulseAdaptationEvent[] = [];
  const longCompleted = input.completedActivities.find(activity =>
    activity.durationMin >= 240 || (activity.tss ?? 0) >= 250
  );
  const highRpe = input.completedActivities.find(activity => (activity.rpe ?? 0) >= 8);
  const fuelingDebt = input.fuelingDebt ?? summarizeFuelingDebt({ today: input.today, logs: input.fuelingHistory });
  const giLog = fuelingDebt.hasOpenDebt
    ? input.fuelingHistory.find(log => log.date === fuelingDebt.openIssueDate && hasGiIssue(log)) ?? input.fuelingHistory.find(hasGiIssue)
    : null;

  if (longCompleted) {
    events.push(adaptationEvent({
      today: input.today,
      kind: 'activity_completed',
      sourceId: longCompleted.id,
      severity: 'action',
      recommendation: 'protect_recovery',
      summary: 'Lange reale Einheit erkannt; Folgetage muessen Belastung absorbieren.',
      evidence: [
        `${longCompleted.activityType} ${longCompleted.durationMin} min`,
        `TSS ${longCompleted.tss ?? 'unbekannt'}`,
        `TSB ${input.tsb.toFixed(1)}`,
      ],
    }));
  }

  if (giLog) {
    events.push(adaptationEvent({
      today: input.today,
      kind: 'fueling_limiter',
      sourceId: giLog.date,
      severity: 'watch',
      recommendation: 'reduce_volume',
      summary: fuelingDebt.summary,
      evidence: [
        `GI-Komfort ${giLog.giComfort}`,
        giLog.carbsG != null ? `${giLog.carbsG} g Carbs` : 'Carbs nicht geloggt',
        fuelingDebt.closureCondition,
      ],
    }));
  }

  if (highRpe) {
    events.push(adaptationEvent({
      today: input.today,
      kind: 'high_rpe',
      sourceId: highRpe.id,
      severity: 'watch',
      recommendation: 'reduce_intensity',
      summary: 'Hohe RPE spricht gegen direktes Nachlegen harter Reize.',
      evidence: [`RPE ${highRpe.rpe}/10`, `${highRpe.activityType} ${highRpe.durationMin} min`],
    }));
  }

  if (input.missedWorkouts.length > 0) {
    events.push(adaptationEvent({
      today: input.today,
      kind: 'planned_workout_missed',
      sourceId: input.missedWorkouts[0]!.id,
      severity: 'watch',
      recommendation: 'move_workout',
      summary: 'Mindestens eine geplante Einheit wurde nicht ausgefuehrt.',
      evidence: input.missedWorkouts
        .slice(0, 2)
        .map(w => `${w.plannedDate}: ${w.activityType} Z${w.zone} ${w.durationMin} min`),
    }));
  }

  if (input.mental && input.mental.energy <= 3 && input.mental.stress >= 7) {
    events.push(adaptationEvent({
      today: input.today,
      kind: 'mental_load',
      severity: 'watch',
      recommendation: 'protect_recovery',
      summary: 'Mentale Last spricht fuer weniger Entscheidungsdruck.',
      evidence: [`Energie ${input.mental.energy}/10`, `Stress ${input.mental.stress}/10`],
    }));
  }

  if (input.readinessScore < 55 || input.tsb <= -12) {
    events.push(adaptationEvent({
      today: input.today,
      kind: 'recovery_risk',
      severity: 'action',
      recommendation: 'protect_recovery',
      summary: 'Readiness/TSB sprechen fuer Erholungsprioritaet.',
      evidence: [`Readiness ${input.readinessScore}/100`, `TSB ${input.tsb.toFixed(1)}`],
    }));
  }

  if (input.syncDebtCount > 0) {
    events.push(adaptationEvent({
      today: input.today,
      kind: 'sync_debt',
      severity: 'action',
      recommendation: 'sync_garmin',
      summary: 'Garmin-Sync-Schulden muessen vor Ausfuehrung geschlossen werden.',
      evidence: [`${input.syncDebtCount} offene Einheit(en)`],
    }));
  }

  if (events.length === 0) {
    events.push(adaptationEvent({
      today: input.today,
      kind: 'recovery_risk',
      severity: 'info',
      recommendation: 'keep_plan',
      summary: 'Keine harte Anpassung noetig; Plan beibehalten.',
      evidence: [`Readiness ${input.readinessScore}/100`, `TSB ${input.tsb.toFixed(1)}`],
    }));
  }

  return events;
}

function mapAdaptationRow(row: typeof pulseAdaptationEvents.$inferSelect): PulseAdaptationEvent {
  return {
    id: row.id,
    userId: row.userId,
    eventDate: row.eventDate,
    kind: row.kind,
    sourceId: row.sourceId === '' ? null : row.sourceId,
    severity: row.severity,
    recommendation: row.recommendation,
    summary: row.summary,
    evidence: row.evidence,
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function upsertAdaptationEvents(
  db: NodePgDatabase<any>,
  userId: string,
  events: PulseAdaptationEvent[],
): Promise<void> {
  for (const item of events) {
    await db.insert(pulseAdaptationEvents)
      .values({
        userId,
        eventDate: item.eventDate,
        kind: item.kind,
        sourceId: item.sourceId ?? '',
        severity: item.severity,
        recommendation: item.recommendation,
        summary: item.summary,
        evidence: item.evidence,
        resolvedAt: item.resolvedAt ? new Date(item.resolvedAt) : null,
      })
      .onConflictDoUpdate({
        target: [
          pulseAdaptationEvents.userId,
          pulseAdaptationEvents.eventDate,
          pulseAdaptationEvents.kind,
          pulseAdaptationEvents.sourceId,
        ],
        set: {
          severity: item.severity,
          recommendation: item.recommendation,
          summary: item.summary,
          evidence: item.evidence,
          resolvedAt: item.resolvedAt ? new Date(item.resolvedAt) : null,
        },
      });
  }
}

export async function loadOpenAdaptationEvents(
  db: NodePgDatabase<any>,
  userId: string,
  today: string,
): Promise<PulseAdaptationEvent[]> {
  const rows = await db
    .select()
    .from(pulseAdaptationEvents)
    .where(and(
      eq(pulseAdaptationEvents.userId, userId),
      eq(pulseAdaptationEvents.eventDate, today),
      isNull(pulseAdaptationEvents.resolvedAt),
    ))
    .orderBy(desc(pulseAdaptationEvents.createdAt));

  return rows.map(mapAdaptationRow);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function isoDate(date: Date): string {
  return date.toISOString().split('T')[0]!;
}

function bestMatchingActivity<
  Workout extends { plannedDate: string; activityType: PulseActivityType; durationMin: number },
  Activity extends { id: string; startTime: Date; activityType: PulseActivityType; durationSec: number | null },
>(workout: Workout, activities: Activity[]): Activity | null {
  const candidates = activities
    .filter(activity => isoDate(activity.startTime) === workout.plannedDate)
    .map(activity => ({
      activity,
      score: scoreActivityWorkoutMatch(workout, activity),
    }))
    .sort((a, b) => b.score - a.score);
  return candidates[0]?.score != null && candidates[0].score >= 0.6 ? candidates[0].activity : null;
}

export async function refreshAdaptationEventsForUser(
  db: NodePgDatabase<any>,
  userId: string,
  today: string,
): Promise<PulseAdaptationEvent[]> {
  const todayStart = new Date(`${today}T00:00:00.000Z`);
  const tomorrowStart = addDays(todayStart, 1);
  const activitySince = addDays(todayStart, -2);
  const recentSince = isoDate(addDays(todayStart, -14));

  const [
    completedActivities,
    recentWorkouts,
    recentMatchActivities,
    [mental],
    [metrics],
    fuelingHistory,
    fuelingDebt,
    syncDebt,
    fitnessLoad,
  ] = await Promise.all([
    db.select({
      id: pulseActivities.id,
      date: pulseActivities.startTime,
      activityType: pulseActivities.activityType,
      durationSec: pulseActivities.durationSec,
      tss: pulseActivities.tss,
      rpe: pulseActivities.rpe,
    }).from(pulseActivities)
      .where(and(
        eq(pulseActivities.userId, userId),
        gte(pulseActivities.startTime, activitySince),
        lt(pulseActivities.startTime, tomorrowStart),
      ))
      .orderBy(desc(pulseActivities.startTime))
      .limit(12),
    db.select({
      id: pulsePlannedWorkouts.id,
      plannedDate: pulsePlannedWorkouts.plannedDate,
      activityType: pulsePlannedWorkouts.activityType,
      durationMin: pulsePlannedWorkouts.durationMin,
      zone: pulsePlannedWorkouts.zone,
      status: pulsePlannedWorkouts.status,
      garminWorkoutId: pulsePlannedWorkouts.garminWorkoutId,
      garminScheduledId: pulsePlannedWorkouts.garminScheduledId,
      completedActivityId: pulsePlannedWorkouts.completedActivityId,
      executionStatus: pulsePlannedWorkouts.executionStatus,
    }).from(pulsePlannedWorkouts)
      .where(and(
        eq(pulsePlannedWorkouts.userId, userId),
        gte(pulsePlannedWorkouts.plannedDate, recentSince),
        lt(pulsePlannedWorkouts.plannedDate, today),
      ))
      .orderBy(desc(pulsePlannedWorkouts.plannedDate))
      .limit(20),
    db.select({
      id: pulseActivities.id,
      startTime: pulseActivities.startTime,
      activityType: pulseActivities.activityType,
      durationSec: pulseActivities.durationSec,
    }).from(pulseActivities)
      .where(and(
        eq(pulseActivities.userId, userId),
        gte(pulseActivities.startTime, new Date(`${recentSince}T00:00:00.000Z`)),
        lt(pulseActivities.startTime, tomorrowStart),
      ))
      .orderBy(desc(pulseActivities.startTime))
      .limit(50),
    db.select({
      mood: pulseMentalCheckins.mood,
      energy: pulseMentalCheckins.energy,
      stress: pulseMentalCheckins.stress,
      motivation: pulseMentalCheckins.motivation,
    }).from(pulseMentalCheckins)
      .where(and(eq(pulseMentalCheckins.userId, userId), eq(pulseMentalCheckins.date, today)))
      .limit(1),
    db.select({
      sleepHours: pulseDailyMetrics.sleepHours,
      hrvStatus: pulseDailyMetrics.hrvStatus,
      bodyBatteryMax: pulseDailyMetrics.bodyBatteryMax,
      stressAvg: pulseDailyMetrics.stressAvg,
    }).from(pulseDailyMetrics)
      .where(and(eq(pulseDailyMetrics.userId, userId), eq(pulseDailyMetrics.date, today)))
      .limit(1),
    db.select({
      date: pulseNutritionLogs.date,
      giComfort: pulseNutritionLogs.giComfort,
      carbsG: pulseNutritionLogs.carbsG,
    }).from(pulseNutritionLogs)
      .where(and(eq(pulseNutritionLogs.userId, userId), gte(pulseNutritionLogs.date, recentSince)))
      .orderBy(desc(pulseNutritionLogs.date))
      .limit(12),
    loadFuelingDebtSummary(userId, today).catch(() => null),
    db.select({ id: pulseGarminExecutionLedger.id }).from(pulseGarminExecutionLedger)
      .where(and(
        eq(pulseGarminExecutionLedger.userId, userId),
        gte(pulseGarminExecutionLedger.attemptedAt, activitySince),
        or(
          eq(pulseGarminExecutionLedger.outcome, 'blocked'),
          eq(pulseGarminExecutionLedger.outcome, 'failed'),
        ),
      ))
      .limit(20),
    computeFitnessLoad(userId, today),
  ]);

  const mentalScore = mental ? ((mental.mood + mental.energy + mental.motivation) / 3) * 10 : null;
  const readiness = computeReadinessScore({
    sleepHours: metrics?.sleepHours ?? null,
    hrvStatus: metrics?.hrvStatus ?? null,
    bodyBatteryMax: metrics?.bodyBatteryMax ?? null,
    stressAvg: metrics?.stressAvg ?? null,
    mentalScore,
    tsb: fitnessLoad.tsb,
  });

  const missedWorkouts = recentWorkouts
    .filter(workout => {
      if (workout.status === 'skipped' || workout.executionStatus === 'missed') return true;
      const activityType = workout.activityType as PulseActivityType;
      const match = bestMatchingActivity({ ...workout, activityType }, recentMatchActivities.map(activity => ({
        ...activity,
        activityType: activity.activityType as PulseActivityType,
      })));
      return deriveWorkoutExecutionState({
        ...workout,
        activityType,
        status: workout.status,
      }, null, match, new Date(`${today}T12:00:00.000Z`)).status === 'missed';
    })
    .slice(0, 5);

  const events = classifyAdaptationEvents({
    today,
    completedActivities: completedActivities.map(activity => ({
      id: activity.id,
      date: isoDate(activity.date),
      activityType: activity.activityType,
      durationMin: Math.round((activity.durationSec ?? 0) / 60),
      tss: activity.tss,
      rpe: activity.rpe,
      plannedWorkoutId: null,
    })),
    missedWorkouts,
    mental: mental ?? null,
    readinessScore: readiness.score,
    tsb: fitnessLoad.tsb,
    fuelingHistory: fuelingHistory.map(log => ({ ...log, durationMin: null })),
    fuelingDebt,
    syncDebtCount: syncDebt.length,
  });

  await db.update(pulseAdaptationEvents)
    .set({ resolvedAt: new Date() })
    .where(and(
      eq(pulseAdaptationEvents.userId, userId),
      eq(pulseAdaptationEvents.eventDate, today),
      isNull(pulseAdaptationEvents.resolvedAt),
    ));
  await upsertAdaptationEvents(db, userId, events);

  return loadOpenAdaptationEvents(db, userId, today);
}
