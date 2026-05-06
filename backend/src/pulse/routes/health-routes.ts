import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { and, desc, eq, gte, isNull, lte, or, sql } from 'drizzle-orm';
import type { PulseFitnessLoad, PulseReadiness } from '@coaching-os/shared/pulse';
import {
  pulseDailyMetrics,
  pulseHealthState,
  pulseUserProfile,
  pulseWeightLog,
} from '../../db/pulse-schema.js';
import { db } from '../../lib/db.js';
import { buildCachedPulseContextFor } from '../lib/pulse-context.js';
import { getCached, invalidateUser, setCached } from '../lib/pulse-cache.js';
import { computeFitnessLoad } from '../services/load-engine.js';
import { profileWithProvenance } from '../services/profile-sync.js';

export async function registerPulseHealthRoutes(app: FastifyInstance) {
  // Public health check
  app.get('/health', async () => ({ status: 'ok', namespace: 'pulse' }));

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
      bodyBatteryAtWake: pulseDailyMetrics.bodyBatteryAtWake,
      bodyBatteryCharged: pulseDailyMetrics.bodyBatteryCharged,
      bodyBatteryDrained: pulseDailyMetrics.bodyBatteryDrained,
      bodyBatteryHighest: pulseDailyMetrics.bodyBatteryHighest,
      bodyBatteryLowest: pulseDailyMetrics.bodyBatteryLowest,
      stressAvg:      pulseDailyMetrics.stressAvg,
      maxStress:      pulseDailyMetrics.maxStress,
      lowStressSec:   pulseDailyMetrics.lowStressSec,
      mediumStressSec: pulseDailyMetrics.mediumStressSec,
      highStressSec:  pulseDailyMetrics.highStressSec,
      moderateIntensityMin: pulseDailyMetrics.moderateIntensityMin,
      vigorousIntensityMin: pulseDailyMetrics.vigorousIntensityMin,
      avgWakingRespiration: pulseDailyMetrics.avgWakingRespiration,
      latestSpo2:     pulseDailyMetrics.latestSpo2,
      steps:          pulseDailyMetrics.steps,
    }).from(pulseDailyMetrics)
      .where(and(eq(pulseDailyMetrics.userId, userId), gte(pulseDailyMetrics.date, since)))
      .orderBy(pulseDailyMetrics.date);
    return { metrics };
  });

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

  app.get('/profile', { onRequest: [app.authenticate] }, async (req) => {
    const userId = req.user.sub;
    const [profile] = await db.select().from(pulseUserProfile).where(eq(pulseUserProfile.userId, userId));
    return profileWithProvenance(profile ?? null, userId);
  });

  app.patch('/profile', { onRequest: [app.authenticate] }, async (req, reply) => {
    const schema = z.object({
      ftpWatts:          z.number().int().min(50).max(600).optional(),
      maxHrBpm:          z.number().int().min(100).max(250).optional(),
      lthrBpm:           z.number().int().min(80).max(230).optional(),
      restingHrBpm:      z.number().int().min(30).max(100).optional(),
      weeklyHoursTarget: z.number().min(1).max(40).optional(),
      trainingPhase:     z.enum(['base','build','peak','taper']).optional(),
      vo2max:            z.number().min(20).max(100).optional(),
      fuelingEnabled:    z.boolean().optional(),
      dietaryConstraints: z.array(z.string().trim().min(1).max(80)).max(12).optional(),
      preferredFuelingProducts: z.string().trim().min(1).max(500).optional(),
      carbGuidanceStyle: z.enum(['suggest_ranges', 'avoid_amounts']).optional(),
      sodiumGuidanceStyle: z.enum(['suggest_ranges', 'avoid_amounts']).optional(),
      bodyWeightGuidanceEnabled: z.boolean().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Ungültige Eingabe' });

    const userId = req.user.sub;
    const now = new Date();
    const provenanceUpdates: Record<string, unknown> = {};
    if (parsed.data.ftpWatts !== undefined) {
      provenanceUpdates.ftpWattsSource = 'manual';
      provenanceUpdates.ftpWattsUpdatedAt = now;
    }
    if (parsed.data.maxHrBpm !== undefined) {
      provenanceUpdates.maxHrBpmSource = 'manual';
      provenanceUpdates.maxHrBpmUpdatedAt = now;
    }
    if (parsed.data.lthrBpm !== undefined) {
      provenanceUpdates.lthrBpmSource = 'manual';
      provenanceUpdates.lthrBpmUpdatedAt = now;
    }
    if (parsed.data.vo2max !== undefined) {
      provenanceUpdates.vo2maxSource = 'manual';
      provenanceUpdates.vo2maxUpdatedAt = now;
    }
    const updates = { ...parsed.data, ...provenanceUpdates, updatedAt: now };
    const [profile] = await db.insert(pulseUserProfile)
      .values({ userId, ...updates } as typeof pulseUserProfile.$inferInsert)
      .onConflictDoUpdate({
        target: pulseUserProfile.userId,
        set: updates as Partial<typeof pulseUserProfile.$inferInsert>,
      }).returning();
    return profileWithProvenance(profile ?? null, userId);
  });
}
