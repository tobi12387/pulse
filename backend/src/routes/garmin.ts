import type { FastifyInstance } from 'fastify';
import { db } from '../lib/db.js';
import { garminDailyHealth } from '../db/schema.js';
import { pulseDailyMetrics, pulseSleepSessions } from '../db/pulse-schema.js';
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

  // Get display name once (needed for the usersummary API URL)
  const profile = await (gc as any).getUserProfile() as any;
  const displayName: string = profile?.displayName ?? '';

  let sleepDurationH: number | null = null;
  let sleepScore: number | null     = null;
  let hrvStatus: string | null      = null;
  let hrvRmssd: number | null       = null;
  let deepSleepH: number | null     = null;
  let remSleepH: number | null      = null;
  let lightSleepH: number | null    = null;
  let awakeSleepH: number | null    = null;

  try {
    const sleep = await gc.getSleepData(date) as any;
    const dto   = sleep?.dailySleepDTO ?? sleep;
    if (dto?.sleepTimeSeconds)                    sleepDurationH = dto.sleepTimeSeconds / 3600;
    if (dto?.sleepScores?.overall?.value != null) sleepScore     = dto.sleepScores.overall.value;
    if (dto?.deepSleepSeconds  != null)           deepSleepH  = dto.deepSleepSeconds  / 3600;
    if (dto?.lightSleepSeconds != null)           lightSleepH = dto.lightSleepSeconds / 3600;
    if (dto?.remSleepSeconds   != null)           remSleepH   = dto.remSleepSeconds   / 3600;
    if (dto?.awakeSleepSeconds != null)           awakeSleepH = dto.awakeSleepSeconds / 3600;
    // HRV from sleep
    if (dto?.hrvStatus) hrvStatus = String(dto.hrvStatus).toLowerCase();
    const hrv5day = dto?.hrv?.lastNight ?? dto?.hrv?.weeklyAvg ?? null;
    if (hrv5day != null && !hrvStatus) {
      hrvStatus = hrv5day > 50 ? 'balanced' : hrv5day > 30 ? 'unbalanced' : 'poor';
    }
    if (hrv5day != null) hrvRmssd = hrv5day;
  } catch { /* sleep data may not be available for all dates */ }

  let restingHr: number | null      = null;
  let steps: number | null          = null;
  let caloriesActive: number | null = null;
  let bodyBatteryMin: number | null = null;
  let bodyBatteryMax: number | null = null;
  let stressAvg: number | null      = null;

  try {
    const hr = await gc.getHeartRate(date) as any;
    if (hr?.restingHeartRate) restingHr = hr.restingHeartRate;
  } catch { /* ignore */ }

  // Daily summary via direct Garmin API — steps, stress, calories, body battery
  try {
    const summary = await (gc as any).get(
      `https://connectapi.garmin.com/usersummary-service/usersummary/daily/${displayName}?calendarDate=${dateStr}`,
    ) as any;
    if (summary?.totalSteps != null)                  steps          = summary.totalSteps;
    if (summary?.averageStressLevel != null)           stressAvg      = summary.averageStressLevel;
    if (summary?.activeKilocalories != null)           caloriesActive = summary.activeKilocalories;
    if (summary?.minBodyBatteryLevel != null)          bodyBatteryMin = summary.minBodyBatteryLevel;
    if (summary?.bodyBatteryMostRecentValue != null)   bodyBatteryMax = summary.bodyBatteryMostRecentValue;
  } catch { /* daily summary unavailable */ }

  const upsertSet = {
    hrvRmssd, hrvStatus, sleepDurationH, sleepScore,
    restingHr, steps, caloriesActive, bodyBatteryMin, bodyBatteryMax, stressAvg,
    syncedAt: new Date(),
  };

  await db.insert(garminDailyHealth).values({ userId, date: dateStr, ...upsertSet })
    .onConflictDoUpdate({ target: [garminDailyHealth.userId, garminDailyHealth.date], set: upsertSet });

  // Also write to pulse_daily_metrics so pulse screens have fresh data
  await db.insert(pulseDailyMetrics).values({
    userId, date: dateStr,
    hrvRmssd, hrvStatus, restingHr,
    sleepHours: sleepDurationH, sleepScore,
    bodyBatteryMin, bodyBatteryMax, stressAvg, steps,
    caloriesActive, source: 'garmin', syncedAt: new Date(),
  }).onConflictDoUpdate({
    target: [pulseDailyMetrics.userId, pulseDailyMetrics.date],
    set: {
      hrvRmssd, hrvStatus, restingHr,
      sleepHours: sleepDurationH, sleepScore,
      bodyBatteryMin, bodyBatteryMax, stressAvg, steps,
      caloriesActive, syncedAt: new Date(),
    },
  });

  // Write sleep session if we have sleep data
  if (sleepDurationH != null) {
    await db.insert(pulseSleepSessions).values({
      userId, date: dateStr,
      durationH: sleepDurationH, sleepScore,
      deepSleepH, remSleepH, lightSleepH, awakeH: awakeSleepH,
      source: 'garmin',
    }).onConflictDoUpdate({
      target: [pulseSleepSessions.userId, pulseSleepSessions.date],
      set: { durationH: sleepDurationH, sleepScore, deepSleepH, remSleepH, lightSleepH, awakeH: awakeSleepH },
    });
  }

  app.log.info(`[garmin-sync] ${dateStr} ✓`);
}
