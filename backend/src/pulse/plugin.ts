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
  type WorkoutStep,
} from '../db/pulse-schema.js';
import { eq, desc, and, gte } from 'drizzle-orm';
import { redis } from '../lib/redis.js';
import { llmComplete, SMART_MODEL } from '../lib/llm.js';
import type { PulseHomeScreenData, PulseCoachMessage } from '@coaching-os/shared/pulse';
import { computeFitnessLoad, computeReadinessScore } from './services/load-engine.js';
import { getPrognosis } from './services/prognosis-engine.js';
import {
  buildRichSystemPrompt, getCoachReplyRich,
  classifyAndExtractCheckin, type CheckinClassification, type CoachFullContext,
} from './services/coach-engine.js';
import { transcribeAudio } from '../lib/whisper.js';
import { generateWeekWorkouts, generateScientificWeekPlan } from './services/plan-engine.js';
import { generateWeeklyReview } from './services/review-engine.js';
import { generateDeepInsight, type InsightDomain } from './services/insight-engine.js';
import { pulseQueues } from './queues/queues.js';

const coachMessageSchema = z.object({
  message: z.string().min(1).max(2000),
});

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

// ─── Workout step generation ──────────────────────────────────────────────────

async function buildWorkoutSteps(
  workout: { id: string; activityType: string; zone: number; durationMin: number; description: string | null },
  profile: { ftpWatts: number | null; maxHrBpm: number | null } | undefined,
): Promise<{ steps: WorkoutStep[]; updatedDescription: string | null }> {
  const ftp = profile?.ftpWatts ?? 250;
  const maxHr = profile?.maxHrBpm ?? 185;

  const isRun = workout.activityType === 'run';
  const isBike = workout.activityType === 'bike';
  const intensityRef = isBike
    ? `FTP=${ftp}W, Zonen: Z1<${Math.round(ftp*0.56)}W, Z2 ${Math.round(ftp*0.56)}-${Math.round(ftp*0.75)}W, Z4 ${Math.round(ftp*0.90)}-${Math.round(ftp*1.05)}W, Z5>${Math.round(ftp*1.05)}W`
    : `Max-HF=${maxHr}bpm, Zonen: Z1<${Math.round(maxHr*0.68)}, Z2 ${Math.round(maxHr*0.68)}-${Math.round(maxHr*0.78)}, Z4 ${Math.round(maxHr*0.88)}-${Math.round(maxHr*0.95)}, Z5>${Math.round(maxHr*0.95)}`;

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
Bei reinen Z2-Workouts: nur warmup + steady + cooldown, kein interval.`;

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
    return step;
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
  app.get('/home', { onRequest: [app.authenticate] }, async (req): Promise<PulseHomeScreenData> => {
    const userId = req.user.sub;
    const today = new Date().toISOString().split('T')[0]!;

    const [
      [metrics],
      [mental],
      recentActivities,
      [nextWorkout],
      fitnessLoad,
      prognosis,
      streaks,
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
      computeFitnessLoad(userId, today),
      getPrognosis(userId),
      computeStreaks(userId, today),
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
        description: nextWorkout.description,
        steps: (nextWorkout.steps ?? null) as import('@coaching-os/shared/pulse').WorkoutStep[] | null,
        garminWorkoutId: nextWorkout.garminWorkoutId ?? null,
        status: nextWorkout.status as PulseWorkoutStatus,
      } : null,
      prognosis,
      streaks,
    };
  });

  app.post('/coach', { onRequest: [app.authenticate] }, async (req, reply) => {
    const parsed = coachMessageSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Ungültige Nachricht' });

    const userId = req.user.sub;
    const today  = new Date().toISOString().split('T')[0]!;
    const since14 = new Date(Date.now() - 14 * 86_400_000).toISOString().split('T')[0]!;

    // Fetch all context in parallel
    const [
      metricsRows, mentalRows, fitnessLoad,
      metrics14, checkins14, activities10,
      upcomingWorkouts, profileRows, weightRows, sessionRows,
    ] = await Promise.all([
      db.select().from(pulseDailyMetrics)
        .where(and(eq(pulseDailyMetrics.userId, userId), eq(pulseDailyMetrics.date, today))).limit(1),
      db.select().from(pulseMentalCheckins)
        .where(and(eq(pulseMentalCheckins.userId, userId), eq(pulseMentalCheckins.date, today))).limit(1),
      computeFitnessLoad(userId, today),
      db.select({ date: pulseDailyMetrics.date, sleepHours: pulseDailyMetrics.sleepHours,
        hrvRmssd: pulseDailyMetrics.hrvRmssd, bodyBatteryMax: pulseDailyMetrics.bodyBatteryMax,
        stressAvg: pulseDailyMetrics.stressAvg })
        .from(pulseDailyMetrics)
        .where(and(eq(pulseDailyMetrics.userId, userId), gte(pulseDailyMetrics.date, since14)))
        .orderBy(pulseDailyMetrics.date),
      db.select({ date: pulseMentalCheckins.date, mood: pulseMentalCheckins.mood,
        energy: pulseMentalCheckins.energy, stress: pulseMentalCheckins.stress,
        motivation: pulseMentalCheckins.motivation })
        .from(pulseMentalCheckins)
        .where(and(eq(pulseMentalCheckins.userId, userId), gte(pulseMentalCheckins.date, since14)))
        .orderBy(pulseMentalCheckins.date),
      db.select({ startTime: pulseActivities.startTime, activityType: pulseActivities.activityType,
        durationSec: pulseActivities.durationSec, tss: pulseActivities.tss,
        normalizedPowerW: pulseActivities.normalizedPowerW, avgHr: pulseActivities.avgHr })
        .from(pulseActivities)
        .where(eq(pulseActivities.userId, userId))
        .orderBy(desc(pulseActivities.startTime)).limit(10),
      db.select({ plannedDate: pulsePlannedWorkouts.plannedDate, activityType: pulsePlannedWorkouts.activityType,
        zone: pulsePlannedWorkouts.zone, durationMin: pulsePlannedWorkouts.durationMin,
        description: pulsePlannedWorkouts.description })
        .from(pulsePlannedWorkouts)
        .where(and(eq(pulsePlannedWorkouts.userId, userId), eq(pulsePlannedWorkouts.status, 'planned'), gte(pulsePlannedWorkouts.plannedDate, today)))
        .orderBy(pulsePlannedWorkouts.plannedDate).limit(3),
      db.select({ ftpWatts: pulseUserProfile.ftpWatts, maxHrBpm: pulseUserProfile.maxHrBpm,
        vo2max: pulseUserProfile.vo2max, trainingPhase: pulseUserProfile.trainingPhase })
        .from(pulseUserProfile).where(eq(pulseUserProfile.userId, userId)).limit(1),
      db.select({ date: pulseWeightLog.date, weightKg: pulseWeightLog.weightKg })
        .from(pulseWeightLog).where(eq(pulseWeightLog.userId, userId))
        .orderBy(desc(pulseWeightLog.date)).limit(35),
      db.select({ id: pulseCoachSessions.id, messages: pulseCoachSessions.messages })
        .from(pulseCoachSessions).where(eq(pulseCoachSessions.userId, userId))
        .orderBy(desc(pulseCoachSessions.lastMessageAt)).limit(1),
    ]);

    const metrics = metricsRows[0] ?? null;
    const mental  = mentalRows[0]  ?? null;

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

    // Weight trend
    const latestW  = weightRows[0] ?? null;
    const cutoff30 = new Date(Date.now() - 30 * 86_400_000).toISOString().split('T')[0]!;
    const w30ago   = weightRows.find(w => w.date <= cutoff30) ?? null;
    const trend30d = latestW && w30ago
      ? Math.round((latestW.weightKg - w30ago.weightKg) * 10) / 10
      : null;

    const coachCtx: CoachFullContext = {
      today,
      readiness: { score: readiness.score, label: readiness.label },
      todayMetrics: metrics ? {
        sleepHours:     metrics.sleepHours,
        sleepScore:     null,
        hrvRmssd:       metrics.hrvRmssd,
        hrvStatus:      metrics.hrvStatus,
        restingHr:      null,
        bodyBatteryMax: metrics.bodyBatteryMax,
        stressAvg:      metrics.stressAvg,
        steps:          null,
      } : null,
      todayCheckin: mental ? {
        mood: mental.mood, energy: mental.energy, stress: mental.stress,
        motivation: mental.motivation, notes: mental.notes,
      } : null,
      load: { ctl: fitnessLoad.ctl, atl: fitnessLoad.atl, tsb: fitnessLoad.tsb },
      profile: profileRows[0] ?? null,
      recentActivities: activities10.map(a => ({
        date: new Date(a.startTime).toISOString().split('T')[0]!,
        activityType: a.activityType,
        durationSec: a.durationSec,
        tss: a.tss,
        normalizedPowerW: a.normalizedPowerW,
        avgHr: a.avgHr,
      })),
      upcomingWorkouts,
      metrics14,
      checkins14,
      latestWeight: latestW ? { weightKg: latestW.weightKg, date: latestW.date, trend30d } : null,
    };

    const systemPrompt = buildRichSystemPrompt(coachCtx);
    const existingSession = sessionRows[0] ?? null;
    const history = (existingSession?.messages as PulseCoachMessage[] ?? []);

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
            targetType: GARMIN_NO_TARGET, ...GARMIN_NULL_FIELDS,
          },
        ];
        if (step.restMin) {
          innerSteps.push({
            type: 'ExecutableStepDTO', stepOrder: 2,
            stepType: GARMIN_STEP_TYPES.rest,
            description: null,
            endCondition: GARMIN_TIME_COND, endConditionValue: restSecs,
            targetType: GARMIN_NO_TARGET, ...GARMIN_NULL_FIELDS,
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
          targetType: GARMIN_NO_TARGET, ...GARMIN_NULL_FIELDS,
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

    const phase = (profile?.trainingPhase ?? 'base') as 'base' | 'build' | 'peak' | 'taper';

    // Use week-specific availability if set, fall back to profile defaults
    const [weekAvail] = await db.select()
      .from(pulseWeekAvailability)
      .where(and(eq(pulseWeekAvailability.userId, userId), eq(pulseWeekAvailability.weekStart, weekStartStr)));

    const weeklyHoursTarget = weekAvail?.weeklyHours ?? profile?.weeklyHoursTarget ?? 8;
    const availableDays = (weekAvail?.availableDays as number[] | null) ?? [0, 2, 4, 5];

    const [fitnessLoad, recentActs, goals] = await Promise.all([
      computeFitnessLoad(userId, weekStartStr),
      db.select({
        startTime:    pulseActivities.startTime,
        activityType: pulseActivities.activityType,
        durationSec:  pulseActivities.durationSec,
        tss:          pulseActivities.tss,
      }).from(pulseActivities)
        .where(and(eq(pulseActivities.userId, userId), gte(pulseActivities.startTime, new Date(Date.now() - 42 * 86_400_000))))
        .orderBy(desc(pulseActivities.startTime))
        .limit(80),
      db.select({ title: pulseGoals.title, targetDate: pulseGoals.targetDate, category: pulseGoals.category })
        .from(pulseGoals)
        .where(and(eq(pulseGoals.userId, userId), eq(pulseGoals.status, 'active')))
        .limit(5),
    ]);

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
        recentActivities:   recentActs.map(a => ({
          date:         a.startTime.toISOString().split('T')[0]!,
          activityType: a.activityType,
          durationMin:  Math.round((a.durationSec ?? 0) / 60),
          tss:          a.tss ?? 0,
        })),
        goals,
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

    return reply.status(201).send({ workouts: withSteps });
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
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Ungültige Eingabe' });

    const userId = req.user.sub;
    const [goal] = await db.insert(pulseGoals).values({
      userId,
      title:       parsed.data.title,
      description: parsed.data.description ?? null,
      targetDate:  parsed.data.targetDate  ?? null,
      category:    parsed.data.category    ?? null,
      metrics:     parsed.data.metrics     ?? {},
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
    const phase = (profile?.trainingPhase ?? 'base') as 'base' | 'build' | 'peak' | 'taper';
    const [fitnessLoad, recentActs2, goals2] = await Promise.all([
      computeFitnessLoad(userId, weekStart),
      db.select({
        startTime:    pulseActivities.startTime,
        activityType: pulseActivities.activityType,
        durationSec:  pulseActivities.durationSec,
        tss:          pulseActivities.tss,
      }).from(pulseActivities)
        .where(and(eq(pulseActivities.userId, userId), gte(pulseActivities.startTime, new Date(Date.now() - 42 * 86_400_000))))
        .orderBy(desc(pulseActivities.startTime)).limit(80),
      db.select({ title: pulseGoals.title, targetDate: pulseGoals.targetDate, category: pulseGoals.category })
        .from(pulseGoals)
        .where(and(eq(pulseGoals.userId, userId), eq(pulseGoals.status, 'active')))
        .limit(5),
    ]);

    let generated: Awaited<ReturnType<typeof generateWeekWorkouts>>;
    try {
      generated = await generateScientificWeekPlan({
        weekStart, phase,
        weeklyHoursTarget: parsed.data.weeklyHours,
        availableDays:     parsed.data.availableDays,
        ctl: fitnessLoad.ctl, atl: fitnessLoad.atl, tsb: fitnessLoad.tsb,
        ftpWatts:  profile?.ftpWatts ?? 250,
        maxHrBpm:  profile?.maxHrBpm ?? 185,
        recentActivities: recentActs2.map(a => ({
          date:         a.startTime.toISOString().split('T')[0]!,
          activityType: a.activityType,
          durationMin:  Math.round((a.durationSec ?? 0) / 60),
          tss:          a.tss ?? 0,
        })),
        goals: goals2,
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
    if (ftpWatts != null) updates.ftpWatts = ftpWatts;

    await db.insert(pulseUserProfile)
      .values({ userId, ...updates } as any)
      .onConflictDoUpdate({ target: pulseUserProfile.userId, set: updates as any });

    return { synced: { vo2max, maxHrBpm, lactateThresholdHr: ud.lactateThresholdHeartRate ?? null, ftpWatts } };
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

  // ─── Morning Briefing ─────────────────────────────────────────────────────────
  app.get('/briefing', { onRequest: [app.authenticate] }, async (req) => {
    const userId = req.user.sub;
    const today = new Date().toISOString().split('T')[0]!;
    const cacheKey = `pulse:briefing:${userId}:${today}`;

    const cached = await redis.get(cacheKey);
    if (cached) return { briefing: cached, date: today, cached: true };

    const [[metrics], [checkin], workouts] = await Promise.all([
      db.select({
        sleepHours:     pulseDailyMetrics.sleepHours,
        hrvRmssd:       pulseDailyMetrics.hrvRmssd,
        hrvStatus:      pulseDailyMetrics.hrvStatus,
        bodyBatteryMax: pulseDailyMetrics.bodyBatteryMax,
        stressAvg:      pulseDailyMetrics.stressAvg,
        restingHr:      pulseDailyMetrics.restingHr,
      }).from(pulseDailyMetrics)
        .where(and(eq(pulseDailyMetrics.userId, userId), eq(pulseDailyMetrics.date, today))),

      db.select({
        mood: pulseMentalCheckins.mood, energy: pulseMentalCheckins.energy,
        stress: pulseMentalCheckins.stress, motivation: pulseMentalCheckins.motivation,
      }).from(pulseMentalCheckins)
        .where(and(eq(pulseMentalCheckins.userId, userId), eq(pulseMentalCheckins.date, today))),

      db.select({
        activityType: pulsePlannedWorkouts.activityType,
        zone: pulsePlannedWorkouts.zone,
        durationMin: pulsePlannedWorkouts.durationMin,
        description: pulsePlannedWorkouts.description,
        status: pulsePlannedWorkouts.status,
      }).from(pulsePlannedWorkouts)
        .where(and(eq(pulsePlannedWorkouts.userId, userId), eq(pulsePlannedWorkouts.plannedDate, today))),
    ]);

    const parts: string[] = [];
    if (metrics?.sleepHours)    parts.push(`Schlaf: ${metrics.sleepHours.toFixed(1)}h`);
    if (metrics?.hrvRmssd)      parts.push(`HRV: ${metrics.hrvRmssd.toFixed(0)} ms (${metrics.hrvStatus ?? '–'})`);
    if (metrics?.bodyBatteryMax) parts.push(`Körperbatterie: ${metrics.bodyBatteryMax}%`);
    if (metrics?.restingHr)     parts.push(`Ruhepuls: ${metrics.restingHr} bpm`);
    if (checkin)                parts.push(`Check-in: Stimmung ${checkin.mood}/10, Energie ${checkin.energy}/10, Stress ${checkin.stress}/10`);
    if (workouts.length > 0) {
      const w = workouts[0]!;
      const statusStr = w.status === 'completed' ? ' (bereits erledigt)' : '';
      parts.push(`Geplantes Training heute: ${w.activityType} Zone ${w.zone}, ${w.durationMin} min${statusStr}`);
      if (w.description) parts.push(`Training-Details: ${w.description}`);
    }

    const context = parts.length > 0 ? parts.join('\n') : 'Noch keine Daten für heute verfügbar.';

    const briefing = await llmComplete(
      `Du bist Pulse, persönlicher Ausdauercoach für Tobi (polarisiertes Training, Triathlon/Radsport).
Schreibe ein Morning Briefing: 3-4 Sätze, kein Markdown, auf Deutsch.
Beziehe dich auf die konkreten Daten. Empfehle die passende Trainingsintensität für heute.
Sei direkt und motivierend — wie ein erfahrener Coach, nicht wie ein Assistent.`,
      `Heute, ${today}:\n${context}`,
      SMART_MODEL,
    );

    const midnight = new Date();
    midnight.setHours(24, 0, 0, 0);
    const ttl = Math.round((midnight.getTime() - Date.now()) / 1000);
    await redis.set(cacheKey, briefing, 'EX', ttl);

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
        startTime:        pulseActivities.startTime,
        activityType:     pulseActivities.activityType,
        durationSec:      pulseActivities.durationSec,
        tss:              pulseActivities.tss,
        normalizedPowerW: pulseActivities.normalizedPowerW,
        vo2maxEstimate:   pulseActivities.vo2maxEstimate,
      }).from(pulseActivities)
        .where(and(eq(pulseActivities.userId, userId), gte(pulseActivities.startTime, since)))
        .orderBy(pulseActivities.startTime),
      db.select({ ftpWatts: pulseUserProfile.ftpWatts })
        .from(pulseUserProfile).where(eq(pulseUserProfile.userId, userId)).limit(1),
    ]);

    const ftp = profileRows[0]?.ftpWatts ?? null;

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

    return { weeks, tssHeatmap, zoneDistribution, vo2maxTrend };
  });
}

// local type aliases to avoid 'as any'
type PulseDailyMetricsHrvStatus = 'poor' | 'below_normal' | 'normal' | 'above_normal' | null;
type PulseActivityType = 'run' | 'bike' | 'swim' | 'strength' | 'hike' | 'other';
type PulseWorkoutStatus = 'planned' | 'completed' | 'skipped';
