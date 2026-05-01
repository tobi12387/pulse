import type { FastifyInstance } from 'fastify';
import { db } from '../lib/db.js';
import { garminDailyHealth } from '../db/schema.js';
import { pulseDailyMetrics, pulseSleepSessions, pulseActivities, pulseWeightLog, pulsePlannedWorkouts, pulseUserProfile, pulseNutritionLogs } from '../db/pulse-schema.js';
import { eq, desc, and, or } from 'drizzle-orm';
import { getGarminClient } from '../lib/garmin-client.js';
import { getGarminActivitiesForDate, upsertGarminActivity } from '../lib/garmin-activities.js';
import { normalizeGarminDailySummary, normalizeGarminSleepData } from '../lib/garmin-recovery.js';
import { llmComplete, SMART_MODEL } from '../lib/llm.js';
import { autoAssignDefaultEquipmentForActivity } from '../pulse/services/strength-equipment.js';
import { deriveWorkoutExecutionState, scoreActivityWorkoutMatch } from '../pulse/services/workout-reconciliation.js';

interface NutritionContext {
  carbsG: number;             // sum during/post
  gelsCount: number;
  drinksMl: number;
  sodiumMg: number;
  hadAnyLog: boolean;
}

function buildNutritionContext(logs: Array<{
  context: string | null; carbsG: number | null; gelsCount: number | null;
  drinksMl: number | null; sodiumMg: number | null;
}>): NutritionContext {
  const relevant = logs.filter(l => l.context === 'during' || l.context === 'post' || l.context == null);
  const sum = (k: keyof typeof relevant[0]) =>
    relevant.reduce((s, l) => s + (typeof l[k] === 'number' ? (l[k] as number) : 0), 0);
  return {
    carbsG:    sum('carbsG'),
    gelsCount: sum('gelsCount'),
    drinksMl:  sum('drinksMl'),
    sodiumMg:  sum('sodiumMg'),
    hadAnyLog: logs.length > 0,
  };
}

function recommendedCarbsPerHour(activityType: string, durationMin: number): number {
  if (activityType === 'bike') {
    if (durationMin < 60)  return 30;
    if (durationMin < 120) return 60;
    return 80;
  }
  if (activityType === 'run') {
    if (durationMin < 75)  return 20;
    return 50;
  }
  return 30;
}

async function generateWorkoutFeedback(
  planned: { activityType: string; zone: number; durationMin: number; description: string | null },
  actual: { durationSec: number | null; avgHr: number | null; maxHr: number | null; avgPowerW: number | null; normalizedPowerW: number | null; tss: number | null },
  profile: { maxHrBpm: number | null; ftpWatts: number | null } | undefined,
  nutrition?: NutritionContext,
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
  const zoneRef = isBike
    ? `${zoneHrRanges[planned.zone]} (Power sekundär: ${zonePowerRanges[planned.zone] ?? '?'})`
    : zoneHrRanges[planned.zone];
  const actualIntensity = isBike
    ? `Avg HR ${actual.avgHr ?? '?'} bpm, Max HR ${actual.maxHr ?? '?'} bpm${actual.normalizedPowerW != null ? `, NP ${actual.normalizedPowerW} W` : ''}${actual.avgPowerW != null ? `, Avg ${actual.avgPowerW} W` : ''}`
    : `Avg HR ${actual.avgHr ?? '?'} bpm, Max HR ${actual.maxHr ?? '?'} bpm`;

  // Phase 9: Nutrition-Block — distinguishes weak performance due to fueling vs form
  let nutritionBlock = '';
  if (nutrition) {
    const dur = actualDurMin ?? planned.durationMin;
    const recCarbs = recommendedCarbsPerHour(planned.activityType, dur);
    const expectedCarbs = Math.round((dur / 60) * recCarbs);
    if (nutrition.hadAnyLog) {
      const carbsPerH = dur > 0 ? Math.round(nutrition.carbsG / (dur / 60)) : 0;
      nutritionBlock = `\nFUELING:\n- Carbs: ${nutrition.carbsG}g (${carbsPerH}g/h, Empfehlung ${recCarbs}g/h)\n- Gels: ${nutrition.gelsCount} | Trinken: ${nutrition.drinksMl}ml | Sodium: ${nutrition.sodiumMg}mg\n- Erwartung für ${dur}min: ~${expectedCarbs}g Carbs`;
    } else if (dur >= 60) {
      nutritionBlock = `\nFUELING:\n- Kein Fueling-Log erfasst (Empfehlung für ${dur}min: ~${expectedCarbs}g Carbs, ${Math.round(dur * 8)}ml)`;
    }
  }

  const prompt = `Du bist ein Ausdauer-Coach. Analysiere dieses Workout kurz und prägnant auf Deutsch.

GEPLANT:
- Typ: ${planned.activityType} | Zone ${planned.zone} (${zoneRef ?? '?'}) | ${planned.durationMin} min
- Beschreibung: ${planned.description ?? '–'}

ABSOLVIERT:
- Dauer: ${actualDurMin ?? '?'} min
- Intensität: ${actualIntensity}
- TSS: ${actual.tss ?? '?'}${nutritionBlock}

Antworte NUR mit einem JSON-Objekt, kein Markdown, kein Text davor/danach:
{
  "feedback": "2-3 Sätze Feedback: Was lief gut, was war anders als geplant, eine konkrete Empfehlung für das nächste Training. Wenn Fueling unter Empfehlung lag, nenne das als möglichen Grund für schwache Performance — nicht als Plan-Abweichung.",
  "complianceScore": 0.0-1.0
}

complianceScore beurteilt NUR Pace/HR/Dauer-Treue zum Plan, nicht das Fueling: 1.0 = perfekt, 0.8 = leichte Abweichungen, 0.6 = deutliche Abweichungen, 0.4 = stark abgewichen.`;

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
  const [activityForMatch] = await db.select({
    id: pulseActivities.id,
    startTime: pulseActivities.startTime,
    activityType: pulseActivities.activityType,
    durationSec: pulseActivities.durationSec,
  }).from(pulseActivities).where(eq(pulseActivities.id, activityId));

  if (!activityForMatch) return;

  const plannedWorkouts = await db.select()
    .from(pulsePlannedWorkouts)
    .where(and(
      eq(pulsePlannedWorkouts.userId, userId),
      eq(pulsePlannedWorkouts.plannedDate, date),
      eq(pulsePlannedWorkouts.status, 'planned'),
    ));

  if (plannedWorkouts.length === 0) return;

  const ranked = plannedWorkouts
    .map(workout => ({
      workout,
      score: scoreActivityWorkoutMatch(workout, activityForMatch),
    }))
    .sort((a, b) => b.score - a.score);
  const best = ranked[0];
  if (!best) return;

  const state = deriveWorkoutExecutionState(
    best.workout,
    null,
    activityForMatch,
    new Date(),
  );

  if (best.score < 0.6 || state.status === 'replaced_or_off_plan') {
    await db.update(pulsePlannedWorkouts)
      .set({
        executionStatus: 'replaced_or_off_plan',
        executionMatchedAt: new Date(),
        executionMatchConfidence: best.score,
        executionNotes: `Am Plantag wurde eine andere Aktivitaet (${activityType}) gefunden.`,
      })
      .where(eq(pulsePlannedWorkouts.id, best.workout.id));
    return;
  }

  const planned = best.workout;

  await db.update(pulsePlannedWorkouts)
    .set({
      status: 'completed',
      completedActivityId: activityId,
      executionStatus: 'completed_matched',
      executionMatchedAt: new Date(),
      executionMatchConfidence: best.score,
      executionNotes: `Mit Garmin-Aktivitaet ${activityId} abgeglichen.`,
    })
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

      // Phase 9: gather nutrition logs for this workout (workoutId match) + same-day fallback
      const nutritionLogs = await db.select({
        context: pulseNutritionLogs.context,
        carbsG:  pulseNutritionLogs.carbsG,
        gelsCount: pulseNutritionLogs.gelsCount,
        drinksMl:  pulseNutritionLogs.drinksMl,
        sodiumMg:  pulseNutritionLogs.sodiumMg,
      }).from(pulseNutritionLogs)
        .where(and(
          eq(pulseNutritionLogs.userId, userId),
          or(
            eq(pulseNutritionLogs.workoutId,  planned.id),
            eq(pulseNutritionLogs.activityId, activityId),
          ),
        ));
      const nutrition = nutritionLogs.length > 0
        ? buildNutritionContext(nutritionLogs.map(l => ({
            context:    l.context,
            carbsG:     l.carbsG,
            gelsCount:  l.gelsCount,
            drinksMl:   l.drinksMl,
            sodiumMg:   l.sodiumMg,
          })))
        : { carbsG: 0, gelsCount: 0, drinksMl: 0, sodiumMg: 0, hadAnyLog: false };

      const { feedback, complianceScore } = await generateWorkoutFeedback(planned, activity, profile ?? undefined, nutrition);
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
    const [latest] = await db.select({ syncedAt: pulseDailyMetrics.syncedAt })
      .from(pulseDailyMetrics)
      .where(eq(pulseDailyMetrics.userId, req.user.sub))
      .orderBy(desc(pulseDailyMetrics.syncedAt))
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
): Promise<{
  date: string;
  dailyMetrics: boolean;
  activities: number;
  weight: boolean;
  errors: Array<{ domain: 'dailyMetrics' | 'sleep' | 'activities' | 'weight'; message: string }>;
}> {
  const gc      = await getGarminClient();
  const dateStr = date.toISOString().split('T')[0]!;
  const errors: Array<{ domain: 'dailyMetrics' | 'sleep' | 'activities' | 'weight'; message: string }> = [];
  const messageOf = (err: unknown) => err instanceof Error ? err.message : String(err);

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

  // Daily summary via direct Garmin API — steps, stress, calories, body battery
  try {
    const summary = await (gc as any).get(
      `https://connectapi.garmin.com/usersummary-service/usersummary/daily/${displayName}?calendarDate=${dateStr}`,
    ) as any;
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

  // LEGACY: garmin_daily_health write — entfernen sobald letzter Konsument auf pulse_daily_metrics migriert.
  await db.insert(garminDailyHealth).values({ userId, date: dateStr, ...upsertSet })
    .onConflictDoUpdate({ target: [garminDailyHealth.userId, garminDailyHealth.date], set: upsertSet });

  // Also write to pulse_daily_metrics so pulse screens have fresh data
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

  // Write sleep session if we have sleep data
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

  // Sync activities for this date
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

        // Backfill weather async — outdoor activities only, ignore failures
        if (!inserted.isIndoor && inserted.startLat != null && inserted.startLon != null) {
          void (async () => {
            try {
              const { getHistoricalWeather } = await import('../lib/weather.js');
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

  // Sync weight for this date
  let weightWritten = false;
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
      weightWritten = true;
      app.log.info(`[garmin-sync] ${dateStr} weight: ${weightKg.toFixed(1)}kg`);
    }
  } catch (err) {
    errors.push({ domain: 'weight', message: messageOf(err) });
  }

  app.log.info(`[garmin-sync] ${dateStr} ✓`);
  return { date: dateStr, dailyMetrics: true, activities: activitiesWritten, weight: weightWritten, errors };
}
