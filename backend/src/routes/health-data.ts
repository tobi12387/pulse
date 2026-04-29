import type { FastifyInstance } from 'fastify';
import { db } from '../lib/db.js';
import { pulseDailyMetrics } from '../db/pulse-schema.js';
import { eq, desc } from 'drizzle-orm';
import { redis } from '../lib/redis.js';
import { CIRCUIT_OPEN_KEY } from '../jobs/garmin-sync.job.js';
import type { HealthSummaryResponse } from '@coaching-os/shared/health';

export default async function healthDataRoutes(app: FastifyInstance) {
  app.get('/summary', { onRequest: [app.authenticate] }, async (req): Promise<HealthSummaryResponse> => {
    const rows = await db.select()
      .from(pulseDailyMetrics)
      .where(eq(pulseDailyMetrics.userId, req.user.sub))
      .orderBy(desc(pulseDailyMetrics.date))
      .limit(7);

    const today = rows[0] ? {
      date:           rows[0].date,
      hrvRmssd:       rows[0].hrvRmssd,
      hrvStatus:      rows[0].hrvStatus,
      sleepDurationH: rows[0].sleepHours,
      sleepScore:     rows[0].sleepScore,
      restingHr:      rows[0].restingHr,
      steps:          rows[0].steps,
      caloriesActive: rows[0].caloriesActive,
      bodyBatteryMin: rows[0].bodyBatteryMin,
      bodyBatteryMax: rows[0].bodyBatteryMax,
      stressAvg:      rows[0].stressAvg,
    } : null;

    const trend7d = [...rows].reverse().map(r => ({
      date:           r.date,
      sleepDurationH: r.sleepHours,
      restingHr:      r.restingHr,
      bodyBatteryMax: r.bodyBatteryMax,
      steps:          r.steps,
    }));

    const lastSync = rows[0]?.syncedAt?.toISOString() ?? null;

    let circuitOpen = false;
    try {
      const result = await Promise.race([
        redis.exists(CIRCUIT_OPEN_KEY),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('redis timeout')), 500)
        ),
      ]);
      circuitOpen = result === 1;
    } catch { /* Redis unavailable or slow — default false */ }

    return { today, trend7d, lastSync, circuitOpen };
  });
}
