import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { db } from '../../lib/db.js';
import { garminDailyHealth } from '../../db/schema.js';
import {
  pulseActivities,
  pulseDailyMetrics,
  pulseSleepSessions,
  pulseWeightLog,
} from '../../db/pulse-schema.js';
import { garminApi, getGarminClient } from '../../lib/garmin-client.js';
import { getGarminActivitiesForDate, upsertGarminActivity } from '../../lib/garmin-activities.js';
import { normalizeGarminDailySummary, normalizeGarminSleepData } from '../../lib/garmin-recovery.js';
import { autoAssignDefaultEquipmentForActivity } from './strength-equipment.js';
import { matchActivityToWorkout } from './workout-execution-sync.js';
import { refreshAdaptationEventsForUser } from './adaptation-events.js';

export type GarminSyncDomain = 'dailyMetrics' | 'sleep' | 'activities' | 'weight';

export interface GarminSyncDomainError {
  domain: GarminSyncDomain;
  message: string;
}

export interface GarminSyncDayResult {
  date: string;
  dailyMetrics: boolean;
  activities: number;
  weight: boolean;
  errors: GarminSyncDomainError[];
}

export async function syncGarminDay(
  userId: string,
  date: Date,
  app: FastifyInstance,
): Promise<GarminSyncDayResult> {
  const gc      = await getGarminClient();
  const dateStr = date.toISOString().split('T')[0]!;
  const errors: GarminSyncDomainError[] = [];
  const messageOf = (err: unknown) => err instanceof Error ? err.message : String(err);

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
  let sleepStartTime: Date | null = null;
  let sleepEndTime: Date | null = null;
  let sleepNeedMin: number | null = null;
  let sleepActualMin: number | null = null;
  let avgSleepStress: number | null = null;
  let avgSleepHr: number | null = null;
  let avgRespiration: number | null = null;
  let restlessMoments: number | null = null;
  let bodyBatteryChange: number | null = null;
  let breathingDisruptionIndex: number | null = null;
  let sleepRawData: unknown = null;

  try {
    const sleep = await gc.getSleepData(date) as any;
    const normalized = normalizeGarminSleepData(sleep);
    sleepDurationH = normalized.durationH;
    sleepScore = normalized.sleepScore;
    deepSleepH = normalized.deepSleepH;
    remSleepH = normalized.remSleepH;
    lightSleepH = normalized.lightSleepH;
    awakeSleepH = normalized.awakeH;
    hrvRmssd = normalized.hrvRmssd;
    hrvStatus = normalized.hrvStatus;
    sleepStartTime = normalized.startTime;
    sleepEndTime = normalized.endTime;
    sleepNeedMin = normalized.sleepNeedMin;
    sleepActualMin = normalized.sleepActualMin;
    avgSleepStress = normalized.avgSleepStress;
    avgSleepHr = normalized.avgSleepHr;
    avgRespiration = normalized.avgRespiration;
    restlessMoments = normalized.restlessMoments;
    bodyBatteryChange = normalized.bodyBatteryChange;
    breathingDisruptionIndex = normalized.breathingDisruptionIndex;
    sleepRawData = normalized.rawData;
  } catch (err) {
    errors.push({ domain: 'sleep', message: messageOf(err) });
  }

  let restingHr: number | null      = null;
  let steps: number | null          = null;
  let caloriesActive: number | null = null;
  let bodyBatteryMin: number | null = null;
  let bodyBatteryMax: number | null = null;
  let bodyBatteryCharged: number | null = null;
  let bodyBatteryDrained: number | null = null;
  let bodyBatteryHighest: number | null = null;
  let bodyBatteryLowest: number | null = null;
  let bodyBatteryAtWake: number | null = null;
  let stressAvg: number | null      = null;
  let maxStress: number | null = null;
  let lowStressSec: number | null = null;
  let mediumStressSec: number | null = null;
  let highStressSec: number | null = null;
  let moderateIntensityMin: number | null = null;
  let vigorousIntensityMin: number | null = null;
  let avgWakingRespiration: number | null = null;
  let latestSpo2: number | null = null;
  let dailyRawData: unknown = null;

  try {
    const hr = await gc.getHeartRate(date) as any;
    if (hr?.restingHeartRate) restingHr = hr.restingHeartRate;
  } catch (err) {
    errors.push({ domain: 'dailyMetrics', message: `heartRate: ${messageOf(err)}` });
  }

  try {
    const summary = await garminApi.getDailyUserSummary(gc, displayName, dateStr) as any;
    const normalized = normalizeGarminDailySummary(summary);
    steps = normalized.steps;
    stressAvg = normalized.stressAvg;
    caloriesActive = normalized.caloriesActive;
    bodyBatteryMin = normalized.bodyBatteryMin;
    bodyBatteryMax = normalized.bodyBatteryMax;
    bodyBatteryCharged = normalized.bodyBatteryCharged;
    bodyBatteryDrained = normalized.bodyBatteryDrained;
    bodyBatteryHighest = normalized.bodyBatteryHighest;
    bodyBatteryLowest = normalized.bodyBatteryLowest;
    bodyBatteryAtWake = normalized.bodyBatteryAtWake;
    maxStress = normalized.maxStress;
    lowStressSec = normalized.lowStressSec;
    mediumStressSec = normalized.mediumStressSec;
    highStressSec = normalized.highStressSec;
    moderateIntensityMin = normalized.moderateIntensityMin;
    vigorousIntensityMin = normalized.vigorousIntensityMin;
    avgWakingRespiration = normalized.avgWakingRespiration;
    latestSpo2 = normalized.latestSpo2;
    dailyRawData = normalized.rawData;
  } catch (err) {
    errors.push({ domain: 'dailyMetrics', message: `dailySummary: ${messageOf(err)}` });
  }

  const upsertSet = {
    hrvRmssd, hrvStatus, sleepDurationH, sleepScore,
    restingHr, steps, caloriesActive, bodyBatteryMin, bodyBatteryMax, stressAvg,
    syncedAt: new Date(),
  };

  // Legacy compatibility until the last consumer has moved to pulse_daily_metrics.
  await db.insert(garminDailyHealth).values({ userId, date: dateStr, ...upsertSet })
    .onConflictDoUpdate({ target: [garminDailyHealth.userId, garminDailyHealth.date], set: upsertSet });

  await db.insert(pulseDailyMetrics).values({
    userId, date: dateStr,
    hrvRmssd, hrvStatus, restingHr,
    sleepHours: sleepDurationH, sleepScore,
    bodyBatteryMin, bodyBatteryMax, stressAvg, steps,
    bodyBatteryCharged, bodyBatteryDrained, bodyBatteryHighest, bodyBatteryLowest, bodyBatteryAtWake,
    maxStress, lowStressSec, mediumStressSec, highStressSec,
    moderateIntensityMin, vigorousIntensityMin, avgWakingRespiration, latestSpo2,
    caloriesActive, source: 'garmin', rawData: dailyRawData, syncedAt: new Date(),
  }).onConflictDoUpdate({
    target: [pulseDailyMetrics.userId, pulseDailyMetrics.date],
    set: {
      hrvRmssd, hrvStatus, restingHr,
      sleepHours: sleepDurationH, sleepScore,
      bodyBatteryMin, bodyBatteryMax, stressAvg, steps,
      bodyBatteryCharged, bodyBatteryDrained, bodyBatteryHighest, bodyBatteryLowest, bodyBatteryAtWake,
      maxStress, lowStressSec, mediumStressSec, highStressSec,
      moderateIntensityMin, vigorousIntensityMin, avgWakingRespiration, latestSpo2,
      caloriesActive, rawData: dailyRawData, syncedAt: new Date(),
    },
  });

  if (sleepDurationH != null) {
    await db.insert(pulseSleepSessions).values({
      userId, date: dateStr,
      startTime: sleepStartTime,
      endTime: sleepEndTime,
      durationH: sleepDurationH, sleepScore,
      deepSleepH, remSleepH, lightSleepH, awakeH: awakeSleepH,
      sleepNeedMin, sleepActualMin, avgSleepStress, avgSleepHr, avgRespiration,
      restlessMoments, bodyBatteryChange, breathingDisruptionIndex,
      source: 'garmin', rawData: sleepRawData,
    }).onConflictDoUpdate({
      target: [pulseSleepSessions.userId, pulseSleepSessions.date],
      set: {
        startTime: sleepStartTime,
        endTime: sleepEndTime,
        durationH: sleepDurationH,
        sleepScore,
        deepSleepH,
        remSleepH,
        lightSleepH,
        awakeH: awakeSleepH,
        sleepNeedMin,
        sleepActualMin,
        avgSleepStress,
        avgSleepHr,
        avgRespiration,
        restlessMoments,
        bodyBatteryChange,
        breathingDisruptionIndex,
        rawData: sleepRawData,
      },
    });
  }

  let activitiesWritten = 0;
  try {
    const dayActivities = await getGarminActivitiesForDate(gc, dateStr);

    for (const a of dayActivities) {
      const inserted = await upsertGarminActivity(userId, a);

      if (inserted) {
        activitiesWritten++;
        await matchActivityToWorkout(userId, inserted.id, dateStr, inserted.activityType, app);
        try {
          await autoAssignDefaultEquipmentForActivity(userId, inserted.id);
        } catch (err) {
          app?.log.warn(`[equipment-auto-tally] activity=${inserted.id}: ${err}`);
        }

        if (!inserted.isIndoor && inserted.startLat != null && inserted.startLon != null) {
          void (async () => {
            try {
              const { getHistoricalWeather } = await import('../../lib/weather.js');
              const ts = Math.floor(inserted.startTime.getTime() / 1000);
              const w = await getHistoricalWeather({ latitude: inserted.startLat!, longitude: inserted.startLon!, timestamp: ts });
              if (w) {
                await db.update(pulseActivities)
                  .set({ weather: w })
                  .where(eq(pulseActivities.id, inserted.id));
              }
            } catch (err) {
              app?.log.warn(`[weather-backfill] activity=${inserted.id}: ${err}`);
            }
          })();
        }
      }
    }
    if (dayActivities.length > 0) {
      app.log.info(`[garmin-sync] ${dateStr} activities: ${dayActivities.length}`);
    }
  } catch (err) {
    errors.push({ domain: 'activities', message: messageOf(err) });
    app.log.warn(`[garmin-sync] activity fetch failed for ${dateStr}: ${err}`);
  }

  let weightWritten = false;
  try {
    const weightData = await gc.getDailyWeightData(date) as any;
    const entries: any[] = weightData?.dateWeightList ?? [];
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
      weightWritten = true;
      app.log.info(`[garmin-sync] ${dateStr} weight: ${weightKg.toFixed(1)}kg`);
    }
  } catch (err) {
    errors.push({ domain: 'weight', message: messageOf(err) });
  }

  app.log.info(`[garmin-sync] ${dateStr} ✓`);
  const decisionDate = new Date().toISOString().split('T')[0]!;
  await refreshAdaptationEventsForUser(db, userId, decisionDate).catch((err: unknown) => {
    app.log.warn(`[garmin-sync] adaptation refresh failed for ${decisionDate}: ${err}`);
  });
  return { date: dateStr, dailyMetrics: true, activities: activitiesWritten, weight: weightWritten, errors };
}
