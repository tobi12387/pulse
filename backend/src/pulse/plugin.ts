import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../lib/db.js';
import {
  pulseDailyMetrics,
  pulseMentalCheckins,
  pulseActivities,
  pulseSleepSessions,
  pulseUserProfile,
  pulsePushSubscriptions,
  pulseEquipmentActivity,
  DEFAULT_PUSH_TOPICS,
  type GarminActivityDetailCache,
  type GarminActivityHrZoneCache,
  type GarminActivityLapCache,
} from '../db/pulse-schema.js';
import { eq, desc, and, gte, isNull, or } from 'drizzle-orm';
import { env } from '../lib/env.js';
import { RPE_SORENESS_AREAS } from '@coaching-os/shared/pulse';
import type { PulsePushTopics } from '@coaching-os/shared/pulse';
import { invalidateUser } from './lib/pulse-cache.js';
import { generateDeepInsight, type InsightDomain } from './services/insight-engine.js';
import { isPushConfigured, normalizePushTopics, sendPushToUser } from '../lib/push.js';
import { garminApi } from '../lib/garmin-client.js';
import { registerPulseCheckinRoutes } from './routes/checkin-routes.js';
import { registerPulseCoachRoutes } from './routes/coach-routes.js';
import { registerPulseDailyLoopRoutes } from './routes/daily-loop-routes.js';
import { registerPulseGarminRoutes } from './routes/garmin-routes.js';
import { registerPulseHealthRoutes } from './routes/health-routes.js';
import { registerPulseTrainingRoutes } from './routes/training-routes.js';

function asGarminLapCache(value: unknown): GarminActivityLapCache[] {
  return Array.isArray(value) ? value as GarminActivityLapCache[] : [];
}

function asGarminHrZoneCache(value: unknown): GarminActivityHrZoneCache[] {
  return Array.isArray(value) ? value as GarminActivityHrZoneCache[] : [];
}

function legacyRawDetailCache(rawData: unknown): {
  hasLegacyCache: boolean;
  laps: GarminActivityLapCache[];
  hrZones: GarminActivityHrZoneCache[];
} {
  if (typeof rawData !== 'object' || rawData == null) {
    return { hasLegacyCache: false, laps: [], hrZones: [] };
  }

  const candidate = rawData as { laps?: unknown; hrZones?: unknown };
  const laps = asGarminLapCache(candidate.laps);
  const hrZones = asGarminHrZoneCache(candidate.hrZones);
  return {
    hasLegacyCache: Array.isArray(candidate.laps) || Array.isArray(candidate.hrZones),
    laps,
    hrZones,
  };
}

function analyticsLapsFromCache(laps: GarminActivityLapCache[]) {
  return laps.map(l => ({
    index:        l.index,
    durationSec:  l.durationSec ?? null,
    avgHr:        l.avgHr ?? null,
    avgPowerW:    l.avgPowerW ?? null,
    avgSpeedMs:   l.avgSpeedMs ?? null,
  }));
}

const activityFeedbackSchema = z.object({
  rpe: z.number().int().min(1).max(10),
  rpeNote: z.string().trim().max(500).nullable().optional(),
  sorenessAreas: z.array(z.enum(RPE_SORENESS_AREAS)).max(8).nullable().optional(),
});

const pushSubscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
  deviceLabel: z.string().trim().max(64).optional(),
});

const pushTopicsPatchSchema = z.object({
  briefing: z.boolean().optional(),
  checkin_reminder: z.boolean().optional(),
  risk_critical: z.boolean().optional(),
}).strict().refine(value => Object.keys(value).length > 0, { message: 'Mindestens ein Topic erforderlich' });

const quietHoursSchema = z.object({
  start: z.string().regex(/^\d{2}:\d{2}$/),
  end: z.string().regex(/^\d{2}:\d{2}$/),
}).refine(({ start, end }) => {
  const values = [start, end].flatMap(v => v.split(':').map(Number));
  const [sh, sm, eh, em] = values;
  return sh! <= 23 && eh! <= 23 && sm! <= 59 && em! <= 59;
}, { message: 'Uhrzeiten müssen im Format HH:MM liegen' });

function hhmm(value: string | null | undefined, fallback: string): string {
  return (value ?? fallback).slice(0, 5);
}

function classifyInsightFailure(error: unknown): {
  status: number;
  body: { error: string; code: string; retryable: boolean; action: string };
} {
  const message = error instanceof Error ? error.message : String(error);
  if (/OpenRouter error: (401|402|403|429|5\d\d)/i.test(message)) {
    return {
      status: 503,
      body: {
        error: 'KI-Provider gerade nicht verfügbar.',
        code: 'provider_unavailable',
        retryable: true,
        action: 'Versuche es später erneut oder nutze den gecachten Stand.',
      },
    };
  }
  if (/timeout|abort|etimedout/i.test(message)) {
    return {
      status: 504,
      body: {
        error: 'Analyse dauert gerade zu lange.',
        code: 'timeout',
        retryable: true,
        action: 'Versuche es erneut oder wähle einen kürzeren Zeitraum.',
      },
    };
  }
  return {
    status: 500,
    body: {
      error: 'Analyse konnte gerade nicht geladen werden.',
      code: 'server_error',
      retryable: true,
      action: 'Deine Daten bleiben sichtbar. Versuche es gleich erneut oder wechsle auf einen anderen Zeitraum.',
    },
  };
}

// ─── Plugin ───────────────────────────────────────────────────────────────────

export default async function pulsePlugin(app: FastifyInstance) {
  // Allow DELETE/GET requests that send Content-Type: application/json but no body
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body, done) => {
    if (!body || (body as string).length === 0) { done(null, undefined); return; }
    try { done(null, JSON.parse(body as string)); } catch (e) { done(e as Error, undefined); }
  });

  await registerPulseHealthRoutes(app);
  await registerPulseDailyLoopRoutes(app);
  await registerPulseCoachRoutes(app);
  await registerPulseCheckinRoutes(app);
  await registerPulseTrainingRoutes(app);
  await registerPulseGarminRoutes(app);

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
      sessions: sessions.map(({ rawData: _rawData, ...s }) => ({
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

    const assignedEquipment = await db.select({
      equipmentId: pulseEquipmentActivity.equipmentId,
    }).from(pulseEquipmentActivity)
      .where(eq(pulseEquipmentActivity.activityId, id));

    let laps: GarminActivityLapCache[] = [];
    let hrZones: GarminActivityHrZoneCache[] = [];

    const hasDetailCache = activity.garminLaps != null || activity.garminHrZones != null;
    const legacyCache = hasDetailCache
      ? { hasLegacyCache: false, laps: [], hrZones: [] }
      : legacyRawDetailCache(activity.rawData);
    if (hasDetailCache) {
      laps = asGarminLapCache(activity.garminLaps);
      hrZones = asGarminHrZoneCache(activity.garminHrZones);
    } else if (legacyCache.hasLegacyCache) {
      laps = legacyCache.laps;
      hrZones = legacyCache.hrZones;
    }

    if (!hasDetailCache && !legacyCache.hasLegacyCache && activity.externalId) {
      try {
        const { getGarminClient } = await import('../lib/garmin-client.js');
        const gc = await getGarminClient();
        const extId = activity.externalId;

        const [splitsRes, zonesRes] = await Promise.allSettled([
          garminApi.getActivitySplits(gc, extId),
          garminApi.getActivityHrTimeInZones(gc, extId),
        ]);

        if (splitsRes.status === 'fulfilled') {
          const splitPayload = splitsRes.value;
          const raw = splitPayload && typeof splitPayload === 'object'
            ? (splitPayload as { lapDTOs?: unknown[] }).lapDTOs ?? []
            : [];
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
          const raw = zonesRes.value;
          const rows = Array.isArray(raw)
            ? raw
            : raw && typeof raw === 'object'
              ? Object.values(raw as Record<string, unknown>)
              : [];
          hrZones = rows.map((z: any) => {
            const zone = z && typeof z === 'object' ? z : {};
            return {
              zone: zone.zoneNumber,
              secsInZone: zone.secsInZone,
              zoneLowBoundary: zone.zoneLowBoundary ?? null,
            };
          });
        }

        if (splitsRes.status === 'fulfilled' || zonesRes.status === 'fulfilled') {
          const detailData: GarminActivityDetailCache = {
            source: 'garmin',
            fetchedAt: new Date().toISOString(),
            splits: splitsRes.status === 'fulfilled' ? splitsRes.value : null,
            hrTimeInZones: zonesRes.status === 'fulfilled' ? zonesRes.value : null,
          };

          await db.update(pulseActivities)
            .set({
              garminDetailData: detailData,
              garminLaps: laps,
              garminHrZones: hrZones,
              garminDetailSyncedAt: new Date(),
            })
            .where(eq(pulseActivities.id, id));
        }

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
        laps: analyticsLapsFromCache(laps),
      });

      // Compare to last 30d activities of same type (loose ±25% duration)
      let comparable: { countLast30d: number; avgEf: number | null; avgDecouplingPct: number | null } | null = null;
      if (result.ef || result.decoupling) {
        const since30d = new Date(activity.startTime.getTime() - 30 * 86_400_000);
        const dur = activity.durationSec ?? 0;
        const peers = await db.select({
          rawData:      pulseActivities.rawData,
          garminLaps:   pulseActivities.garminLaps,
          activityType: pulseActivities.activityType,
          durationSec: pulseActivities.durationSec,
        }).from(pulseActivities)
          .where(and(
            eq(pulseActivities.userId, userId),
            eq(pulseActivities.activityType, activity.activityType),
            gte(pulseActivities.startTime, since30d),
          ))
          .limit(40);

        // Use only ones with cached laps and similar duration.
        const efs: number[] = [];
        const decs: number[] = [];
        for (const p of peers) {
          const peerLaps = asGarminLapCache(p.garminLaps);
          if (!peerLaps.length) {
            peerLaps.push(...legacyRawDetailCache(p.rawData).laps);
          }
          if (!peerLaps?.length) continue;
          if (dur > 0 && p.durationSec != null) {
            const ratio = p.durationSec / dur;
            if (ratio < 0.75 || ratio > 1.25) continue;
          }
          const r = computeFromLaps({
            activityType: p.activityType,
            laps: analyticsLapsFromCache(peerLaps),
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
        equipmentIds: assignedEquipment.map(row => row.equipmentId),
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

  // ─── Web Push settings + subscriptions ─────────────────────────────────────
  app.get('/push/settings', { onRequest: [app.authenticate] }, async (req) => {
    const userId = req.user.sub;
    const [profile] = await db.select({
      topics: pulseUserProfile.pushTopics,
      quietStart: pulseUserProfile.pushQuietStart,
      quietEnd: pulseUserProfile.pushQuietEnd,
    }).from(pulseUserProfile).where(eq(pulseUserProfile.userId, userId));

    const subscriptions = await db.select({
      id: pulsePushSubscriptions.id,
      endpoint: pulsePushSubscriptions.endpoint,
      deviceLabel: pulsePushSubscriptions.deviceLabel,
      enabled: pulsePushSubscriptions.enabled,
      lastSuccessAt: pulsePushSubscriptions.lastSuccessAt,
      lastErrorAt: pulsePushSubscriptions.lastErrorAt,
      consecutiveFailures: pulsePushSubscriptions.consecutiveFailures,
      createdAt: pulsePushSubscriptions.createdAt,
      updatedAt: pulsePushSubscriptions.updatedAt,
    }).from(pulsePushSubscriptions)
      .where(eq(pulsePushSubscriptions.userId, userId))
      .orderBy(desc(pulsePushSubscriptions.createdAt));

    return {
      configured: isPushConfigured(),
      publicKey: env.VAPID_PUBLIC_KEY ?? null,
      topics: normalizePushTopics(profile?.topics),
      quietHours: {
        start: hhmm(profile?.quietStart, '22:00'),
        end: hhmm(profile?.quietEnd, '06:30'),
      },
      subscriptions,
    };
  });

  app.post('/push/subscribe', { onRequest: [app.authenticate] }, async (req, reply) => {
    const parsed = pushSubscriptionSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Ungültige Push-Subscription' });
    const userId = req.user.sub;
    const now = new Date();

    const [subscription] = await db.insert(pulsePushSubscriptions).values({
      userId,
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.keys.p256dh,
      auth: parsed.data.keys.auth,
      deviceLabel: parsed.data.deviceLabel ?? null,
      enabled: true,
      consecutiveFailures: 0,
      updatedAt: now,
    }).onConflictDoUpdate({
      target: pulsePushSubscriptions.endpoint,
      set: {
        userId,
        p256dh: parsed.data.keys.p256dh,
        auth: parsed.data.keys.auth,
        deviceLabel: parsed.data.deviceLabel ?? null,
        enabled: true,
        consecutiveFailures: 0,
        updatedAt: now,
      },
    }).returning();

    await invalidateUser(userId);

    return reply.status(201).send({ subscription });
  });

  app.delete('/push/subscribe', { onRequest: [app.authenticate] }, async (req, reply) => {
    const parsed = z.object({ endpoint: z.string().url() }).safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Ungültige Push-Subscription' });
    const userId = req.user.sub;
    await db.delete(pulsePushSubscriptions)
      .where(and(eq(pulsePushSubscriptions.userId, userId), eq(pulsePushSubscriptions.endpoint, parsed.data.endpoint)));
    await invalidateUser(userId);
    return reply.status(204).send();
  });

  app.get('/push/topics', { onRequest: [app.authenticate] }, async (req) => {
    const userId = req.user.sub;
    const [profile] = await db.select({ topics: pulseUserProfile.pushTopics })
      .from(pulseUserProfile).where(eq(pulseUserProfile.userId, userId));
    return normalizePushTopics(profile?.topics);
  });

  app.patch('/push/topics', { onRequest: [app.authenticate] }, async (req, reply) => {
    const parsed = pushTopicsPatchSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Ungültige Push-Themen' });
    const userId = req.user.sub;
    const [profile] = await db.select({ topics: pulseUserProfile.pushTopics })
      .from(pulseUserProfile).where(eq(pulseUserProfile.userId, userId));
    const currentTopics = normalizePushTopics(profile?.topics);
    const nextTopics: PulsePushTopics = {
      briefing: parsed.data.briefing ?? currentTopics.briefing,
      checkin_reminder: parsed.data.checkin_reminder ?? currentTopics.checkin_reminder,
      risk_critical: parsed.data.risk_critical ?? currentTopics.risk_critical,
    };

    const [updated] = await db.insert(pulseUserProfile).values({
      userId,
      pushTopics: nextTopics,
      updatedAt: new Date(),
    }).onConflictDoUpdate({
      target: pulseUserProfile.userId,
      set: { pushTopics: nextTopics, updatedAt: new Date() },
    }).returning({ topics: pulseUserProfile.pushTopics });

    return normalizePushTopics(updated?.topics ?? DEFAULT_PUSH_TOPICS);
  });

  app.patch('/push/quiet-hours', { onRequest: [app.authenticate] }, async (req, reply) => {
    const parsed = quietHoursSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Ungültige stille Zeiten' });
    const userId = req.user.sub;

    const [updated] = await db.insert(pulseUserProfile).values({
      userId,
      pushQuietStart: parsed.data.start,
      pushQuietEnd: parsed.data.end,
      updatedAt: new Date(),
    }).onConflictDoUpdate({
      target: pulseUserProfile.userId,
      set: { pushQuietStart: parsed.data.start, pushQuietEnd: parsed.data.end, updatedAt: new Date() },
    }).returning({ start: pulseUserProfile.pushQuietStart, end: pulseUserProfile.pushQuietEnd });

    return { start: hhmm(updated?.start, parsed.data.start), end: hhmm(updated?.end, parsed.data.end) };
  });

  app.post('/push/test', { onRequest: [app.authenticate] }, async (req, reply) => {
    if (!isPushConfigured()) {
      return reply.status(503).send({ error: 'Web Push ist serverseitig noch nicht konfiguriert.' });
    }
    const userId = req.user.sub;
    const result = await sendPushToUser(userId, {
      topic: 'briefing',
      title: 'Pulse Test',
      body: 'Push ist aktiv.',
      url: '/settings',
      tag: 'pulse-test',
    });
    return { ok: true, result };
  });

  // GET /api/pulse/insights?domain=sleep|hrv|load|weight|mental|overall&days=30&refresh=false
  app.get('/insights', { onRequest: [app.authenticate] }, async (req, reply) => {
    const userId = req.user.sub;
    const query = req.query as { domain?: string; days?: string; refresh?: string };
    const domain = (query.domain ?? 'overall') as InsightDomain;
    const days = Math.min(90, Math.max(7, parseInt(query.days ?? '30', 10)));
    const forceRefresh = query.refresh === 'true';
    const validDomains: InsightDomain[] = ['sleep', 'hrv', 'load', 'weight', 'mental', 'overall'];
    if (!validDomains.includes(domain)) {
      return reply.code(400).send({
        error: 'Ungültige Insight-Domain.',
        code: 'invalid_domain',
        retryable: false,
        action: 'Wähle eine der sichtbaren Insight-Karten.',
      });
    }
    try {
      return await generateDeepInsight(userId, domain, days, forceRefresh);
    } catch (error) {
      req.log.error({ err: error, domain, days }, 'pulse insight generation failed');
      const classified = classifyInsightFailure(error);
      return reply.code(classified.status).send(classified.body);
    }
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

}
