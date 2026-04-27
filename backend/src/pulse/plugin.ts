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
} from '../db/pulse-schema.js';
import { eq, desc, and, gte } from 'drizzle-orm';
import type { PulseHomeScreenData, PulseCoachMessage } from '@coaching-os/shared/pulse';
import { computeFitnessLoad, computeReadinessScore } from './services/load-engine.js';
import { getPrognosis } from './services/prognosis-engine.js';
import { getCoachReply, classifyAndExtractCheckin, type CheckinClassification } from './services/coach-engine.js';
import { transcribeAudio } from '../lib/whisper.js';
import { generateWeekWorkouts, generateLLMWeekPlan } from './services/plan-engine.js';
import { generateWeeklyReview } from './services/review-engine.js';
import { pulseQueues } from './queues/queues.js';

const coachMessageSchema = z.object({
  message: z.string().min(1).max(2000),
});

// ─── Plugin ───────────────────────────────────────────────────────────────────

export default async function pulsePlugin(app: FastifyInstance) {
  // Public health check
  app.get('/health', async () => ({ status: 'ok', namespace: 'pulse' }));

  // All routes below require JWT
  app.get('/home', { onRequest: [app.authenticate] }, async (req): Promise<PulseHomeScreenData> => {
    const userId = req.user.sub;
    const today = new Date().toISOString().split('T')[0]!;

    const [metrics] = await db.select()
      .from(pulseDailyMetrics)
      .where(and(eq(pulseDailyMetrics.userId, userId), eq(pulseDailyMetrics.date, today)));

    const [mental] = await db.select()
      .from(pulseMentalCheckins)
      .where(and(eq(pulseMentalCheckins.userId, userId), eq(pulseMentalCheckins.date, today)));

    const recentActivities = await db.select()
      .from(pulseActivities)
      .where(eq(pulseActivities.userId, userId))
      .orderBy(desc(pulseActivities.startTime))
      .limit(3);

    const [nextWorkout] = await db.select()
      .from(pulsePlannedWorkouts)
      .where(and(
        eq(pulsePlannedWorkouts.userId, userId),
        eq(pulsePlannedWorkouts.status, 'planned'),
        gte(pulsePlannedWorkouts.plannedDate, today),
      ))
      .orderBy(pulsePlannedWorkouts.plannedDate)
      .limit(1);

    const [fitnessLoad, prognosis] = await Promise.all([
      computeFitnessLoad(userId, today),
      getPrognosis(userId),
    ]);

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
      })),
      nextWorkout: nextWorkout ? {
        id: nextWorkout.id, userId: nextWorkout.userId,
        plannedDate: nextWorkout.plannedDate, activityType: nextWorkout.activityType as PulseActivityType,
        zone: nextWorkout.zone, durationMin: nextWorkout.durationMin,
        distanceKm: nextWorkout.distanceKm, targetTss: nextWorkout.targetTss,
        description: nextWorkout.description, status: nextWorkout.status as PulseWorkoutStatus,
      } : null,
      prognosis,
    };
  });

  app.post('/coach', { onRequest: [app.authenticate] }, async (req, reply) => {
    const parsed = coachMessageSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Ungültige Nachricht' });

    const userId = req.user.sub;
    const today = new Date().toISOString().split('T')[0]!;

    const [metrics] = await db.select()
      .from(pulseDailyMetrics)
      .where(and(eq(pulseDailyMetrics.userId, userId), eq(pulseDailyMetrics.date, today)));

    const [mental] = await db.select()
      .from(pulseMentalCheckins)
      .where(and(eq(pulseMentalCheckins.userId, userId), eq(pulseMentalCheckins.date, today)));

    const fitnessLoad = await computeFitnessLoad(userId, today);

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

    const replyText = await getCoachReply(parsed.data.message, {
      readiness:      readiness.score,
      sleepHours:     metrics?.sleepHours ?? null,
      hrvStatus:      metrics?.hrvStatus ?? null,
      bodyBatteryMax: metrics?.bodyBatteryMax ?? null,
      tsb:            fitnessLoad.tsb,
      stressAvg:      metrics?.stressAvg ?? null,
    });

    const userMsg: PulseCoachMessage = {
      role: 'user',
      content: parsed.data.message,
      timestamp: new Date().toISOString(),
    };
    const assistantMsg: PulseCoachMessage = {
      role: 'assistant',
      content: replyText,
      timestamp: new Date().toISOString(),
    };

    const [existingSession] = await db.select({ id: pulseCoachSessions.id, messages: pulseCoachSessions.messages })
      .from(pulseCoachSessions)
      .where(eq(pulseCoachSessions.userId, userId))
      .orderBy(desc(pulseCoachSessions.lastMessageAt))
      .limit(1);

    if (existingSession) {
      const msgs = existingSession.messages as PulseCoachMessage[];
      const updated = [...msgs.slice(-20), userMsg, assistantMsg];
      await db.update(pulseCoachSessions)
        .set({ messages: updated, lastMessageAt: new Date() })
        .where(eq(pulseCoachSessions.id, existingSession.id));
    } else {
      await db.insert(pulseCoachSessions).values({
        userId,
        messages: [userMsg, assistantMsg],
      });
    }

    return { reply: replyText };
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
    }

    // 4. Coach-Antwort in Session speichern
    const userMsg: PulseCoachMessage = { role: 'user',      content: transcript,                timestamp: new Date().toISOString() };
    const botMsg:  PulseCoachMessage = { role: 'assistant', content: classification.coachReply, timestamp: new Date().toISOString() };

    const [session] = await db.select({ id: pulseCoachSessions.id, messages: pulseCoachSessions.messages })
      .from(pulseCoachSessions)
      .where(eq(pulseCoachSessions.userId, userId))
      .orderBy(desc(pulseCoachSessions.lastMessageAt))
      .limit(1);

    if (session) {
      const msgs = session.messages as PulseCoachMessage[];
      await db.update(pulseCoachSessions)
        .set({ messages: [...msgs.slice(-20), userMsg, botMsg], lastMessageAt: new Date() })
        .where(eq(pulseCoachSessions.id, session.id));
    } else {
      await db.insert(pulseCoachSessions).values({ userId, messages: [userMsg, botMsg] });
    }

    return {
      transcript,
      reply:             classification.coachReply,
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

  // ─── Sleep sessions ───────────────────────────────────────────────────────────
  app.get('/sleep', { onRequest: [app.authenticate] }, async (req) => {
    const userId = req.user.sub;
    const limit = Math.min(Number((req.query as { limit?: string }).limit ?? 7), 30);
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

    // If rawData already cached, return it
    if (activity.rawData && (activity.rawData as any).laps) {
      return { activity: { ...activity, startTime: activity.startTime.toISOString() }, ...(activity.rawData as any) };
    }

    // Fetch laps + HR zones from Garmin if externalId available
    let laps: any[] = [];
    let hrZones: { zone: number; secsInZone: number; zoneLowBoundary: number }[] = [];

    if (activity.externalId) {
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

    return {
      activity: { ...activity, startTime: activity.startTime.toISOString() },
      laps,
      hrZones,
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

  app.post('/plan/generate', { onRequest: [app.authenticate] }, async (req, reply) => {
    const userId = req.user.sub;
    const now = new Date();
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() + mondayOffset);
    const weekStartStr = weekStart.toISOString().split('T')[0]!;

    const [profile] = await db.select()
      .from(pulseUserProfile)
      .where(eq(pulseUserProfile.userId, userId));

    const phase = (profile?.trainingPhase ?? 'base') as 'base' | 'build' | 'peak' | 'taper';
    const weeklyHoursTarget = profile?.weeklyHoursTarget ?? 8;
    const availableDays = [1, 3, 5, 6];

    const fitnessLoad = await computeFitnessLoad(userId, weekStartStr);
    const recentActs = await db.select({
      activityType: pulseActivities.activityType,
      durationSec:  pulseActivities.durationSec,
      tss:          pulseActivities.tss,
    }).from(pulseActivities)
      .where(and(eq(pulseActivities.userId, userId), gte(pulseActivities.startTime, new Date(Date.now() - 14 * 86_400_000))))
      .orderBy(desc(pulseActivities.startTime))
      .limit(6);

    let generated: Awaited<ReturnType<typeof generateWeekWorkouts>>;
    try {
      generated = await generateLLMWeekPlan({
        weekStart: weekStartStr,
        phase,
        weeklyHoursTarget,
        availableDays,
        ctl: fitnessLoad.ctl,
        atl: fitnessLoad.atl,
        tsb: fitnessLoad.tsb,
        ftpWatts: profile?.ftpWatts ?? 250,
        recentActivities: recentActs.map(a => ({
          activityType: a.activityType,
          durationMin:  Math.round((a.durationSec ?? 0) / 60),
          tss:          a.tss ?? 0,
        })),
      });
    } catch (err) {
      app.log.warn(`[plan] LLM plan failed, using templates: ${err}`);
      generated = generateWeekWorkouts({ weekStart: weekStartStr, phase, weeklyHoursTarget, availableDays });
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

    return reply.status(201).send({ workouts: inserted });
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
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Ungültige Eingabe' });

    const userId = req.user.sub;
    const [goal] = await db.insert(pulseGoals).values({
      userId,
      title:       parsed.data.title,
      description: parsed.data.description ?? null,
      targetDate:  parsed.data.targetDate  ?? null,
    }).returning();

    return reply.status(201).send(goal);
  });

  app.patch('/goals/:id', { onRequest: [app.authenticate] }, async (req, reply) => {
    const schema = z.object({
      status:   z.enum(['active', 'completed', 'paused', 'abandoned']).optional(),
      progress: z.number().min(0).max(1).optional(),
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

  // ─── Garmin weight backfill ───────────────────────────────────────────────────
  app.post('/garmin/backfill-weight', { onRequest: [app.authenticate] }, async (req, reply) => {
    const userId = req.user.sub;
    const { days = 90 } = (req.body as { days?: number }) ?? {};
    const { syncGarminDay } = await import('../routes/garmin.js');
    let synced = 0;
    const errors: string[] = [];
    for (let i = 0; i < Math.min(days, 180); i++) {
      const date = new Date(Date.now() - i * 86_400_000);
      try {
        await syncGarminDay(userId, date, app);
        synced++;
      } catch (err) {
        errors.push(`${date.toISOString().split('T')[0]}: ${String(err).slice(0, 80)}`);
        if (errors.length >= 5) break;
      }
    }
    return { synced, errors };
  });

  // ─── Garmin manual sync ───────────────────────────────────────────────────────
  app.post('/garmin/sync', { onRequest: [app.authenticate] }, async (req, reply) => {
    const userId = req.user.sub;
    const today = new Date().toISOString().split('T')[0]!;
    try {
      await pulseQueues['pulse-garmin-sync'].add('sync-now', { userId, date: today }, { priority: 1 });
      return { status: 'queued', date: today };
    } catch {
      return reply.status(503).send({ error: 'Queue nicht verfügbar' });
    }
  });
}

// local type aliases to avoid 'as any'
type PulseDailyMetricsHrvStatus = 'poor' | 'below_normal' | 'normal' | 'above_normal' | null;
type PulseActivityType = 'run' | 'bike' | 'swim' | 'strength' | 'hike' | 'other';
type PulseWorkoutStatus = 'planned' | 'completed' | 'skipped';
