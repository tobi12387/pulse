import type { FastifyInstance } from 'fastify';
import { db } from '../lib/db.js';
import { garminDailyHealth } from '../db/schema.js';
import { eq, desc } from 'drizzle-orm';
import { getGarminClient } from '../lib/garmin-client.js';

export default async function garminRoutes(app: FastifyInstance) {
  // GET /api/garmin/status
  app.get('/status', { onRequest: [app.authenticate] }, async (req) => {
    const [latest] = await db.select({ syncedAt: garminDailyHealth.syncedAt })
      .from(garminDailyHealth)
      .where(eq(garminDailyHealth.userId, req.user.sub))
      .orderBy(desc(garminDailyHealth.syncedAt))
      .limit(1);

    const lastSync = latest?.syncedAt?.toISOString() ?? null;
    let syncStatus: 'ok' | 'stale' | 'never' = 'never';
    if (lastSync) {
      const ageHours = (Date.now() - new Date(lastSync).getTime()) / 3_600_000;
      syncStatus = ageHours < 5 ? 'ok' : 'stale';
    }

    return { connected: true, lastSync, syncStatus, errorMessage: null };
  });

  // POST /api/garmin/sync — fetch today + yesterday from Garmin Connect
  app.post('/sync', { onRequest: [app.authenticate] }, async (req, reply) => {
    const today = new Date();
    const yesterday = new Date(Date.now() - 86_400_000);

    try {
      for (const date of [yesterday, today]) {
        await syncGarminDay(req.user.sub, date, app);
      }
    } catch (err) {
      app.log.error(`Garmin sync failed: ${err}`);
      return reply.status(502).send({ error: 'Garmin sync fehlgeschlagen. Zugangsdaten prüfen.' });
    }

    const todayStr = today.toISOString().split('T')[0]!;
    const yestStr  = yesterday.toISOString().split('T')[0]!;
    return { synced: [yestStr, todayStr] };
  });
}

export async function syncGarminDay(
  userId: string,
  date: Date,
  app: FastifyInstance,
): Promise<void> {
  const gc      = await getGarminClient();
  const dateStr = date.toISOString().split('T')[0]!;

  let sleepDurationH: number | null = null;
  let sleepScore: number | null     = null;
  let hrvStatus: string | null      = null;

  try {
    const sleep = await gc.getSleepData(date) as any;
    const dto   = sleep?.dailySleepDTO ?? sleep;
    if (dto?.sleepTimeSeconds)                    sleepDurationH = dto.sleepTimeSeconds / 3600;
    if (dto?.sleepScores?.overall?.value != null) sleepScore     = dto.sleepScores.overall.value;
    const hrv5day = dto?.hrv?.lastNight ?? dto?.hrv?.weeklyAvg ?? null;
    if (hrv5day != null) {
      hrvStatus = hrv5day > 50 ? 'balanced' : hrv5day > 30 ? 'unbalanced' : 'poor';
    }
  } catch { /* sleep data may not be available for all dates */ }

  let restingHr: number | null      = null;
  let steps: number | null          = null;
  let caloriesActive: number | null = null;
  let bodyBatteryMin: number | null = null;
  let bodyBatteryMax: number | null = null;
  let stressAvg: number | null      = null;
  let hrvRmssd: number | null       = null;

  try {
    const stats = await gc.getHeartRate(date) as any;
    if (stats?.restingHeartRate) restingHr = stats.restingHeartRate;
  } catch { /* ignore */ }

  try {
    const summary = await gc.getDailySummary(date) as any;
    if (summary?.totalSteps)            steps          = summary.totalSteps;
    if (summary?.activeCalories)        caloriesActive = summary.activeCalories;
    if (summary?.minBodyBattery != null) bodyBatteryMin = summary.minBodyBattery;
    if (summary?.maxBodyBattery != null) bodyBatteryMax = summary.maxBodyBattery;
    if (summary?.averageStressLevel)    stressAvg      = summary.averageStressLevel;
  } catch { /* ignore */ }

  try {
    const hrv = await gc.getHrvData(date) as any;
    const rmssd = hrv?.hrvSummary?.lastNight ?? hrv?.hrvSummary?.weekly5DayAvg ?? null;
    if (rmssd != null) hrvRmssd = rmssd;
  } catch { /* ignore */ }

  await db.insert(garminDailyHealth).values({
    userId,
    date: dateStr,
    hrvRmssd,
    hrvStatus,
    sleepDurationH,
    sleepScore,
    restingHr,
    steps,
    caloriesActive,
    bodyBatteryMin,
    bodyBatteryMax,
    stressAvg,
  }).onConflictDoUpdate({
    target: [garminDailyHealth.userId, garminDailyHealth.date],
    set: {
      hrvRmssd,
      hrvStatus,
      sleepDurationH,
      sleepScore,
      restingHr,
      steps,
      caloriesActive,
      bodyBatteryMin,
      bodyBatteryMax,
      stressAvg,
      syncedAt: new Date(),
    },
  });

  app.log.info(`[garmin-sync] ${dateStr} ✓`);
}
