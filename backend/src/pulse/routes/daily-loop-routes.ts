import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { and, desc, eq, gte, lt, or } from 'drizzle-orm';
import type {
  PulseActionsResponse,
  PulseDailyDecisionQualityResponse,
  PulseDailyOutcomeLearningResponse,
  PulseHomeScreenData,
  RpeSorenessArea,
  WorkoutStep,
} from '@coaching-os/shared/pulse';
import {
  pulseActionDecisions,
  pulseActivities,
  pulseDailyMetrics,
  pulseMentalCheckins,
  pulsePlannedWorkouts,
  pulseRiskSignals,
  pulseSleepSessions,
} from '../../db/pulse-schema.js';
import { db } from '../../lib/db.js';
import { llmComplete, SMART_MODEL } from '../../lib/llm.js';
import { buildBriefingSystemPrompt, buildBriefingUserContentRich } from '../../jobs/briefing-generation.job.js';
import { buildCachedPulseContextFor } from '../lib/pulse-context.js';
import { getCached, invalidateUser, setCached } from '../lib/pulse-cache.js';
import { computeReadinessScore } from '../services/load-engine.js';
import { getPrognosis } from '../services/prognosis-engine.js';
import { evaluateAndPersistRiskSignals, getActiveRiskSignals } from '../services/risk-engine.js';
import { buildDailyOutcomeLearning, type DailyOutcomeLearningActionDecision } from '../services/daily-outcome-learning.js';
import { deriveWorkoutExecutionState, scoreActivityWorkoutMatch } from '../services/workout-reconciliation.js';
import {
  addDateDays,
  computeStreaks,
  getFitnessLoadCached,
  getPulseDataStatus,
  listCurrentActionStates,
  loadDailyDecisionQuality,
  toIsoDate,
} from '../services/daily-loop.js';

type PulseDailyMetricsHrvStatus = 'poor' | 'below_normal' | 'normal' | 'above_normal' | null;
type PulseActivityType = 'run' | 'bike' | 'swim' | 'strength' | 'hike' | 'other';
type PulseWorkoutStatus = 'planned' | 'completed' | 'skipped';
type PulsePlannedWorkoutRow = typeof pulsePlannedWorkouts.$inferSelect;
type PulseExecutionActivityRow = Pick<typeof pulseActivities.$inferSelect, 'id' | 'startTime' | 'activityType' | 'durationSec'>;

const actionDecisionPatchSchema = z.object({
  status: z.enum(['completed', 'deferred', 'dismissed']),
  reason: z.string().trim().max(500).optional(),
});

function enrichHomeWorkoutExecutionState(
  workout: PulsePlannedWorkoutRow,
  activities: PulseExecutionActivityRow[],
  now: Date,
): PulsePlannedWorkoutRow {
  const sameDayActivities = activities.filter(activity => toIsoDate(activity.startTime) === workout.plannedDate);
  const completedActivity = workout.completedActivityId
    ? activities.find(activity => activity.id === workout.completedActivityId) ?? null
    : null;
  const bestSameDayActivity = sameDayActivities
    .map(activity => ({ activity, score: scoreActivityWorkoutMatch(workout, activity) }))
    .sort((a, b) => b.score - a.score)[0]?.activity ?? null;
  const activity = completedActivity ?? bestSameDayActivity;
  const state = deriveWorkoutExecutionState({
    id: workout.id,
    plannedDate: workout.plannedDate,
    activityType: workout.activityType,
    status: workout.status,
    garminWorkoutId: workout.garminWorkoutId,
    garminScheduledId: workout.garminScheduledId,
    completedActivityId: workout.completedActivityId,
    durationMin: workout.durationMin,
  }, null, activity ? {
    id: activity.id,
    startTime: activity.startTime,
    activityType: activity.activityType,
    durationSec: activity.durationSec,
  } : null, now);

  return {
    ...workout,
    completedActivityId: state.matchedActivityId ?? workout.completedActivityId,
    executionStatus: state.status,
    executionMatchedAt: state.matchedActivityId ? (workout.executionMatchedAt ?? now) : workout.executionMatchedAt,
    executionMatchConfidence: state.confidence ?? workout.executionMatchConfidence ?? null,
    executionNotes: workout.executionNotes ?? state.notes,
  };
}

function isHomeWorkoutCompleted(workout: PulsePlannedWorkoutRow | null | undefined): boolean {
  return workout?.status === 'completed'
    || workout?.completedActivityId != null
    || workout?.executionStatus === 'completed_matched';
}

function selectHomeTodayWorkout(workouts: PulsePlannedWorkoutRow[]): PulsePlannedWorkoutRow | null {
  return workouts.find(workout => workout.status === 'planned' && !isHomeWorkoutCompleted(workout))
    ?? workouts.find(isHomeWorkoutCompleted)
    ?? workouts.find(workout => workout.status === 'planned')
    ?? null;
}

function serializePlannedWorkout(workout: PulsePlannedWorkoutRow) {
  return {
    id: workout.id, userId: workout.userId,
    plannedDate: workout.plannedDate, activityType: workout.activityType as PulseActivityType,
    zone: workout.zone, durationMin: workout.durationMin,
    distanceKm: workout.distanceKm, targetTss: workout.targetTss,
    description: workout.description,
    steps: (workout.steps ?? null) as WorkoutStep[] | null,
    garminWorkoutId: workout.garminWorkoutId ?? null,
    garminScheduledId: workout.garminScheduledId ?? null,
    status: workout.status as PulseWorkoutStatus,
    workoutFeedback: workout.workoutFeedback ?? null,
    complianceScore: workout.complianceScore ?? null,
    origin: workout.origin ?? 'generated',
    userLocked: workout.userLocked ?? false,
    completedActivityId: workout.completedActivityId ?? null,
    executionStatus: workout.executionStatus ?? (
      workout.garminScheduledId ? 'garmin_scheduled' : workout.garminWorkoutId ? 'garmin_template' : 'local_planned'
    ),
    executionMatchedAt: workout.executionMatchedAt?.toISOString() ?? null,
    executionMatchConfidence: workout.executionMatchConfidence ?? null,
    executionNotes: workout.executionNotes ?? null,
  };
}

export async function registerPulseDailyLoopRoutes(app: FastifyInstance) {
  app.get('/home', { onRequest: [app.authenticate] }, async (req): Promise<PulseHomeScreenData> => {
    const userId = req.user.sub;
    const now = new Date();
    const today = now.toISOString().split('T')[0]!;
    const todayStart = new Date(`${today}T00:00:00.000Z`);
    const tomorrowStart = addDateDays(todayStart, 1);

    const since60d = new Date(Date.now() - 60 * 86_400_000).toISOString().split('T')[0]!;
    const [
      [metrics],
      [mental],
      recentActivities,
      todayWorkouts,
      todayActivities,
      upcomingWorkouts,
      fitnessLoad,
      prognosis,
      streaks,
      dailyHistory,
      sleepHistory,
      dataStatus,
      pulseContext,
    ] = await Promise.all([
      db.select().from(pulseDailyMetrics)
        .where(and(eq(pulseDailyMetrics.userId, userId), eq(pulseDailyMetrics.date, today))),
      db.select().from(pulseMentalCheckins)
        .where(and(eq(pulseMentalCheckins.userId, userId), eq(pulseMentalCheckins.date, today))),
      db.select().from(pulseActivities)
        .where(eq(pulseActivities.userId, userId))
        .orderBy(desc(pulseActivities.startTime))
        .limit(3),
      db.select().from(pulsePlannedWorkouts)
        .where(and(
          eq(pulsePlannedWorkouts.userId, userId),
          eq(pulsePlannedWorkouts.plannedDate, today),
        ))
        .orderBy(desc(pulsePlannedWorkouts.createdAt)),
      db.select({
        id: pulseActivities.id,
        startTime: pulseActivities.startTime,
        activityType: pulseActivities.activityType,
        durationSec: pulseActivities.durationSec,
      }).from(pulseActivities)
        .where(and(
          eq(pulseActivities.userId, userId),
          gte(pulseActivities.startTime, todayStart),
          lt(pulseActivities.startTime, tomorrowStart),
        ))
        .orderBy(desc(pulseActivities.startTime))
        .limit(20),
      db.select().from(pulsePlannedWorkouts)
        .where(and(
          eq(pulsePlannedWorkouts.userId, userId),
          eq(pulsePlannedWorkouts.status, 'planned'),
          gte(pulsePlannedWorkouts.plannedDate, today),
        ))
        .orderBy(pulsePlannedWorkouts.plannedDate)
        .limit(7),
      getFitnessLoadCached(userId, today),
      getPrognosis(userId),
      computeStreaks(userId, today),
      db.select({
        sleepHours: pulseDailyMetrics.sleepHours,
        hrvRmssd:   pulseDailyMetrics.hrvRmssd,
        restingHr:  pulseDailyMetrics.restingHr,
        date: pulseDailyMetrics.date,
        highStressSec: pulseDailyMetrics.highStressSec,
        bodyBatteryAtWake: pulseDailyMetrics.bodyBatteryAtWake,
        bodyBatteryCharged: pulseDailyMetrics.bodyBatteryCharged,
        bodyBatteryDrained: pulseDailyMetrics.bodyBatteryDrained,
      }).from(pulseDailyMetrics)
        .where(and(eq(pulseDailyMetrics.userId, userId), gte(pulseDailyMetrics.date, since60d)))
        .orderBy(desc(pulseDailyMetrics.date)),
      db.select({
        date: pulseSleepSessions.date,
        sleepNeedMin: pulseSleepSessions.sleepNeedMin,
        sleepActualMin: pulseSleepSessions.sleepActualMin,
      }).from(pulseSleepSessions)
        .where(and(eq(pulseSleepSessions.userId, userId), gte(pulseSleepSessions.date, since60d)))
        .orderBy(desc(pulseSleepSessions.date)),
      getPulseDataStatus(userId, today),
      buildCachedPulseContextFor(userId, today),
    ]);

    const { computeRecovery } = await import('../../lib/recovery-metrics.js');
    const sleepByDate = new Map(sleepHistory.map(row => [row.date, row]));
    const recovery = dailyHistory.length >= 1
      ? computeRecovery({
          daily: dailyHistory.map(row => ({
            ...row,
            sleepNeedMin: sleepByDate.get(row.date)?.sleepNeedMin ?? null,
            sleepActualMin: sleepByDate.get(row.date)?.sleepActualMin ?? null,
          })),
        })
      : null;

    const enrichedTodayWorkouts = todayWorkouts.map(workout => enrichHomeWorkoutExecutionState(workout, todayActivities, now));
    const todayWorkout = selectHomeTodayWorkout(enrichedTodayWorkouts);
    const nextWorkout = upcomingWorkouts
      .map(workout => workout.plannedDate === today ? enrichHomeWorkoutExecutionState(workout, todayActivities, now) : workout)
      .find(workout => !isHomeWorkoutCompleted(workout))
      ?? null;

    const mentalScore = mental
      ? ((mental.mood + mental.energy + mental.motivation) / 3) * 10
      : null;

    const readiness = computeReadinessScore({
      sleepHours:     metrics?.sleepHours ?? null,
      hrvStatus:      metrics?.hrvStatus ?? null,
      bodyBatteryMax: metrics?.bodyBatteryMax ?? null,
      stressAvg:      metrics?.stressAvg ?? null,
      mentalScore,
      tsb:            fitnessLoad.tsb,
    });

    return {
      date: today,
      readiness,
      todayMetrics: metrics ? {
        id: metrics.id, userId: metrics.userId, date: metrics.date,
        hrvRmssd: metrics.hrvRmssd, hrvStatus: metrics.hrvStatus as PulseDailyMetricsHrvStatus,
        restingHr: metrics.restingHr, sleepHours: metrics.sleepHours,
        sleepScore: metrics.sleepScore, bodyBatteryMin: metrics.bodyBatteryMin,
        bodyBatteryMax: metrics.bodyBatteryMax,
        bodyBatteryCharged: metrics.bodyBatteryCharged,
        bodyBatteryDrained: metrics.bodyBatteryDrained,
        bodyBatteryHighest: metrics.bodyBatteryHighest,
        bodyBatteryLowest: metrics.bodyBatteryLowest,
        bodyBatteryAtWake: metrics.bodyBatteryAtWake,
        stressAvg: metrics.stressAvg,
        maxStress: metrics.maxStress,
        lowStressSec: metrics.lowStressSec,
        mediumStressSec: metrics.mediumStressSec,
        highStressSec: metrics.highStressSec,
        moderateIntensityMin: metrics.moderateIntensityMin,
        vigorousIntensityMin: metrics.vigorousIntensityMin,
        avgWakingRespiration: metrics.avgWakingRespiration,
        latestSpo2: metrics.latestSpo2,
        steps: metrics.steps, caloriesActive: metrics.caloriesActive,
        source: metrics.source, syncedAt: metrics.syncedAt.toISOString(),
      } : null,
      fitnessLoad,
      todayWorkout: todayWorkout ? serializePlannedWorkout(todayWorkout) : null,
      recentActivities: recentActivities.map((a) => ({
        id: a.id, userId: a.userId, externalId: a.externalId,
        source: a.source, startTime: a.startTime.toISOString(),
        activityType: a.activityType as PulseActivityType, name: a.name,
        durationSec: a.durationSec, distanceM: a.distanceM,
        avgHr: a.avgHr, maxHr: a.maxHr, avgPowerW: a.avgPowerW,
        normalizedPowerW: a.normalizedPowerW, tss: a.tss,
        calories: a.calories, elevationGainM: a.elevationGainM,
        trainingEffectAerobic: a.trainingEffectAerobic,
        trainingEffectAnaerobic: a.trainingEffectAnaerobic,
        vo2maxEstimate: a.vo2maxEstimate,
        rpe: a.rpe,
        rpeNote: a.rpeNote,
        sorenessAreas: a.sorenessAreas as RpeSorenessArea[] | null,
        feedbackLoggedAt: a.feedbackLoggedAt?.toISOString() ?? null,
      })),
      nextWorkout: nextWorkout ? serializePlannedWorkout(nextWorkout) : null,
      prognosis,
      streaks,
      recovery,
      dataStatus,
      nextBestActions: pulseContext.nextBestActions,
    };
  });

  app.get('/actions', { onRequest: [app.authenticate] }, async (req): Promise<PulseActionsResponse> => {
    const today = new Date().toISOString().split('T')[0]!;
    const query = z.object({ includeHistory: z.string().optional() }).safeParse(req.query);
    const includeHistory = query.success && query.data.includeHistory === 'true';
    return listCurrentActionStates(req.user.sub, today, includeHistory);
  });

  app.patch('/actions/:id', { onRequest: [app.authenticate] }, async (req, reply) => {
    const parsedParams = z.object({ id: z.string().uuid() }).safeParse(req.params);
    const parsedBody = actionDecisionPatchSchema.safeParse(req.body);
    if (!parsedParams.success || !parsedBody.success) return reply.status(400).send({ error: 'Ungültige Eingabe' });

    const [updated] = await db.update(pulseActionDecisions)
      .set({
        status: parsedBody.data.status,
        resolvedAt: new Date(),
        resolutionReason: parsedBody.data.reason ?? null,
      })
      .where(and(eq(pulseActionDecisions.id, parsedParams.data.id), eq(pulseActionDecisions.userId, req.user.sub)))
      .returning();

    if (!updated) return reply.status(404).send({ error: 'Aktion nicht gefunden' });
    await invalidateUser(req.user.sub);

    return {
      decision: {
        id: updated.id,
        status: updated.status,
        resolvedAt: updated.resolvedAt?.toISOString() ?? null,
        resolutionReason: updated.resolutionReason ?? null,
      },
    };
  });

  app.get('/outcomes/daily', { onRequest: [app.authenticate] }, async (req, reply): Promise<PulseDailyOutcomeLearningResponse | unknown> => {
    const parsed = z.object({
      days: z.coerce.number().int().min(1).max(30).optional().default(14),
    }).safeParse(req.query);
    if (!parsed.success) return reply.status(400).send({ error: 'Ungültige Eingabe' });

    const userId = req.user.sub;
    const today = toIsoDate(new Date());
    const sinceDate = addDateDays(new Date(`${today}T00:00:00.000Z`), -parsed.data.days);
    const since = toIsoDate(sinceDate);

    const [actionRows, checkins, plannedWorkouts, activities, dailyMetrics] = await Promise.all([
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
        source: pulseActivities.source,
        startTime: pulseActivities.startTime,
        activityType: pulseActivities.activityType,
        durationSec: pulseActivities.durationSec,
      }).from(pulseActivities)
        .where(and(eq(pulseActivities.userId, userId), gte(pulseActivities.startTime, sinceDate)))
        .orderBy(desc(pulseActivities.startTime)),
      db.select({
        date: pulseDailyMetrics.date,
        sleepHours: pulseDailyMetrics.sleepHours,
        hrvStatus: pulseDailyMetrics.hrvStatus,
        bodyBatteryMax: pulseDailyMetrics.bodyBatteryMax,
        stressAvg: pulseDailyMetrics.stressAvg,
      }).from(pulseDailyMetrics)
        .where(and(eq(pulseDailyMetrics.userId, userId), gte(pulseDailyMetrics.date, since))),
    ]);

    return {
      items: buildDailyOutcomeLearning({
        today,
        days: parsed.data.days,
        actionDecisions: actionRows.map((row): DailyOutcomeLearningActionDecision => ({
          ...row,
          status: row.status as DailyOutcomeLearningActionDecision['status'],
          createdAt: row.createdAt.toISOString(),
          resolvedAt: row.resolvedAt?.toISOString() ?? null,
        })),
        checkins,
        plannedWorkouts: plannedWorkouts.map(row => ({
          ...row,
          executionStatus: row.executionStatus ?? null,
        })),
        activities: activities.map(row => ({
          ...row,
          startTime: row.startTime.toISOString(),
        })),
        dailyMetrics: dailyMetrics.map(row => ({
          ...row,
          hrvStatus: row.hrvStatus ?? null,
        })),
      }),
    };
  });

  app.get('/decisions/quality', { onRequest: [app.authenticate] }, async (req, reply): Promise<PulseDailyDecisionQualityResponse | unknown> => {
    const parsed = z.object({
      days: z.coerce.number().int().min(1).max(30).optional().default(14),
    }).safeParse(req.query);
    if (!parsed.success) return reply.status(400).send({ error: 'Ungültige Eingabe' });

    return loadDailyDecisionQuality(req.user.sub, parsed.data.days);
  });

  app.get('/risk', { onRequest: [app.authenticate] }, async (req) => {
    const userId = req.user.sub;
    await evaluateAndPersistRiskSignals(userId);
    const rows = await getActiveRiskSignals(userId);
    return {
      signals: rows.map(r => ({
        id: r.id,
        ruleId: r.ruleId,
        severity: r.severity,
        status: r.status,
        title: r.title,
        description: r.description,
        recommendation: r.recommendation,
        metric: r.metricSnapshot as Record<string, unknown>,
        triggeredAt: r.triggeredAt.toISOString(),
        resolvedAt: r.resolvedAt?.toISOString() ?? null,
        snoozedUntil: r.snoozedUntil?.toISOString() ?? null,
      })),
    };
  });

  app.post('/risk/:id/snooze', { onRequest: [app.authenticate] }, async (req, reply) => {
    const userId = req.user.sub;
    const { id } = req.params as { id: string };
    const parsed = z.object({ hours: z.number().int().min(1).max(168).optional().default(24) }).safeParse(req.body ?? {});
    if (!parsed.success) return reply.status(400).send({ error: 'Ungültige Snooze-Dauer' });

    const snoozedUntil = new Date(Date.now() + parsed.data.hours * 3600_000);
    const [row] = await db.update(pulseRiskSignals)
      .set({ status: 'snoozed', snoozedUntil, updatedAt: new Date() })
      .where(and(eq(pulseRiskSignals.id, id), eq(pulseRiskSignals.userId, userId)))
      .returning();
    if (!row) return reply.status(404).send({ error: 'Risk-Signal nicht gefunden' });
    await invalidateUser(userId);
    return { ok: true, snoozedUntil: snoozedUntil.toISOString() };
  });

  app.post('/risk/:id/resolve', { onRequest: [app.authenticate] }, async (req, reply) => {
    const userId = req.user.sub;
    const { id } = req.params as { id: string };
    const now = new Date();
    const [row] = await db.update(pulseRiskSignals)
      .set({ status: 'resolved', resolvedAt: now, updatedAt: now })
      .where(and(eq(pulseRiskSignals.id, id), eq(pulseRiskSignals.userId, userId)))
      .returning();
    if (!row) return reply.status(404).send({ error: 'Risk-Signal nicht gefunden' });
    await invalidateUser(userId);
    return { ok: true };
  });

  app.get('/briefing', { onRequest: [app.authenticate] }, async (req) => {
    const userId = req.user.sub;
    const today = new Date().toISOString().split('T')[0]!;

    const cached = await getCached<string>('briefing-v2', userId, today);
    if (cached) return { briefing: cached, date: today, cached: true };

    const ctx = await buildCachedPulseContextFor(userId, today);
    const todayRace = ctx.nextRace?.daysUntil === 0 && ctx.nextRace.priority !== 'C'
      ? ctx.nextRace
      : null;

    if (todayRace) {
      const fmtTime = (sec: number | null): string => {
        if (sec == null) return '–';
        const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
        return h > 0 ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}` : `${m}:${String(s).padStart(2,'0')}`;
      };
      const lthr = ctx.profile?.lthrBpm ?? (ctx.profile?.maxHrBpm ? Math.round(ctx.profile.maxHrBpm * 0.92) : null);
      const hrCap = lthr ? Math.round(lthr * (todayRace.distanceKm && todayRace.distanceKm > 30 ? 0.92 : 0.96)) : null;
      const briefingPrompt = `Du bist Coach für Tobi am RACE-DAY. Schreibe ein präzises Race-Briefing.
RACE: ${todayRace.title}${todayRace.distanceKm ? ` ${todayRace.distanceKm}km` : ''}, ${todayRace.discipline ?? 'unspezifiziert'}, Priority ${todayRace.priority}
Standort: ${todayRace.location ?? '–'}
${todayRace.notes ? `Notizen: ${todayRace.notes}` : ''}

FORM: CTL ${ctx.fitnessLoad.ctl.toFixed(0)} | TSB ${ctx.fitnessLoad.tsb.toFixed(0)} (${ctx.fitnessLoad.tsb >= 0 ? 'frisch' : 'leicht müde'})
READINESS: ${ctx.readiness.score}/100 (${ctx.readiness.label})
PROGNOSE: ${todayRace.predictedTimeSec ? fmtTime(todayRace.predictedTimeSec) : 'keine'} (${todayRace.predictionConfidence ?? '–'} confidence)
ZIEL:     ${todayRace.targetTimeSec ? fmtTime(todayRace.targetTimeSec) : 'keine'}
HR-Cap:   ${hrCap ? `${hrCap} bpm` : 'siehe Profil'}

Format (5 Abschnitte, je 1-2 Zeilen, deutsche Sprache, kein Markdown, kein Fett):
🏁 Pacing: konkrete HR-Range pro Disziplin/Phase
⚡ Strategie: erste 30%/Mitte/letzte 20% Anweisung
🍯 Fueling: g Carbs/h, ml/h, Salz wenn Hitze
✅ Logistik: 5 Items (Helm/Nummer/Gels/Salz/Auto-Schlüssel oder ähnlich)
💬 Mindset: 1 Satz Mantra für harte Momente

Direkt, knapp, kein Smalltalk.`;
      const briefing = await llmComplete(
        'Du bist erfahrener Race-Coach. Antworte mit dem geforderten Format.',
        briefingPrompt,
        SMART_MODEL,
      );
      await setCached('briefing-v2', userId, today, briefing);
      return { briefing, date: today, cached: false, raceDay: true };
    }

    let userContent = buildBriefingUserContentRich(ctx, ctx.todayCheckin ? 'check-in' : 'garmin-alarm');
    const plannedToday = ctx.upcomingWorkouts.find(w => w.plannedDate === today) ?? null;
    const isOutdoorSport = plannedToday &&
      (plannedToday.activityType === 'bike' || plannedToday.activityType === 'run' || plannedToday.activityType === 'hike');
    if (isOutdoorSport && ctx.profile?.homeLat != null && ctx.profile?.homeLon != null) {
      try {
        const { getCurrentWeather } = await import('../../lib/weather.js');
        const w = await getCurrentWeather({ latitude: ctx.profile.homeLat, longitude: ctx.profile.homeLon });
        if (w) {
          const weatherLine = `Wetter heute: ${w.tempC.toFixed(0)}°C (gefühlt ${w.feelsC.toFixed(0)}°C), ${w.conditions}, Wind ${w.windKmh.toFixed(0)} km/h, Niederschlag ${w.precipMm.toFixed(1)} mm`;
          const weatherHints = [weatherLine];
          if (w.feelsC > 28) weatherHints.push('Hinweis: Hitze erhöht HR-Drift bei gleicher Pace; HR-Cap ggf. +5 bpm akzeptieren oder Pace reduzieren.');
          if (w.feelsC < 0)  weatherHints.push('Hinweis: Frost: verlängerte Aufwärmphase 15+ min, Atemwegsschutz erwägen.');
          if (w.windKmh > 25) weatherHints.push('Hinweis: starker Wind: Outdoor-Z2 evtl. nach HR statt nach Pace steuern, Powerausgabe asymmetrisch.');
          userContent += `\n${weatherHints.join('\n')}`;
        }
      } catch (err) {
        app.log.warn(`[briefing] weather fetch failed: ${err}`);
      }
    }

    const briefing = await llmComplete(
      buildBriefingSystemPrompt(),
      userContent,
      SMART_MODEL,
    );

    await setCached('briefing-v2', userId, today, briefing);

    return { briefing, date: today, cached: false };
  });
}
