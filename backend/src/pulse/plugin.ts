import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../lib/db.js';
import {
  pulseDailyMetrics,
  pulseMentalCheckins,
  pulseActivities,
  pulsePlannedWorkouts,
  pulseCoachSessions,
  pulseSleepSessions,
  pulseGoals,
  pulseUserProfile,
  pulseWeeklyReviews,
  pulseWeightLog,
  pulseWeekAvailability,
  pulseHealthState,
  pulseNutritionLogs,
  pulseRiskSignals,
  type WorkoutStep,
} from '../db/pulse-schema.js';
import { eq, desc, and, gte, lte, isNull, or, sql, inArray } from 'drizzle-orm';
import { env } from '../lib/env.js';
import { llmComplete, SMART_MODEL } from '../lib/llm.js';
import { RPE_SORENESS_AREAS } from '@coaching-os/shared/pulse';
import type { PulseFitnessLoad, PulseHomeScreenData, PulseCoachMessage, PulseReadiness, RpeSorenessArea } from '@coaching-os/shared/pulse';
import { hrTargetRangeForZone } from '@coaching-os/shared/pulse-thresholds';
import { computeFitnessLoad, computeReadinessScore } from './services/load-engine.js';
import { getPrognosis } from './services/prognosis-engine.js';
import {
  buildRichSystemPrompt, getCoachReplyRich,
  classifyAndExtractCheckin, type CheckinClassification,
} from './services/coach-engine.js';
import { buildCachedPulseContextFor, mapPulseContextToCoachContext } from './lib/pulse-context.js';
import { getCached, invalidateUser, setCached } from './lib/pulse-cache.js';
import { evaluateAndPersistRiskSignals, getActiveRiskSignals } from './services/risk-engine.js';
import { transcribeAudio } from '../lib/whisper.js';
import { decidePlanDays, generateWeekWorkouts, generateScientificWeekPlan, getMesocycleWeek } from './services/plan-engine.js';
import { proposeTodayAdjustment, deriveCurrentPhase } from './services/adapt-engine.js';
import { getActiveRaces } from './services/race-engine.js';
import { generateWeeklyReview } from './services/review-engine.js';
import { generateDeepInsight, type InsightDomain } from './services/insight-engine.js';
import { syncGarminDay } from '../routes/garmin.js';
import { users } from '../db/schema.js';
import type { PulseDataStatus } from '@coaching-os/shared/pulse';
import { buildBriefingSystemPrompt, buildBriefingUserContentRich } from '../jobs/briefing-generation.job.js';

const coachMessageSchema = z.object({
  message: z.string().min(1).max(2000),
});

const garminSyncSchema = z.object({
  days: z.number().int().min(1).max(30).optional().default(7),
});

const activityFeedbackSchema = z.object({
  rpe: z.number().int().min(1).max(10),
  rpeNote: z.string().trim().max(500).nullable().optional(),
  sorenessAreas: z.array(z.enum(RPE_SORENESS_AREAS)).max(8).nullable().optional(),
});

async function getFitnessLoadCached(userId: string, date: string): Promise<PulseFitnessLoad> {
  const cached = await getCached<PulseFitnessLoad>('fitness-load', userId, date);
  if (cached) return cached;

  const load = await computeFitnessLoad(userId, date);
  await setCached('fitness-load', userId, date, load);
  return load;
}

function normalizeCoachMessages(messages: unknown): PulseCoachMessage[] {
  if (!Array.isArray(messages)) return [];
  return messages.filter((m): m is PulseCoachMessage => (
    typeof m === 'object' &&
    m !== null &&
    ((m as PulseCoachMessage).role === 'user' || (m as PulseCoachMessage).role === 'assistant') &&
    typeof (m as PulseCoachMessage).content === 'string' &&
    typeof (m as PulseCoachMessage).timestamp === 'string'
  ));
}

async function getPlannedZoneByActivityId(userId: string, activityIds: string[]): Promise<Map<string, number>> {
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

function normalizeRacePriority(value: string | null): 'A' | 'B' | 'C' | null {
  return value === 'A' || value === 'B' || value === 'C' ? value : null;
}

// ─── Streak helpers ───────────────────────────────────────────────────────────

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

async function computeStreaks(userId: string, today: string): Promise<{ checkinStreakDays: number; workoutStreakDays: number }> {
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

async function getPulseDataStatus(userId: string, today: string): Promise<PulseDataStatus> {
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

// ─── Workout step generation ──────────────────────────────────────────────────

function supportsHrStepTargets(activityType: string): boolean {
  return activityType === 'run' || activityType === 'bike' || activityType === 'hike';
}

function addHrTargetToStep(step: WorkoutStep, profile: { maxHrBpm: number | null; lthrBpm: number | null } | undefined): WorkoutStep {
  const maxHr = profile?.maxHrBpm ?? 185;
  const target = hrTargetRangeForZone(step.zone, maxHr, profile?.lthrBpm ?? null);
  const description = step.description?.includes('bpm')
    ? step.description
    : `${step.description ? `${step.description} ` : ''}HR ${target.label}.`.trim();
  const next: WorkoutStep = {
    ...step,
    description,
    targetLabel: target.label,
  };
  if (target.minBpm != null) next.targetHrMinBpm = target.minBpm;
  if (target.maxBpm != null) next.targetHrMaxBpm = target.maxBpm;
  return next;
}

function hrZoneReference(maxHrBpm: number, lthrBpm: number | null | undefined): string {
  return [1, 2, 3, 4, 5]
    .map(zone => {
      const target = hrTargetRangeForZone(zone, maxHrBpm, lthrBpm ?? null);
      return `Z${zone} ${target.label}`;
    })
    .join(', ');
}

async function buildWorkoutSteps(
  workout: { id: string; activityType: string; zone: number; durationMin: number; description: string | null },
  profile: { ftpWatts: number | null; maxHrBpm: number | null; lthrBpm: number | null } | undefined,
): Promise<{ steps: WorkoutStep[]; updatedDescription: string | null }> {
  const ftp = profile?.ftpWatts ?? 250;
  const maxHr = profile?.maxHrBpm ?? 185;

  const isRun = workout.activityType === 'run';
  const isBike = workout.activityType === 'bike';
  const intensityRef = supportsHrStepTargets(workout.activityType)
    ? `HR-first: ${hrZoneReference(maxHr, profile?.lthrBpm)}. FTP=${ftp}W nur als Sekundaerkontrolle.`
    : isBike
    ? `FTP=${ftp}W als Sekundaerinfo; wenn Pulsdaten fehlen: Z2 ${Math.round(ftp*0.56)}-${Math.round(ftp*0.75)}W, Z4 ${Math.round(ftp*0.90)}-${Math.round(ftp*1.05)}W.`
    : isRun
    ? `Max-HF=${maxHr}bpm, HR-first: ${hrZoneReference(maxHr, profile?.lthrBpm)}.`
    : `Technik/Bewegungsqualitaet; keine harte Zielzone erzwingen.`;

  const prompt = `Erstelle eine detaillierte Trainingsanleitung für dieses Workout:

Typ: ${workout.activityType} | Zone: ${workout.zone} | Dauer: ${workout.durationMin} min
Kurzbeschreibung: ${workout.description ?? '–'}
Athleten-Referenz: ${intensityRef}

Antworte NUR mit einem JSON-Objekt:
{
  "steps": [
    {"type":"warmup","durationMin":10,"zone":1,"description":"Beschreibung"},
    {"type":"interval","reps":4,"durationMin":8,"zone":4,"restMin":2,"description":"Ziel: X"},
    {"type":"cooldown","durationMin":10,"zone":1,"description":"Ausschwingen"}
  ],
  "coachingNote": "1-2 Sätze Coaching-Hinweis auf Deutsch"
}

Typen: warmup, interval, steady, cooldown. Zonen 1-5.
Gesamtdauer der steps muss ~${workout.durationMin} Minuten ergeben (inkl. Pausen).
Bei reinen Z2-Workouts: nur warmup + steady + cooldown, kein interval.
Bei Run/Bike/Hike: Beschreibungen muessen die HR-Zielrange nennen; Watt/Pace nur als Sekundaerkontrolle.`;

  const raw = await llmComplete(
    'Du bist Sportwissenschaftler und Ausdauercoach. Antworte nur mit validem JSON.',
    prompt,
    SMART_MODEL,
  );

  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('LLM returned no valid JSON for workout steps');

  const parsed = JSON.parse(jsonMatch[0]) as { steps: WorkoutStep[]; coachingNote?: string };
  const steps: WorkoutStep[] = (parsed.steps ?? []).map(s => {
    const step: WorkoutStep = {
      type: (['warmup','interval','rest','cooldown','steady'].includes(s.type) ? s.type : 'steady') as WorkoutStep['type'],
      durationMin: Math.max(1, s.durationMin ?? 10),
      zone: Math.max(1, Math.min(5, s.zone ?? workout.zone)),
    };
    if (s.reps != null) step.reps = s.reps;
    if (s.restMin != null) step.restMin = s.restMin;
    if (s.description) step.description = s.description;
    return supportsHrStepTargets(workout.activityType) ? addHrTargetToStep(step, profile) : step;
  });

  const coachingNote = parsed.coachingNote ?? null;
  const updatedDescription = coachingNote
    ? `${workout.description ?? ''}\n\n${coachingNote}`.trim()
    : workout.description;

  return { steps, updatedDescription };
}

// ─── Plugin ───────────────────────────────────────────────────────────────────

export default async function pulsePlugin(app: FastifyInstance) {
  // Allow DELETE/GET requests that send Content-Type: application/json but no body
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body, done) => {
    if (!body || (body as string).length === 0) { done(null, undefined); return; }
    try { done(null, JSON.parse(body as string)); } catch (e) { done(e as Error, undefined); }
  });

  // Public health check
  app.get('/health', async () => ({ status: 'ok', namespace: 'pulse' }));

  // All routes below require JWT
  app.get('/readiness', { onRequest: [app.authenticate] }, async (req): Promise<PulseReadiness & { date: string; cached: boolean }> => {
    const userId = req.user.sub;
    const today = new Date().toISOString().split('T')[0]!;
    const cached = await getCached<PulseReadiness>('readiness', userId, today);
    if (cached) return { ...cached, date: today, cached: true };

    const ctx = await buildCachedPulseContextFor(userId, today);
    await setCached('readiness', userId, today, ctx.readiness);
    return { ...ctx.readiness, date: today, cached: false };
  });

  app.get('/load', { onRequest: [app.authenticate] }, async (req): Promise<PulseFitnessLoad & { cached: boolean }> => {
    const userId = req.user.sub;
    const today = new Date().toISOString().split('T')[0]!;
    const cached = await getCached<PulseFitnessLoad>('fitness-load', userId, today);
    if (cached) return { ...cached, cached: true };

    const load = await computeFitnessLoad(userId, today);
    await setCached('fitness-load', userId, today, load);
    return { ...load, cached: false };
  });

  app.get('/home', { onRequest: [app.authenticate] }, async (req): Promise<PulseHomeScreenData> => {
    const userId = req.user.sub;
    const today = new Date().toISOString().split('T')[0]!;

    const since60d = new Date(Date.now() - 60 * 86_400_000).toISOString().split('T')[0]!;
    const [
      [metrics],
      [mental],
      recentActivities,
      [nextWorkout],
      fitnessLoad,
      prognosis,
      streaks,
      dailyHistory,
      dataStatus,
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
          eq(pulsePlannedWorkouts.status, 'planned'),
          gte(pulsePlannedWorkouts.plannedDate, today),
        ))
        .orderBy(pulsePlannedWorkouts.plannedDate)
        .limit(1),
      getFitnessLoadCached(userId, today),
      getPrognosis(userId),
      computeStreaks(userId, today),
      db.select({
        sleepHours: pulseDailyMetrics.sleepHours,
        hrvRmssd:   pulseDailyMetrics.hrvRmssd,
        restingHr:  pulseDailyMetrics.restingHr,
      }).from(pulseDailyMetrics)
        .where(and(eq(pulseDailyMetrics.userId, userId), gte(pulseDailyMetrics.date, since60d)))
        .orderBy(desc(pulseDailyMetrics.date)),
      getPulseDataStatus(userId, today),
    ]);

    const { computeRecovery } = await import('../lib/recovery-metrics.js');
    const recovery = dailyHistory.length >= 1
      ? computeRecovery({ daily: dailyHistory })
      : null;

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
        bodyBatteryMax: metrics.bodyBatteryMax, stressAvg: metrics.stressAvg,
        steps: metrics.steps, caloriesActive: metrics.caloriesActive,
        source: metrics.source, syncedAt: metrics.syncedAt.toISOString(),
      } : null,
      fitnessLoad,
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
      nextWorkout: nextWorkout ? {
        id: nextWorkout.id, userId: nextWorkout.userId,
        plannedDate: nextWorkout.plannedDate, activityType: nextWorkout.activityType as PulseActivityType,
        zone: nextWorkout.zone, durationMin: nextWorkout.durationMin,
        distanceKm: nextWorkout.distanceKm, targetTss: nextWorkout.targetTss,
        description: nextWorkout.description,
        steps: (nextWorkout.steps ?? null) as import('@coaching-os/shared/pulse').WorkoutStep[] | null,
        garminWorkoutId: nextWorkout.garminWorkoutId ?? null,
        status: nextWorkout.status as PulseWorkoutStatus,
        workoutFeedback: nextWorkout.workoutFeedback ?? null,
        complianceScore: nextWorkout.complianceScore ?? null,
        completedActivityId: nextWorkout.completedActivityId ?? null,
      } : null,
      prognosis,
      streaks,
      recovery,
      dataStatus,
    };
  });

  app.get('/sync/status', { onRequest: [app.authenticate] }, async (req) => {
    const today = new Date().toISOString().split('T')[0]!;
    return getPulseDataStatus(req.user.sub, today);
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

  app.post('/coach', { onRequest: [app.authenticate] }, async (req, reply) => {
    const parsed = coachMessageSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Ungültige Nachricht' });

    const userId = req.user.sub;
    const today  = new Date().toISOString().split('T')[0]!;

    const [[existingSession], pulseContext] = await Promise.all([
      db.select({ id: pulseCoachSessions.id, messages: pulseCoachSessions.messages })
        .from(pulseCoachSessions)
        .where(eq(pulseCoachSessions.userId, userId))
        .orderBy(desc(pulseCoachSessions.lastMessageAt))
        .limit(1),
      buildCachedPulseContextFor(userId, today),
    ]);

    const coachCtx = mapPulseContextToCoachContext(pulseContext);
    const systemPrompt = buildRichSystemPrompt(coachCtx);
    const history = normalizeCoachMessages(existingSession?.messages);

    const replyText = await getCoachReplyRich(parsed.data.message, systemPrompt, history);

    const userMsg: PulseCoachMessage = { role: 'user',      content: parsed.data.message, timestamp: new Date().toISOString() };
    const botMsg:  PulseCoachMessage = { role: 'assistant', content: replyText,            timestamp: new Date().toISOString() };

    if (existingSession) {
      const updated = [...history.slice(-20), userMsg, botMsg];
      await db.update(pulseCoachSessions)
        .set({ messages: updated, lastMessageAt: new Date() })
        .where(eq(pulseCoachSessions.id, existingSession.id));
    } else {
      await db.insert(pulseCoachSessions).values({ userId, messages: [userMsg, botMsg] });
    }

    return { reply: replyText };
  });

  app.get('/coach/history', { onRequest: [app.authenticate] }, async (req) => {
    const [session] = await db.select({ messages: pulseCoachSessions.messages })
      .from(pulseCoachSessions)
      .where(eq(pulseCoachSessions.userId, req.user.sub))
      .orderBy(desc(pulseCoachSessions.lastMessageAt))
      .limit(1);

    return { messages: normalizeCoachMessages(session?.messages) };
  });

  app.delete('/coach/history', { onRequest: [app.authenticate] }, async (req, reply) => {
    await db.delete(pulseCoachSessions).where(eq(pulseCoachSessions.userId, req.user.sub));
    return reply.status(204).send();
  });

  app.post('/checkin', { onRequest: [app.authenticate] }, async (req, reply) => {
    const schema = z.object({
      mood:       z.number().int().min(1).max(10),
      energy:     z.number().int().min(1).max(10),
      stress:     z.number().int().min(1).max(10),
      motivation: z.number().int().min(1).max(10),
      notes:      z.string().max(500).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Ungültige Eingabe' });

    const today = new Date().toISOString().split('T')[0]!;
    const userId = req.user.sub;

    const [existing] = await db.select({ id: pulseMentalCheckins.id })
      .from(pulseMentalCheckins)
      .where(and(eq(pulseMentalCheckins.userId, userId), eq(pulseMentalCheckins.date, today)));
    if (existing) return reply.status(409).send({ error: 'Heute bereits eingecheckt' });

    const [checkin] = await db.insert(pulseMentalCheckins).values({
      userId, date: today, ...parsed.data, notes: parsed.data.notes ?? null,
    }).returning();

    await invalidateUser(userId);
    return reply.status(201).send(checkin);
  });

  // POST /api/pulse/checkin/voice
  app.post('/checkin/voice', { onRequest: [app.authenticate] }, async (req, reply) => {
    const schema = z.object({
      audio:    z.string().min(1),   // base64
      mimeType: z.string().default('audio/webm'),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Ungültige Anfrage' });

    const userId = req.user.sub;
    const today  = new Date().toISOString().split('T')[0]!;

    // 1. Transkription
    let transcript: string;
    try {
      transcript = await transcribeAudio(parsed.data.audio, parsed.data.mimeType);
    } catch (err) {
      app.log.error(`[voice-checkin] Whisper error: ${err}`);
      return reply.status(502).send({ error: 'Transkription fehlgeschlagen, bitte als Text eingeben.' });
    }

    // 2. Check-in-Erkennung + Extraktion
    let classification: CheckinClassification;
    try {
      classification = await classifyAndExtractCheckin(transcript);
    } catch (err) {
      app.log.error(`[voice-checkin] LLM classification error: ${err}`);
      return reply.status(502).send({ error: 'Coach-Analyse fehlgeschlagen, bitte erneut versuchen.' });
    }

    // 3. Falls Check-in: in DB speichern
    let checkinId: string | null = null;
    if (classification.isCheckin && classification.extraction) {
      const ex = classification.extraction;
      const [existing] = await db.select({ id: pulseMentalCheckins.id, notes: pulseMentalCheckins.notes })
        .from(pulseMentalCheckins)
        .where(and(eq(pulseMentalCheckins.userId, userId), eq(pulseMentalCheckins.date, today)));

      if (existing) {
        const updatedNotes = [existing.notes, transcript].filter(Boolean).join('\n---\n');
        await db.update(pulseMentalCheckins)
          .set({
            mood:           ex.mood,
            energy:         ex.energy,
            stress:         ex.stress,
            motivation:     ex.motivation,
            themes:         ex.themes,
            notes:          updatedNotes,
            source:         'voice',
            coachQuestions: ex.followUpQuestions.map(q => ({ question: q, answer: null })),
          })
          .where(eq(pulseMentalCheckins.id, existing.id));
        checkinId = existing.id;
      } else {
        const [inserted] = await db.insert(pulseMentalCheckins).values({
          userId,
          date:           today,
          mood:           ex.mood,
          energy:         ex.energy,
          stress:         ex.stress,
          motivation:     ex.motivation,
          themes:         ex.themes,
          notes:          transcript,
          source:         'voice',
          coachQuestions: ex.followUpQuestions.map(q => ({ question: q, answer: null })),
        }).returning({ id: pulseMentalCheckins.id });
        checkinId = inserted?.id ?? null;
      }
      await invalidateUser(userId);
    }

    const [session] = await db.select({ id: pulseCoachSessions.id, messages: pulseCoachSessions.messages })
      .from(pulseCoachSessions)
      .where(eq(pulseCoachSessions.userId, userId))
      .orderBy(desc(pulseCoachSessions.lastMessageAt))
      .limit(1);

    // 4. Nach optionaler Check-in-Persistenz mit frischem PulseContext antworten.
    const history = normalizeCoachMessages(session?.messages);
    const pulseContext = await buildCachedPulseContextFor(userId, today);
    const systemPrompt = buildRichSystemPrompt(mapPulseContextToCoachContext(pulseContext));
    const replyText = await getCoachReplyRich(transcript, systemPrompt, history);

    const userMsg: PulseCoachMessage = { role: 'user',      content: transcript, timestamp: new Date().toISOString() };
    const botMsg:  PulseCoachMessage = { role: 'assistant', content: replyText,  timestamp: new Date().toISOString() };

    if (session) {
      await db.update(pulseCoachSessions)
        .set({ messages: [...history.slice(-20), userMsg, botMsg], lastMessageAt: new Date() })
        .where(eq(pulseCoachSessions.id, session.id));
    } else {
      await db.insert(pulseCoachSessions).values({ userId, messages: [userMsg, botMsg] });
    }

    return {
      transcript,
      reply:             replyText,
      isCheckin:         classification.isCheckin,
      followUpQuestions: classification.extraction?.followUpQuestions ?? [],
      checkinId,
      extraction:        classification.extraction
        ? {
            mood:       classification.extraction.mood,
            energy:     classification.extraction.energy,
            stress:     classification.extraction.stress,
            motivation: classification.extraction.motivation,
            themes:     classification.extraction.themes,
          }
        : null,
    };
  });

  // GET /api/pulse/checkin/today
  app.get('/checkin/today', { onRequest: [app.authenticate] }, async (req) => {
    const userId = req.user.sub;
    const today  = new Date().toISOString().split('T')[0]!;
    const [checkin] = await db.select({ id: pulseMentalCheckins.id, date: pulseMentalCheckins.date })
      .from(pulseMentalCheckins)
      .where(and(eq(pulseMentalCheckins.userId, userId), eq(pulseMentalCheckins.date, today)));
    return { checkin: checkin ?? null };
  });

  // GET /api/pulse/checkin/history?days=30
  app.get('/checkin/history', { onRequest: [app.authenticate] }, async (req) => {
    const userId = req.user.sub;
    const q = req.query as { days?: string };
    const days = Math.min(180, Math.max(7, parseInt(q.days ?? '30', 10)));
    const since = new Date(Date.now() - days * 86_400_000).toISOString().split('T')[0]!;
    const checkins = await db.select({
      id: pulseMentalCheckins.id,
      date: pulseMentalCheckins.date,
      mood: pulseMentalCheckins.mood,
      energy: pulseMentalCheckins.energy,
      stress: pulseMentalCheckins.stress,
      motivation: pulseMentalCheckins.motivation,
    })
      .from(pulseMentalCheckins)
      .where(and(eq(pulseMentalCheckins.userId, userId), gte(pulseMentalCheckins.date, since)))
      .orderBy(pulseMentalCheckins.date);
    return { checkins };
  });

  // ─── Sleep sessions ───────────────────────────────────────────────────────────
  app.get('/sleep', { onRequest: [app.authenticate] }, async (req) => {
    const userId = req.user.sub;
    const limit = Math.min(Number((req.query as { limit?: string }).limit ?? 7), 90);
    const sessions = await db.select()
      .from(pulseSleepSessions)
      .where(eq(pulseSleepSessions.userId, userId))
      .orderBy(desc(pulseSleepSessions.date))
      .limit(limit);
    return {
      sessions: sessions.map((s) => ({
        ...s,
        startTime: s.startTime?.toISOString() ?? null,
        endTime:   s.endTime?.toISOString()   ?? null,
      })),
    };
  });

  // ─── Activities ───────────────────────────────────────────────────────────────
  app.get('/activities', { onRequest: [app.authenticate] }, async (req) => {
    const userId = req.user.sub;
    const limit = Math.min(Number((req.query as { limit?: string }).limit ?? 10), 50);
    const activities = await db.select()
      .from(pulseActivities)
      .where(eq(pulseActivities.userId, userId))
      .orderBy(desc(pulseActivities.startTime))
      .limit(limit);
    return {
      activities: activities.map((a) => ({
        ...a,
        startTime: a.startTime.toISOString(),
      })),
    };
  });

  // ─── Activity detail (laps + HR zones from Garmin) ───────────────────────────
  app.get('/activities/:id', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const userId = req.user.sub;

    const [activity] = await db.select()
      .from(pulseActivities)
      .where(and(eq(pulseActivities.id, id), eq(pulseActivities.userId, userId)));

    if (!activity) return reply.status(404).send({ error: 'Not found' });

    // Use cached rawData if present, else fetch from Garmin
    let laps: any[] = [];
    let hrZones: { zone: number; secsInZone: number; zoneLowBoundary: number }[] = [];

    if (activity.rawData && (activity.rawData as any).laps) {
      const rd = activity.rawData as { laps?: any[]; hrZones?: any[] };
      laps    = rd.laps    ?? [];
      hrZones = rd.hrZones ?? [];
    } else if (activity.externalId) {
      try {
        const { getGarminClient } = await import('../lib/garmin-client.js');
        const gc = await getGarminClient();
        const extId = activity.externalId;

        const [splitsRes, zonesRes] = await Promise.allSettled([
          (gc as any).get(`https://connectapi.garmin.com/activity-service/activity/${extId}/splits`),
          (gc as any).get(`https://connectapi.garmin.com/activity-service/activity/${extId}/hrTimeInZones`),
        ]);

        if (splitsRes.status === 'fulfilled') {
          const raw = (splitsRes.value as any).lapDTOs ?? [];
          laps = raw.map((l: any, i: number) => ({
            index:    i + 1,
            distanceM: l.distance ?? null,
            durationSec: l.duration ?? null,
            avgHr:    l.averageHR ?? null,
            maxHr:    l.maxHR ?? null,
            avgPowerW: l.averagePower ?? null,
            avgSpeedMs: l.averageSpeed ?? null,
            elevationGainM: l.elevationGain ?? null,
          }));
        }

        if (zonesRes.status === 'fulfilled') {
          const raw = zonesRes.value as any[];
          hrZones = (Array.isArray(raw) ? raw : Object.values(raw)).map((z: any) => ({
            zone: z.zoneNumber,
            secsInZone: z.secsInZone,
            zoneLowBoundary: z.zoneLowBoundary,
          }));
        }

        // Cache in rawData
        await db.update(pulseActivities)
          .set({ rawData: { laps, hrZones } })
          .where(eq(pulseActivities.id, id));

      } catch (err) {
        app.log.warn(`[activity-detail] Garmin fetch failed for ${id}: ${err}`);
      }
    }

    // Phase 8: derive analytics from laps (no full 1Hz streams persisted)
    let analytics: {
      ef: { ef: number; unit: 'sec/km/bpm' | 'W/bpm' } | null;
      decoupling: {
        firstHalfRatio: number; secondHalfRatio: number;
        decouplingPct: number; rating: 'excellent'|'good'|'fair'|'poor';
      } | null;
      hrDriftBpm: number | null;
      weather: typeof activity.weather | null;
      comparable: { countLast30d: number; avgEf: number | null; avgDecouplingPct: number | null } | null;
    } | null = null;

    try {
      const { computeFromLaps } = await import('../lib/activity-analytics.js');
      const result = computeFromLaps({
        activityType: activity.activityType,
        laps: laps.map(l => ({
          index:        l.index,
          durationSec:  l.durationSec,
          avgHr:        l.avgHr,
          avgPowerW:    l.avgPowerW,
          avgSpeedMs:   l.avgSpeedMs,
        })),
      });

      // Compare to last 30d activities of same type (loose ±25% duration)
      let comparable: { countLast30d: number; avgEf: number | null; avgDecouplingPct: number | null } | null = null;
      if (result.ef || result.decoupling) {
        const since30d = new Date(activity.startTime.getTime() - 30 * 86_400_000);
        const dur = activity.durationSec ?? 0;
        const peers = await db.select({
          rawData:     pulseActivities.rawData,
          activityType: pulseActivities.activityType,
          durationSec: pulseActivities.durationSec,
        }).from(pulseActivities)
          .where(and(
            eq(pulseActivities.userId, userId),
            eq(pulseActivities.activityType, activity.activityType),
            gte(pulseActivities.startTime, since30d),
          ))
          .limit(40);

        // Use only ones with cached laps in rawData and similar duration
        const efs: number[] = [];
        const decs: number[] = [];
        for (const p of peers) {
          if (p.rawData == null) continue;
          const peerLaps = (p.rawData as { laps?: Array<{ durationSec: number|null; avgHr: number|null; avgPowerW: number|null; avgSpeedMs: number|null; index: number }> }).laps;
          if (!peerLaps?.length) continue;
          if (dur > 0 && p.durationSec != null) {
            const ratio = p.durationSec / dur;
            if (ratio < 0.75 || ratio > 1.25) continue;
          }
          const r = computeFromLaps({
            activityType: p.activityType,
            laps: peerLaps,
          });
          if (r.ef) efs.push(r.ef.ef);
          if (r.decoupling) decs.push(r.decoupling.decouplingPct);
        }
        comparable = {
          countLast30d:        peers.length,
          avgEf:               efs.length  > 0 ? efs.reduce((s, v) => s + v, 0) / efs.length   : null,
          avgDecouplingPct:    decs.length > 0 ? decs.reduce((s, v) => s + v, 0) / decs.length : null,
        };
      }

      analytics = {
        ef:           result.ef,
        decoupling:   result.decoupling,
        hrDriftBpm:   result.hrDriftBpm,
        weather:      activity.weather ?? null,
        comparable,
      };
    } catch (err) {
      app.log.warn(`[activity-analytics] failed for ${id}: ${err}`);
    }

    return {
      activity: {
        ...activity,
        startTime: activity.startTime.toISOString(),
        feedbackLoggedAt: activity.feedbackLoggedAt?.toISOString() ?? null,
      },
      laps,
      hrZones,
      analytics,
    };
  });

  app.patch('/activities/:id/feedback', { onRequest: [app.authenticate] }, async (req, reply) => {
    const parsed = activityFeedbackSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Ungültiges RPE-Feedback' });

    const { id } = req.params as { id: string };
    const userId = req.user.sub;
    const { rpe, rpeNote, sorenessAreas } = parsed.data;
    const note = rpeNote?.trim() ? rpeNote.trim() : null;

    const [updated] = await db.update(pulseActivities)
      .set({
        rpe,
        rpeNote: note,
        sorenessAreas: sorenessAreas && sorenessAreas.length > 0 ? sorenessAreas : null,
        feedbackLoggedAt: new Date(),
      })
      .where(and(eq(pulseActivities.id, id), eq(pulseActivities.userId, userId)))
      .returning();

    if (!updated) return reply.status(404).send({ error: 'Not found' });

    await invalidateUser(userId);

    return {
      activity: {
        ...updated,
        startTime: updated.startTime.toISOString(),
        feedbackLoggedAt: updated.feedbackLoggedAt?.toISOString() ?? null,
      },
    };
  });

  // ─── Training plan ────────────────────────────────────────────────────────────
  app.get('/plan', { onRequest: [app.authenticate] }, async (req) => {
    const userId = req.user.sub;
    const today = new Date().toISOString().split('T')[0]!;
    const workouts = await db.select()
      .from(pulsePlannedWorkouts)
      .where(and(eq(pulsePlannedWorkouts.userId, userId), gte(pulsePlannedWorkouts.plannedDate, today)))
      .orderBy(pulsePlannedWorkouts.plannedDate)
      .limit(14);
    return { workouts };
  });

  // ─── Single workout + detail generation ──────────────────────────────────────
  app.get('/plan/workout/:id', { onRequest: [app.authenticate] }, async (req, reply) => {
    const userId = req.user.sub;
    const { id } = req.params as { id: string };
    const [workout] = await db.select().from(pulsePlannedWorkouts)
      .where(and(eq(pulsePlannedWorkouts.id, id), eq(pulsePlannedWorkouts.userId, userId)));
    if (!workout) return reply.status(404).send({ error: 'Not found' });
    return { workout };
  });

  app.patch('/plan/workout/:id', { onRequest: [app.authenticate] }, async (req, reply) => {
    const schema = z.object({
      activityType: z.enum(['run','bike','swim','strength','hike','other']).optional(),
      zone:         z.number().int().min(1).max(5).optional(),
      durationMin:  z.number().int().min(5).max(360).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Ungültige Eingabe' });
    const userId = req.user.sub;
    const { id } = req.params as { id: string };
    const [updated] = await db.update(pulsePlannedWorkouts)
      .set({ ...parsed.data, steps: null })
      .where(and(eq(pulsePlannedWorkouts.id, id), eq(pulsePlannedWorkouts.userId, userId)))
      .returning();
    if (!updated) return reply.status(404).send({ error: 'Not found' });
    return { workout: updated };
  });

  app.post('/plan/workout/:id/detail', { onRequest: [app.authenticate] }, async (req, reply) => {
    const userId = req.user.sub;
    const { id } = req.params as { id: string };
    const [workout] = await db.select().from(pulsePlannedWorkouts)
      .where(and(eq(pulsePlannedWorkouts.id, id), eq(pulsePlannedWorkouts.userId, userId)));
    if (!workout) return reply.status(404).send({ error: 'Not found' });

    const [profile] = await db.select().from(pulseUserProfile).where(eq(pulseUserProfile.userId, userId));
    const { steps, updatedDescription } = await buildWorkoutSteps(workout, profile ?? undefined);

    await db.update(pulsePlannedWorkouts)
      .set({ steps, description: updatedDescription })
      .where(eq(pulsePlannedWorkouts.id, id));

    return { workout: { ...workout, steps, description: updatedDescription } };
  });

  // ─── Garmin workout helpers ────────────────────────────────────────────────────

  const GARMIN_SPORT_TYPES: Record<string, { sportTypeId: number; sportTypeKey: string }> = {
    run:      { sportTypeId: 1,  sportTypeKey: 'running' },
    bike:     { sportTypeId: 2,  sportTypeKey: 'cycling' },
    swim:     { sportTypeId: 5,  sportTypeKey: 'swimming' },
    strength: { sportTypeId: 13, sportTypeKey: 'strength_training' },
    hike:     { sportTypeId: 1,  sportTypeKey: 'running' },
    other:    { sportTypeId: 1,  sportTypeKey: 'running' },
  };
  const GARMIN_STEP_TYPES: Record<string, { stepTypeId: number; stepTypeKey: string }> = {
    warmup:   { stepTypeId: 1, stepTypeKey: 'warmup' },
    cooldown: { stepTypeId: 2, stepTypeKey: 'cooldown' },
    interval: { stepTypeId: 3, stepTypeKey: 'interval' },
    steady:   { stepTypeId: 3, stepTypeKey: 'interval' },
    rest:     { stepTypeId: 4, stepTypeKey: 'recovery' },
  };
  const GARMIN_TIME_COND = { conditionTypeId: 2, conditionTypeKey: 'time', displayOrder: 0, displayable: true };
  const GARMIN_NO_TARGET = { workoutTargetTypeId: 1, workoutTargetTypeKey: 'no.target', displayOrder: 0 };
  const GARMIN_HR_ZONE_TARGET = { workoutTargetTypeId: 4, workoutTargetTypeKey: 'heart.rate.zone', displayOrder: 0 };
  const GARMIN_NULL_FIELDS = {
    childStepId: null, endConditionCompare: null, targetValueOne: null, targetValueTwo: null,
    targetValueUnit: null, zoneNumber: null, secondaryTargetType: null,
    secondaryTargetValueOne: null, secondaryTargetValueTwo: null,
    secondaryTargetValueUnit: null, secondaryZoneNumber: null, endConditionZone: null,
    preferredEndConditionUnit: null, strokeType: { strokeTypeId: 0, strokeTypeKey: null, displayOrder: 0 },
    equipmentType: { equipmentTypeId: 0, equipmentTypeKey: null, displayOrder: 0 },
    category: null, exerciseName: null, workoutProvider: null, providerExerciseSourceId: null,
  };
  const GARMIN_ACTIVITY_NAMES: Record<string, string> = {
    run: 'Laufen', bike: 'Radfahren', swim: 'Schwimmen', strength: 'Kraft',
  };

  function garminTargetFields(activityType: string, step: WorkoutStep) {
    if (!supportsHrStepTargets(activityType)) {
      return { ...GARMIN_NULL_FIELDS, targetType: GARMIN_NO_TARGET };
    }
    return {
      ...GARMIN_NULL_FIELDS,
      targetType: GARMIN_HR_ZONE_TARGET,
      zoneNumber: Math.max(1, Math.min(5, step.zone)),
    };
  }

  function buildGarminWorkoutJson(workout: {
    activityType: string; zone: number; durationMin: number;
    description: string | null; steps: WorkoutStep[] | null;
  }) {
    const sportType = GARMIN_SPORT_TYPES[workout.activityType] ?? GARMIN_SPORT_TYPES.run!;
    let stepOrder = 0;
    const garminSteps: object[] = [];

    for (const step of workout.steps ?? []) {
      const stepType = GARMIN_STEP_TYPES[step.type] ?? GARMIN_STEP_TYPES.interval;
      const durationSecs = step.durationMin * 60;

      if (step.type === 'interval' && step.reps && step.reps > 1) {
        const restSecs = (step.restMin ?? 2) * 60;
        const innerSteps: object[] = [
          {
            type: 'ExecutableStepDTO', stepOrder: 1,
            stepType: GARMIN_STEP_TYPES.interval,
            description: step.description ?? `Zone ${step.zone}`,
            endCondition: GARMIN_TIME_COND, endConditionValue: durationSecs,
            ...garminTargetFields(workout.activityType, step),
          },
        ];
        if (step.restMin) {
          const restStep: WorkoutStep = { type: 'rest', durationMin: step.restMin, zone: 1 };
          innerSteps.push({
            type: 'ExecutableStepDTO', stepOrder: 2,
            stepType: GARMIN_STEP_TYPES.rest,
            description: 'Erholung',
            endCondition: GARMIN_TIME_COND, endConditionValue: restSecs,
            ...garminTargetFields(workout.activityType, restStep),
          });
        }
        stepOrder++;
        garminSteps.push({
          type: 'RepeatGroupDTO', stepOrder,
          stepType: { stepTypeId: 6, stepTypeKey: 'repeat', displayOrder: 0 },
          childStepId: 1, numberOfIterations: step.reps,
          endCondition: { conditionTypeId: 1, conditionTypeKey: 'lap.button', displayOrder: 0, displayable: false },
          endConditionValue: null,
          workoutSteps: innerSteps,
        });
      } else {
        stepOrder++;
        garminSteps.push({
          type: 'ExecutableStepDTO', stepOrder,
          stepType: { ...stepType, displayOrder: 0 },
          description: step.description ?? null,
          endCondition: GARMIN_TIME_COND, endConditionValue: durationSecs,
          ...garminTargetFields(workout.activityType, step),
        });
      }
    }

    return {
      workoutName: `${GARMIN_ACTIVITY_NAMES[workout.activityType] ?? workout.activityType} – Z${workout.zone} · ${workout.durationMin}min`,
      description: workout.description ?? `Zone ${workout.zone} Training`,
      sportType,
      estimatedDurationInSecs: workout.durationMin * 60,
      estimatedDistanceInMeters: null,
      workoutSegments: [{ segmentOrder: 1, sportType, workoutSteps: garminSteps }],
    };
  }

  // ─── Garmin Connect workout sync ──────────────────────────────────────────────
  app.post('/plan/workout/:id/sync-garmin', { onRequest: [app.authenticate] }, async (req, reply) => {
    const userId = req.user.sub;
    const { id } = req.params as { id: string };

    const [workout] = await db.select().from(pulsePlannedWorkouts)
      .where(and(eq(pulsePlannedWorkouts.id, id), eq(pulsePlannedWorkouts.userId, userId)));
    if (!workout) return reply.status(404).send({ error: 'Not found' });

    const [profile] = await db.select().from(pulseUserProfile).where(eq(pulseUserProfile.userId, userId));

    if (!workout.steps?.length) {
      const { steps, updatedDescription } = await buildWorkoutSteps(workout, profile ?? undefined);
      await db.update(pulsePlannedWorkouts)
        .set({ steps, description: updatedDescription })
        .where(eq(pulsePlannedWorkouts.id, id));
      workout.steps = steps as typeof workout.steps;
      if (updatedDescription) workout.description = updatedDescription;
    }

    try {
      const { getGarminClient } = await import('../lib/garmin-client.js');
      const gc = await getGarminClient();

      const garminWorkout = buildGarminWorkoutJson(workout);
      const created = await gc.addWorkout(garminWorkout) as { workoutId: number };
      const garminWorkoutId = String(created.workoutId);

      const scheduleUrl = `https://connectapi.garmin.com/workout-service/schedule/${garminWorkoutId}`;
      const scheduled = await gc.client.post(scheduleUrl, { date: workout.plannedDate }) as any;
      const garminScheduledId = scheduled?.workoutScheduleId != null
        ? String(scheduled.workoutScheduleId)
        : scheduled?.scheduledWorkoutId != null
          ? String(scheduled.scheduledWorkoutId)
          : null;

      await db.update(pulsePlannedWorkouts)
        .set({ garminWorkoutId, garminScheduledId })
        .where(eq(pulsePlannedWorkouts.id, id));

      return { garminWorkoutId, date: workout.plannedDate };
    } catch (err) {
      app.log.error(`Garmin workout sync failed: ${err}`);
      return reply.status(502).send({ error: `Garmin-Sync fehlgeschlagen: ${String(err).slice(0, 120)}` });
    }
  });

  // ─── Garmin Calendar Sync ─────────────────────────────────────────────────────
  // Fetches Garmin calendar via calendar-service (month=0-indexed) and returns
  // future workout schedule entries. Each item: { id (scheduleId), workoutId, date }.
  async function fetchGarminCalendarWorkouts(gc: any, today: string): Promise<Array<{ id: string; workoutId: string; date: string }>> {
    const result: Array<{ id: string; workoutId: string; date: string }> = [];
    const now = new Date();
    for (let offset = 0; offset < 3; offset++) {
      const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
      const year = d.getFullYear();
      const month = d.getMonth(); // 0-indexed — calendar-service uses this format
      try {
        const cal = await gc.client.get(`https://connectapi.garmin.com/calendar-service/year/${year}/month/${month}`) as any;
        const items: any[] = cal?.calendarItems ?? [];
        for (const item of items) {
          if (item.itemType !== 'workout') continue;
          if (!item.workoutId) continue;
          const date: string = item.date ?? '';
          if (date < today) continue;
          result.push({ id: String(item.id), workoutId: String(item.workoutId), date });
        }
      } catch { /* non-fatal */ }
    }
    return result;
  }

  app.post('/garmin/calendar/sync', { onRequest: [app.authenticate] }, async (req, reply) => {
    const userId = req.user.sub;
    const today = new Date().toISOString().split('T')[0]!;

    const futurePlanned = await db.select().from(pulsePlannedWorkouts)
      .where(and(
        eq(pulsePlannedWorkouts.userId, userId),
        eq(pulsePlannedWorkouts.status, 'planned'),
        gte(pulsePlannedWorkouts.plannedDate, today),
      ));

    const [profile] = await db.select().from(pulseUserProfile).where(eq(pulseUserProfile.userId, userId));

    let gc: any;
    try {
      const { getGarminClient } = await import('../lib/garmin-client.js');
      gc = await getGarminClient();
    } catch (err) {
      return reply.status(502).send({ error: `Garmin-Login fehlgeschlagen: ${String(err).slice(0, 120)}` });
    }

    // Upload workouts not yet in Garmin
    let uploaded = 0;
    const errors: string[] = [];
    for (const workout of futurePlanned.filter(w => !w.garminWorkoutId)) {
      try {
        let w = workout;
        if (!w.steps?.length) {
          const { steps, updatedDescription } = await buildWorkoutSteps(w, profile ?? undefined);
          await db.update(pulsePlannedWorkouts)
            .set({ steps, description: updatedDescription })
            .where(eq(pulsePlannedWorkouts.id, w.id));
          w = { ...w, steps: steps as typeof w.steps, description: updatedDescription };
        }
        const garminWorkout = buildGarminWorkoutJson(w);
        const created = await gc.addWorkout(garminWorkout) as { workoutId: number };
        const garminWorkoutId = String(created.workoutId);
        const scheduleUrl = `https://connectapi.garmin.com/workout-service/schedule/${garminWorkoutId}`;
        const scheduled = await gc.client.post(scheduleUrl, { date: w.plannedDate }) as any;
        const garminScheduledId = scheduled?.workoutScheduleId != null
          ? String(scheduled.workoutScheduleId)
          : scheduled?.id != null ? String(scheduled.id) : null;
        await db.update(pulsePlannedWorkouts)
          .set({ garminWorkoutId, garminScheduledId })
          .where(eq(pulsePlannedWorkouts.id, w.id));
        uploaded++;
      } catch (err) {
        errors.push(`${workout.plannedDate}: ${String(err).slice(0, 80)}`);
      }
    }

    // Collect our current workout IDs (after uploads)
    const allPlanned = await db.select({ garminWorkoutId: pulsePlannedWorkouts.garminWorkoutId })
      .from(pulsePlannedWorkouts)
      .where(and(eq(pulsePlannedWorkouts.userId, userId), gte(pulsePlannedWorkouts.plannedDate, today)));
    const ourWorkoutIds = new Set(
      allPlanned.map(w => w.garminWorkoutId).filter((id): id is string => id != null),
    );

    // Remove calendar entries + workout templates not belonging to our current plan
    const calendarItems = await fetchGarminCalendarWorkouts(gc, today);
    const removedTemplates = new Set<string>();
    let removed = 0;
    for (const item of calendarItems) {
      if (!ourWorkoutIds.has(item.workoutId)) {
        try {
          await gc.client.delete(`https://connectapi.garmin.com/workout-service/schedule/${item.id}`);
          removed++;
          app.log.info(`[calendar-sync] Removed orphan schedule ${item.id} (workout ${item.workoutId}) on ${item.date}`);
        } catch (err) {
          app.log.warn(`[calendar-sync] Failed to remove schedule ${item.id}: ${err}`);
        }
        // Also delete the workout template so it disappears from the device library
        if (!removedTemplates.has(item.workoutId)) {
          try {
            await gc.client.delete(`https://connectapi.garmin.com/workout-service/workout/${item.workoutId}`);
            removedTemplates.add(item.workoutId);
          } catch { /* template may already be gone */ }
        }
      }
    }

    return { uploaded, removed, errors: errors.length > 0 ? errors : undefined };
  });

  app.post('/plan/generate', { onRequest: [app.authenticate] }, async (req, reply) => {
    const userId = req.user.sub;
    const body = req.body as { weekStart?: string } | null;
    let weekStartStr: string;
    if (body?.weekStart && /^\d{4}-\d{2}-\d{2}$/.test(body.weekStart)) {
      weekStartStr = body.weekStart;
    } else {
      const now = new Date();
      const mondayOffset = now.getDay() === 0 ? -6 : 1 - now.getDay();
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() + mondayOffset);
      weekStartStr = weekStart.toISOString().split('T')[0]!;
    }

    const [profile] = await db.select()
      .from(pulseUserProfile)
      .where(eq(pulseUserProfile.userId, userId));

    // Auto-derive phase from next race (Phase 8 wird das ergänzen). Fallback: profile.trainingPhase.
    // 'base' default in profile bedeutet "Auto"; nur explizite Werte überschreiben den Race-derived.
    const explicitPhase = profile?.trainingPhase as 'base' | 'build' | 'peak' | 'taper' | null | undefined;
    const derivedPhase  = await deriveCurrentPhase(userId, weekStartStr);
    const phase: 'base' | 'build' | 'peak' | 'taper' =
      (explicitPhase && explicitPhase !== 'base') ? explicitPhase : derivedPhase;

    // Use week-specific availability if set, fall back to profile defaults
    const [weekAvail] = await db.select()
      .from(pulseWeekAvailability)
      .where(and(eq(pulseWeekAvailability.userId, userId), eq(pulseWeekAvailability.weekStart, weekStartStr)));

    const weeklyHoursTarget = weekAvail?.weeklyHours ?? profile?.weeklyHoursTarget ?? 8;
    const availableDays = (weekAvail?.availableDays as number[] | null) ?? [0, 2, 4, 5];

    const since42d = new Date(Date.now() - 42 * 86_400_000);
    const today = new Date().toISOString().split('T')[0]!;
    const [fitnessLoad, recentActs, goals, recentFeedback, activeHealthStates, riskSignalRows] = await Promise.all([
      computeFitnessLoad(userId, weekStartStr),
      db.select({
        id:            pulseActivities.id,
        startTime:    pulseActivities.startTime,
        activityType: pulseActivities.activityType,
        durationSec:  pulseActivities.durationSec,
        tss:          pulseActivities.tss,
        rpe:          pulseActivities.rpe,
      }).from(pulseActivities)
        .where(and(eq(pulseActivities.userId, userId), gte(pulseActivities.startTime, since42d)))
        .orderBy(desc(pulseActivities.startTime))
        .limit(80),
      db.select({
        title:          pulseGoals.title,
        targetDate:     pulseGoals.targetDate,
        category:       pulseGoals.category,
        metrics:        pulseGoals.metrics,
        raceDiscipline: pulseGoals.raceDiscipline,
        raceDistanceKm: pulseGoals.raceDistanceKm,
        racePriority:   pulseGoals.racePriority,
      })
        .from(pulseGoals)
        .where(and(eq(pulseGoals.userId, userId), eq(pulseGoals.status, 'active')))
        .limit(5),
      db.select({
        plannedDate:     pulsePlannedWorkouts.plannedDate,
        activityType:    pulsePlannedWorkouts.activityType,
        zone:            pulsePlannedWorkouts.zone,
        durationMin:     pulsePlannedWorkouts.durationMin,
        workoutFeedback: pulsePlannedWorkouts.workoutFeedback,
        complianceScore: pulsePlannedWorkouts.complianceScore,
      }).from(pulsePlannedWorkouts)
        .where(and(
          eq(pulsePlannedWorkouts.userId, userId),
          eq(pulsePlannedWorkouts.status, 'completed'),
          gte(pulsePlannedWorkouts.plannedDate, since42d.toISOString().split('T')[0]!),
        ))
        .orderBy(desc(pulsePlannedWorkouts.plannedDate))
        .limit(10),
      db.select().from(pulseHealthState)
        .where(and(
          eq(pulseHealthState.userId, userId),
          isNull(pulseHealthState.resolvedAt),
          or(isNull(pulseHealthState.endDate), gte(pulseHealthState.endDate, today)),
        )),
      getActiveRiskSignals(userId),
    ]);
    const activeRaces = await getActiveRaces(userId, weekStartStr);
    const plannedZoneByActivityId = await getPlannedZoneByActivityId(userId, recentActs.map(a => a.id));
    const recentPlanActivities = recentActs.map(a => ({
      date:         a.startTime.toISOString().split('T')[0]!,
      activityType: a.activityType,
      durationMin:  Math.round((a.durationSec ?? 0) / 60),
      tss:          a.tss ?? 0,
      rpe:          a.rpe,
      plannedZone:  plannedZoneByActivityId.get(a.id) ?? null,
    }));
    const planGoals = goals.map(g => ({
      ...g,
      metrics: (g.metrics as Record<string, unknown> | null) ?? null,
      racePriority: normalizeRacePriority(g.racePriority),
    }));
    const riskSignals = riskSignalRows.map(r => ({
      ruleId: r.ruleId,
      severity: r.severity as 'info' | 'warn' | 'critical',
      title: r.title,
      recommendation: r.recommendation,
    }));
    const mesocycleWeek = getMesocycleWeek(weekStartStr);
    const planDecision = decidePlanDays({
      availableDays,
      weeklyHoursTarget,
      tsb: fitnessLoad.tsb,
      phase,
      mesocycleWeek,
      goals: planGoals,
      riskSignals,
      recentActivities: recentPlanActivities,
    });

    let generated: Awaited<ReturnType<typeof generateWeekWorkouts>>;
    try {
      generated = await generateScientificWeekPlan({
        weekStart:          weekStartStr,
        phase,
        weeklyHoursTarget,
        availableDays,
        ctl:                fitnessLoad.ctl,
        atl:                fitnessLoad.atl,
        tsb:                fitnessLoad.tsb,
        ftpWatts:           profile?.ftpWatts ?? 250,
        maxHrBpm:           profile?.maxHrBpm ?? 185,
        lthrBpm:            profile?.lthrBpm ?? undefined,
        recentActivities:   recentPlanActivities,
        goals:              planGoals,
        riskSignals,
        recentFeedback: recentFeedback
          .filter(w => w.workoutFeedback != null)
          .map(w => ({
            date:               w.plannedDate,
            activityType:       w.activityType,
            plannedZone:        w.zone,
            plannedDurationMin: w.durationMin,
            feedback:           w.workoutFeedback!,
            complianceScore:    w.complianceScore ?? 0.7,
          })),
        healthStates: activeHealthStates.map(s => ({
          type:      s.type as 'illness' | 'injury' | 'fatigue' | 'travel',
          severity:  s.severity as 'mild' | 'moderate' | 'severe',
          bodyPart:  s.bodyPart,
          startDate: s.startDate,
          endDate:   s.endDate,
          notes:     s.notes,
        })),
        races: activeRaces.map(r => ({
          title:      r.title,
          date:       r.date,
          daysUntil:  r.daysUntil,
          priority:   r.priority,
          discipline: r.discipline,
          distanceKm: r.distanceKm,
        })),
      });
    } catch (err) {
      app.log.warn(`[plan] Scientific plan failed, using templates: ${err}`);
      generated = generateWeekWorkouts({ weekStart: weekStartStr, phase, weeklyHoursTarget, availableDays });
    }

    // Clean up old Garmin workouts before deleting from DB (prevents duplicates)
    const oldWorkouts = await db.select({
      garminWorkoutId:   pulsePlannedWorkouts.garminWorkoutId,
      garminScheduledId: pulsePlannedWorkouts.garminScheduledId,
    }).from(pulsePlannedWorkouts).where(and(
      eq(pulsePlannedWorkouts.userId, userId),
      gte(pulsePlannedWorkouts.plannedDate, weekStartStr),
      eq(pulsePlannedWorkouts.status, 'planned'),
    ));

    const oldWithGarmin = oldWorkouts.filter(w => w.garminWorkoutId);
    if (oldWithGarmin.length > 0) {
      try {
        const { getGarminClient } = await import('../lib/garmin-client.js');
        const gc = await getGarminClient();
        await Promise.allSettled(oldWithGarmin.map(async (w) => {
          if (w.garminScheduledId) {
            await gc.client.delete(`https://connectapi.garmin.com/workout-service/schedule/${w.garminScheduledId}`);
          }
          await gc.client.delete(`https://connectapi.garmin.com/workout-service/workout/${w.garminWorkoutId}`);
        }));
        app.log.info(`[plan] Cleaned up ${oldWithGarmin.length} old Garmin workouts`);
      } catch (err) {
        app.log.warn(`[plan] Garmin cleanup failed (non-fatal): ${err}`);
      }
    }

    await db.delete(pulsePlannedWorkouts).where(
      and(
        eq(pulsePlannedWorkouts.userId, userId),
        gte(pulsePlannedWorkouts.plannedDate, weekStartStr),
        eq(pulsePlannedWorkouts.status, 'planned'),
      ),
    );

    const inserted = await db.insert(pulsePlannedWorkouts).values(
      generated.map((w) => ({
        userId,
        plannedDate:  w.plannedDate,
        activityType: w.activityType,
        zone:         w.zone,
        durationMin:  w.durationMin,
        targetTss:    w.targetTss,
        description:  w.description,
      })),
    ).returning();

    // Generate structured steps for all workouts in parallel (best-effort)
    const withSteps = await Promise.all(
      inserted.map(async (w) => {
        try {
          const { steps, updatedDescription } = await buildWorkoutSteps(w, profile ?? undefined);
          await db.update(pulsePlannedWorkouts)
            .set({ steps, description: updatedDescription })
            .where(eq(pulsePlannedWorkouts.id, w.id));
          return { ...w, steps, description: updatedDescription };
        } catch (err) {
          app.log.warn(`[plan] Step generation failed for workout ${w.id}: ${err}`);
          return w;
        }
      }),
    );

    // Fire-and-forget: sync newly generated workouts to Garmin calendar
    (async () => {
      try {
        const { getGarminClient } = await import('../lib/garmin-client.js');
        const gc = await getGarminClient();
        const today = weekStartStr;

        // Upload new workouts to Garmin
        for (const w of withSteps.filter(ww => !ww.garminWorkoutId)) {
          try {
            const garminWorkout = buildGarminWorkoutJson(w);
            const created = await gc.addWorkout(garminWorkout) as { workoutId: number };
            const garminWorkoutId = String(created.workoutId);
            const scheduleUrl = `https://connectapi.garmin.com/workout-service/schedule/${garminWorkoutId}`;
            const scheduled = await gc.client.post(scheduleUrl, { date: w.plannedDate }) as any;
            const garminScheduledId = scheduled?.workoutScheduleId != null
              ? String(scheduled.workoutScheduleId)
              : scheduled?.id != null ? String(scheduled.id) : null;
            await db.update(pulsePlannedWorkouts)
              .set({ garminWorkoutId, garminScheduledId })
              .where(eq(pulsePlannedWorkouts.id, w.id));
            app.log.info(`[plan-generate] Synced workout ${w.id} → Garmin ${garminWorkoutId}`);
          } catch (err) {
            app.log.warn(`[plan-generate] Garmin sync failed for ${w.id}: ${err}`);
          }
        }

        // Remove orphaned calendar entries not in current plan
        const allFuture = await db.select({ garminWorkoutId: pulsePlannedWorkouts.garminWorkoutId })
          .from(pulsePlannedWorkouts)
          .where(and(eq(pulsePlannedWorkouts.userId, userId), gte(pulsePlannedWorkouts.plannedDate, today)));
        const ourIds = new Set(allFuture.map(w => w.garminWorkoutId).filter((id): id is string => id != null));
        const calItems = await fetchGarminCalendarWorkouts(gc, today);
        const deletedTemplates = new Set<string>();
        for (const item of calItems) {
          if (!ourIds.has(item.workoutId)) {
            try {
              await gc.client.delete(`https://connectapi.garmin.com/workout-service/schedule/${item.id}`);
              app.log.info(`[plan-generate] Removed orphan ${item.id} on ${item.date}`);
            } catch { /* non-fatal */ }
            if (!deletedTemplates.has(item.workoutId)) {
              try {
                await gc.client.delete(`https://connectapi.garmin.com/workout-service/workout/${item.workoutId}`);
                deletedTemplates.add(item.workoutId);
              } catch { /* template may already be gone */ }
            }
          }
        }
      } catch (err) {
        app.log.warn(`[plan-generate] Background Garmin calendar sync failed: ${err}`);
      }
    })();

    return reply.status(201).send({ workouts: withSteps, planDecision });
  });

  // ─── Goals ────────────────────────────────────────────────────────────────────
  app.get('/goals', { onRequest: [app.authenticate] }, async (req) => {
    const userId = req.user.sub;
    const goals = await db.select()
      .from(pulseGoals)
      .where(eq(pulseGoals.userId, userId))
      .orderBy(desc(pulseGoals.createdAt));
    return { goals };
  });

  app.post('/goals', { onRequest: [app.authenticate] }, async (req, reply) => {
    const schema = z.object({
      title:       z.string().min(1).max(255),
      description: z.string().max(1000).optional(),
      targetDate:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      category:    z.string().max(30).optional(),
      metrics:     z.record(z.unknown()).optional(),
      raceDiscipline:    z.enum(['run','bike','swim','triathlon_sprint','triathlon_olympic','triathlon_70_3','triathlon_140_6','duathlon','other']).optional(),
      raceDistanceKm:    z.number().min(0.1).max(500).optional(),
      raceTargetTimeSec: z.number().int().min(60).max(86400).optional(),
      racePriority:      z.enum(['A','B','C']).optional(),
      raceLocation:      z.string().max(255).optional(),
      raceNotes:         z.string().max(1000).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Ungültige Eingabe' });

    const userId = req.user.sub;
    const [goal] = await db.insert(pulseGoals).values({
      userId,
      title:             parsed.data.title,
      description:       parsed.data.description ?? null,
      targetDate:        parsed.data.targetDate  ?? null,
      category:          parsed.data.category    ?? null,
      metrics:           parsed.data.metrics     ?? {},
      raceDiscipline:    parsed.data.raceDiscipline    ?? null,
      raceDistanceKm:    parsed.data.raceDistanceKm    ?? null,
      raceTargetTimeSec: parsed.data.raceTargetTimeSec ?? null,
      racePriority:      parsed.data.racePriority      ?? (parsed.data.category === 'race' ? 'A' : null),
      raceLocation:      parsed.data.raceLocation      ?? null,
      raceNotes:         parsed.data.raceNotes         ?? null,
    }).returning();

    return reply.status(201).send(goal);
  });

  app.patch('/goals/:id', { onRequest: [app.authenticate] }, async (req, reply) => {
    const schema = z.object({
      status:      z.enum(['active', 'completed', 'paused', 'abandoned']).optional(),
      progress:    z.number().min(0).max(1).optional(),
      title:       z.string().min(1).max(255).optional(),
      description: z.string().max(1000).optional().nullable(),
      targetDate:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
      category:    z.string().max(30).optional().nullable(),
      metrics:     z.record(z.unknown()).optional(),
      raceDiscipline:    z.enum(['run','bike','swim','triathlon_sprint','triathlon_olympic','triathlon_70_3','triathlon_140_6','duathlon','other']).optional().nullable(),
      raceDistanceKm:    z.number().min(0.1).max(500).optional().nullable(),
      raceTargetTimeSec: z.number().int().min(60).max(86400).optional().nullable(),
      racePriority:      z.enum(['A','B','C']).optional().nullable(),
      raceLocation:      z.string().max(255).optional().nullable(),
      raceNotes:         z.string().max(1000).optional().nullable(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Ungültige Eingabe' });

    const userId = req.user.sub;
    const { id } = req.params as { id: string };

    const [updated] = await db.update(pulseGoals)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(and(eq(pulseGoals.id, id), eq(pulseGoals.userId, userId)))
      .returning();

    if (!updated) return reply.status(404).send({ error: 'Ziel nicht gefunden' });
    return updated;
  });

  app.delete('/goals/:id', { onRequest: [app.authenticate] }, async (req, reply) => {
    const userId = req.user.sub;
    const { id } = req.params as { id: string };

    const [deleted] = await db.delete(pulseGoals)
      .where(and(eq(pulseGoals.id, id), eq(pulseGoals.userId, userId)))
      .returning({ id: pulseGoals.id });

    if (!deleted) return reply.status(404).send({ error: 'Ziel nicht gefunden' });
    return reply.status(204).send();
  });

  // ─── Race list with prognosis (Phase 7) ───────────────────────────────────────
  app.get('/races', { onRequest: [app.authenticate] }, async (req) => {
    const userId = req.user.sub;
    const today = new Date().toISOString().split('T')[0]!;
    const races = await getActiveRaces(userId, today);
    return { races };
  });

  // ─── Health states (Phase 6) ──────────────────────────────────────────────────
  // Active = resolved_at IS NULL AND start_date <= today AND (end_date IS NULL OR end_date >= today)
  app.get('/health-state', { onRequest: [app.authenticate] }, async (req) => {
    const userId = req.user.sub;
    const today = new Date().toISOString().split('T')[0]!;

    const [active, recent] = await Promise.all([
      db.select().from(pulseHealthState)
        .where(and(
          eq(pulseHealthState.userId, userId),
          isNull(pulseHealthState.resolvedAt),
          lte(pulseHealthState.startDate, today),
          or(isNull(pulseHealthState.endDate), gte(pulseHealthState.endDate, today)),
        ))
        .orderBy(desc(pulseHealthState.startDate)),
      db.select().from(pulseHealthState)
        .where(and(
          eq(pulseHealthState.userId, userId),
          gte(pulseHealthState.startDate, sql`(CURRENT_DATE - INTERVAL '30 days')::date`),
        ))
        .orderBy(desc(pulseHealthState.startDate))
        .limit(20),
    ]);

    return { active, recent };
  });

  app.post('/health-state', { onRequest: [app.authenticate] }, async (req, reply) => {
    const schema = z.object({
      type:         z.enum(['illness', 'injury', 'fatigue', 'travel']),
      severity:     z.enum(['mild', 'moderate', 'severe']),
      bodyPart:     z.string().max(50).optional(),
      notes:        z.string().max(500).optional(),
      durationDays: z.number().int().min(1).max(60),
      startDate:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Ungültige Eingabe' });

    const userId = req.user.sub;
    const startDate = parsed.data.startDate ?? new Date().toISOString().split('T')[0]!;
    const end = new Date(startDate + 'T00:00:00Z');
    end.setUTCDate(end.getUTCDate() + parsed.data.durationDays - 1);
    const endDate = end.toISOString().split('T')[0]!;

    const [created] = await db.insert(pulseHealthState).values({
      userId,
      type:      parsed.data.type,
      severity:  parsed.data.severity,
      bodyPart:  parsed.data.bodyPart ?? null,
      notes:     parsed.data.notes    ?? null,
      startDate,
      endDate,
    }).returning();

    await invalidateUser(userId);
    return reply.status(201).send(created);
  });

  app.patch('/health-state/:id', { onRequest: [app.authenticate] }, async (req, reply) => {
    const schema = z.object({
      severity:     z.enum(['mild', 'moderate', 'severe']).optional(),
      notes:        z.string().max(500).optional().nullable(),
      endDate:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Ungültige Eingabe' });

    const userId = req.user.sub;
    const { id } = req.params as { id: string };

    const [updated] = await db.update(pulseHealthState)
      .set(parsed.data)
      .where(and(eq(pulseHealthState.id, id), eq(pulseHealthState.userId, userId)))
      .returning();

    if (!updated) return reply.status(404).send({ error: 'Status nicht gefunden' });
    await invalidateUser(userId);
    return updated;
  });

  app.post('/health-state/:id/resolve', { onRequest: [app.authenticate] }, async (req, reply) => {
    const userId = req.user.sub;
    const { id } = req.params as { id: string };

    const [resolved] = await db.update(pulseHealthState)
      .set({ resolvedAt: new Date() })
      .where(and(
        eq(pulseHealthState.id, id),
        eq(pulseHealthState.userId, userId),
        isNull(pulseHealthState.resolvedAt),
      ))
      .returning();

    if (!resolved) return reply.status(404).send({ error: 'Status nicht aktiv' });
    await invalidateUser(userId);
    return resolved;
  });

  app.delete('/health-state/:id', { onRequest: [app.authenticate] }, async (req, reply) => {
    const userId = req.user.sub;
    const { id } = req.params as { id: string };

    const [deleted] = await db.delete(pulseHealthState)
      .where(and(eq(pulseHealthState.id, id), eq(pulseHealthState.userId, userId)))
      .returning({ id: pulseHealthState.id });

    if (!deleted) return reply.status(404).send({ error: 'Status nicht gefunden' });
    await invalidateUser(userId);
    return reply.status(204).send();
  });

  // ─── Nutrition logs (Phase 9) ────────────────────────────────────────────────
  app.get('/nutrition', { onRequest: [app.authenticate] }, async (req) => {
    const userId = req.user.sub;
    const q = req.query as { from?: string; to?: string; workoutId?: string; activityId?: string; days?: string };
    const conds = [eq(pulseNutritionLogs.userId, userId)];

    if (q.workoutId) conds.push(eq(pulseNutritionLogs.workoutId, q.workoutId));
    if (q.activityId) conds.push(eq(pulseNutritionLogs.activityId, q.activityId));
    if (q.from && /^\d{4}-\d{2}-\d{2}$/.test(q.from)) conds.push(gte(pulseNutritionLogs.date, q.from));
    if (q.to   && /^\d{4}-\d{2}-\d{2}$/.test(q.to))   conds.push(lte(pulseNutritionLogs.date, q.to));
    if (!q.from && !q.workoutId && !q.activityId) {
      const days = Math.min(Math.max(parseInt(q.days ?? '14', 10), 1), 365);
      const since = new Date(Date.now() - days * 86_400_000).toISOString().split('T')[0]!;
      conds.push(gte(pulseNutritionLogs.date, since));
    }

    const logs = await db.select().from(pulseNutritionLogs)
      .where(and(...conds))
      .orderBy(desc(pulseNutritionLogs.date), desc(pulseNutritionLogs.createdAt));
    return { logs };
  });

  app.post('/nutrition', { onRequest: [app.authenticate] }, async (req, reply) => {
    const schema = z.object({
      date:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      context:     z.enum(['pre','during','post','daily']).optional(),
      workoutId:   z.string().uuid().optional(),
      activityId:  z.string().uuid().optional(),
      mealType:    z.string().max(30).optional(),
      description: z.string().max(500).optional(),
      calories:    z.number().int().min(0).max(20000).optional(),
      proteinG:    z.number().min(0).max(2000).optional(),
      carbsG:      z.number().min(0).max(2000).optional(),
      fatG:        z.number().min(0).max(1000).optional(),
      gelsCount:   z.number().int().min(0).max(50).optional(),
      drinksMl:    z.number().int().min(0).max(20000).optional(),
      sodiumMg:    z.number().int().min(0).max(50000).optional(),
      notes:       z.string().max(1000).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Ungültige Eingabe' });

    const userId = req.user.sub;
    const date = parsed.data.date ?? new Date().toISOString().split('T')[0]!;

    // Auto-derive carbs from gels if explicit carbs not provided (1 gel ≈ 25g)
    let carbsG = parsed.data.carbsG;
    if (carbsG == null && parsed.data.gelsCount != null && parsed.data.gelsCount > 0) {
      carbsG = parsed.data.gelsCount * 25;
    }

    const [log] = await db.insert(pulseNutritionLogs).values({
      userId, date,
      context:     parsed.data.context     ?? null,
      workoutId:   parsed.data.workoutId   ?? null,
      activityId:  parsed.data.activityId  ?? null,
      mealType:    parsed.data.mealType    ?? null,
      description: parsed.data.description ?? null,
      calories:    parsed.data.calories    ?? null,
      proteinG:    parsed.data.proteinG    ?? null,
      carbsG:      carbsG                  ?? null,
      fatG:        parsed.data.fatG        ?? null,
      gelsCount:   parsed.data.gelsCount   ?? null,
      drinksMl:    parsed.data.drinksMl    ?? null,
      sodiumMg:    parsed.data.sodiumMg    ?? null,
      notes:       parsed.data.notes       ?? null,
    }).returning();

    return reply.status(201).send(log);
  });

  app.delete('/nutrition/:id', { onRequest: [app.authenticate] }, async (req, reply) => {
    const userId = req.user.sub;
    const { id } = req.params as { id: string };
    const [deleted] = await db.delete(pulseNutritionLogs)
      .where(and(eq(pulseNutritionLogs.id, id), eq(pulseNutritionLogs.userId, userId)))
      .returning({ id: pulseNutritionLogs.id });
    if (!deleted) return reply.status(404).send({ error: 'Nicht gefunden' });
    return reply.status(204).send();
  });

  // ─── Today-Adjust (Phase 6 Task 4) ────────────────────────────────────────────
  app.get('/plan/today/proposal', { onRequest: [app.authenticate] }, async (req) => {
    const userId = req.user.sub;
    const today = new Date().toISOString().split('T')[0]!;
    const proposal = await proposeTodayAdjustment(userId, today);
    return { proposal };
  });

  app.post('/plan/today/accept', { onRequest: [app.authenticate] }, async (req, reply) => {
    const schema = z.object({ workoutId: z.string().uuid() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Ungültige Eingabe' });

    const userId = req.user.sub;
    const today = new Date().toISOString().split('T')[0]!;
    const proposal = await proposeTodayAdjustment(userId, today);
    if (!proposal || proposal.workoutId !== parsed.data.workoutId) {
      return reply.status(409).send({ error: 'Vorschlag nicht mehr aktuell' });
    }

    // Atomic: capture original_zone/original_duration_min from current row, then overwrite.
    const result = await db.execute(sql`
      UPDATE pulse_planned_workouts
      SET
        original_zone         = COALESCE(original_zone, zone),
        original_duration_min = COALESCE(original_duration_min, duration_min),
        zone                  = ${proposal.proposed.zone},
        duration_min          = ${proposal.proposed.durationMin},
        activity_type         = ${proposal.proposed.activityType}::pulse_activity_type,
        description           = ${proposal.proposed.description},
        adjusted_reason       = ${proposal.reason},
        adjusted_at           = NOW(),
        steps                 = NULL
      WHERE id = ${parsed.data.workoutId} AND user_id = ${userId}
      RETURNING id, planned_date, activity_type, zone, duration_min, description,
                adjusted_reason, original_zone, original_duration_min;
    `);
    const rows = (result as unknown as { rows: Array<Record<string, unknown>> }).rows;
    if (!rows[0]) return reply.status(404).send({ error: 'Workout nicht gefunden' });

    return { ok: true, workout: rows[0], proposal };
  });

  // ─── Week availability ────────────────────────────────────────────────────────
  app.get('/plan/availability', { onRequest: [app.authenticate] }, async (req) => {
    const userId = req.user.sub;
    const now = new Date();
    const mondayOffset = now.getDay() === 0 ? -6 : 1 - now.getDay();
    const thisMonday = new Date(now);
    thisMonday.setDate(now.getDate() + mondayOffset);
    const nextMonday = new Date(thisMonday);
    nextMonday.setDate(thisMonday.getDate() + 7);

    const weeks = [
      thisMonday.toISOString().split('T')[0]!,
      nextMonday.toISOString().split('T')[0]!,
    ];

    const rows = await db.select()
      .from(pulseWeekAvailability)
      .where(and(
        eq(pulseWeekAvailability.userId, userId),
        gte(pulseWeekAvailability.weekStart, weeks[0]!),
      ))
      .limit(4);

    const [profile] = await db.select({ weeklyHours: pulseUserProfile.weeklyHoursTarget })
      .from(pulseUserProfile).where(eq(pulseUserProfile.userId, userId));

    const defaults = { availableDays: [0, 2, 4, 5], weeklyHours: profile?.weeklyHours ?? 8 };

    return {
      weeks: weeks.map(w => {
        const row = rows.find(r => r.weekStart === w);
        return {
          weekStart: w,
          availableDays: (row?.availableDays as number[]) ?? defaults.availableDays,
          weeklyHours: row?.weeklyHours ?? defaults.weeklyHours,
          notes: row?.notes ?? null,
          isCustom: !!row,
        };
      }),
    };
  });

  app.put('/plan/availability/:weekStart', { onRequest: [app.authenticate] }, async (req, reply) => {
    const userId = req.user.sub;
    const { weekStart } = req.params as { weekStart: string };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) return reply.status(400).send({ error: 'Ungültiges Datum' });

    const schema = z.object({
      availableDays: z.array(z.number().min(0).max(6)).min(1).max(7),
      weeklyHours:   z.number().min(1).max(40),
      notes:         z.string().max(200).optional(),
      regenerate:    z.boolean().optional().default(true),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Ungültige Eingabe' });

    await db.insert(pulseWeekAvailability).values({
      userId, weekStart,
      availableDays: parsed.data.availableDays,
      weeklyHours:   parsed.data.weeklyHours,
      notes:         parsed.data.notes ?? null,
    }).onConflictDoUpdate({
      target: [pulseWeekAvailability.userId, pulseWeekAvailability.weekStart],
      set: {
        availableDays: parsed.data.availableDays,
        weeklyHours:   parsed.data.weeklyHours,
        notes:         parsed.data.notes ?? null,
      },
    });

    if (!parsed.data.regenerate) return { ok: true };

    // Auto-regenerate plan for this week
    const [profile] = await db.select().from(pulseUserProfile).where(eq(pulseUserProfile.userId, userId));
    const explicitPhase = profile?.trainingPhase as 'base' | 'build' | 'peak' | 'taper' | null | undefined;
    const derivedPhase = await deriveCurrentPhase(userId, weekStart);
    const phase: 'base' | 'build' | 'peak' | 'taper' =
      (explicitPhase && explicitPhase !== 'base') ? explicitPhase : derivedPhase;
    const since42d = new Date(Date.now() - 42 * 86_400_000);
    const today = new Date().toISOString().split('T')[0]!;
    const [fitnessLoad, recentActs2, goals2, recentFeedback2, activeHealthStates2, riskSignalRows2] = await Promise.all([
      computeFitnessLoad(userId, weekStart),
      db.select({
        id:            pulseActivities.id,
        startTime:    pulseActivities.startTime,
        activityType: pulseActivities.activityType,
        durationSec:  pulseActivities.durationSec,
        tss:          pulseActivities.tss,
        rpe:          pulseActivities.rpe,
      }).from(pulseActivities)
        .where(and(eq(pulseActivities.userId, userId), gte(pulseActivities.startTime, since42d)))
        .orderBy(desc(pulseActivities.startTime)).limit(80),
      db.select({
        title:          pulseGoals.title,
        targetDate:     pulseGoals.targetDate,
        category:       pulseGoals.category,
        metrics:        pulseGoals.metrics,
        raceDiscipline: pulseGoals.raceDiscipline,
        raceDistanceKm: pulseGoals.raceDistanceKm,
        racePriority:   pulseGoals.racePriority,
      })
        .from(pulseGoals)
        .where(and(eq(pulseGoals.userId, userId), eq(pulseGoals.status, 'active')))
        .limit(5),
      db.select({
        plannedDate:     pulsePlannedWorkouts.plannedDate,
        activityType:    pulsePlannedWorkouts.activityType,
        zone:            pulsePlannedWorkouts.zone,
        durationMin:     pulsePlannedWorkouts.durationMin,
        workoutFeedback: pulsePlannedWorkouts.workoutFeedback,
        complianceScore: pulsePlannedWorkouts.complianceScore,
      }).from(pulsePlannedWorkouts)
        .where(and(
          eq(pulsePlannedWorkouts.userId, userId),
          eq(pulsePlannedWorkouts.status, 'completed'),
          gte(pulsePlannedWorkouts.plannedDate, since42d.toISOString().split('T')[0]!),
        ))
        .orderBy(desc(pulsePlannedWorkouts.plannedDate))
        .limit(10),
      db.select().from(pulseHealthState)
        .where(and(
          eq(pulseHealthState.userId, userId),
          isNull(pulseHealthState.resolvedAt),
          or(isNull(pulseHealthState.endDate), gte(pulseHealthState.endDate, today)),
        )),
      getActiveRiskSignals(userId),
    ]);
    const activeRaces2 = await getActiveRaces(userId, weekStart);
    const plannedZoneByActivityId2 = await getPlannedZoneByActivityId(userId, recentActs2.map(a => a.id));
    const recentPlanActivities2 = recentActs2.map(a => ({
      date:         a.startTime.toISOString().split('T')[0]!,
      activityType: a.activityType,
      durationMin:  Math.round((a.durationSec ?? 0) / 60),
      tss:          a.tss ?? 0,
      rpe:          a.rpe,
      plannedZone:  plannedZoneByActivityId2.get(a.id) ?? null,
    }));
    const planGoals2 = goals2.map(g => ({
      ...g,
      metrics: (g.metrics as Record<string, unknown> | null) ?? null,
      racePriority: normalizeRacePriority(g.racePriority),
    }));
    const riskSignals2 = riskSignalRows2.map(r => ({
      ruleId: r.ruleId,
      severity: r.severity as 'info' | 'warn' | 'critical',
      title: r.title,
      recommendation: r.recommendation,
    }));

    let generated: Awaited<ReturnType<typeof generateWeekWorkouts>>;
    try {
      generated = await generateScientificWeekPlan({
        weekStart, phase,
        weeklyHoursTarget: parsed.data.weeklyHours,
        availableDays:     parsed.data.availableDays,
        ctl: fitnessLoad.ctl, atl: fitnessLoad.atl, tsb: fitnessLoad.tsb,
        ftpWatts:  profile?.ftpWatts ?? 250,
        maxHrBpm:  profile?.maxHrBpm ?? 185,
        lthrBpm:   profile?.lthrBpm ?? undefined,
        recentActivities: recentPlanActivities2,
        goals: planGoals2,
        riskSignals: riskSignals2,
        recentFeedback: recentFeedback2
          .filter(w => w.workoutFeedback != null)
          .map(w => ({
            date:               w.plannedDate,
            activityType:       w.activityType,
            plannedZone:        w.zone,
            plannedDurationMin: w.durationMin,
            feedback:           w.workoutFeedback!,
            complianceScore:    w.complianceScore ?? 0.7,
          })),
        healthStates: activeHealthStates2.map(s => ({
          type:      s.type as 'illness' | 'injury' | 'fatigue' | 'travel',
          severity:  s.severity as 'mild' | 'moderate' | 'severe',
          bodyPart:  s.bodyPart,
          startDate: s.startDate,
          endDate:   s.endDate,
          notes:     s.notes,
        })),
        races: activeRaces2.map(r => ({
          title:      r.title,
          date:       r.date,
          daysUntil:  r.daysUntil,
          priority:   r.priority,
          discipline: r.discipline,
          distanceKm: r.distanceKm,
        })),
      });
    } catch {
      generated = generateWeekWorkouts({ weekStart, phase, weeklyHoursTarget: parsed.data.weeklyHours, availableDays: parsed.data.availableDays });
    }

    // Clean up old Garmin workouts before deleting (prevents duplicates)
    const oldAvailWorkouts = await db.select({
      garminWorkoutId:   pulsePlannedWorkouts.garminWorkoutId,
      garminScheduledId: pulsePlannedWorkouts.garminScheduledId,
    }).from(pulsePlannedWorkouts).where(and(
      eq(pulsePlannedWorkouts.userId, userId),
      gte(pulsePlannedWorkouts.plannedDate, weekStart),
      eq(pulsePlannedWorkouts.status, 'planned'),
    ));
    const oldAvailWithGarmin = oldAvailWorkouts.filter(w => w.garminWorkoutId);
    if (oldAvailWithGarmin.length > 0) {
      try {
        const { getGarminClient } = await import('../lib/garmin-client.js');
        const gc = await getGarminClient();
        await Promise.allSettled(oldAvailWithGarmin.map(async (w) => {
          if (w.garminScheduledId) {
            await gc.client.delete(`https://connectapi.garmin.com/workout-service/schedule/${w.garminScheduledId}`);
          }
          await gc.client.delete(`https://connectapi.garmin.com/workout-service/workout/${w.garminWorkoutId}`);
        }));
      } catch { /* non-fatal */ }
    }

    await db.delete(pulsePlannedWorkouts).where(and(
      eq(pulsePlannedWorkouts.userId, userId),
      gte(pulsePlannedWorkouts.plannedDate, weekStart),
      eq(pulsePlannedWorkouts.status, 'planned'),
    ));

    const inserted2 = await db.insert(pulsePlannedWorkouts).values(
      generated.map(w => ({ userId, plannedDate: w.plannedDate, activityType: w.activityType, zone: w.zone, durationMin: w.durationMin, targetTss: w.targetTss, description: w.description })),
    ).returning();

    const workouts = await Promise.all(
      inserted2.map(async (w) => {
        try {
          const { steps, updatedDescription } = await buildWorkoutSteps(w, profile ?? undefined);
          await db.update(pulsePlannedWorkouts)
            .set({ steps, description: updatedDescription })
            .where(eq(pulsePlannedWorkouts.id, w.id));
          return { ...w, steps, description: updatedDescription };
        } catch {
          return w;
        }
      }),
    );

    return { ok: true, workouts };
  });

  // ─── Weekly review ────────────────────────────────────────────────────────────
  app.get('/review/latest', { onRequest: [app.authenticate] }, async (req) => {
    const userId = req.user.sub;
    const [review] = await db.select()
      .from(pulseWeeklyReviews)
      .where(eq(pulseWeeklyReviews.userId, userId))
      .orderBy(desc(pulseWeeklyReviews.weekStart))
      .limit(1);
    return review ?? null;
  });

  app.post('/review/generate', { onRequest: [app.authenticate] }, async (req) => {
    const userId = req.user.sub;
    const now = new Date();
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const lastMonday = new Date(now);
    lastMonday.setDate(now.getDate() + mondayOffset - 7);
    const weekStartStr = lastMonday.toISOString().split('T')[0]!;
    return generateWeeklyReview(userId, weekStartStr);
  });

  // ─── Daily metrics history ─────────────────────────────────────────────────────
  app.get('/metrics', { onRequest: [app.authenticate] }, async (req) => {
    const userId = req.user.sub;
    const days = Math.min(Number((req.query as { days?: string }).days ?? 14), 90);
    const since = new Date(Date.now() - days * 86_400_000).toISOString().split('T')[0]!;
    const metrics = await db.select({
      date:           pulseDailyMetrics.date,
      hrvRmssd:       pulseDailyMetrics.hrvRmssd,
      restingHr:      pulseDailyMetrics.restingHr,
      sleepHours:     pulseDailyMetrics.sleepHours,
      sleepScore:     pulseDailyMetrics.sleepScore,
      bodyBatteryMax: pulseDailyMetrics.bodyBatteryMax,
      stressAvg:      pulseDailyMetrics.stressAvg,
      steps:          pulseDailyMetrics.steps,
    }).from(pulseDailyMetrics)
      .where(and(eq(pulseDailyMetrics.userId, userId), gte(pulseDailyMetrics.date, since)))
      .orderBy(pulseDailyMetrics.date);
    return { metrics };
  });

  // ─── Weight log ────────────────────────────────────────────────────────────────
  app.get('/weight', { onRequest: [app.authenticate] }, async (req) => {
    const userId = req.user.sub;
    const days = Math.min(Number((req.query as { days?: string }).days ?? 90), 365);
    const since = new Date(Date.now() - days * 86_400_000).toISOString().split('T')[0]!;
    const entries = await db.select({
      id: pulseWeightLog.id, date: pulseWeightLog.date,
      weightKg: pulseWeightLog.weightKg,
      bodyFatPct: pulseWeightLog.bodyFatPct,
      muscleMassKg: pulseWeightLog.muscleMassKg,
      bmi: pulseWeightLog.bmi,
      source: pulseWeightLog.source,
      notes: pulseWeightLog.notes,
    }).from(pulseWeightLog)
      .where(and(eq(pulseWeightLog.userId, userId), gte(pulseWeightLog.date, since)))
      .orderBy(desc(pulseWeightLog.date));
    return { entries };
  });

  app.post('/weight', { onRequest: [app.authenticate] }, async (req, reply) => {
    const schema = z.object({
      weightKg: z.number().min(30).max(300),
      date:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      notes:    z.string().max(500).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Ungültige Eingabe' });

    const userId = req.user.sub;
    const date = parsed.data.date ?? new Date().toISOString().split('T')[0]!;
    const [entry] = await db.insert(pulseWeightLog).values({
      userId, date, weightKg: parsed.data.weightKg, notes: parsed.data.notes ?? null,
    }).onConflictDoUpdate({
      target: [pulseWeightLog.userId, pulseWeightLog.date],
      set: { weightKg: parsed.data.weightKg, notes: parsed.data.notes ?? null },
    }).returning();
    return reply.status(201).send(entry);
  });

  // ─── User profile (FTP, maxHR, weeklyHours, phase) ───────────────────────────
  app.get('/profile', { onRequest: [app.authenticate] }, async (req) => {
    const userId = req.user.sub;
    const [profile] = await db.select().from(pulseUserProfile).where(eq(pulseUserProfile.userId, userId));
    return profile ?? { userId, ftpWatts: null, maxHrBpm: null, restingHrBpm: null, weightKg: null, vo2max: null, trainingPhase: 'base', weeklyHoursTarget: null };
  });

  app.patch('/profile', { onRequest: [app.authenticate] }, async (req, reply) => {
    const schema = z.object({
      ftpWatts:          z.number().int().min(50).max(600).optional(),
      maxHrBpm:          z.number().int().min(100).max(250).optional(),
      restingHrBpm:      z.number().int().min(30).max(100).optional(),
      weeklyHoursTarget: z.number().min(1).max(40).optional(),
      trainingPhase:     z.enum(['base','build','peak','taper']).optional(),
      vo2max:            z.number().min(20).max(100).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Ungültige Eingabe' });

    const userId = req.user.sub;
    const [profile] = await db.insert(pulseUserProfile)
      .values({ userId, ...parsed.data, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: pulseUserProfile.userId,
        set: { ...parsed.data, updatedAt: new Date() },
      }).returning();
    return profile;
  });

  // ─── Garmin profile sync (VO2max, maxHR, threshold HR) ──────────────────────
  app.post('/garmin/sync-profile', { onRequest: [app.authenticate] }, async (req) => {
    const userId = req.user.sub;
    const gc = await import('../lib/garmin-client.js').then(m => m.getGarminClient());

    const settings = await gc.getUserSettings() as any;
    const ud = settings?.userData ?? {};

    const vo2max: number | null = ud.vo2MaxRunning != null && ud.vo2MaxCycling != null
      ? Math.round((ud.vo2MaxRunning + ud.vo2MaxCycling) / 2)
      : (ud.vo2MaxRunning ?? ud.vo2MaxCycling ?? null);

    const garminMaxHrBpm: number | null = ud.lactateThresholdHeartRate
      ? Math.round(ud.lactateThresholdHeartRate / 0.89)
      : null;
    const lthrBpm: number | null = ud.lactateThresholdHeartRate != null
      ? Math.round(ud.lactateThresholdHeartRate)
      : null;

    // Derive maxHR from recorded activities — most accurate source
    const { max } = await import('drizzle-orm');
    const [activityMaxRow] = await db.select({ maxHrRecorded: max(pulseActivities.maxHr) })
      .from(pulseActivities)
      .where(eq(pulseActivities.userId, userId));

    const maxHrBpm: number | null = activityMaxRow?.maxHrRecorded ?? garminMaxHrBpm;

    // FTP from best 20-min power across all activities (standard: best20min × 0.95)
    let ftpWatts: number | null = null;
    try {
      const allActivities = await gc.getActivities(0, 200) as any[];
      const best20min = allActivities
        .map((a: any) => a.max20MinPower as number | undefined)
        .filter((p): p is number => p != null && p > 0)
        .reduce((best, p) => Math.max(best, p), 0);
      if (best20min > 0) ftpWatts = Math.round(best20min * 0.95);
    } catch {
      // non-fatal — continue without FTP
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (vo2max != null)   updates.vo2max = vo2max;
    if (maxHrBpm != null) updates.maxHrBpm = maxHrBpm;
    if (lthrBpm != null)  updates.lthrBpm = lthrBpm;
    if (ftpWatts != null) updates.ftpWatts = ftpWatts;

    await db.insert(pulseUserProfile)
      .values({ userId, ...updates } as any)
      .onConflictDoUpdate({ target: pulseUserProfile.userId, set: updates as any });

    return { synced: { vo2max, maxHrBpm, lactateThresholdHr: lthrBpm, ftpWatts } };
  });

  // ─── Garmin manual sync ───────────────────────────────────────────────────────
  app.post('/garmin/sync', { onRequest: [app.authenticate] }, async (req, reply) => {
    const parsed = garminSyncSchema.safeParse(req.body ?? {});
    if (!parsed.success) return reply.status(400).send({ error: 'Ungültige Eingabe' });
    if (env.NODE_ENV === 'test') {
      return { status: 'skipped', days: parsed.data.days, dates: [], activities: 0 };
    }

    const userId = req.user.sub;
    const today = new Date();
    const dates = Array.from({ length: parsed.data.days }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - (parsed.data.days - 1 - i));
      return d;
    });
    try {
      const results = [];
      for (const date of dates) results.push(await syncGarminDay(userId, date, app));
      await invalidateUser(userId);
      return {
        status: 'synced',
        days: parsed.data.days,
        dates: results.map(r => r.date),
        activities: results.reduce((sum, r) => sum + r.activities, 0),
      };
    } catch (err) {
      app.log.error(`Pulse Garmin sync failed: ${err}`);
      return reply.status(502).send({ error: 'Garmin sync fehlgeschlagen. Zugangsdaten prüfen.' });
    }
  });

  // ─── Morning Briefing ─────────────────────────────────────────────────────────
  app.get('/briefing', { onRequest: [app.authenticate] }, async (req) => {
    const userId = req.user.sub;
    const today = new Date().toISOString().split('T')[0]!;

    const cached = await getCached<string>('briefing', userId, today);
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
      await setCached('briefing', userId, today, briefing);
      return { briefing, date: today, cached: false, raceDay: true };
    }

    let userContent = buildBriefingUserContentRich(ctx, ctx.todayCheckin ? 'check-in' : 'garmin-alarm');
    const plannedToday = ctx.upcomingWorkouts.find(w => w.plannedDate === today) ?? null;
    const isOutdoorSport = plannedToday &&
      (plannedToday.activityType === 'bike' || plannedToday.activityType === 'run' || plannedToday.activityType === 'hike');
    if (isOutdoorSport && ctx.profile?.homeLat != null && ctx.profile?.homeLon != null) {
      try {
        const { getCurrentWeather } = await import('../lib/weather.js');
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

    await setCached('briefing', userId, today, briefing);

    return { briefing, date: today, cached: false };
  });

  // GET /api/pulse/insights?domain=sleep|hrv|load|weight|mental|overall&days=30&refresh=false
  app.get('/insights', { onRequest: [app.authenticate] }, async (req) => {
    const userId = req.user.sub;
    const query = req.query as { domain?: string; days?: string; refresh?: string };
    const domain = (query.domain ?? 'overall') as InsightDomain;
    const days = Math.min(90, Math.max(7, parseInt(query.days ?? '30', 10)));
    const forceRefresh = query.refresh === 'true';
    const validDomains: InsightDomain[] = ['sleep', 'hrv', 'load', 'weight', 'mental', 'overall'];
    if (!validDomains.includes(domain)) {
      return { error: 'Invalid domain' };
    }
    return generateDeepInsight(userId, domain, days, forceRefresh);
  });

  // GET /api/pulse/correlations?days=30
  app.get('/correlations', { onRequest: [app.authenticate] }, async (req) => {
    const userId = req.user.sub;
    const q = req.query as { days?: string };
    const days = Math.min(90, Math.max(14, parseInt(q.days ?? '30', 10)));
    const since = new Date(Date.now() - days * 86_400_000).toISOString().split('T')[0]!;

    const [metricsRows, checkinRows] = await Promise.all([
      db.select({
        date: pulseDailyMetrics.date,
        sleepHours:     pulseDailyMetrics.sleepHours,
        hrvRmssd:       pulseDailyMetrics.hrvRmssd,
        bodyBatteryMax: pulseDailyMetrics.bodyBatteryMax,
        stressAvg:      pulseDailyMetrics.stressAvg,
        restingHr:      pulseDailyMetrics.restingHr,
      }).from(pulseDailyMetrics)
        .where(and(eq(pulseDailyMetrics.userId, userId), gte(pulseDailyMetrics.date, since)))
        .orderBy(pulseDailyMetrics.date),
      db.select({
        date: pulseMentalCheckins.date,
        mood:       pulseMentalCheckins.mood,
        energy:     pulseMentalCheckins.energy,
        stress:     pulseMentalCheckins.stress,
        motivation: pulseMentalCheckins.motivation,
      }).from(pulseMentalCheckins)
        .where(and(eq(pulseMentalCheckins.userId, userId), gte(pulseMentalCheckins.date, since)))
        .orderBy(pulseMentalCheckins.date),
    ]);

    const mByDate = new Map(metricsRows.map(r => [r.date, r]));
    const cByDate = new Map(checkinRows.map(r => [r.date, r]));
    const allDates = [...new Set([...metricsRows.map(r => r.date), ...checkinRows.map(r => r.date)])].sort();

    function pearson(pairs: [number, number][]): number {
      const n = pairs.length;
      if (n < 3) return 0;
      const mx = pairs.reduce((s, p) => s + p[0], 0) / n;
      const my = pairs.reduce((s, p) => s + p[1], 0) / n;
      const num = pairs.reduce((s, p) => s + (p[0] - mx) * (p[1] - my), 0);
      const den = Math.sqrt(
        pairs.reduce((s, p) => s + (p[0] - mx) ** 2, 0) *
        pairs.reduce((s, p) => s + (p[1] - my) ** 2, 0),
      );
      return den === 0 ? 0 : Math.round((num / den) * 100) / 100;
    }

    type XYFn = (date: string) => number | null | undefined;
    function buildPairs(xFn: XYFn, yFn: XYFn) {
      return allDates.flatMap(d => {
        const x = xFn(d), y = yFn(d);
        return x != null && y != null ? [{ date: d, x, y }] : [];
      });
    }

    const defs = [
      { id: 'sleep_hrv',      labelX: 'Schlaf (h)', labelY: 'HRV (ms)',         xFn: (d: string) => mByDate.get(d)?.sleepHours,     yFn: (d: string) => mByDate.get(d)?.hrvRmssd },
      { id: 'sleep_battery',  labelX: 'Schlaf (h)', labelY: 'Body Battery (%)', xFn: (d: string) => mByDate.get(d)?.sleepHours,     yFn: (d: string) => mByDate.get(d)?.bodyBatteryMax },
      { id: 'stress_hrv',     labelX: 'Stress',     labelY: 'HRV (ms)',         xFn: (d: string) => mByDate.get(d)?.stressAvg,      yFn: (d: string) => mByDate.get(d)?.hrvRmssd },
      { id: 'mood_energy',    labelX: 'Stimmung',   labelY: 'Energie',          xFn: (d: string) => cByDate.get(d)?.mood,           yFn: (d: string) => cByDate.get(d)?.energy },
      { id: 'hrv_motivation', labelX: 'HRV (ms)',   labelY: 'Motivation',       xFn: (d: string) => mByDate.get(d)?.hrvRmssd,       yFn: (d: string) => cByDate.get(d)?.motivation },
      { id: 'sleep_stress',   labelX: 'Schlaf (h)', labelY: 'Stress',           xFn: (d: string) => mByDate.get(d)?.sleepHours,     yFn: (d: string) => mByDate.get(d)?.stressAvg },
    ];

    const correlations = defs.map(({ id, labelX, labelY, xFn, yFn }) => {
      const points = buildPairs(xFn, yFn);
      return { id, labelX, labelY, r: pearson(points.map(p => [p.x, p.y])), n: points.length, points };
    });

    return { correlations };
  });

  // GET /api/pulse/training-analytics?weeks=12
  app.get('/training-analytics', { onRequest: [app.authenticate] }, async (req) => {
    const userId = req.user.sub;
    const q = req.query as { weeks?: string };
    const weeks = Math.min(24, Math.max(4, parseInt(q.weeks ?? '12', 10)));
    const since = new Date(Date.now() - weeks * 7 * 86_400_000);
    const today = new Date().toISOString().split('T')[0]!;

    const [activities, profileRows] = await Promise.all([
      db.select({
        id:               pulseActivities.id,
        startTime:        pulseActivities.startTime,
        activityType:     pulseActivities.activityType,
        durationSec:      pulseActivities.durationSec,
        tss:              pulseActivities.tss,
        normalizedPowerW: pulseActivities.normalizedPowerW,
        vo2maxEstimate:   pulseActivities.vo2maxEstimate,
        rpe:              pulseActivities.rpe,
      }).from(pulseActivities)
        .where(and(eq(pulseActivities.userId, userId), gte(pulseActivities.startTime, since)))
        .orderBy(pulseActivities.startTime),
      db.select({ ftpWatts: pulseUserProfile.ftpWatts })
        .from(pulseUserProfile).where(eq(pulseUserProfile.userId, userId)).limit(1),
    ]);

    const ftp = profileRows[0]?.ftpWatts ?? null;
    const ratedActivityIds = activities.filter(a => a.rpe != null).map(a => a.id);
    const completedPlans = ratedActivityIds.length > 0
      ? await db.select({
          completedActivityId: pulsePlannedWorkouts.completedActivityId,
          zone: pulsePlannedWorkouts.zone,
        }).from(pulsePlannedWorkouts)
          .where(and(
            eq(pulsePlannedWorkouts.userId, userId),
            inArray(pulsePlannedWorkouts.completedActivityId, ratedActivityIds),
          ))
      : [];
    const plannedZoneByActivityId = new Map(completedPlans.map(p => [p.completedActivityId, p.zone]));

    // ── TSS Heatmap: one entry per day ────────────────────────────────────────
    const tssByDate = new Map<string, number>();
    for (const a of activities) {
      const d = a.startTime.toISOString().split('T')[0]!;
      tssByDate.set(d, (tssByDate.get(d) ?? 0) + (a.tss ?? 0));
    }

    const tssHeatmap: Array<{ date: string; tss: number }> = [];
    const cur = new Date(since);
    while (cur.toISOString().split('T')[0]! <= today) {
      const ds = cur.toISOString().split('T')[0]!;
      tssHeatmap.push({ date: ds, tss: Math.round(tssByDate.get(ds) ?? 0) });
      cur.setDate(cur.getDate() + 1);
    }

    // ── Zone distribution per ISO week ────────────────────────────────────────
    function getZone(a: typeof activities[0]): number | null {
      const plannedZone = plannedZoneByActivityId.get(a.id);
      if (plannedZone != null) return plannedZone;
      if (ftp && a.normalizedPowerW && a.activityType === 'bike') {
        const IF = a.normalizedPowerW / ftp;
        if (IF < 0.55) return 1;
        if (IF < 0.75) return 2;
        if (IF < 0.87) return 3;
        if (IF < 0.95) return 4;
        return 5;
      }
      if (a.tss && a.durationSec && a.durationSec > 0) {
        const tssH = (a.tss / a.durationSec) * 3600;
        if (tssH < 45)  return 1;
        if (tssH < 65)  return 2;
        if (tssH < 85)  return 3;
        if (tssH < 100) return 4;
        return 5;
      }
      return null;
    }

    function weekStart(d: Date): string {
      const day = d.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      const mon = new Date(d);
      mon.setDate(d.getDate() + diff);
      return mon.toISOString().split('T')[0]!;
    }

    type ZoneMap = { z1: number; z2: number; z3: number; z4: number; z5: number };
    const zByWeek = new Map<string, ZoneMap>();
    for (const a of activities) {
      const zone = getZone(a);
      if (!zone || !a.durationSec) continue;
      const ws = weekStart(a.startTime);
      const entry = zByWeek.get(ws) ?? { z1: 0, z2: 0, z3: 0, z4: 0, z5: 0 };
      entry[`z${zone}` as keyof ZoneMap] += a.durationSec / 3600;
      zByWeek.set(ws, entry);
    }

    const zoneDistribution = [...zByWeek.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([ws, z]) => ({
        weekStart: ws,
        zones: {
          z1: Math.round(z.z1 * 10) / 10, z2: Math.round(z.z2 * 10) / 10,
          z3: Math.round(z.z3 * 10) / 10, z4: Math.round(z.z4 * 10) / 10,
          z5: Math.round(z.z5 * 10) / 10,
        },
        totalH: Math.round((z.z1 + z.z2 + z.z3 + z.z4 + z.z5) * 10) / 10,
      }));

    // ── VO2max trend ──────────────────────────────────────────────────────────
    const vo2maxTrend = activities
      .filter(a => a.vo2maxEstimate != null)
      .map(a => ({ date: a.startTime.toISOString().split('T')[0]!, vo2max: a.vo2maxEstimate! }));

    const recentRpe = new Map<number, { sum: number; count: number }>();
    const previousRpe = new Map<number, { sum: number; count: number }>();
    const now = new Date();
    const recentCutoff = new Date(now.getTime() - 30 * 86_400_000);
    const previousCutoff = new Date(now.getTime() - 60 * 86_400_000);
    for (const a of activities) {
      if (a.rpe == null) continue;
      const zone = getZone(a);
      if (!zone) continue;
      const bucket = a.startTime >= recentCutoff
        ? recentRpe
        : a.startTime >= previousCutoff
        ? previousRpe
        : null;
      if (!bucket) continue;
      const entry = bucket.get(zone) ?? { sum: 0, count: 0 };
      entry.sum += a.rpe;
      entry.count += 1;
      bucket.set(zone, entry);
    }
    const rpeByZone = [1, 2, 3, 4, 5].map(zone => {
      const recent = recentRpe.get(zone);
      const previous = previousRpe.get(zone);
      const avgRpe = recent && recent.count > 0 ? Math.round((recent.sum / recent.count) * 10) / 10 : null;
      const previousAvgRpe = previous && previous.count > 0 ? Math.round((previous.sum / previous.count) * 10) / 10 : null;
      const drift = avgRpe != null && previousAvgRpe != null ? Math.round((avgRpe - previousAvgRpe) * 10) / 10 : null;
      return { zone, avgRpe, count: recent?.count ?? 0, previousAvgRpe, drift };
    });
    const totalRated = [...recentRpe.values()].reduce((sum, z) => sum + z.count, 0);

    return { weeks, tssHeatmap, zoneDistribution, vo2maxTrend, rpeByZone: { totalRated, zones: rpeByZone } };
  });
}

// local type aliases to avoid 'as any'
type PulseDailyMetricsHrvStatus = 'poor' | 'below_normal' | 'normal' | 'above_normal' | null;
type PulseActivityType = 'run' | 'bike' | 'swim' | 'strength' | 'hike' | 'other';
type PulseWorkoutStatus = 'planned' | 'completed' | 'skipped';
