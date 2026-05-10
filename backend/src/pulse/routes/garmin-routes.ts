import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { and, desc, eq, gte, lte } from 'drizzle-orm';
import type {
  PulseDataCoverageResponse,
  PulseGarminBackfillDomain,
  PulseGarminBackfillResponse,
  PulseGarminCoverageResponse,
  PulseGarminSignalUsefulnessResponse,
} from '@coaching-os/shared/pulse';
import { db } from '../../lib/db.js';
import { redis } from '../../lib/redis.js';
import { env } from '../../lib/env.js';
import { garminApi } from '../../lib/garmin-client.js';
import {
  pulseActivities,
  pulseDailyMetrics,
  pulsePlannedWorkouts,
  pulseSleepSessions,
  pulseUserProfile,
  pulseWeightLog,
} from '../../db/pulse-schema.js';
import { readGarminCircuitState } from '../../jobs/garmin-sync.job.js';
import { syncGarminDay } from '../services/garmin-sync-day.js';
import { invalidateUser } from '../lib/pulse-cache.js';
import { getPulseDataStatus } from '../services/daily-loop.js';
import { buildGarminDataQuality } from '../services/garmin-data-quality.js';
import { buildGarminSignalUsefulness } from '../services/garmin-signal-usefulness.js';
import { fetchGarminCalendarWorkouts } from '../services/garmin-calendar-workouts.js';
import {
  buildGarminRemoteRepeatRepairContract,
  buildGarminSyncContract,
  buildGarminWorkoutJson,
  garminWorkoutHasBrokenRepeatIterations,
  summarizeGarminPayloadSnapshot,
  workoutHasRepeatSteps,
} from '../services/garmin-workout.js';
import {
  listLatestGarminExecutionEntries,
  recordGarminExecution,
} from '../services/garmin-execution-ledger.js';
import { profileWithProvenance, syncProfileFromGarmin } from '../services/profile-sync.js';
import { buildWorkoutSteps } from '../services/workout-steps.js';
import { loadTrainingCapabilitySummary } from '../services/training-capability-store.js';
import type { WorkoutLibraryMetadata } from '../services/workout-library.js';
import { buildFuelingRecoveryGuidanceForPlannedWorkout } from '../services/fueling-recovery-planned-workout.js';

const garminSyncSchema = z.object({
  days: z.number().int().min(1).max(30).optional().default(7),
});

const GARMIN_BACKFILL_LIMIT_DAYS = 31;
const GARMIN_BACKFILL_DELAY_MS = 500;
const garminBackfillDomains = ['dailyMetrics', 'sleep', 'activities', 'weather', 'weight'] as const;

function workoutMetadataUpdate(metadata: WorkoutLibraryMetadata) {
  return {
    archetypeId: metadata.archetypeId,
    difficultyLevel: metadata.difficultyLevel,
    difficultyEnergySystem: metadata.difficultyEnergySystem,
    capabilityFit: metadata.capabilityFit,
  };
}
const garminBackfillSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  domains: z.array(z.enum(garminBackfillDomains)).min(1).max(garminBackfillDomains.length).optional(),
  dryRun: z.boolean().optional().default(false),
});
const profileSyncSchema = z.object({
  overrideManualFields: z.array(z.enum(['ftpWatts', 'maxHrBpm', 'lthrBpm', 'vo2max'])).max(4).optional().default([]),
});

function addDateDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function toIsoDate(date: Date): string {
  return date.toISOString().split('T')[0]!;
}

function dateRange(from: string, to: string): string[] {
  const start = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`);
  const result: string[] = [];
  for (let cur = start; cur <= end; cur = addDateDays(cur, 1)) {
    result.push(toIsoDate(cur));
  }
  return result;
}

function missingSyncReason(date: string, today: string): 'not_synced' | 'not_synced_yet' {
  return date === today ? 'not_synced_yet' : 'not_synced';
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function addBackfillReason(reasons: Set<string>, domain: PulseGarminBackfillDomain, reason: string): void {
  reasons.add(`${domain}:${reason}`);
}

interface BackfillCoverageRows {
  dailyByDate: Map<string, {
    hrvRmssd: number | null;
    restingHr: number | null;
    sleepHours: number | null;
    bodyBatteryMax: number | null;
    stressAvg: number | null;
    steps: number | null;
  }>;
  sleepByDate: Map<string, {
    durationH: number | null;
    deepSleepH: number | null;
    remSleepH: number | null;
    lightSleepH: number | null;
    awakeH: number | null;
  }>;
  activitiesByDate: Map<string, { count: number; weatherCount: number }>;
  weightByDate: Map<string, {
    bodyFatPct: number | null;
    muscleMassKg: number | null;
    bmi: number | null;
  }>;
}

async function loadBackfillCoverageRows(userId: string, from: string, to: string): Promise<BackfillCoverageRows> {
  const [dailyRows, sleepRows, activityRows, weightRows] = await Promise.all([
    db.select({
      date: pulseDailyMetrics.date,
      hrvRmssd: pulseDailyMetrics.hrvRmssd,
      restingHr: pulseDailyMetrics.restingHr,
      sleepHours: pulseDailyMetrics.sleepHours,
      bodyBatteryMax: pulseDailyMetrics.bodyBatteryMax,
      stressAvg: pulseDailyMetrics.stressAvg,
      steps: pulseDailyMetrics.steps,
    }).from(pulseDailyMetrics)
      .where(and(eq(pulseDailyMetrics.userId, userId), gte(pulseDailyMetrics.date, from), lte(pulseDailyMetrics.date, to))),
    db.select({
      date: pulseSleepSessions.date,
      durationH: pulseSleepSessions.durationH,
      deepSleepH: pulseSleepSessions.deepSleepH,
      remSleepH: pulseSleepSessions.remSleepH,
      lightSleepH: pulseSleepSessions.lightSleepH,
      awakeH: pulseSleepSessions.awakeH,
    }).from(pulseSleepSessions)
      .where(and(eq(pulseSleepSessions.userId, userId), gte(pulseSleepSessions.date, from), lte(pulseSleepSessions.date, to))),
    db.select({
      startTime: pulseActivities.startTime,
      weather: pulseActivities.weather,
    }).from(pulseActivities)
      .where(and(
        eq(pulseActivities.userId, userId),
        gte(pulseActivities.startTime, new Date(`${from}T00:00:00.000Z`)),
        lte(pulseActivities.startTime, new Date(`${to}T23:59:59.999Z`)),
      )),
    db.select({
      date: pulseWeightLog.date,
      bodyFatPct: pulseWeightLog.bodyFatPct,
      muscleMassKg: pulseWeightLog.muscleMassKg,
      bmi: pulseWeightLog.bmi,
    }).from(pulseWeightLog)
      .where(and(eq(pulseWeightLog.userId, userId), gte(pulseWeightLog.date, from), lte(pulseWeightLog.date, to))),
  ]);

  const activitiesByDate = new Map<string, { count: number; weatherCount: number }>();
  for (const row of activityRows) {
    const date = toIsoDate(row.startTime);
    const current = activitiesByDate.get(date) ?? { count: 0, weatherCount: 0 };
    current.count += 1;
    if (row.weather != null) current.weatherCount += 1;
    activitiesByDate.set(date, current);
  }

  return {
    dailyByDate: new Map(dailyRows.map(row => [row.date, row])),
    sleepByDate: new Map(sleepRows.map(row => [row.date, row])),
    activitiesByDate,
    weightByDate: new Map(weightRows.map(row => [row.date, row])),
  };
}

function backfillReasonsForDate(
  date: string,
  today: string,
  domains: PulseGarminBackfillDomain[],
  coverage: BackfillCoverageRows,
): string[] {
  const daily = coverage.dailyByDate.get(date);
  const sleepRow = coverage.sleepByDate.get(date);
  const activity = coverage.activitiesByDate.get(date) ?? { count: 0, weatherCount: 0 };
  const weight = coverage.weightByDate.get(date);
  const reasons = new Set<string>();
  const selected = new Set<PulseGarminBackfillDomain>(domains);
  const missingDailyFields = daily
    ? [daily.hrvRmssd, daily.restingHr, daily.sleepHours, daily.bodyBatteryMax, daily.stressAvg, daily.steps]
      .filter(value => value == null).length
    : 0;
  const hasSleep = sleepRow != null || daily?.sleepHours != null;
  const hasStages = !!sleepRow && [sleepRow.deepSleepH, sleepRow.remSleepH, sleepRow.lightSleepH, sleepRow.awakeH].some(value => value != null);
  const missingWeatherCount = Math.max(0, activity.count - activity.weatherCount);
  const missingBodyComposition = !!weight && [weight.bodyFatPct, weight.muscleMassKg, weight.bmi].every(value => value == null);

  if (selected.has('dailyMetrics')) {
    if (!daily) addBackfillReason(reasons, 'dailyMetrics', missingSyncReason(date, today));
    else if (missingDailyFields > 0) addBackfillReason(reasons, 'dailyMetrics', 'partial');
  }
  if (selected.has('sleep')) {
    if (!hasSleep && !daily) addBackfillReason(reasons, 'sleep', missingSyncReason(date, today));
    else if (hasSleep && !hasStages) addBackfillReason(reasons, 'sleep', 'partial');
  }
  if (selected.has('activities') && activity.count === 0 && !daily) {
    addBackfillReason(reasons, 'activities', missingSyncReason(date, today));
  }
  if (selected.has('weather') && missingWeatherCount > 0) {
    addBackfillReason(reasons, 'weather', 'partial');
  }
  if (selected.has('weight')) {
    if (!weight && !daily) addBackfillReason(reasons, 'weight', missingSyncReason(date, today));
    else if (missingBodyComposition) addBackfillReason(reasons, 'weight', 'partial');
  }

  return [...reasons];
}

function backfillDayFromReasons(date: string, reasons: string[]): PulseGarminBackfillResponse['days'][number] {
  return {
    date,
    status: reasons.length > 0 ? 'planned' : 'skipped',
    dailyMetrics: false,
    activities: 0,
    weight: false,
    reason: reasons.length > 0 ? reasons.join(', ') : 'already_complete_or_not_recorded',
    error: null,
  };
}

async function recordGarminExecutionSafely(
  app: FastifyInstance,
  input: Parameters<typeof recordGarminExecution>[1],
): Promise<void> {
  await recordGarminExecution(db, input).catch((err: unknown) => {
    app.log.warn(`[calendar-sync] Failed to record Garmin execution ledger for ${input.plannedWorkoutId}: ${err}`);
  });
}

export async function registerPulseGarminRoutes(app: FastifyInstance) {
  app.get('/sync/status', { onRequest: [app.authenticate] }, async (req) => {
    const today = new Date().toISOString().split('T')[0]!;
    return getPulseDataStatus(req.user.sub, today);
  });

  app.get('/garmin/execution-ledger', { onRequest: [app.authenticate] }, async (req, reply) => {
    const parsed = z.object({ workoutId: z.string().uuid() }).safeParse(req.query);
    if (!parsed.success) return reply.status(400).send({ error: 'Ungültige Eingabe' });

    const userId = req.user.sub;
    const [workout] = await db.select({ id: pulsePlannedWorkouts.id })
      .from(pulsePlannedWorkouts)
      .where(and(
        eq(pulsePlannedWorkouts.id, parsed.data.workoutId),
        eq(pulsePlannedWorkouts.userId, userId),
      ));
    if (!workout) return reply.status(404).send({ error: 'Workout nicht gefunden' });

    const entries = await listLatestGarminExecutionEntries(db, userId, workout.id);
    return { entries };
  });

  app.get('/data-coverage', { onRequest: [app.authenticate] }, async (req, reply) => {
    const parsed = z.object({
      days: z.coerce.number().int().min(1).max(366).optional().default(30),
      year: z.coerce.number().int().min(2020).max(2100).optional(),
    }).safeParse(req.query);
    if (!parsed.success) return reply.status(400).send({ error: 'Ungültige Eingabe' });

    const userId = req.user.sub;
    const today = toIsoDate(new Date());
    let from: string;
    let to: string;
    let year: number | null = null;
    if (parsed.data.year != null) {
      year = parsed.data.year;
      from = `${year}-01-01`;
      const yearEnd = `${year}-12-31`;
      to = yearEnd > today ? today : yearEnd;
    } else {
      to = today;
      from = toIsoDate(addDateDays(new Date(`${today}T00:00:00.000Z`), -(parsed.data.days - 1)));
    }

    const days = dateRange(from, to);
    const [dailyRows, sleepRows, activityRows, weightRows, [profile]] = await Promise.all([
      db.select({
        date: pulseDailyMetrics.date,
        hrvRmssd: pulseDailyMetrics.hrvRmssd,
        restingHr: pulseDailyMetrics.restingHr,
        sleepHours: pulseDailyMetrics.sleepHours,
        sleepScore: pulseDailyMetrics.sleepScore,
        bodyBatteryMax: pulseDailyMetrics.bodyBatteryMax,
        stressAvg: pulseDailyMetrics.stressAvg,
        steps: pulseDailyMetrics.steps,
        syncedAt: pulseDailyMetrics.syncedAt,
      }).from(pulseDailyMetrics)
        .where(and(eq(pulseDailyMetrics.userId, userId), gte(pulseDailyMetrics.date, from), lte(pulseDailyMetrics.date, to))),
      db.select({
        date: pulseSleepSessions.date,
        durationH: pulseSleepSessions.durationH,
        deepSleepH: pulseSleepSessions.deepSleepH,
        remSleepH: pulseSleepSessions.remSleepH,
        lightSleepH: pulseSleepSessions.lightSleepH,
        awakeH: pulseSleepSessions.awakeH,
      }).from(pulseSleepSessions)
        .where(and(eq(pulseSleepSessions.userId, userId), gte(pulseSleepSessions.date, from), lte(pulseSleepSessions.date, to))),
      db.select({
        startTime: pulseActivities.startTime,
        weather: pulseActivities.weather,
      }).from(pulseActivities)
        .where(and(
          eq(pulseActivities.userId, userId),
          gte(pulseActivities.startTime, new Date(`${from}T00:00:00.000Z`)),
          lte(pulseActivities.startTime, new Date(`${to}T23:59:59.999Z`)),
        )),
      db.select({
        date: pulseWeightLog.date,
        bodyFatPct: pulseWeightLog.bodyFatPct,
        muscleMassKg: pulseWeightLog.muscleMassKg,
        bmi: pulseWeightLog.bmi,
      }).from(pulseWeightLog)
        .where(and(eq(pulseWeightLog.userId, userId), gte(pulseWeightLog.date, from), lte(pulseWeightLog.date, to))),
      db.select({
        ftpWatts: pulseUserProfile.ftpWatts,
        ftpWattsSource: pulseUserProfile.ftpWattsSource,
        ftpWattsUpdatedAt: pulseUserProfile.ftpWattsUpdatedAt,
        maxHrBpm: pulseUserProfile.maxHrBpm,
        maxHrBpmSource: pulseUserProfile.maxHrBpmSource,
        maxHrBpmUpdatedAt: pulseUserProfile.maxHrBpmUpdatedAt,
        lthrBpm: pulseUserProfile.lthrBpm,
        lthrBpmSource: pulseUserProfile.lthrBpmSource,
        lthrBpmUpdatedAt: pulseUserProfile.lthrBpmUpdatedAt,
        vo2max: pulseUserProfile.vo2max,
        vo2maxSource: pulseUserProfile.vo2maxSource,
        vo2maxUpdatedAt: pulseUserProfile.vo2maxUpdatedAt,
        updatedAt: pulseUserProfile.updatedAt,
      }).from(pulseUserProfile).where(eq(pulseUserProfile.userId, userId)).limit(1),
    ]);

    const dailyByDate = new Map(dailyRows.map(row => [row.date, row]));
    const sleepByDate = new Map(sleepRows.map(row => [row.date, row]));
    const weightByDate = new Map(weightRows.map(row => [row.date, row]));
    const activitiesByDate = new Map<string, { count: number; weatherCount: number }>();
    for (const row of activityRows) {
      const date = toIsoDate(row.startTime);
      const current = activitiesByDate.get(date) ?? { count: 0, weatherCount: 0 };
      current.count += 1;
      if (row.weather != null) current.weatherCount += 1;
      activitiesByDate.set(date, current);
    }

    const coverageDays: PulseDataCoverageResponse['days'] = days.map(date => {
      const daily = dailyByDate.get(date);
      const sleep = sleepByDate.get(date);
      const activity = activitiesByDate.get(date) ?? { count: 0, weatherCount: 0 };
      const weight = weightByDate.get(date);
      const missingFields = daily
        ? ([
            ['hrvRmssd', daily.hrvRmssd],
            ['restingHr', daily.restingHr],
            ['sleepHours', daily.sleepHours],
            ['bodyBatteryMax', daily.bodyBatteryMax],
            ['stressAvg', daily.stressAvg],
            ['steps', daily.steps],
          ] as const)
          .filter(([, value]) => value == null)
          .map(([field]) => field)
        : [];
      const hasStages = !!sleep && [sleep.deepSleepH, sleep.remSleepH, sleep.lightSleepH, sleep.awakeH].some(value => value != null);
      const missingWeatherCount = Math.max(0, activity.count - activity.weatherCount);
      const hasDaily = daily != null;
      const hasSleep = sleep != null || daily?.sleepHours != null;

      return {
        date,
        dailyMetrics: {
          status: !daily ? 'missing' : missingFields.length > 0 ? 'partial' : 'present',
          reason: !daily ? missingSyncReason(date, today) : missingFields.length > 0 ? 'partial' : 'present',
          syncedAt: daily?.syncedAt?.toISOString() ?? null,
          missingFields,
        },
        sleep: {
          status: hasSleep ? (hasStages ? 'present' : 'partial') : 'missing',
          reason: hasSleep ? (hasStages ? 'present' : 'partial') : hasDaily ? 'garmin_unavailable' : missingSyncReason(date, today),
          durationH: sleep?.durationH ?? daily?.sleepHours ?? null,
          hasStages,
          missingFields: hasSleep && !hasStages ? ['sleepStages'] : [],
        },
        activities: {
          status: activity.count > 0 ? missingWeatherCount > 0 ? 'partial' : 'present' : 'missing',
          reason: activity.count > 0 ? missingWeatherCount > 0 ? 'partial' : 'present' : hasDaily ? 'not_recorded' : missingSyncReason(date, today),
          count: activity.count,
          weatherCount: activity.weatherCount,
          missingWeatherCount,
          missingFields: missingWeatherCount > 0 ? ['weather'] : [],
        },
        weight: {
          status: weight ? 'present' : 'missing',
          reason: weight ? 'present' : hasDaily ? 'not_recorded' : missingSyncReason(date, today),
          hasBodyComposition: !!weight && [weight.bodyFatPct, weight.muscleMassKg, weight.bmi].some(value => value != null),
          missingFields: weight && [weight.bodyFatPct, weight.muscleMassKg, weight.bmi].every(value => value == null)
            ? ['bodyComposition']
            : [],
        },
      };
    });

    const profileMissing: PulseDataCoverageResponse['profile']['missing'] = [];
    if (profile?.ftpWatts == null) profileMissing.push('ftpWatts');
    if (profile?.maxHrBpm == null) profileMissing.push('maxHrBpm');
    if (profile?.lthrBpm == null) profileMissing.push('lthrBpm');
    if (profile?.vo2max == null) profileMissing.push('vo2max');

    return {
      range: { from, to, days: coverageDays.length, year },
      summary: {
        dailyMetricsDays: coverageDays.filter(day => day.dailyMetrics.status !== 'missing').length,
        sleepDays: coverageDays.filter(day => day.sleep.status !== 'missing').length,
        activityDays: coverageDays.filter(day => day.activities.count > 0).length,
        activities: activityRows.length,
        weatherActivities: activityRows.filter(row => row.weather != null).length,
        weightDays: coverageDays.filter(day => day.weight.status !== 'missing').length,
        completeDays: coverageDays.filter(day => day.dailyMetrics.status === 'present' && day.sleep.status !== 'missing').length,
      },
      profile: {
        updatedAt: profile?.updatedAt?.toISOString() ?? null,
        ftpWatts: profile?.ftpWatts ?? null,
        maxHrBpm: profile?.maxHrBpm ?? null,
        lthrBpm: profile?.lthrBpm ?? null,
        vo2max: profile?.vo2max ?? null,
        provenance: profileWithProvenance(profile ?? null, userId).provenance,
        missing: profileMissing,
      },
      days: coverageDays.reverse(),
    } satisfies PulseDataCoverageResponse;
  });

  app.get('/garmin/coverage', { onRequest: [app.authenticate] }, async (req, reply): Promise<PulseGarminCoverageResponse | unknown> => {
    const parsed = z.object({
      days: z.coerce.number().int().min(1).max(366).optional().default(30),
    }).safeParse(req.query);
    if (!parsed.success) return reply.status(400).send({ error: 'Ungültige Eingabe' });

    const userId = req.user.sub;
    const now = new Date();
    const today = toIsoDate(now);
    const to = today;
    const from = toIsoDate(addDateDays(new Date(`${today}T00:00:00.000Z`), -(parsed.data.days - 1)));
    const futureTo = toIsoDate(addDateDays(new Date(`${today}T00:00:00.000Z`), parsed.data.days));

    const [
      dailyRows,
      sleepRows,
      activityRows,
      weightRows,
      plannedRows,
      circuit,
    ] = await Promise.all([
      db.select({
        date: pulseDailyMetrics.date,
        hrvRmssd: pulseDailyMetrics.hrvRmssd,
        sleepHours: pulseDailyMetrics.sleepHours,
        bodyBatteryMax: pulseDailyMetrics.bodyBatteryMax,
        stressAvg: pulseDailyMetrics.stressAvg,
        steps: pulseDailyMetrics.steps,
        syncedAt: pulseDailyMetrics.syncedAt,
      }).from(pulseDailyMetrics)
        .where(and(
          eq(pulseDailyMetrics.userId, userId),
          eq(pulseDailyMetrics.source, 'garmin'),
          gte(pulseDailyMetrics.date, from),
          lte(pulseDailyMetrics.date, to),
        )),
      db.select({
        date: pulseSleepSessions.date,
        durationH: pulseSleepSessions.durationH,
        deepSleepH: pulseSleepSessions.deepSleepH,
        remSleepH: pulseSleepSessions.remSleepH,
        lightSleepH: pulseSleepSessions.lightSleepH,
        awakeH: pulseSleepSessions.awakeH,
      }).from(pulseSleepSessions)
        .where(and(
          eq(pulseSleepSessions.userId, userId),
          eq(pulseSleepSessions.source, 'garmin'),
          gte(pulseSleepSessions.date, from),
          lte(pulseSleepSessions.date, to),
        )),
      db.select({
        startTime: pulseActivities.startTime,
        weather: pulseActivities.weather,
      }).from(pulseActivities)
        .where(and(
          eq(pulseActivities.userId, userId),
          eq(pulseActivities.source, 'garmin'),
          gte(pulseActivities.startTime, new Date(`${from}T00:00:00.000Z`)),
          lte(pulseActivities.startTime, new Date(`${to}T23:59:59.999Z`)),
        )),
      db.select({
        date: pulseWeightLog.date,
        bodyFatPct: pulseWeightLog.bodyFatPct,
        muscleMassKg: pulseWeightLog.muscleMassKg,
        bmi: pulseWeightLog.bmi,
      }).from(pulseWeightLog)
        .where(and(
          eq(pulseWeightLog.userId, userId),
          eq(pulseWeightLog.source, 'garmin'),
          gte(pulseWeightLog.date, from),
          lte(pulseWeightLog.date, to),
        )),
      db.select({
        plannedDate: pulsePlannedWorkouts.plannedDate,
        garminWorkoutId: pulsePlannedWorkouts.garminWorkoutId,
        garminScheduledId: pulsePlannedWorkouts.garminScheduledId,
      }).from(pulsePlannedWorkouts)
        .where(and(
          eq(pulsePlannedWorkouts.userId, userId),
          eq(pulsePlannedWorkouts.status, 'planned'),
          gte(pulsePlannedWorkouts.plannedDate, today),
          lte(pulsePlannedWorkouts.plannedDate, futureTo),
        )),
      readGarminCircuitState(redis).catch(() => ({
        status: 'unknown' as const,
        failures: null,
        reason: 'Redis/Circuit-Breaker-Status ist lokal nicht verfügbar.',
      })),
    ]);

    return buildGarminDataQuality({
      today,
      now: now.toISOString(),
      range: { from, to, days: dateRange(from, to).length },
      dailyMetrics: dailyRows.map(row => ({
        date: row.date,
        syncedAt: row.syncedAt?.toISOString() ?? null,
        hrvRmssd: row.hrvRmssd,
        sleepHours: row.sleepHours,
        bodyBatteryMax: row.bodyBatteryMax,
        stressAvg: row.stressAvg,
        steps: row.steps,
      })),
      sleepSessions: sleepRows,
      activities: activityRows.map(row => ({
        startTime: row.startTime.toISOString(),
        weather: row.weather,
      })),
      weightLogs: weightRows,
      plannedWorkouts: plannedRows,
      circuit,
    });
  });

  app.get('/garmin/signal-usefulness', { onRequest: [app.authenticate] }, async (req, reply): Promise<PulseGarminSignalUsefulnessResponse | unknown> => {
    const parsed = z.object({
      days: z.coerce.number().int().min(1).max(366).optional().default(30),
    }).safeParse(req.query);
    if (!parsed.success) return reply.status(400).send({ error: 'Ungültige Eingabe' });

    const userId = req.user.sub;
    const today = toIsoDate(new Date());
    const to = today;
    const from = toIsoDate(addDateDays(new Date(`${today}T00:00:00.000Z`), -(parsed.data.days - 1)));

    const [dailyRows, sleepRows, activityRows] = await Promise.all([
      db.select({
        date: pulseDailyMetrics.date,
        hrvRmssd: pulseDailyMetrics.hrvRmssd,
        sleepHours: pulseDailyMetrics.sleepHours,
        bodyBatteryMax: pulseDailyMetrics.bodyBatteryMax,
        bodyBatteryCharged: pulseDailyMetrics.bodyBatteryCharged,
        bodyBatteryDrained: pulseDailyMetrics.bodyBatteryDrained,
        bodyBatteryAtWake: pulseDailyMetrics.bodyBatteryAtWake,
        highStressSec: pulseDailyMetrics.highStressSec,
        mediumStressSec: pulseDailyMetrics.mediumStressSec,
        lowStressSec: pulseDailyMetrics.lowStressSec,
        avgWakingRespiration: pulseDailyMetrics.avgWakingRespiration,
        latestSpo2: pulseDailyMetrics.latestSpo2,
        syncedAt: pulseDailyMetrics.syncedAt,
      }).from(pulseDailyMetrics)
        .where(and(
          eq(pulseDailyMetrics.userId, userId),
          eq(pulseDailyMetrics.source, 'garmin'),
          gte(pulseDailyMetrics.date, from),
          lte(pulseDailyMetrics.date, to),
        ))
        .orderBy(desc(pulseDailyMetrics.date)),
      db.select({
        date: pulseSleepSessions.date,
        sleepNeedMin: pulseSleepSessions.sleepNeedMin,
        sleepActualMin: pulseSleepSessions.sleepActualMin,
        avgRespiration: pulseSleepSessions.avgRespiration,
        bodyBatteryChange: pulseSleepSessions.bodyBatteryChange,
      }).from(pulseSleepSessions)
        .where(and(
          eq(pulseSleepSessions.userId, userId),
          eq(pulseSleepSessions.source, 'garmin'),
          gte(pulseSleepSessions.date, from),
          lte(pulseSleepSessions.date, to),
        ))
        .orderBy(desc(pulseSleepSessions.date)),
      db.select({
        startTime: pulseActivities.startTime,
        weather: pulseActivities.weather,
        garminDetailData: pulseActivities.garminDetailData,
        garminLaps: pulseActivities.garminLaps,
        garminHrZones: pulseActivities.garminHrZones,
      }).from(pulseActivities)
        .where(and(
          eq(pulseActivities.userId, userId),
          eq(pulseActivities.source, 'garmin'),
          gte(pulseActivities.startTime, new Date(`${from}T00:00:00.000Z`)),
          lte(pulseActivities.startTime, new Date(`${to}T23:59:59.999Z`)),
        ))
        .orderBy(desc(pulseActivities.startTime)),
    ]);

    return buildGarminSignalUsefulness({
      range: { from, to, days: dateRange(from, to).length },
      dailyMetrics: dailyRows.map(row => ({
        date: row.date,
        hrvRmssd: row.hrvRmssd,
        sleepHours: row.sleepHours,
        bodyBatteryMax: row.bodyBatteryMax,
        bodyBatteryCharged: row.bodyBatteryCharged,
        bodyBatteryDrained: row.bodyBatteryDrained,
        bodyBatteryAtWake: row.bodyBatteryAtWake,
        highStressSec: row.highStressSec,
        mediumStressSec: row.mediumStressSec,
        lowStressSec: row.lowStressSec,
        avgWakingRespiration: row.avgWakingRespiration,
        latestSpo2: row.latestSpo2,
        syncedAt: row.syncedAt?.toISOString() ?? null,
      })),
      sleepSessions: sleepRows,
      activities: activityRows.map(row => ({
        date: toIsoDate(row.startTime),
        hasWeather: row.weather != null,
        hasHrZones: Array.isArray(row.garminHrZones) && row.garminHrZones.length > 0,
        hasLaps: Array.isArray(row.garminLaps) && row.garminLaps.length > 0,
        hasDetail: row.garminDetailData != null,
      })),
      decisionEvidenceSignals: ['sleep_hrv', 'training_load_execution'],
    });
  });

  app.post('/garmin/backfill', { onRequest: [app.authenticate] }, async (req, reply): Promise<PulseGarminBackfillResponse | unknown> => {
    const parsed = garminBackfillSchema.safeParse(req.body ?? {});
    if (!parsed.success) return reply.status(400).send({ error: 'Ungültige Eingabe' });

    const userId = req.user.sub;
    const today = toIsoDate(new Date());
    const { from, to, dryRun } = parsed.data;
    if (from > to) return reply.status(400).send({ error: 'Startdatum muss vor Enddatum liegen.' });
    if (from < '2020-01-01') return reply.status(400).send({ error: 'Backfill ist erst ab 2020 erlaubt.' });
    if (to > today) return reply.status(400).send({ error: 'Backfill darf nicht in der Zukunft liegen.' });

    const domains = (parsed.data.domains ?? [...garminBackfillDomains]) as PulseGarminBackfillDomain[];
    const dates = dateRange(from, to);
    if (dates.length > GARMIN_BACKFILL_LIMIT_DAYS) {
      return reply.status(400).send({ error: `Maximal ${GARMIN_BACKFILL_LIMIT_DAYS} Tage pro Backfill.` });
    }

    const coverageRows = await loadBackfillCoverageRows(userId, from, to);
    const plannedDays = dates.map(date => backfillDayFromReasons(
      date,
      backfillReasonsForDate(date, today, domains, coverageRows),
    ));

    const results: PulseGarminBackfillResponse['days'] = [];
    if (dryRun) {
      results.push(...plannedDays);
    } else if (env.NODE_ENV === 'test') {
      results.push(...plannedDays.map(day => day.status === 'planned'
        ? { ...day, status: 'synced' as const, dailyMetrics: true, reason: day.reason }
        : day));
    } else {
      const actionable = plannedDays.filter(day => day.status === 'planned');
      for (let index = 0; index < plannedDays.length; index++) {
        const day = plannedDays[index]!;
        if (day.status === 'skipped') {
          results.push(day);
          continue;
        }

        try {
          const synced = await syncGarminDay(userId, new Date(`${day.date}T00:00:00.000Z`), app);
          const refreshedRows = await loadBackfillCoverageRows(userId, day.date, day.date);
          const remainingReasons = backfillReasonsForDate(day.date, today, domains, refreshedRows);
          const selectedErrors = synced.errors.filter(error => domains.includes(error.domain));
          const blockingErrors = selectedErrors.filter(error => error.domain === 'dailyMetrics' || error.domain === 'activities');
          const hasRemainingGaps = remainingReasons.length > 0;
          const hasSyncErrors = blockingErrors.length > 0;
          const errorMessage = [
            hasSyncErrors ? `Garmin-Fehler: ${blockingErrors.map(error => `${error.domain}:${error.message}`).join('; ')}` : null,
            hasRemainingGaps ? `Weiterhin offen: ${remainingReasons.join(', ')}` : null,
          ].filter((message): message is string => message != null).join(' | ');
          results.push({
            ...day,
            status: hasRemainingGaps || hasSyncErrors ? 'failed' : 'synced',
            dailyMetrics: synced.dailyMetrics,
            activities: synced.activities,
            weight: synced.weight,
            reason: hasRemainingGaps ? remainingReasons.join(', ') : day.reason,
            error: errorMessage || null,
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          app.log.warn(`[garmin-backfill] ${day.date}: ${message}`);
          results.push({ ...day, status: 'failed', error: message });
        }

        const syncedSoFar = results.filter(result => result.status === 'synced' || result.status === 'failed').length;
        if (syncedSoFar < actionable.length) await sleep(GARMIN_BACKFILL_DELAY_MS);
      }
      await invalidateUser(userId);
    }

    const response: PulseGarminBackfillResponse = {
      dryRun,
      range: { from, to, days: dates.length },
      domains,
      limitDays: GARMIN_BACKFILL_LIMIT_DAYS,
      summary: {
        planned: plannedDays.filter(day => day.status === 'planned').length,
        synced: results.filter(day => day.status === 'synced').length,
        skipped: results.filter(day => day.status === 'skipped').length,
        failed: results.filter(day => day.status === 'failed').length,
        activities: results.reduce((sum, day) => sum + day.activities, 0),
        weightDays: results.filter(day => day.weight).length,
      },
      days: results,
    };

    return response;
  });

  app.post('/garmin/calendar/sync', { onRequest: [app.authenticate] }, async (req, reply) => {
    const userId = req.user.sub;
    const today = new Date().toISOString().split('T')[0]!;

    const futurePlanned = await db.select().from(pulsePlannedWorkouts)
      .where(and(
        eq(pulsePlannedWorkouts.userId, userId),
        eq(pulsePlannedWorkouts.status, 'planned'),
        gte(pulsePlannedWorkouts.plannedDate, today),
      ));

    const [profile] = await db.select().from(pulseUserProfile).where(eq(pulseUserProfile.userId, userId));

    let gc: any;
    try {
      const { getGarminClient } = await import('../../lib/garmin-client.js');
      gc = await getGarminClient();
    } catch (err) {
      return reply.status(502).send({ error: `Garmin-Login fehlgeschlagen: ${String(err).slice(0, 120)}` });
    }

    let uploaded = 0;
    let repaired = 0;
    const errors: string[] = [];

    for (const workout of futurePlanned.filter(w => w.garminWorkoutId && workoutHasRepeatSteps(w.steps))) {
      try {
        const remoteWorkout = await garminApi.getWorkout(gc, workout.garminWorkoutId!) as unknown;
        if (!garminWorkoutHasBrokenRepeatIterations(remoteWorkout)) continue;

        if (workout.garminScheduledId) {
          await garminApi.deleteWorkoutSchedule(gc, workout.garminScheduledId).catch((err: unknown) => {
            app.log.warn(`[calendar-sync] Failed to remove broken repeat schedule ${workout.garminScheduledId}: ${err}`);
          });
        }
        await garminApi.deleteWorkout(gc, workout.garminWorkoutId!).catch((err: unknown) => {
          app.log.warn(`[calendar-sync] Failed to remove broken repeat workout ${workout.garminWorkoutId}: ${err}`);
        });
        const repairContract = buildGarminRemoteRepeatRepairContract();
        await db.update(pulsePlannedWorkouts)
          .set({
            garminWorkoutId: null,
            garminScheduledId: null,
            garminSyncContract: repairContract,
            executionStatus: null,
            executionNotes: null,
            executionMatchConfidence: null,
            executionMatchedAt: null,
          })
          .where(eq(pulsePlannedWorkouts.id, workout.id));
        await recordGarminExecutionSafely(app, {
          userId,
          plannedWorkoutId: workout.id,
          operation: 'calendar_repair',
          outcome: 'degraded',
          localContract: repairContract,
          remoteWorkoutId: workout.garminWorkoutId,
          remoteScheduledId: workout.garminScheduledId,
          issues: repairContract.issues,
        });
        workout.garminWorkoutId = null;
        workout.garminScheduledId = null;
        repaired++;
      } catch (err) {
        errors.push(`${workout.plannedDate}: Repeat-Pruefung fehlgeschlagen (${String(err).slice(0, 80)})`);
        await recordGarminExecutionSafely(app, {
          userId,
          plannedWorkoutId: workout.id,
          operation: 'calendar_repair',
          outcome: 'failed',
          localContract: null,
          remoteWorkoutId: workout.garminWorkoutId,
          remoteScheduledId: workout.garminScheduledId,
          errorMessage: String(err).slice(0, 240),
        });
      }
    }

    for (const workout of futurePlanned.filter(w => !w.garminWorkoutId)) {
      try {
        let w = workout;
        if (!w.steps?.length) {
          const capabilitySummary = await loadTrainingCapabilitySummary(userId).catch((err: unknown) => {
            app.log.warn(`[calendar-sync] Training capability summary failed (non-fatal): ${err}`);
            return null;
          });
          const { steps, updatedDescription, metadata } = await buildWorkoutSteps(w, profile ?? undefined, capabilitySummary);
          const metadataUpdate = workoutMetadataUpdate(metadata);
          await db.update(pulsePlannedWorkouts)
            .set({ steps, description: updatedDescription, ...metadataUpdate })
            .where(eq(pulsePlannedWorkouts.id, w.id));
          w = { ...w, steps: steps as typeof w.steps, description: updatedDescription, ...metadataUpdate };
        }
        const fuelingGuidance = await buildFuelingRecoveryGuidanceForPlannedWorkout(userId, w).catch((err: unknown) => {
          app.log.warn(`[calendar-sync] Fueling guidance failed for ${w.id}: ${err}`);
          return null;
        });
        const garminWorkout = buildGarminWorkoutJson(w, { fuelingGuidance });
        const garminSyncContract = buildGarminSyncContract(w, garminWorkout);
        if (!garminSyncContract.payloadReady) {
          await db.update(pulsePlannedWorkouts)
            .set({
              garminSyncContract,
              executionStatus: 'local_planned',
              executionNotes: garminSyncContract.summary,
            })
            .where(eq(pulsePlannedWorkouts.id, w.id));
          await recordGarminExecutionSafely(app, {
            userId,
            plannedWorkoutId: w.id,
            operation: 'calendar_repair',
            outcome: 'blocked',
            localContract: garminSyncContract,
            payloadSnapshot: summarizeGarminPayloadSnapshot(garminWorkout),
            issues: garminSyncContract.issues,
          });
          errors.push(`${workout.plannedDate}: ${garminSyncContract.summary}`);
          continue;
        }
        const created = await gc.addWorkout(garminWorkout) as { workoutId: number };
        const garminWorkoutId = String(created.workoutId);
        const scheduled = await garminApi.scheduleWorkout(gc, garminWorkoutId, w.plannedDate) as any;
        const garminScheduledId = scheduled?.workoutScheduleId != null
          ? String(scheduled.workoutScheduleId)
          : scheduled?.id != null ? String(scheduled.id) : null;
        const executionStatus = garminScheduledId ? 'garmin_scheduled' : 'garmin_template';
        const executionNotes = garminScheduledId
          ? 'Workout ist auf Garmin im Kalender geplant.'
          : 'Workout-Vorlage ist auf Garmin, aber kein Kalendertermin ist bekannt.';
        await db.update(pulsePlannedWorkouts)
          .set({ garminWorkoutId, garminScheduledId, garminSyncContract, executionStatus, executionNotes })
          .where(eq(pulsePlannedWorkouts.id, w.id));
        await recordGarminExecutionSafely(app, {
          userId,
          plannedWorkoutId: w.id,
          operation: 'calendar_repair',
          outcome: garminSyncContract.status,
          localContract: garminSyncContract,
          remoteWorkoutId: garminWorkoutId,
          remoteScheduledId: garminScheduledId,
          payloadSnapshot: summarizeGarminPayloadSnapshot(garminWorkout, {
            workoutId: garminWorkoutId,
            scheduledId: garminScheduledId,
          }),
          issues: garminSyncContract.issues,
        });
        uploaded++;
      } catch (err) {
        errors.push(`${workout.plannedDate}: ${String(err).slice(0, 80)}`);
        await recordGarminExecutionSafely(app, {
          userId,
          plannedWorkoutId: workout.id,
          operation: 'calendar_repair',
          outcome: 'failed',
          localContract: null,
          errorMessage: String(err).slice(0, 240),
        });
      }
    }

    const allPlanned = await db.select({ garminWorkoutId: pulsePlannedWorkouts.garminWorkoutId })
      .from(pulsePlannedWorkouts)
      .where(and(eq(pulsePlannedWorkouts.userId, userId), gte(pulsePlannedWorkouts.plannedDate, today)));
    const ourWorkoutIds = new Set(
      allPlanned.map(w => w.garminWorkoutId).filter((id): id is string => id != null),
    );

    const calendarItems = await fetchGarminCalendarWorkouts(gc, today);
    const removedTemplates = new Set<string>();
    let removed = 0;
    for (const item of calendarItems) {
      if (!ourWorkoutIds.has(item.workoutId)) {
        try {
          await garminApi.deleteWorkoutSchedule(gc, item.id);
          removed++;
          app.log.info(`[calendar-sync] Removed orphan schedule ${item.id} (workout ${item.workoutId}) on ${item.date}`);
        } catch (err) {
          app.log.warn(`[calendar-sync] Failed to remove schedule ${item.id}: ${err}`);
        }
        if (!removedTemplates.has(item.workoutId)) {
          try {
            await garminApi.deleteWorkout(gc, item.workoutId);
            removedTemplates.add(item.workoutId);
          } catch { /* template may already be gone */ }
        }
      }
    }

    return { uploaded, repaired, removed, errors: errors.length > 0 ? errors : undefined };
  });

  app.post('/garmin/sync-profile', { onRequest: [app.authenticate] }, async (req, reply) => {
    const parsed = profileSyncSchema.safeParse(req.body ?? {});
    if (!parsed.success) return reply.status(400).send({ error: 'Ungültige Eingabe' });

    const userId = req.user.sub;
    const gc = await import('../../lib/garmin-client.js').then(m => m.getGarminClient());
    const result = await syncProfileFromGarmin(userId, gc, {
      logger: app.log,
      overrideManualFields: parsed.data.overrideManualFields,
    });
    await invalidateUser(userId);
    return {
      synced: result.synced,
      diagnostics: result.diagnostics,
      profile: profileWithProvenance(result.profile, userId),
    };
  });

  app.post('/garmin/sync', { onRequest: [app.authenticate] }, async (req, reply) => {
    const parsed = garminSyncSchema.safeParse(req.body ?? {});
    if (!parsed.success) return reply.status(400).send({ error: 'Ungültige Eingabe' });
    if (env.NODE_ENV === 'test') {
      return { status: 'skipped', days: parsed.data.days, dates: [], activities: 0 };
    }

    const userId = req.user.sub;
    const today = new Date();
    const dates = Array.from({ length: parsed.data.days }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - (parsed.data.days - 1 - i));
      return d;
    });
    try {
      const results = [];
      for (const date of dates) results.push(await syncGarminDay(userId, date, app));
      await invalidateUser(userId);
      return {
        status: 'synced',
        days: parsed.data.days,
        dates: results.map(r => r.date),
        activities: results.reduce((sum, r) => sum + r.activities, 0),
      };
    } catch (err) {
      app.log.error(`Pulse Garmin sync failed: ${err}`);
      return reply.status(502).send({ error: 'Garmin sync fehlgeschlagen. Zugangsdaten prüfen.' });
    }
  });
}
