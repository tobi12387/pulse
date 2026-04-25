import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../lib/db.js';
import {
  pulseDailyMetrics,
  pulseMentalCheckins,
  pulseActivities,
  pulsePlannedWorkouts,
  pulseCoachSessions,
} from '../db/pulse-schema.js';
import { eq, desc, and, gte } from 'drizzle-orm';
import type { PulseHomeScreenData, PulseReadiness, PulseCoachMessage } from '@coaching-os/shared/pulse';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeReadiness(metrics: {
  sleepHours: number | null;
  hrvStatus: string | null;
  bodyBatteryMax: number | null;
  stressAvg: number | null;
  mentalMood: number | null;
  mentalEnergy: number | null;
  mentalMotivation: number | null;
  mentalStress: number | null;
  tsb: number;
}): PulseReadiness {
  const sleep = metrics.sleepHours != null
    ? Math.min(metrics.sleepHours / 8, 1) * 100
    : 60;

  const hrv = metrics.hrvStatus != null ? ({
    poor: 25, below_normal: 50, balanced: 75, normal: 75, above_normal: 100,
  }[metrics.hrvStatus] ?? 60) : 60;

  const tsb = Math.max(0, Math.min(100, (metrics.tsb + 30) / 60 * 100));

  const battery = metrics.bodyBatteryMax ?? 60;

  const mental = metrics.mentalMood != null
    ? ((metrics.mentalMood + (metrics.mentalEnergy ?? 5) + (metrics.mentalMotivation ?? 5)) / 3) * 10
    : 60;

  const stress = metrics.stressAvg != null
    ? Math.max(0, (100 - metrics.stressAvg))
    : metrics.mentalStress != null
      ? (10 - metrics.mentalStress) * 10
      : 60;

  const score = Math.round(
    sleep   * 0.25 +
    hrv     * 0.25 +
    tsb     * 0.20 +
    battery * 0.15 +
    mental  * 0.10 +
    stress  * 0.05,
  );

  const label: PulseReadiness['label'] =
    score >= 80 ? 'excellent' :
    score >= 65 ? 'good' :
    score >= 45 ? 'moderate' : 'low';

  return {
    score,
    components: { sleep, hrv, tsb, battery, mental, stress },
    label,
  };
}

const coachMessageSchema = z.object({
  message: z.string().min(1).max(2000),
});

function simpleCoachReply(message: string, readiness: PulseReadiness): string {
  const m = message.toLowerCase();

  if (/^(hallo|hi|hey|guten morgen|servus|moin)/.test(m)) {
    return `Hallo! Deine heutige Readiness liegt bei ${readiness.score}/100 (${readiness.label}). Wie kann ich dir helfen?`;
  }
  if (/(schlaf|schlafen|müde)/.test(m)) {
    const s = Math.round(readiness.components.sleep);
    return `Dein Schlaf-Score heute: ${s}/100. ${s < 60 ? 'Lass heute das intensive Training lieber aus.' : 'Gute Basis für das Training!'}`;
  }
  if (/(hrv|herzrate|herzratenvariabil)/.test(m)) {
    return `Dein HRV-Score heute: ${Math.round(readiness.components.hrv)}/100. ${readiness.components.hrv < 50 ? 'Dein Nervensystem braucht Erholung.' : 'Dein Nervensystem ist gut erholt.'}`;
  }
  if (/(readiness|bereit|form|fit)/.test(m)) {
    return `Deine Readiness heute: ${readiness.score}/100 (${readiness.label}). ${readiness.score >= 70 ? 'Grünes Licht für hartes Training!' : readiness.score >= 50 ? 'Moderates Training ist ok.' : 'Heute lieber regenerieren.'}`;
  }
  if (/(trainingsplan|plan|woche|workout|training)/.test(m)) {
    return `Basierend auf deiner Readiness von ${readiness.score}/100 empfehle ich heute ${readiness.score >= 70 ? 'Intensivtraining (Zone 4-5).' : readiness.score >= 50 ? 'moderates Training (Zone 2-3).' : 'Regeneration oder leichtes Z1-Training.'}`;
  }
  if (/(erholung|recovery|regeneration|pause)/.test(m)) {
    return `Erholung ist genauso wichtig wie Training. Dein TSB liegt bei ${Math.round(readiness.components.tsb)}/100 — ${readiness.components.tsb < 40 ? 'du akkumulierst gerade Ermüdung, eine Pause wäre sinnvoll.' : 'du bist gut erholt.'}`;
  }

  return `Ich bin dein Pulse Coach. Du fragst: "${message}". Deine aktuelle Readiness ist ${readiness.score}/100. Was möchtest du konkret wissen — Training, Schlaf, HRV oder Erholung?`;
}

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

    const readiness = computeReadiness({
      sleepHours:       metrics?.sleepHours ?? null,
      hrvStatus:        metrics?.hrvStatus ?? null,
      bodyBatteryMax:   metrics?.bodyBatteryMax ?? null,
      stressAvg:        metrics?.stressAvg ?? null,
      mentalMood:       mental?.mood ?? null,
      mentalEnergy:     mental?.energy ?? null,
      mentalMotivation: mental?.motivation ?? null,
      mentalStress:     mental?.stress ?? null,
      tsb:              0,
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
      fitnessLoad: { ctl: 0, atl: 0, tsb: 0, date: today },
      recentActivities: recentActivities.map((a) => ({
        id: a.id, userId: a.userId, externalId: a.externalId,
        source: a.source, startTime: a.startTime.toISOString(),
        activityType: a.activityType as PulseActivityType, name: a.name,
        durationSec: a.durationSec, distanceM: a.distanceM,
        avgHr: a.avgHr, maxHr: a.maxHr, avgPowerW: a.avgPowerW,
        normalizedPowerW: a.normalizedPowerW, tss: a.tss,
        calories: a.calories, elevationGainM: a.elevationGainM,
      })),
      nextWorkout: nextWorkout ? {
        id: nextWorkout.id, userId: nextWorkout.userId,
        plannedDate: nextWorkout.plannedDate, activityType: nextWorkout.activityType as PulseActivityType,
        zone: nextWorkout.zone, durationMin: nextWorkout.durationMin,
        distanceKm: nextWorkout.distanceKm, targetTss: nextWorkout.targetTss,
        description: nextWorkout.description, status: nextWorkout.status as PulseWorkoutStatus,
      } : null,
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

    const readiness = computeReadiness({
      sleepHours:       metrics?.sleepHours ?? null,
      hrvStatus:        metrics?.hrvStatus ?? null,
      bodyBatteryMax:   metrics?.bodyBatteryMax ?? null,
      stressAvg:        metrics?.stressAvg ?? null,
      mentalMood:       mental?.mood ?? null,
      mentalEnergy:     mental?.energy ?? null,
      mentalMotivation: mental?.motivation ?? null,
      mentalStress:     mental?.stress ?? null,
      tsb:              0,
    });

    const replyText = simpleCoachReply(parsed.data.message, readiness);

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
}

// local type aliases to avoid 'as any'
type PulseDailyMetricsHrvStatus = 'poor' | 'below_normal' | 'normal' | 'above_normal' | null;
type PulseActivityType = 'run' | 'bike' | 'swim' | 'strength' | 'hike' | 'other';
type PulseWorkoutStatus = 'planned' | 'completed' | 'skipped';
