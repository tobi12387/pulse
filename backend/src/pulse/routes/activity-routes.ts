import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { and, desc, eq, gte } from 'drizzle-orm';
import { RPE_SORENESS_AREAS } from '@coaching-os/shared/pulse';
import { db } from '../../lib/db.js';
import { garminApi } from '../../lib/garmin-client.js';
import {
  pulseActivities,
  pulseEquipmentActivity,
  pulseSleepSessions,
  type GarminActivityDetailCache,
  type GarminActivityHrZoneCache,
  type GarminActivityLapCache,
} from '../../db/pulse-schema.js';
import { invalidateUser } from '../lib/pulse-cache.js';
import { refreshAdaptationEventsForUser } from '../services/adaptation-events.js';

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

export async function registerPulseActivityRoutes(app: FastifyInstance) {
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
        const { getGarminClient } = await import('../../lib/garmin-client.js');
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
      const { computeFromLaps } = await import('../../lib/activity-analytics.js');
      const result = computeFromLaps({
        activityType: activity.activityType,
        laps: analyticsLapsFromCache(laps),
      });

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
    await refreshAdaptationEventsForUser(db, userId, new Date().toISOString().split('T')[0]!).catch((err: unknown) => {
      app.log.warn(`[activity-feedback] Failed to refresh adaptation events for ${userId}: ${err}`);
    });

    return {
      activity: {
        ...updated,
        startTime: updated.startTime.toISOString(),
        feedbackLoggedAt: updated.feedbackLoggedAt?.toISOString() ?? null,
      },
    };
  });
}
