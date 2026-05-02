import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../lib/db.js';
import { redis } from '../lib/redis.js';
import {
  pulseDailyMetrics,
  pulseMentalCheckins,
  pulseActivities,
  pulsePlannedWorkouts,
  pulseSleepSessions,
  pulseUserProfile,
  pulseWeightLog,
  pulsePushSubscriptions,
  pulseEquipmentActivity,
  DEFAULT_PUSH_TOPICS,
  type GarminActivityDetailCache,
  type GarminActivityHrZoneCache,
  type GarminActivityLapCache,
} from '../db/pulse-schema.js';
import { eq, desc, and, gte, lte, isNull, or } from 'drizzle-orm';
import { env } from '../lib/env.js';
import { RPE_SORENESS_AREAS } from '@coaching-os/shared/pulse';
import type { PulseDataCoverageResponse, PulseGarminBackfillDomain, PulseGarminBackfillResponse, PulseGarminCoverageResponse, PulseGarminSignalUsefulnessResponse, PulsePushTopics } from '@coaching-os/shared/pulse';
import { invalidateUser } from './lib/pulse-cache.js';
import { getPulseDataStatus } from './services/daily-loop.js';
import { generateDeepInsight, type InsightDomain } from './services/insight-engine.js';
import {
  buildGarminWorkoutJson,
  garminWorkoutHasBrokenRepeatIterations,
  workoutHasRepeatSteps,
} from './services/garmin-workout.js';
import { profileWithProvenance, syncProfileFromGarmin } from './services/profile-sync.js';
import { buildGarminDataQuality } from './services/garmin-data-quality.js';
import { buildGarminSignalUsefulness } from './services/garmin-signal-usefulness.js';
import { buildWorkoutSteps } from './services/workout-steps.js';
import { fetchGarminCalendarWorkouts } from './services/garmin-calendar-workouts.js';
import { readGarminCircuitState } from '../jobs/garmin-sync.job.js';
import { syncGarminDay } from '../routes/garmin.js';
import { isPushConfigured, normalizePushTopics, sendPushToUser } from '../lib/push.js';
import { garminApi } from '../lib/garmin-client.js';
import { registerPulseCheckinRoutes } from './routes/checkin-routes.js';
import { registerPulseCoachRoutes } from './routes/coach-routes.js';
import { registerPulseDailyLoopRoutes } from './routes/daily-loop-routes.js';
import { registerPulseHealthRoutes } from './routes/health-routes.js';
import { registerPulseTrainingRoutes } from './routes/training-routes.js';

const garminSyncSchema = z.object({
  days: z.number().int().min(1).max(30).optional().default(7),
});

const GARMIN_BACKFILL_LIMIT_DAYS = 31;
const GARMIN_BACKFILL_DELAY_MS = 500;
const garminBackfillDomains = ['dailyMetrics', 'sleep', 'activities', 'weather', 'weight'] as const;
const garminBackfillSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  domains: z.array(z.enum(garminBackfillDomains)).min(1).max(garminBackfillDomains.length).optional(),
  dryRun: z.boolean().optional().default(false),
});

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

  app.get('/sync/status', { onRequest: [app.authenticate] }, async (req) => {
    const today = new Date().toISOString().split('T')[0]!;
    return getPulseDataStatus(req.user.sub, today);
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

  // ─── Garmin Calendar Sync ─────────────────────────────────────────────────────
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
      const { getGarminClient } = await import('../lib/garmin-client.js');
      gc = await getGarminClient();
    } catch (err) {
      return reply.status(502).send({ error: `Garmin-Login fehlgeschlagen: ${String(err).slice(0, 120)}` });
    }

    let uploaded = 0;
    let repaired = 0;
    const errors: string[] = [];

    // Repair previously uploaded repeat workouts that Garmin stored with null iteration counts.
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
        await db.update(pulsePlannedWorkouts)
          .set({
            garminWorkoutId: null,
            garminScheduledId: null,
            executionStatus: null,
            executionNotes: null,
            executionMatchConfidence: null,
            executionMatchedAt: null,
          })
          .where(eq(pulsePlannedWorkouts.id, workout.id));
        workout.garminWorkoutId = null;
        workout.garminScheduledId = null;
        repaired++;
      } catch (err) {
        errors.push(`${workout.plannedDate}: Repeat-Pruefung fehlgeschlagen (${String(err).slice(0, 80)})`);
      }
    }

    // Upload workouts not yet in Garmin
    for (const workout of futurePlanned.filter(w => !w.garminWorkoutId)) {
      try {
        let w = workout;
        if (!w.steps?.length) {
          const { steps, updatedDescription } = await buildWorkoutSteps(w, profile ?? undefined);
          await db.update(pulsePlannedWorkouts)
            .set({ steps, description: updatedDescription })
            .where(eq(pulsePlannedWorkouts.id, w.id));
          w = { ...w, steps: steps as typeof w.steps, description: updatedDescription };
        }
        const garminWorkout = buildGarminWorkoutJson(w);
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
          .set({ garminWorkoutId, garminScheduledId, executionStatus, executionNotes })
          .where(eq(pulsePlannedWorkouts.id, w.id));
        uploaded++;
      } catch (err) {
        errors.push(`${workout.plannedDate}: ${String(err).slice(0, 80)}`);
      }
    }

    // Collect our current workout IDs (after uploads)
    const allPlanned = await db.select({ garminWorkoutId: pulsePlannedWorkouts.garminWorkoutId })
      .from(pulsePlannedWorkouts)
      .where(and(eq(pulsePlannedWorkouts.userId, userId), gte(pulsePlannedWorkouts.plannedDate, today)));
    const ourWorkoutIds = new Set(
      allPlanned.map(w => w.garminWorkoutId).filter((id): id is string => id != null),
    );

    // Remove calendar entries + workout templates not belonging to our current plan
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
        // Also delete the workout template so it disappears from the device library
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

  // ─── Garmin profile sync (VO2max, maxHR, threshold HR) ──────────────────────
  app.post('/garmin/sync-profile', { onRequest: [app.authenticate] }, async (req) => {
    const userId = req.user.sub;
    const gc = await import('../lib/garmin-client.js').then(m => m.getGarminClient());
    const result = await syncProfileFromGarmin(userId, gc, { logger: app.log });
    await invalidateUser(userId);
    return {
      synced: result.synced,
      diagnostics: result.diagnostics,
      profile: profileWithProvenance(result.profile, userId),
    };
  });

  // ─── Garmin manual sync ───────────────────────────────────────────────────────
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
