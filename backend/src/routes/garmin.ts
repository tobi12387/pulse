import type { FastifyInstance } from 'fastify';
import { db } from '../lib/db.js';
import { garminDailyHealth } from '../db/schema.js';
import { pulseDailyMetrics, pulseSleepSessions, pulseActivities, pulseWeightLog, pulsePlannedWorkouts, pulseUserProfile } from '../db/pulse-schema.js';
import { eq, desc, and } from 'drizzle-orm';
import { getGarminClient } from '../lib/garmin-client.js';
import { llmComplete, SMART_MODEL } from '../lib/llm.js';

async function generateWorkoutFeedback(
  planned: { activityType: string; zone: number; durationMin: number; description: string | null },
  actual: { durationSec: number | null; avgHr: number | null; maxHr: number | null; avgPowerW: number | null; normalizedPowerW: number | null; tss: number | null },
  profile: { maxHrBpm: number | null; ftpWatts: number | null } | undefined,
): Promise<{ feedback: string; complianceScore: number }> {
  const maxHr = profile?.maxHrBpm ?? 185;
  const ftp = profile?.ftpWatts ?? 250;

  const zoneHrRanges: Record<number, string> = {
    1: `<${Math.round(maxHr * 0.68)} bpm`,
    2: `${Math.round(maxHr * 0.68)}–${Math.round(maxHr * 0.78)} bpm`,
    3: `${Math.round(maxHr * 0.78)}–${Math.round(maxHr * 0.88)} bpm`,
    4: `${Math.round(maxHr * 0.88)}–${Math.round(maxHr * 0.95)} bpm`,
    5: `>${Math.round(maxHr * 0.95)} bpm`,
  };
  const zonePowerRanges: Record<number, string> = {
    1: `<${Math.round(ftp * 0.56)} W`,
    2: `${Math.round(ftp * 0.56)}–${Math.round(ftp * 0.75)} W`,
    3: `${Math.round(ftp * 0.75)}–${Math.round(ftp * 0.90)} W`,
    4: `${Math.round(ftp * 0.90)}–${Math.round(ftp * 1.05)} W`,
    5: `>${Math.round(ftp * 1.05)} W`,
  };

  const actualDurMin = actual.durationSec != null ? Math.round(actual.durationSec / 60) : null;
  const isBike = planned.activityType === 'bike';
  const zoneRef = isBike ? zonePowerRanges[planned.zone] : zoneHrRanges[planned.zone];
  const actualIntensity = isBike
    ? (actual.normalizedPowerW != null ? `NP ${actual.normalizedPowerW} W, Avg ${actual.avgPowerW ?? '?'} W` : `Avg HR ${actual.avgHr ?? '?'} bpm`)
    : `Avg HR ${actual.avgHr ?? '?'} bpm, Max HR ${actual.maxHr ?? '?'} bpm`;

  const prompt = `Du bist ein Ausdauer-Coach. Analysiere dieses Workout kurz und prägnant auf Deutsch.

GEPLANT:
- Typ: ${planned.activityType} | Zone ${planned.zone} (${zoneRef ?? '?'}) | ${planned.durationMin} min
- Beschreibung: ${planned.description ?? '–'}

ABSOLVIERT:
- Dauer: ${actualDurMin ?? '?'} min
- Intensität: ${actualIntensity}
- TSS: ${actual.tss ?? '?'}

Antworte NUR mit einem JSON-Objekt, kein Markdown, kein Text davor/danach:
{
  "feedback": "2-3 Sätze Feedback: Was lief gut, was war anders als geplant, eine konkrete Empfehlung für das nächste Training",
  "complianceScore": 0.0-1.0
}

complianceScore: 1.0 = perfekt nach Plan, 0.8 = leichte Abweichungen, 0.6 = deutliche Abweichungen, 0.4 = stark abgewichen`;

  const raw = await llmComplete('Du bist Ausdauer-Coach. Antworte nur mit validem JSON.', prompt, SMART_MODEL);
  const parsed = JSON.parse(raw.trim().replace(/^```json\n?|```$/g, ''));
  return {
    feedback: parsed.feedback ?? '',
    complianceScore: Math.max(0, Math.min(1, parsed.complianceScore ?? 0.7)),
  };
}

async function matchActivityToWorkout(
  userId: string,
  activityId: string,
  date: string,
  activityType: string,
  app?: FastifyInstance,
): Promise<void> {
  if (activityType === 'other') return;

  const matchType = activityType === 'hike' ? 'run' : activityType;

  const [planned] = await db.select()
    .from(pulsePlannedWorkouts)
    .where(and(
      eq(pulsePlannedWorkouts.userId, userId),
      eq(pulsePlannedWorkouts.plannedDate, date),
      eq(pulsePlannedWorkouts.status, 'planned'),
      eq(pulsePlannedWorkouts.activityType, matchType as 'run' | 'bike' | 'swim' | 'strength' | 'hike' | 'other'),
    ))
    .limit(1);

  if (!planned) return;

  await db.update(pulsePlannedWorkouts)
    .set({ status: 'completed', completedActivityId: activityId })
    .where(eq(pulsePlannedWorkouts.id, planned.id));

  // Async feedback generation — fire and forget
  (async () => {
    try {
      const [activity] = await db.select({
        durationSec: pulseActivities.durationSec,
        avgHr: pulseActivities.avgHr,
        maxHr: pulseActivities.maxHr,
        avgPowerW: pulseActivities.avgPowerW,
        normalizedPowerW: pulseActivities.normalizedPowerW,
        tss: pulseActivities.tss,
      }).from(pulseActivities).where(eq(pulseActivities.id, activityId));

      const [profile] = await db.select({ maxHrBpm: pulseUserProfile.maxHrBpm, ftpWatts: pulseUserProfile.ftpWatts })
        .from(pulseUserProfile).where(eq(pulseUserProfile.userId, userId));

      if (!activity) return;
      const { feedback, complianceScore } = await generateWorkoutFeedback(planned, activity, profile ?? undefined);
      await db.update(pulsePlannedWorkouts)
        .set({ workoutFeedback: feedback, complianceScore })
        .where(eq(pulsePlannedWorkouts.id, planned.id));
      app?.log.info(`[workout-feedback] ${planned.plannedDate} score=${complianceScore.toFixed(2)}`);
    } catch (err) {
      app?.log.warn(`[workout-feedback] generation failed: ${err}`);
    }
  })();
}

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
    // HRV is at top-level sleep object, not inside dailySleepDTO
    if (sleep?.avgOvernightHrv != null) hrvRmssd = sleep.avgOvernightHrv;
    if (sleep?.hrvStatus)               hrvStatus = String(sleep.hrvStatus).toLowerCase();
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

  // Sync activities for this date
  try {
    const activities = await (gc as any).getActivities(0, 20) as any[];
    const dayActivities = (activities ?? []).filter((a: any) => {
      const start = a.startTimeGMT ?? a.startTimeLocal ?? '';
      return start.startsWith(dateStr);
    });

    for (const a of dayActivities) {
      const typeKey: string = (a.activityType?.typeKey ?? '').toLowerCase();
      const activityType =
        typeKey.includes('running') || typeKey.includes('run') ? 'run' :
        typeKey.includes('cycling') || typeKey.includes('biking') || typeKey.includes('bike') ? 'bike' :
        typeKey.includes('swimming') || typeKey.includes('swim') ? 'swim' :
        typeKey.includes('strength') || typeKey.includes('weight') ? 'strength' :
        typeKey.includes('hiking') || typeKey.includes('hike') ? 'hike' : 'other';

      const externalId = String(a.activityId);
      const startTime = new Date(a.startTimeGMT ? `${a.startTimeGMT}Z` : a.startTimeLocal);
      const vals = {
        userId,
        externalId,
        source: 'garmin' as const,
        startTime,
        activityType: activityType as 'run' | 'bike' | 'swim' | 'strength' | 'hike' | 'other',
        name: a.activityName ?? null,
        durationSec: a.duration != null ? Math.round(a.duration) : null,
        distanceM: a.distance ?? null,
        avgHr: a.averageHR ?? null,
        maxHr: a.maxHR ?? null,
        avgPowerW: a.avgPower != null ? Math.round(a.avgPower) : null,
        normalizedPowerW: a.normPower != null ? Math.round(a.normPower) : null,
        tss: a.trainingStressScore ?? null,
        calories: a.calories != null ? Math.round(a.calories) : null,
        elevationGainM: a.elevationGain ?? null,
        trainingEffectAerobic: a.aerobicTrainingEffect ?? null,
        trainingEffectAnaerobic: a.anaerobicTrainingEffect ?? null,
        vo2maxEstimate: a.vO2MaxValue ?? null,
      };

      const [inserted] = await db.insert(pulseActivities).values(vals)
        .onConflictDoUpdate({
          target: [pulseActivities.externalId, pulseActivities.source],
          set: {
            name: vals.name, durationSec: vals.durationSec, distanceM: vals.distanceM,
            avgHr: vals.avgHr, maxHr: vals.maxHr, avgPowerW: vals.avgPowerW,
            normalizedPowerW: vals.normalizedPowerW, tss: vals.tss, calories: vals.calories,
            elevationGainM: vals.elevationGainM, trainingEffectAerobic: vals.trainingEffectAerobic,
            trainingEffectAnaerobic: vals.trainingEffectAnaerobic, vo2maxEstimate: vals.vo2maxEstimate,
          },
        }).returning({ id: pulseActivities.id });

      if (inserted) {
        await matchActivityToWorkout(userId, inserted.id, dateStr, activityType, app);
      }
    }
    if (dayActivities.length > 0) {
      app.log.info(`[garmin-sync] ${dateStr} activities: ${dayActivities.length}`);
    }
  } catch (err) {
    app.log.warn(`[garmin-sync] activity fetch failed for ${dateStr}: ${err}`);
  }

  // Sync weight for this date
  try {
    const weightData = await gc.getDailyWeightData(date) as any;
    const entries: any[] = weightData?.dateWeightList ?? [];
    // Use the first measurement of the day (most are from a scale, sourceType INDEX_SCALE)
    const entry = entries[0];
    if (entry?.weight) {
      const weightKg     = entry.weight / 1000;
      const bodyFatPct   = entry.bodyFat   ?? null;
      const muscleMassKg = entry.muscleMass != null ? entry.muscleMass / 1000 : null;
      const bmi          = entry.bmi       ?? null;
      await db.insert(pulseWeightLog).values({
        userId, date: dateStr, weightKg, bodyFatPct, muscleMassKg, bmi, source: 'garmin',
      }).onConflictDoUpdate({
        target: [pulseWeightLog.userId, pulseWeightLog.date],
        set: { weightKg, bodyFatPct, muscleMassKg, bmi, source: 'garmin' },
      });
      app.log.info(`[garmin-sync] ${dateStr} weight: ${weightKg.toFixed(1)}kg`);
    }
  } catch { /* weight not tracked every day */ }

  app.log.info(`[garmin-sync] ${dateStr} ✓`);
}
