import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../lib/db.js';
import { redis } from '../lib/redis.js';
import {
  pulseDailyMetrics,
  pulseMentalCheckins,
  pulseActivities,
  pulseCoachPreferences,
  pulsePlannedWorkouts,
  pulsePlanGenerations,
  pulseSleepSessions,
  pulseGoals,
  pulseUserProfile,
  pulseWeeklyReviews,
  pulseWeightLog,
  pulseWeekAvailability,
  pulseHealthState,
  pulseNutritionLogs,
  pulsePushSubscriptions,
  pulseEquipmentActivity,
  DEFAULT_PUSH_TOPICS,
  type GarminActivityDetailCache,
  type GarminActivityHrZoneCache,
  type GarminActivityLapCache,
  type WorkoutStep,
} from '../db/pulse-schema.js';
import { eq, desc, and, gte, lte, lt, isNull, or, sql, inArray } from 'drizzle-orm';
import { env } from '../lib/env.js';
import { llmComplete, SMART_MODEL } from '../lib/llm.js';
import { RPE_SORENESS_AREAS } from '@coaching-os/shared/pulse';
import type { PulseActivityType as SharedPulseActivityType, PulseDataCoverageResponse, PulseGarminBackfillDomain, PulseGarminBackfillResponse, PulseGarminCoverageResponse, PulseGarminSignalUsefulnessResponse, PulsePlanDecision, PulsePlanTrace, PulseRaceCommandResponse, PulseSeasonStrategyResponse, PulseTrainingExecutionReview, RpeSorenessArea, PulsePushTopics } from '@coaching-os/shared/pulse';
import { hrTargetRangeForZone } from '@coaching-os/shared/pulse-thresholds';
import { computeFitnessLoad } from './services/load-engine.js';
import { buildPulseContextFor } from './lib/pulse-context.js';
import { invalidateUser } from './lib/pulse-cache.js';
import { evaluateAndPersistRiskSignals, getActiveRiskSignals } from './services/risk-engine.js';
import { decidePlanDays, generateWeekWorkouts, generateScientificWeekPlan, getMesocycleWeek, tssFromWorkout } from './services/plan-engine.js';
import { buildPlanLearningSnapshot } from './services/plan-learning.js';
import { buildPlanTrace } from './services/plan-trace.js';
import {
  deriveExecutionReviewAvailability,
  determinePlanReplacementCutoff,
  mergeRegeneratedWorkoutsForTrace,
  recoveryFromFitnessLoad,
} from './services/plan-regeneration.js';
import { buildTrainingExecutionReview } from './services/training-execution-review.js';
import { proposeTodayAdjustment, deriveCurrentPhase } from './services/adapt-engine.js';
import { getActiveRaces } from './services/race-engine.js';
import { buildRaceCommandSummary } from './services/race-command.js';
import { getFitnessLoadCached, getPulseDataStatus } from './services/daily-loop.js';
import { serializeCoachPreferences } from './services/coach.js';
import { buildSeasonStrategy } from './services/season-strategy.js';
import { generateWeeklyReview } from './services/review-engine.js';
import { generateDeepInsight, type InsightDomain } from './services/insight-engine.js';
import {
  buildGarminWorkoutJson,
  garminWorkoutHasBrokenRepeatIterations,
  workoutHasRepeatSteps,
} from './services/garmin-workout.js';
import { deriveWorkoutExecutionState, scoreActivityWorkoutMatch } from './services/workout-reconciliation.js';
import { profileWithProvenance, syncProfileFromGarmin } from './services/profile-sync.js';
import { buildGarminDataQuality } from './services/garmin-data-quality.js';
import { buildGarminSignalUsefulness } from './services/garmin-signal-usefulness.js';
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

function enrichWorkoutExecutionState(
  workout: typeof pulsePlannedWorkouts.$inferSelect,
  activities: Array<Pick<typeof pulseActivities.$inferSelect, 'id' | 'startTime' | 'activityType' | 'durationSec'>>,
  now: Date,
) {
  const sameDayActivities = activities.filter(activity => toIsoDate(activity.startTime) === workout.plannedDate);
  const completedActivity = workout.completedActivityId
    ? activities.find(activity => activity.id === workout.completedActivityId) ?? null
    : null;
  const bestSameDayActivity = sameDayActivities
    .map(activity => ({ activity, score: scoreActivityWorkoutMatch(workout, activity) }))
    .sort((a, b) => b.score - a.score)[0]?.activity ?? null;
  const activity = completedActivity ?? bestSameDayActivity;
  const state = deriveWorkoutExecutionState({
    id: workout.id,
    plannedDate: workout.plannedDate,
    activityType: workout.activityType,
    status: workout.status,
    garminWorkoutId: workout.garminWorkoutId,
    garminScheduledId: workout.garminScheduledId,
    completedActivityId: workout.completedActivityId,
    durationMin: workout.durationMin,
  }, null, activity ? {
    id: activity.id,
    startTime: activity.startTime,
    activityType: activity.activityType,
    durationSec: activity.durationSec,
  } : null, now);

  return {
    ...workout,
    executionStatus: state.status,
    executionMatchedAt: workout.executionMatchedAt?.toISOString() ?? null,
    executionMatchConfidence: state.confidence ?? workout.executionMatchConfidence ?? null,
    executionNotes: workout.executionNotes ?? state.notes,
  };
}

const activityFeedbackSchema = z.object({
  rpe: z.number().int().min(1).max(10),
  rpeNote: z.string().trim().max(500).nullable().optional(),
  sorenessAreas: z.array(z.enum(RPE_SORENESS_AREAS)).max(8).nullable().optional(),
});

const isoDateSchema = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(value + 'T00:00:00Z');
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, { message: 'Ungültiges Datum' });

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

async function getPlannedZoneByActivityId(userId: string, activityIds: string[]): Promise<Map<string, number>> {
  const uniqueIds = [...new Set(activityIds)].filter(id => id.length > 0);
  if (uniqueIds.length === 0) return new Map();

  const rows = await db.select({
    completedActivityId: pulsePlannedWorkouts.completedActivityId,
    zone: pulsePlannedWorkouts.zone,
  }).from(pulsePlannedWorkouts)
    .where(and(
      eq(pulsePlannedWorkouts.userId, userId),
      inArray(pulsePlannedWorkouts.completedActivityId, uniqueIds),
    ));

  return new Map(
    rows
      .filter((row): row is { completedActivityId: string; zone: number } => row.completedActivityId != null)
      .map(row => [row.completedActivityId, row.zone]),
  );
}

function normalizeRacePriority(value: string | null): 'A' | 'B' | 'C' | null {
  return value === 'A' || value === 'B' || value === 'C' ? value : null;
}

type PlanTraceRow = typeof pulsePlanGenerations.$inferSelect;

type TraceWorkout = {
  plannedDate: string;
  activityType: string;
  zone: number;
  durationMin: number;
  targetTss: number | null;
  adjustedReason?: string | null;
};

type ExecutionWorkoutRow = {
  id: string;
  plannedDate: string;
  activityType: SharedPulseActivityType;
  zone: number;
  durationMin: number;
  status: string;
  completedActivityId: string | null;
  complianceScore: number | null;
};

type ExecutionActivityRow = {
  id: string;
  startTime: Date;
  activityType: SharedPulseActivityType;
  durationSec: number | null;
  tss: number | null;
  rpe: number | null;
  sorenessAreas: string[] | null;
};

function shiftIsoDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split('T')[0]!;
}

function currentWeekStartIso(now = new Date()): string {
  const weekStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = weekStart.getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  weekStart.setUTCDate(weekStart.getUTCDate() + mondayOffset);
  return weekStart.toISOString().split('T')[0]!;
}

function normalizeSorenessAreas(areas: string[] | null): RpeSorenessArea[] | null {
  if (!areas || areas.length === 0) return null;
  const allowed = new Set<string>(RPE_SORENESS_AREAS);
  const normalized = areas.filter((area): area is RpeSorenessArea => allowed.has(area));
  return normalized.length > 0 ? normalized : null;
}

function buildExecutionReviewForPreviousWeek(params: {
  currentWeekStart: string;
  previousWorkouts: ExecutionWorkoutRow[];
  activities: ExecutionActivityRow[];
  availableDays: number[];
  recovery: ReturnType<typeof recoveryFromFitnessLoad>;
  today: string;
}): PulseTrainingExecutionReview | null {
  if (params.previousWorkouts.length === 0) return null;
  const previousWeekStart = shiftIsoDate(params.currentWeekStart, -7);
  const previousActivities = params.activities.filter(activity => {
    const date = activity.startTime.toISOString().split('T')[0]!;
    return date >= previousWeekStart && date < params.currentWeekStart;
  });

  return buildTrainingExecutionReview({
    weekStart: previousWeekStart,
    plannedWorkouts: params.previousWorkouts.map(workout => ({
      id: workout.id,
      plannedDate: workout.plannedDate,
      activityType: workout.activityType,
      zone: workout.zone,
      durationMin: workout.durationMin,
      status: workout.status,
      completedActivityId: workout.completedActivityId,
      complianceScore: workout.complianceScore,
    })),
    activities: previousActivities.map(activity => ({
      id: activity.id,
      startTime: activity.startTime,
      activityType: activity.activityType,
      durationSec: activity.durationSec,
      tss: activity.tss,
      rpe: activity.rpe,
      sorenessAreas: normalizeSorenessAreas(activity.sorenessAreas),
    })),
    availableDays: params.availableDays,
    recovery: params.recovery,
    today: params.today,
  });
}

function mapPlanTrace(row: PlanTraceRow): PulsePlanTrace {
  const adaptation = row.inputSnapshot.adaptation ?? null;
  const restDayRationale = row.inputSnapshot.restDayRationale ?? [];
  return {
    id: row.id,
    userId: row.userId,
    weekStart: row.weekStart,
    createdAt: row.createdAt?.toISOString() ?? new Date(0).toISOString(),
    inputSnapshot: row.inputSnapshot,
    planDecision: row.planDecision,
    sportMix: row.sportMix,
    hardDays: row.hardDays,
    generatedSummary: row.generatedSummary ?? [],
    adaptation,
    restDayRationale,
  };
}

function dayOffsetFromWeekStart(weekStart: string, plannedDate: string): number | null {
  const start = Date.parse(`${weekStart}T00:00:00Z`);
  const date = Date.parse(`${plannedDate}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(date)) return null;
  const offset = Math.round((date - start) / 86_400_000);
  return offset >= 0 && offset <= 6 ? offset : null;
}

function reconcilePlanDecisionWithWorkouts(params: {
  decision: PulsePlanDecision;
  weekStart: string;
  availableDays: number[];
  workouts: TraceWorkout[];
}): PulsePlanDecision {
  const selectedDays = [...new Set(params.workouts
    .map(workout => dayOffsetFromWeekStart(params.weekStart, workout.plannedDate))
    .filter((day): day is number => day != null))]
    .sort((a, b) => a - b);
  const availableDays = [...new Set(params.availableDays)].sort((a, b) => a - b);
  const skippedAvailableDays = availableDays.filter(day => !selectedDays.includes(day));
  const changed = (
    selectedDays.join(',') !== params.decision.selectedDays.join(',') ||
    skippedAvailableDays.join(',') !== params.decision.skippedAvailableDays.join(',')
  );

  return {
    ...params.decision,
    selectedDays,
    skippedAvailableDays,
    targetSessionCount: selectedDays.length,
    reasons: changed
      ? [...params.decision.reasons, 'Finale Health-/Race-Constraints haben die Trainingstage nach der Grundentscheidung angepasst.']
      : params.decision.reasons,
  };
}

async function persistPlanTrace(
  app: FastifyInstance,
  values: typeof pulsePlanGenerations.$inferInsert,
): Promise<PulsePlanTrace | null> {
  try {
    const [row] = await db.insert(pulsePlanGenerations).values(values).returning();
    return row ? mapPlanTrace(row) : null;
  } catch (err) {
    app.log.warn(`[plan] Plan trace persistence failed (non-fatal): ${err}`);
    return null;
  }
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

// ─── Workout step generation ──────────────────────────────────────────────────

function supportsHrStepTargets(activityType: string): boolean {
  return activityType === 'run' || activityType === 'bike' || activityType === 'hike';
}

function addHrTargetToStep(step: WorkoutStep, profile: { maxHrBpm: number | null; lthrBpm: number | null } | undefined): WorkoutStep {
  const maxHr = profile?.maxHrBpm ?? 185;
  const target = hrTargetRangeForZone(step.zone, maxHr, profile?.lthrBpm ?? null);
  const description = step.description?.includes('bpm')
    ? step.description
    : `${step.description ? `${step.description} ` : ''}HR ${target.label}.`.trim();
  const next: WorkoutStep = {
    ...step,
    description,
    targetLabel: target.label,
  };
  if (target.minBpm != null) next.targetHrMinBpm = target.minBpm;
  if (target.maxBpm != null) next.targetHrMaxBpm = target.maxBpm;
  return next;
}

function hrZoneReference(maxHrBpm: number, lthrBpm: number | null | undefined): string {
  return [1, 2, 3, 4, 5]
    .map(zone => {
      const target = hrTargetRangeForZone(zone, maxHrBpm, lthrBpm ?? null);
      return `Z${zone} ${target.label}`;
    })
    .join(', ');
}

function buildDeterministicWorkoutSteps(
  workout: { activityType: string; zone: number; durationMin: number; description: string | null },
  profile: { maxHrBpm: number | null; lthrBpm: number | null } | undefined,
): WorkoutStep[] {
  const duration = Math.max(5, workout.durationMin);
  const zone = Math.max(1, Math.min(5, workout.zone));
  let steps: WorkoutStep[];

  if (duration <= 20) {
    steps = [{ type: 'steady', durationMin: duration, zone, description: 'Kurze Aktivierung sauber und kontrolliert ausführen.' }];
  } else if (zone >= 4) {
    const warmup = Math.min(15, Math.max(8, Math.round(duration * 0.25)));
    const cooldown = Math.min(10, Math.max(5, Math.round(duration * 0.15)));
    const workBudget = Math.max(8, duration - warmup - cooldown);
    const reps = Math.max(2, Math.min(zone >= 5 ? 6 : 5, Math.floor(workBudget / (zone >= 5 ? 5 : 8))));
    const restMin = zone >= 5 ? 2 : 3;
    const intervalMin = Math.max(2, Math.floor((workBudget - restMin * (reps - 1)) / reps));
    steps = [
      { type: 'warmup', durationMin: warmup, zone: 1, description: 'Progressiv aufwaermen, locker starten.' },
      { type: 'interval', reps, durationMin: intervalMin, restMin, zone, description: `Qualitaetsblock in Z${zone}, Pausen wirklich locker.` },
      { type: 'cooldown', durationMin: cooldown, zone: 1, description: 'Ausschwingen und Puls beruhigen.' },
    ];
  } else {
    const warmup = duration >= 45 ? 10 : 5;
    const cooldown = duration >= 45 ? 10 : 5;
    steps = [
      { type: 'warmup', durationMin: warmup, zone: 1, description: 'Locker einrollen/einlaufen.' },
      { type: 'steady', durationMin: Math.max(5, duration - warmup - cooldown), zone, description: `Stabiler aerober Block in Z${zone}.` },
      { type: 'cooldown', durationMin: cooldown, zone: 1, description: 'Ruhig beenden.' },
    ];
  }

  return steps.map(step => supportsHrStepTargets(workout.activityType) ? addHrTargetToStep(step, profile) : step);
}

async function buildWorkoutSteps(
  workout: { id: string; activityType: string; zone: number; durationMin: number; description: string | null },
  profile: { ftpWatts: number | null; maxHrBpm: number | null; lthrBpm: number | null } | undefined,
): Promise<{ steps: WorkoutStep[]; updatedDescription: string | null }> {
  const ftp = profile?.ftpWatts ?? 250;
  const maxHr = profile?.maxHrBpm ?? 185;

  const isRun = workout.activityType === 'run';
  const isBike = workout.activityType === 'bike';
  const intensityRef = supportsHrStepTargets(workout.activityType)
    ? `HR-first: ${hrZoneReference(maxHr, profile?.lthrBpm)}. FTP=${ftp}W nur als Sekundaerkontrolle.`
    : isBike
    ? `FTP=${ftp}W als Sekundaerinfo; wenn Pulsdaten fehlen: Z2 ${Math.round(ftp*0.56)}-${Math.round(ftp*0.75)}W, Z4 ${Math.round(ftp*0.90)}-${Math.round(ftp*1.05)}W.`
    : isRun
    ? `Max-HF=${maxHr}bpm, HR-first: ${hrZoneReference(maxHr, profile?.lthrBpm)}.`
    : `Technik/Bewegungsqualitaet; keine harte Zielzone erzwingen.`;

  const prompt = `Erstelle eine detaillierte Trainingsanleitung für dieses Workout:

Typ: ${workout.activityType} | Zone: ${workout.zone} | Dauer: ${workout.durationMin} min
Kurzbeschreibung: ${workout.description ?? '–'}
Athleten-Referenz: ${intensityRef}

Antworte NUR mit einem JSON-Objekt:
{
  "steps": [
    {"type":"warmup","durationMin":10,"zone":1,"description":"Beschreibung"},
    {"type":"interval","reps":4,"durationMin":8,"zone":4,"restMin":2,"description":"Ziel: X"},
    {"type":"cooldown","durationMin":10,"zone":1,"description":"Ausschwingen"}
  ],
  "coachingNote": "1-2 Sätze Coaching-Hinweis auf Deutsch"
}

Typen: warmup, interval, steady, cooldown. Zonen 1-5.
Gesamtdauer der steps muss ~${workout.durationMin} Minuten ergeben (inkl. Pausen).
Bei reinen Z2-Workouts: nur warmup + steady + cooldown, kein interval.
Bei Run/Bike/Hike: Beschreibungen muessen die HR-Zielrange nennen; Watt/Pace nur als Sekundaerkontrolle.`;

  try {
    const raw = await llmComplete(
      'Du bist Sportwissenschaftler und Ausdauercoach. Antworte nur mit validem JSON.',
      prompt,
      SMART_MODEL,
    );

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('LLM returned no valid JSON for workout steps');

    const parsed = JSON.parse(jsonMatch[0]) as { steps: WorkoutStep[]; coachingNote?: string };
    if (!Array.isArray(parsed.steps) || parsed.steps.length === 0) {
      throw new Error('LLM returned empty workout steps');
    }
    const steps: WorkoutStep[] = parsed.steps.map(s => {
      const step: WorkoutStep = {
        type: (['warmup','interval','rest','cooldown','steady'].includes(s.type) ? s.type : 'steady') as WorkoutStep['type'],
        durationMin: Math.max(1, s.durationMin ?? 10),
        zone: Math.max(1, Math.min(5, s.zone ?? workout.zone)),
      };
      if (s.reps != null) step.reps = s.reps;
      if (s.restMin != null) step.restMin = s.restMin;
      if (s.description) step.description = s.description;
      return supportsHrStepTargets(workout.activityType) ? addHrTargetToStep(step, profile) : step;
    });

    const coachingNote = parsed.coachingNote ?? null;
    const updatedDescription = coachingNote
      ? `${workout.description ?? ''}\n\n${coachingNote}`.trim()
      : workout.description;

    return { steps, updatedDescription };
  } catch {
    return {
      steps: buildDeterministicWorkoutSteps(workout, profile),
      updatedDescription: workout.description,
    };
  }
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

  // ─── Training plan ────────────────────────────────────────────────────────────
  app.get('/plan', { onRequest: [app.authenticate] }, async (req) => {
    const userId = req.user.sub;
    const now = new Date();
    const since = toIsoDate(addDateDays(now, -7));
    const workouts = await db.select()
      .from(pulsePlannedWorkouts)
      .where(and(eq(pulsePlannedWorkouts.userId, userId), gte(pulsePlannedWorkouts.plannedDate, since)))
      .orderBy(pulsePlannedWorkouts.plannedDate)
      .limit(21);

    const activities = await db.select({
      id: pulseActivities.id,
      startTime: pulseActivities.startTime,
      activityType: pulseActivities.activityType,
      durationSec: pulseActivities.durationSec,
    }).from(pulseActivities)
      .where(and(
        eq(pulseActivities.userId, userId),
        gte(pulseActivities.startTime, new Date(`${since}T00:00:00.000Z`)),
      ))
      .limit(100);

    return { workouts: workouts.map(workout => enrichWorkoutExecutionState(workout, activities, now)) };
  });

  // ─── Single workout + detail generation ──────────────────────────────────────
  app.get('/plan/workout/:id', { onRequest: [app.authenticate] }, async (req, reply) => {
    const userId = req.user.sub;
    const { id } = req.params as { id: string };
    const [workout] = await db.select().from(pulsePlannedWorkouts)
      .where(and(eq(pulsePlannedWorkouts.id, id), eq(pulsePlannedWorkouts.userId, userId)));
    if (!workout) return reply.status(404).send({ error: 'Not found' });
    const activities = await db.select({
      id: pulseActivities.id,
      startTime: pulseActivities.startTime,
      activityType: pulseActivities.activityType,
      durationSec: pulseActivities.durationSec,
    }).from(pulseActivities)
      .where(and(
        eq(pulseActivities.userId, userId),
        gte(pulseActivities.startTime, new Date(`${workout.plannedDate}T00:00:00.000Z`)),
        lte(pulseActivities.startTime, new Date(`${workout.plannedDate}T23:59:59.999Z`)),
      ))
      .limit(20);
    return { workout: enrichWorkoutExecutionState(workout, activities, new Date()) };
  });

  app.patch('/plan/workout/:id', { onRequest: [app.authenticate] }, async (req, reply) => {
    const schema = z.object({
      activityType: z.enum(['run','bike','swim','strength','hike','other']).optional(),
      zone:         z.number().int().min(1).max(5).optional(),
      durationMin:  z.number().int().min(5).max(360).optional(),
      plannedDate:  isoDateSchema.optional(),
      status:       z.enum(['planned','skipped']).optional(),
      description:  z.string().max(1000).nullable().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Ungültige Eingabe' });
    if (Object.keys(parsed.data).length === 0) return reply.status(400).send({ error: 'Ungültige Eingabe' });
    const userId = req.user.sub;
    const { id } = req.params as { id: string };
    const changesPrescription =
      parsed.data.activityType !== undefined ||
      parsed.data.zone !== undefined ||
      parsed.data.durationMin !== undefined;
    let targetTss: number | undefined;
    if (parsed.data.zone !== undefined || parsed.data.durationMin !== undefined) {
      const [current] = await db.select({
        zone: pulsePlannedWorkouts.zone,
        durationMin: pulsePlannedWorkouts.durationMin,
      }).from(pulsePlannedWorkouts)
        .where(and(eq(pulsePlannedWorkouts.id, id), eq(pulsePlannedWorkouts.userId, userId)));
      if (!current) return reply.status(404).send({ error: 'Not found' });
      targetTss = tssFromWorkout(parsed.data.durationMin ?? current.durationMin, parsed.data.zone ?? current.zone);
    }
    const [updated] = await db.update(pulsePlannedWorkouts)
      .set({
        ...parsed.data,
        ...(changesPrescription ? { steps: null } : {}),
        ...(targetTss !== undefined ? { targetTss } : {}),
      })
      .where(and(eq(pulsePlannedWorkouts.id, id), eq(pulsePlannedWorkouts.userId, userId)))
      .returning();
    if (!updated) return reply.status(404).send({ error: 'Not found' });
    return { workout: updated };
  });

  app.post('/plan/workout/:id/detail', { onRequest: [app.authenticate] }, async (req, reply) => {
    const userId = req.user.sub;
    const { id } = req.params as { id: string };
    const [workout] = await db.select().from(pulsePlannedWorkouts)
      .where(and(eq(pulsePlannedWorkouts.id, id), eq(pulsePlannedWorkouts.userId, userId)));
    if (!workout) return reply.status(404).send({ error: 'Not found' });

    const [profile] = await db.select().from(pulseUserProfile).where(eq(pulseUserProfile.userId, userId));
    const { steps, updatedDescription } = await buildWorkoutSteps(workout, profile ?? undefined);

    await db.update(pulsePlannedWorkouts)
      .set({ steps, description: updatedDescription })
      .where(eq(pulsePlannedWorkouts.id, id));

    return { workout: { ...workout, steps, description: updatedDescription } };
  });

  // ─── Garmin Connect workout sync ──────────────────────────────────────────────
  app.post('/plan/workout/:id/sync-garmin', { onRequest: [app.authenticate] }, async (req, reply) => {
    const userId = req.user.sub;
    const { id } = req.params as { id: string };

    const [workout] = await db.select().from(pulsePlannedWorkouts)
      .where(and(eq(pulsePlannedWorkouts.id, id), eq(pulsePlannedWorkouts.userId, userId)));
    if (!workout) return reply.status(404).send({ error: 'Not found' });

    const [profile] = await db.select().from(pulseUserProfile).where(eq(pulseUserProfile.userId, userId));

    if (!workout.steps?.length) {
      const { steps, updatedDescription } = await buildWorkoutSteps(workout, profile ?? undefined);
      await db.update(pulsePlannedWorkouts)
        .set({ steps, description: updatedDescription })
        .where(eq(pulsePlannedWorkouts.id, id));
      workout.steps = steps as typeof workout.steps;
      if (updatedDescription) workout.description = updatedDescription;
    }

    try {
      const { getGarminClient } = await import('../lib/garmin-client.js');
      const gc = await getGarminClient();

      const garminWorkout = buildGarminWorkoutJson(workout);
      const created = await gc.addWorkout(garminWorkout) as { workoutId: number };
      const garminWorkoutId = String(created.workoutId);

      const scheduled = await garminApi.scheduleWorkout(gc, garminWorkoutId, workout.plannedDate) as any;
      const garminScheduledId = scheduled?.workoutScheduleId != null
        ? String(scheduled.workoutScheduleId)
        : scheduled?.scheduledWorkoutId != null
          ? String(scheduled.scheduledWorkoutId)
          : null;

      const executionStatus = garminScheduledId ? 'garmin_scheduled' : 'garmin_template';
      const executionNotes = garminScheduledId
        ? 'Workout ist auf Garmin im Kalender geplant.'
        : 'Workout-Vorlage ist auf Garmin, aber kein Kalendertermin ist bekannt.';

      const [updated] = await db.update(pulsePlannedWorkouts)
        .set({ garminWorkoutId, garminScheduledId, executionStatus, executionNotes })
        .where(eq(pulsePlannedWorkouts.id, id))
        .returning();

      return {
        garminWorkoutId,
        garminScheduledId,
        date: workout.plannedDate,
        workout: updated ? enrichWorkoutExecutionState(updated, [], new Date()) : null,
      };
    } catch (err) {
      app.log.error(`Garmin workout sync failed: ${err}`);
      return reply.status(502).send({ error: `Garmin-Sync fehlgeschlagen: ${String(err).slice(0, 120)}` });
    }
  });

  // ─── Garmin Calendar Sync ─────────────────────────────────────────────────────
  // Fetches Garmin calendar via calendar-service (month=0-indexed) and returns
  // future workout schedule entries. Each item: { id (scheduleId), workoutId, date }.
  async function fetchGarminCalendarWorkouts(gc: any, today: string): Promise<Array<{ id: string; workoutId: string; date: string }>> {
    const result: Array<{ id: string; workoutId: string; date: string }> = [];
    const now = new Date();
    for (let offset = 0; offset < 3; offset++) {
      const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
      const year = d.getFullYear();
      const month = d.getMonth(); // 0-indexed — calendar-service uses this format
      try {
        const cal = await garminApi.getCalendarMonth(gc, year, month) as any;
        const items: any[] = cal?.calendarItems ?? [];
        for (const item of items) {
          if (item.itemType !== 'workout') continue;
          if (!item.workoutId) continue;
          const date: string = item.date ?? '';
          if (date < today) continue;
          result.push({ id: String(item.id), workoutId: String(item.workoutId), date });
        }
      } catch { /* non-fatal */ }
    }
    return result;
  }

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

  app.post('/plan/generate', { onRequest: [app.authenticate] }, async (req, reply) => {
    const userId = req.user.sub;
    const body = req.body as { weekStart?: string } | null;
    let weekStartStr: string;
    if (body?.weekStart && /^\d{4}-\d{2}-\d{2}$/.test(body.weekStart)) {
      weekStartStr = body.weekStart;
    } else {
      const now = new Date();
      const mondayOffset = now.getDay() === 0 ? -6 : 1 - now.getDay();
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() + mondayOffset);
      weekStartStr = weekStart.toISOString().split('T')[0]!;
    }

    const [profile] = await db.select()
      .from(pulseUserProfile)
      .where(eq(pulseUserProfile.userId, userId));
    const profileProvenance = profileWithProvenance(profile ?? null, userId).provenance;

    // Auto-derive phase from next race (Phase 8 wird das ergänzen). Fallback: profile.trainingPhase.
    // 'base' default in profile bedeutet "Auto"; nur explizite Werte überschreiben den Race-derived.
    const explicitPhase = profile?.trainingPhase as 'base' | 'build' | 'peak' | 'taper' | null | undefined;
    const derivedPhase  = await deriveCurrentPhase(userId, weekStartStr);
    const phase: 'base' | 'build' | 'peak' | 'taper' =
      (explicitPhase && explicitPhase !== 'base') ? explicitPhase : derivedPhase;

    // Use week-specific availability if set, fall back to profile defaults
    const [weekAvail] = await db.select()
      .from(pulseWeekAvailability)
      .where(and(eq(pulseWeekAvailability.userId, userId), eq(pulseWeekAvailability.weekStart, weekStartStr)));

    const weeklyHoursTarget = weekAvail?.weeklyHours ?? profile?.weeklyHoursTarget ?? 8;
    const availableDays = (weekAvail?.availableDays as number[] | null) ?? [0, 2, 4, 5];

    const since42d = new Date(Date.now() - 42 * 86_400_000);
    const today = new Date().toISOString().split('T')[0]!;
    const previousWeekStart = shiftIsoDate(weekStartStr, -7);
    const [fitnessLoad, recentActs, goals, recentFeedback, activeHealthStates, riskSignalRows, planLearning, previousWorkoutRows] = await Promise.all([
      computeFitnessLoad(userId, weekStartStr),
      db.select({
        id:            pulseActivities.id,
        startTime:    pulseActivities.startTime,
        activityType: pulseActivities.activityType,
        durationSec:  pulseActivities.durationSec,
        tss:          pulseActivities.tss,
        rpe:          pulseActivities.rpe,
        sorenessAreas: pulseActivities.sorenessAreas,
      }).from(pulseActivities)
        .where(and(eq(pulseActivities.userId, userId), gte(pulseActivities.startTime, since42d)))
        .orderBy(desc(pulseActivities.startTime))
        .limit(80),
      db.select({
        title:          pulseGoals.title,
        targetDate:     pulseGoals.targetDate,
        category:       pulseGoals.category,
        metrics:        pulseGoals.metrics,
        raceDiscipline: pulseGoals.raceDiscipline,
        raceDistanceKm: pulseGoals.raceDistanceKm,
        racePriority:   pulseGoals.racePriority,
      })
        .from(pulseGoals)
        .where(and(eq(pulseGoals.userId, userId), eq(pulseGoals.status, 'active')))
        .limit(5),
      db.select({
        plannedDate:     pulsePlannedWorkouts.plannedDate,
        activityType:    pulsePlannedWorkouts.activityType,
        zone:            pulsePlannedWorkouts.zone,
        durationMin:     pulsePlannedWorkouts.durationMin,
        workoutFeedback: pulsePlannedWorkouts.workoutFeedback,
        complianceScore: pulsePlannedWorkouts.complianceScore,
      }).from(pulsePlannedWorkouts)
        .where(and(
          eq(pulsePlannedWorkouts.userId, userId),
          eq(pulsePlannedWorkouts.status, 'completed'),
          gte(pulsePlannedWorkouts.plannedDate, since42d.toISOString().split('T')[0]!),
        ))
        .orderBy(desc(pulsePlannedWorkouts.plannedDate))
        .limit(10),
      db.select().from(pulseHealthState)
        .where(and(
          eq(pulseHealthState.userId, userId),
          isNull(pulseHealthState.resolvedAt),
          or(isNull(pulseHealthState.endDate), gte(pulseHealthState.endDate, today)),
        )),
      getActiveRiskSignals(userId),
      buildPlanLearningSnapshot(userId, weekStartStr),
      db.select({
        id: pulsePlannedWorkouts.id,
        plannedDate: pulsePlannedWorkouts.plannedDate,
        activityType: pulsePlannedWorkouts.activityType,
        zone: pulsePlannedWorkouts.zone,
        durationMin: pulsePlannedWorkouts.durationMin,
        status: pulsePlannedWorkouts.status,
        completedActivityId: pulsePlannedWorkouts.completedActivityId,
        complianceScore: pulsePlannedWorkouts.complianceScore,
      }).from(pulsePlannedWorkouts)
        .where(and(
          eq(pulsePlannedWorkouts.userId, userId),
          gte(pulsePlannedWorkouts.plannedDate, previousWeekStart),
          lt(pulsePlannedWorkouts.plannedDate, weekStartStr),
          inArray(pulsePlannedWorkouts.status, ['planned', 'completed', 'skipped']),
        )),
    ]);
    const activeRaces = await getActiveRaces(userId, weekStartStr, { ctl: fitnessLoad.ctl });
    const [coachPrefsRow] = await db.select().from(pulseCoachPreferences).where(eq(pulseCoachPreferences.userId, userId)).limit(1);
    const plannedZoneByActivityId = await getPlannedZoneByActivityId(userId, recentActs.map(a => a.id));
    const recentPlanActivities = recentActs.map(a => ({
      date:         a.startTime.toISOString().split('T')[0]!,
      activityType: a.activityType,
      durationMin:  Math.round((a.durationSec ?? 0) / 60),
      tss:          a.tss ?? 0,
      rpe:          a.rpe,
      plannedZone:  plannedZoneByActivityId.get(a.id) ?? null,
    }));
    const planGoals = goals.map(g => ({
      ...g,
      metrics: (g.metrics as Record<string, unknown> | null) ?? null,
      racePriority: normalizeRacePriority(g.racePriority),
    }));
    const riskSignals = riskSignalRows.map(r => ({
      ruleId: r.ruleId,
      severity: r.severity as 'info' | 'warn' | 'critical',
      title: r.title,
      recommendation: r.recommendation,
    }));
    const coachPreferences = serializeCoachPreferences(coachPrefsRow ?? null);
    const seasonStrategy = buildSeasonStrategy({
      today,
      weekStart: weekStartStr,
      races: activeRaces,
      goals: planGoals.map(goal => ({
        id: null,
        title: goal.title,
        category: goal.category,
        targetDate: goal.targetDate,
        racePriority: goal.racePriority,
      })),
      fitnessLoad,
      availability: { availableDays, weeklyHours: weeklyHoursTarget },
      coachPreferences: {
        preferredLongDays: coachPreferences.preferredLongDays,
        dislikedWorkoutPatterns: coachPreferences.dislikedWorkoutPatterns,
      },
    });
    const executionReview = buildExecutionReviewForPreviousWeek({
      currentWeekStart: weekStartStr,
      previousWorkouts: previousWorkoutRows,
      activities: recentActs,
      availableDays: deriveExecutionReviewAvailability({
        weekStart: previousWeekStart,
        plannedWorkouts: previousWorkoutRows,
        skippedAvailableDays: planLearning.previousWeek?.skippedAvailableDays ?? [],
      }),
      recovery: recoveryFromFitnessLoad(fitnessLoad),
      today,
    });
    const planLearningWithExecution = executionReview
      ? { ...planLearning, executionReview }
      : planLearning;
    const mesocycleWeek = getMesocycleWeek(weekStartStr);
    const planDecision = decidePlanDays({
      availableDays,
      weeklyHoursTarget,
      tsb: fitnessLoad.tsb,
      phase,
      mesocycleWeek,
      goals: planGoals,
      riskSignals,
      recentActivities: recentPlanActivities,
      planLearning: planLearningWithExecution,
      executionReview,
      seasonStrategy,
    });

    let generated: Awaited<ReturnType<typeof generateWeekWorkouts>>;
    try {
      generated = await generateScientificWeekPlan({
        weekStart:          weekStartStr,
        phase,
        weeklyHoursTarget,
        availableDays,
        ctl:                fitnessLoad.ctl,
        atl:                fitnessLoad.atl,
        tsb:                fitnessLoad.tsb,
        ftpWatts:           profile?.ftpWatts ?? 250,
        maxHrBpm:           profile?.maxHrBpm ?? 185,
        lthrBpm:            profile?.lthrBpm ?? undefined,
        recentActivities:   recentPlanActivities,
        goals:              planGoals,
        riskSignals,
        planLearning:        planLearningWithExecution,
        executionReview,
        seasonStrategy,
        recentFeedback: recentFeedback
          .filter(w => w.workoutFeedback != null)
          .map(w => ({
            date:               w.plannedDate,
            activityType:       w.activityType,
            plannedZone:        w.zone,
            plannedDurationMin: w.durationMin,
            feedback:           w.workoutFeedback!,
            complianceScore:    w.complianceScore ?? 0.7,
          })),
        healthStates: activeHealthStates.map(s => ({
          type:      s.type as 'illness' | 'injury' | 'fatigue' | 'travel',
          severity:  s.severity as 'mild' | 'moderate' | 'severe',
          bodyPart:  s.bodyPart,
          startDate: s.startDate,
          endDate:   s.endDate,
          notes:     s.notes,
        })),
        races: activeRaces.map(r => ({
          title:      r.title,
          date:       r.date,
          daysUntil:  r.daysUntil,
          priority:   r.priority,
          discipline: r.discipline,
          distanceKm: r.distanceKm,
        })),
      });
    } catch (err) {
      app.log.warn(`[plan] Scientific plan failed, using templates: ${err}`);
      generated = generateWeekWorkouts({ weekStart: weekStartStr, phase, weeklyHoursTarget, availableDays: planDecision.selectedDays });
    }
    const replacementCutoff = determinePlanReplacementCutoff(weekStartStr, today);
    const generatedForInsert = generated.filter(w => w.plannedDate >= replacementCutoff);
    const preservedWorkoutRows = replacementCutoff > weekStartStr
      ? await db.select().from(pulsePlannedWorkouts).where(and(
          eq(pulsePlannedWorkouts.userId, userId),
          gte(pulsePlannedWorkouts.plannedDate, weekStartStr),
          lt(pulsePlannedWorkouts.plannedDate, replacementCutoff),
        ))
      : [];

    // Clean up old Garmin workouts before deleting from DB (prevents duplicates)
    const oldWorkouts = await db.select({
      garminWorkoutId:   pulsePlannedWorkouts.garminWorkoutId,
      garminScheduledId: pulsePlannedWorkouts.garminScheduledId,
    }).from(pulsePlannedWorkouts).where(and(
      eq(pulsePlannedWorkouts.userId, userId),
      gte(pulsePlannedWorkouts.plannedDate, replacementCutoff),
      eq(pulsePlannedWorkouts.status, 'planned'),
    ));

    const oldWithGarmin = oldWorkouts.filter(w => w.garminWorkoutId);
    if (oldWithGarmin.length > 0) {
      try {
        const { getGarminClient } = await import('../lib/garmin-client.js');
        const gc = await getGarminClient();
        await Promise.allSettled(oldWithGarmin.map(async (w) => {
          if (w.garminScheduledId) {
            await garminApi.deleteWorkoutSchedule(gc, w.garminScheduledId);
          }
          await garminApi.deleteWorkout(gc, w.garminWorkoutId!);
        }));
        app.log.info(`[plan] Cleaned up ${oldWithGarmin.length} old Garmin workouts`);
      } catch (err) {
        app.log.warn(`[plan] Garmin cleanup failed (non-fatal): ${err}`);
      }
    }

    await db.delete(pulsePlannedWorkouts).where(
      and(
        eq(pulsePlannedWorkouts.userId, userId),
        gte(pulsePlannedWorkouts.plannedDate, replacementCutoff),
        eq(pulsePlannedWorkouts.status, 'planned'),
      ),
    );

    const inserted = generatedForInsert.length > 0
      ? await db.insert(pulsePlannedWorkouts).values(
          generatedForInsert.map((w) => ({
            userId,
            plannedDate:  w.plannedDate,
            activityType: w.activityType,
            zone:         w.zone,
            durationMin:  w.durationMin,
            targetTss:    w.targetTss,
            description:  w.description,
            adjustedReason: w.adjustedReason ?? null,
            adjustedAt:   w.adjustedReason ? new Date() : null,
          })),
        ).returning()
      : [];

    // Generate structured steps for all workouts in parallel (best-effort)
    const withSteps = await Promise.all(
      inserted.map(async (w) => {
        try {
          const { steps, updatedDescription } = await buildWorkoutSteps(w, profile ?? undefined);
          await db.update(pulsePlannedWorkouts)
            .set({ steps, description: updatedDescription })
            .where(eq(pulsePlannedWorkouts.id, w.id));
          return { ...w, steps, description: updatedDescription };
        } catch (err) {
          app.log.warn(`[plan] Step generation failed for workout ${w.id}: ${err}`);
          return w;
        }
      }),
    );

    const traceWorkouts = mergeRegeneratedWorkoutsForTrace(preservedWorkoutRows, withSteps);
    const finalPlanDecision = reconcilePlanDecisionWithWorkouts({
      decision: planDecision,
      weekStart: weekStartStr,
      availableDays,
      workouts: traceWorkouts,
    });
    const planTracePayload = buildPlanTrace({
      weekStart: weekStartStr,
      phase,
      mesocycleWeek,
      weeklyHoursTarget,
      availableDays,
      load: fitnessLoad,
      profile: {
        ftpWatts: profile?.ftpWatts ?? null,
        maxHrBpm: profile?.maxHrBpm ?? null,
        lthrBpm: profile?.lthrBpm ?? null,
        provenance: profileProvenance,
      },
      goals: planGoals,
      riskSignals,
      planLearning: planLearningWithExecution,
      executionReview,
      healthStates: activeHealthStates.map(s => ({
        type:      s.type,
        severity:  s.severity,
        bodyPart:  s.bodyPart,
        startDate: s.startDate,
        endDate:   s.endDate,
      })),
      recentActivities: recentPlanActivities,
      planDecision: finalPlanDecision,
      workouts: traceWorkouts,
      seasonStrategy,
    });
    const planTrace = await persistPlanTrace(app, {
      userId,
      weekStart: weekStartStr,
      ...planTracePayload,
    });
    await invalidateUser(userId);

    // Fire-and-forget: sync newly generated workouts to Garmin calendar
    (async () => {
      try {
        const { getGarminClient } = await import('../lib/garmin-client.js');
        const gc = await getGarminClient();
        const syncCutoff = replacementCutoff;

        // Upload new workouts to Garmin
        for (const w of withSteps.filter(ww => !ww.garminWorkoutId)) {
          try {
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
            app.log.info(`[plan-generate] Synced workout ${w.id} → Garmin ${garminWorkoutId}`);
          } catch (err) {
            app.log.warn(`[plan-generate] Garmin sync failed for ${w.id}: ${err}`);
          }
        }

        // Remove orphaned calendar entries not in current plan
        const allFuture = await db.select({ garminWorkoutId: pulsePlannedWorkouts.garminWorkoutId })
          .from(pulsePlannedWorkouts)
          .where(and(eq(pulsePlannedWorkouts.userId, userId), gte(pulsePlannedWorkouts.plannedDate, syncCutoff)));
        const ourIds = new Set(allFuture.map(w => w.garminWorkoutId).filter((id): id is string => id != null));
        const calItems = await fetchGarminCalendarWorkouts(gc, syncCutoff);
        const deletedTemplates = new Set<string>();
        for (const item of calItems) {
          if (!ourIds.has(item.workoutId)) {
            try {
              await garminApi.deleteWorkoutSchedule(gc, item.id);
              app.log.info(`[plan-generate] Removed orphan ${item.id} on ${item.date}`);
            } catch { /* non-fatal */ }
            if (!deletedTemplates.has(item.workoutId)) {
              try {
                await garminApi.deleteWorkout(gc, item.workoutId);
                deletedTemplates.add(item.workoutId);
              } catch { /* template may already be gone */ }
            }
          }
        }
      } catch (err) {
        app.log.warn(`[plan-generate] Background Garmin calendar sync failed: ${err}`);
      }
    })();

    return reply.status(201).send({
      workouts: [...preservedWorkoutRows, ...withSteps].sort((a, b) => a.plannedDate.localeCompare(b.plannedDate)),
      planDecision: finalPlanDecision,
      planTrace,
    });
  });

  app.get('/plan/trace/:weekStart', { onRequest: [app.authenticate] }, async (req, reply) => {
    const userId = req.user.sub;
    const { weekStart } = req.params as { weekStart: string };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) return reply.status(400).send({ error: 'Ungültiges Datum' });

    const [row] = await db.select()
      .from(pulsePlanGenerations)
      .where(and(
        eq(pulsePlanGenerations.userId, userId),
        eq(pulsePlanGenerations.weekStart, weekStart),
      ))
      .orderBy(desc(pulsePlanGenerations.createdAt))
      .limit(1);

    return { trace: row ? mapPlanTrace(row) : null };
  });

  // ─── Goals ────────────────────────────────────────────────────────────────────
  app.get('/goals', { onRequest: [app.authenticate] }, async (req) => {
    const userId = req.user.sub;
    const goals = await db.select()
      .from(pulseGoals)
      .where(eq(pulseGoals.userId, userId))
      .orderBy(desc(pulseGoals.createdAt));
    return { goals };
  });

  app.post('/goals', { onRequest: [app.authenticate] }, async (req, reply) => {
    const schema = z.object({
      title:       z.string().min(1).max(255),
      description: z.string().max(1000).optional(),
      targetDate:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      category:    z.string().max(30).optional(),
      metrics:     z.record(z.unknown()).optional(),
      raceDiscipline:    z.enum(['run','bike','swim','triathlon_sprint','triathlon_olympic','triathlon_70_3','triathlon_140_6','duathlon','other']).optional(),
      raceDistanceKm:    z.number().min(0.1).max(500).optional(),
      raceTargetTimeSec: z.number().int().min(60).max(86400).optional(),
      racePriority:      z.enum(['A','B','C']).optional(),
      raceLocation:      z.string().max(255).optional(),
      raceNotes:         z.string().max(1000).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Ungültige Eingabe' });

    const userId = req.user.sub;
    const [goal] = await db.insert(pulseGoals).values({
      userId,
      title:             parsed.data.title,
      description:       parsed.data.description ?? null,
      targetDate:        parsed.data.targetDate  ?? null,
      category:          parsed.data.category    ?? null,
      metrics:           parsed.data.metrics     ?? {},
      raceDiscipline:    parsed.data.raceDiscipline    ?? null,
      raceDistanceKm:    parsed.data.raceDistanceKm    ?? null,
      raceTargetTimeSec: parsed.data.raceTargetTimeSec ?? null,
      racePriority:      parsed.data.racePriority      ?? (parsed.data.category === 'race' ? 'A' : null),
      raceLocation:      parsed.data.raceLocation      ?? null,
      raceNotes:         parsed.data.raceNotes         ?? null,
    }).returning();

    return reply.status(201).send(goal);
  });

  app.patch('/goals/:id', { onRequest: [app.authenticate] }, async (req, reply) => {
    const schema = z.object({
      status:      z.enum(['active', 'completed', 'paused', 'abandoned']).optional(),
      progress:    z.number().min(0).max(1).optional(),
      title:       z.string().min(1).max(255).optional(),
      description: z.string().max(1000).optional().nullable(),
      targetDate:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
      category:    z.string().max(30).optional().nullable(),
      metrics:     z.record(z.unknown()).optional(),
      raceDiscipline:    z.enum(['run','bike','swim','triathlon_sprint','triathlon_olympic','triathlon_70_3','triathlon_140_6','duathlon','other']).optional().nullable(),
      raceDistanceKm:    z.number().min(0.1).max(500).optional().nullable(),
      raceTargetTimeSec: z.number().int().min(60).max(86400).optional().nullable(),
      racePriority:      z.enum(['A','B','C']).optional().nullable(),
      raceLocation:      z.string().max(255).optional().nullable(),
      raceNotes:         z.string().max(1000).optional().nullable(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Ungültige Eingabe' });

    const userId = req.user.sub;
    const { id } = req.params as { id: string };

    const [updated] = await db.update(pulseGoals)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(and(eq(pulseGoals.id, id), eq(pulseGoals.userId, userId)))
      .returning();

    if (!updated) return reply.status(404).send({ error: 'Ziel nicht gefunden' });
    return updated;
  });

  app.delete('/goals/:id', { onRequest: [app.authenticate] }, async (req, reply) => {
    const userId = req.user.sub;
    const { id } = req.params as { id: string };

    const [deleted] = await db.delete(pulseGoals)
      .where(and(eq(pulseGoals.id, id), eq(pulseGoals.userId, userId)))
      .returning({ id: pulseGoals.id });

    if (!deleted) return reply.status(404).send({ error: 'Ziel nicht gefunden' });
    return reply.status(204).send();
  });

  // ─── Race list with prognosis (Phase 7) ───────────────────────────────────────
  app.get('/races', { onRequest: [app.authenticate] }, async (req) => {
    const userId = req.user.sub;
    const today = new Date().toISOString().split('T')[0]!;
    const fitnessLoad = await getFitnessLoadCached(userId, today);
    const races = await getActiveRaces(userId, today, { ctl: fitnessLoad.ctl });
    return { races };
  });

  app.get('/race-command', { onRequest: [app.authenticate] }, async (req): Promise<PulseRaceCommandResponse> => {
    const userId = req.user.sub;
    const today = toIsoDate(new Date());
    const fitnessLoad = await getFitnessLoadCached(userId, today);
    const races = await getActiveRaces(userId, today, { ctl: fitnessLoad.ctl });
    if (races.length === 0) return { command: null };

    const futureTo = toIsoDate(addDateDays(new Date(`${today}T00:00:00.000Z`), 180));
    const [riskSignals, healthStates, plannedWorkouts] = await Promise.all([
      getActiveRiskSignals(userId),
      db.select({
        type: pulseHealthState.type,
        severity: pulseHealthState.severity,
        startDate: pulseHealthState.startDate,
        notes: pulseHealthState.notes,
      }).from(pulseHealthState)
        .where(and(
          eq(pulseHealthState.userId, userId),
          isNull(pulseHealthState.resolvedAt),
          lte(pulseHealthState.startDate, today),
          or(isNull(pulseHealthState.endDate), gte(pulseHealthState.endDate, today)),
        ))
        .orderBy(desc(pulseHealthState.startDate)),
      db.select({
        id: pulsePlannedWorkouts.id,
        plannedDate: pulsePlannedWorkouts.plannedDate,
        activityType: pulsePlannedWorkouts.activityType,
        zone: pulsePlannedWorkouts.zone,
        durationMin: pulsePlannedWorkouts.durationMin,
        targetTss: pulsePlannedWorkouts.targetTss,
        description: pulsePlannedWorkouts.description,
      }).from(pulsePlannedWorkouts)
        .where(and(
          eq(pulsePlannedWorkouts.userId, userId),
          eq(pulsePlannedWorkouts.status, 'planned'),
          gte(pulsePlannedWorkouts.plannedDate, today),
          lte(pulsePlannedWorkouts.plannedDate, futureTo),
        ))
        .orderBy(pulsePlannedWorkouts.plannedDate),
    ]);

    return {
      command: buildRaceCommandSummary({
        today,
        races,
        fitnessLoad: {
          ctl: fitnessLoad.ctl,
          atl: fitnessLoad.atl,
          tsb: fitnessLoad.tsb,
        },
        plannedWorkouts,
        healthStates,
        riskSignals: riskSignals.map(signal => ({
          severity: signal.severity,
          title: signal.title,
          recommendation: signal.recommendation,
        })),
      }),
    };
  });

  app.get('/season-strategy', { onRequest: [app.authenticate] }, async (req): Promise<PulseSeasonStrategyResponse> => {
    const userId = req.user.sub;
    const today = toIsoDate(new Date());
    const weekStart = currentWeekStartIso();
    const fitnessLoad = await getFitnessLoadCached(userId, today);

    const [races, goals, weekAvail, profile, prefsRow] = await Promise.all([
      getActiveRaces(userId, today, { ctl: fitnessLoad.ctl }),
      db.select({
        id: pulseGoals.id,
        title: pulseGoals.title,
        category: pulseGoals.category,
        targetDate: pulseGoals.targetDate,
        racePriority: pulseGoals.racePriority,
      }).from(pulseGoals)
        .where(and(eq(pulseGoals.userId, userId), eq(pulseGoals.status, 'active')))
        .limit(8),
      db.select().from(pulseWeekAvailability)
        .where(and(eq(pulseWeekAvailability.userId, userId), eq(pulseWeekAvailability.weekStart, weekStart)))
        .limit(1),
      db.select().from(pulseUserProfile)
        .where(eq(pulseUserProfile.userId, userId))
        .limit(1),
      db.select().from(pulseCoachPreferences)
        .where(eq(pulseCoachPreferences.userId, userId))
        .limit(1),
    ]);

    const preferences = serializeCoachPreferences(prefsRow[0] ?? null);
    const availability = {
      availableDays: (weekAvail[0]?.availableDays as number[] | null) ?? [0, 2, 4, 5],
      weeklyHours: weekAvail[0]?.weeklyHours ?? profile[0]?.weeklyHoursTarget ?? 8,
    };

    return {
      strategy: buildSeasonStrategy({
        today,
        weekStart,
        races,
        goals: goals.map(goal => ({
          id: goal.id,
          title: goal.title,
          category: goal.category,
          targetDate: goal.targetDate,
          racePriority: normalizeRacePriority(goal.racePriority),
        })),
        fitnessLoad,
        availability,
        coachPreferences: {
          preferredLongDays: preferences.preferredLongDays,
          dislikedWorkoutPatterns: preferences.dislikedWorkoutPatterns,
        },
      }),
    };
  });

  // ─── Nutrition logs (Phase 9) ────────────────────────────────────────────────
  app.get('/nutrition', { onRequest: [app.authenticate] }, async (req) => {
    const userId = req.user.sub;
    const q = req.query as { from?: string; to?: string; workoutId?: string; activityId?: string; days?: string };
    const conds = [eq(pulseNutritionLogs.userId, userId)];

    if (q.workoutId) conds.push(eq(pulseNutritionLogs.workoutId, q.workoutId));
    if (q.activityId) conds.push(eq(pulseNutritionLogs.activityId, q.activityId));
    if (q.from && /^\d{4}-\d{2}-\d{2}$/.test(q.from)) conds.push(gte(pulseNutritionLogs.date, q.from));
    if (q.to   && /^\d{4}-\d{2}-\d{2}$/.test(q.to))   conds.push(lte(pulseNutritionLogs.date, q.to));
    if (!q.from && !q.workoutId && !q.activityId) {
      const days = Math.min(Math.max(parseInt(q.days ?? '14', 10), 1), 365);
      const since = new Date(Date.now() - days * 86_400_000).toISOString().split('T')[0]!;
      conds.push(gte(pulseNutritionLogs.date, since));
    }

    const logs = await db.select().from(pulseNutritionLogs)
      .where(and(...conds))
      .orderBy(desc(pulseNutritionLogs.date), desc(pulseNutritionLogs.createdAt));
    return { logs };
  });

  app.post('/nutrition', { onRequest: [app.authenticate] }, async (req, reply) => {
    const schema = z.object({
      date:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      context:     z.enum(['pre','during','post','daily']).optional(),
      workoutId:   z.string().uuid().optional(),
      activityId:  z.string().uuid().optional(),
      mealType:    z.string().max(30).optional(),
      description: z.string().max(500).optional(),
      calories:    z.number().int().min(0).max(20000).optional(),
      proteinG:    z.number().min(0).max(2000).optional(),
      carbsG:      z.number().min(0).max(2000).optional(),
      fatG:        z.number().min(0).max(1000).optional(),
      gelsCount:   z.number().int().min(0).max(50).optional(),
      drinksMl:    z.number().int().min(0).max(20000).optional(),
      sodiumMg:    z.number().int().min(0).max(50000).optional(),
      notes:       z.string().max(1000).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Ungültige Eingabe' });

    const userId = req.user.sub;
    const date = parsed.data.date ?? new Date().toISOString().split('T')[0]!;

    // Auto-derive carbs from gels if explicit carbs not provided (1 gel ≈ 25g)
    let carbsG = parsed.data.carbsG;
    if (carbsG == null && parsed.data.gelsCount != null && parsed.data.gelsCount > 0) {
      carbsG = parsed.data.gelsCount * 25;
    }

    const [log] = await db.insert(pulseNutritionLogs).values({
      userId, date,
      context:     parsed.data.context     ?? null,
      workoutId:   parsed.data.workoutId   ?? null,
      activityId:  parsed.data.activityId  ?? null,
      mealType:    parsed.data.mealType    ?? null,
      description: parsed.data.description ?? null,
      calories:    parsed.data.calories    ?? null,
      proteinG:    parsed.data.proteinG    ?? null,
      carbsG:      carbsG                  ?? null,
      fatG:        parsed.data.fatG        ?? null,
      gelsCount:   parsed.data.gelsCount   ?? null,
      drinksMl:    parsed.data.drinksMl    ?? null,
      sodiumMg:    parsed.data.sodiumMg    ?? null,
      notes:       parsed.data.notes       ?? null,
    }).returning();

    return reply.status(201).send(log);
  });

  app.delete('/nutrition/:id', { onRequest: [app.authenticate] }, async (req, reply) => {
    const userId = req.user.sub;
    const { id } = req.params as { id: string };
    const [deleted] = await db.delete(pulseNutritionLogs)
      .where(and(eq(pulseNutritionLogs.id, id), eq(pulseNutritionLogs.userId, userId)))
      .returning({ id: pulseNutritionLogs.id });
    if (!deleted) return reply.status(404).send({ error: 'Nicht gefunden' });
    return reply.status(204).send();
  });

  // ─── Today-Adjust (Phase 6 Task 4) ────────────────────────────────────────────
  app.get('/plan/today/proposal', { onRequest: [app.authenticate] }, async (req) => {
    const userId = req.user.sub;
    const today = new Date().toISOString().split('T')[0]!;
    const proposal = await proposeTodayAdjustment(userId, today);
    return { proposal };
  });

  app.post('/plan/today/accept', { onRequest: [app.authenticate] }, async (req, reply) => {
    const schema = z.object({ workoutId: z.string().uuid() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Ungültige Eingabe' });

    const userId = req.user.sub;
    const today = new Date().toISOString().split('T')[0]!;
    const proposal = await proposeTodayAdjustment(userId, today);
    if (!proposal || proposal.workoutId !== parsed.data.workoutId) {
      return reply.status(409).send({ error: 'Vorschlag nicht mehr aktuell' });
    }

    // Atomic: capture original_zone/original_duration_min from current row, then overwrite.
    const result = await db.execute(sql`
      UPDATE pulse_planned_workouts
      SET
        original_zone         = COALESCE(original_zone, zone),
        original_duration_min = COALESCE(original_duration_min, duration_min),
        zone                  = ${proposal.proposed.zone},
        duration_min          = ${proposal.proposed.durationMin},
        activity_type         = ${proposal.proposed.activityType}::pulse_activity_type,
        description           = ${proposal.proposed.description},
        adjusted_reason       = ${proposal.reason},
        adjusted_at           = NOW(),
        steps                 = NULL
      WHERE id = ${parsed.data.workoutId} AND user_id = ${userId}
      RETURNING id, planned_date, activity_type, zone, duration_min, description,
                adjusted_reason, original_zone, original_duration_min;
    `);
    const rows = (result as unknown as { rows: Array<Record<string, unknown>> }).rows;
    if (!rows[0]) return reply.status(404).send({ error: 'Workout nicht gefunden' });

    return { ok: true, workout: rows[0], proposal };
  });

  // ─── Week availability ────────────────────────────────────────────────────────
  app.get('/plan/availability', { onRequest: [app.authenticate] }, async (req) => {
    const userId = req.user.sub;
    const now = new Date();
    const mondayOffset = now.getDay() === 0 ? -6 : 1 - now.getDay();
    const thisMonday = new Date(now);
    thisMonday.setDate(now.getDate() + mondayOffset);
    const nextMonday = new Date(thisMonday);
    nextMonday.setDate(thisMonday.getDate() + 7);

    const weeks = [
      thisMonday.toISOString().split('T')[0]!,
      nextMonday.toISOString().split('T')[0]!,
    ];

    const rows = await db.select()
      .from(pulseWeekAvailability)
      .where(and(
        eq(pulseWeekAvailability.userId, userId),
        gte(pulseWeekAvailability.weekStart, weeks[0]!),
      ))
      .limit(4);

    const [profile] = await db.select({ weeklyHours: pulseUserProfile.weeklyHoursTarget })
      .from(pulseUserProfile).where(eq(pulseUserProfile.userId, userId));

    const defaults = { availableDays: [0, 2, 4, 5], weeklyHours: profile?.weeklyHours ?? 8 };

    return {
      weeks: weeks.map(w => {
        const row = rows.find(r => r.weekStart === w);
        return {
          weekStart: w,
          availableDays: (row?.availableDays as number[]) ?? defaults.availableDays,
          weeklyHours: row?.weeklyHours ?? defaults.weeklyHours,
          notes: row?.notes ?? null,
          isCustom: !!row,
        };
      }),
    };
  });

  app.put('/plan/availability/:weekStart', { onRequest: [app.authenticate] }, async (req, reply) => {
    const userId = req.user.sub;
    const { weekStart } = req.params as { weekStart: string };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) return reply.status(400).send({ error: 'Ungültiges Datum' });

    const schema = z.object({
      availableDays: z.array(z.number().min(0).max(6)).min(1).max(7),
      weeklyHours:   z.number().min(1).max(40),
      notes:         z.string().max(200).optional(),
      regenerate:    z.boolean().optional().default(true),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Ungültige Eingabe' });

    await db.insert(pulseWeekAvailability).values({
      userId, weekStart,
      availableDays: parsed.data.availableDays,
      weeklyHours:   parsed.data.weeklyHours,
      notes:         parsed.data.notes ?? null,
    }).onConflictDoUpdate({
      target: [pulseWeekAvailability.userId, pulseWeekAvailability.weekStart],
      set: {
        availableDays: parsed.data.availableDays,
        weeklyHours:   parsed.data.weeklyHours,
        notes:         parsed.data.notes ?? null,
      },
    });

    if (!parsed.data.regenerate) return { ok: true };

    // Auto-regenerate plan for this week
    const [profile] = await db.select().from(pulseUserProfile).where(eq(pulseUserProfile.userId, userId));
    const profileProvenance2 = profileWithProvenance(profile ?? null, userId).provenance;
    const explicitPhase = profile?.trainingPhase as 'base' | 'build' | 'peak' | 'taper' | null | undefined;
    const derivedPhase = await deriveCurrentPhase(userId, weekStart);
    const phase: 'base' | 'build' | 'peak' | 'taper' =
      (explicitPhase && explicitPhase !== 'base') ? explicitPhase : derivedPhase;
    const since42d = new Date(Date.now() - 42 * 86_400_000);
    const today = new Date().toISOString().split('T')[0]!;
    const previousWeekStart2 = shiftIsoDate(weekStart, -7);
    const [fitnessLoad, recentActs2, goals2, recentFeedback2, activeHealthStates2, riskSignalRows2, planLearning2, previousWorkoutRows2] = await Promise.all([
      computeFitnessLoad(userId, weekStart),
      db.select({
        id:            pulseActivities.id,
        startTime:    pulseActivities.startTime,
        activityType: pulseActivities.activityType,
        durationSec:  pulseActivities.durationSec,
        tss:          pulseActivities.tss,
        rpe:          pulseActivities.rpe,
        sorenessAreas: pulseActivities.sorenessAreas,
      }).from(pulseActivities)
        .where(and(eq(pulseActivities.userId, userId), gte(pulseActivities.startTime, since42d)))
        .orderBy(desc(pulseActivities.startTime)).limit(80),
      db.select({
        title:          pulseGoals.title,
        targetDate:     pulseGoals.targetDate,
        category:       pulseGoals.category,
        metrics:        pulseGoals.metrics,
        raceDiscipline: pulseGoals.raceDiscipline,
        raceDistanceKm: pulseGoals.raceDistanceKm,
        racePriority:   pulseGoals.racePriority,
      })
        .from(pulseGoals)
        .where(and(eq(pulseGoals.userId, userId), eq(pulseGoals.status, 'active')))
        .limit(5),
      db.select({
        plannedDate:     pulsePlannedWorkouts.plannedDate,
        activityType:    pulsePlannedWorkouts.activityType,
        zone:            pulsePlannedWorkouts.zone,
        durationMin:     pulsePlannedWorkouts.durationMin,
        workoutFeedback: pulsePlannedWorkouts.workoutFeedback,
        complianceScore: pulsePlannedWorkouts.complianceScore,
      }).from(pulsePlannedWorkouts)
        .where(and(
          eq(pulsePlannedWorkouts.userId, userId),
          eq(pulsePlannedWorkouts.status, 'completed'),
          gte(pulsePlannedWorkouts.plannedDate, since42d.toISOString().split('T')[0]!),
        ))
        .orderBy(desc(pulsePlannedWorkouts.plannedDate))
        .limit(10),
      db.select().from(pulseHealthState)
        .where(and(
          eq(pulseHealthState.userId, userId),
          isNull(pulseHealthState.resolvedAt),
          or(isNull(pulseHealthState.endDate), gte(pulseHealthState.endDate, today)),
        )),
      getActiveRiskSignals(userId),
      buildPlanLearningSnapshot(userId, weekStart),
      db.select({
        id: pulsePlannedWorkouts.id,
        plannedDate: pulsePlannedWorkouts.plannedDate,
        activityType: pulsePlannedWorkouts.activityType,
        zone: pulsePlannedWorkouts.zone,
        durationMin: pulsePlannedWorkouts.durationMin,
        status: pulsePlannedWorkouts.status,
        completedActivityId: pulsePlannedWorkouts.completedActivityId,
        complianceScore: pulsePlannedWorkouts.complianceScore,
      }).from(pulsePlannedWorkouts)
        .where(and(
          eq(pulsePlannedWorkouts.userId, userId),
          gte(pulsePlannedWorkouts.plannedDate, previousWeekStart2),
          lt(pulsePlannedWorkouts.plannedDate, weekStart),
          inArray(pulsePlannedWorkouts.status, ['planned', 'completed', 'skipped']),
        )),
    ]);
    const activeRaces2 = await getActiveRaces(userId, weekStart, { ctl: fitnessLoad.ctl });
    const [coachPrefsRow2] = await db.select().from(pulseCoachPreferences).where(eq(pulseCoachPreferences.userId, userId)).limit(1);
    const plannedZoneByActivityId2 = await getPlannedZoneByActivityId(userId, recentActs2.map(a => a.id));
    const recentPlanActivities2 = recentActs2.map(a => ({
      date:         a.startTime.toISOString().split('T')[0]!,
      activityType: a.activityType,
      durationMin:  Math.round((a.durationSec ?? 0) / 60),
      tss:          a.tss ?? 0,
      rpe:          a.rpe,
      plannedZone:  plannedZoneByActivityId2.get(a.id) ?? null,
    }));
    const planGoals2 = goals2.map(g => ({
      ...g,
      metrics: (g.metrics as Record<string, unknown> | null) ?? null,
      racePriority: normalizeRacePriority(g.racePriority),
    }));
    const riskSignals2 = riskSignalRows2.map(r => ({
      ruleId: r.ruleId,
      severity: r.severity as 'info' | 'warn' | 'critical',
      title: r.title,
      recommendation: r.recommendation,
    }));
    const coachPreferences2 = serializeCoachPreferences(coachPrefsRow2 ?? null);
    const seasonStrategy2 = buildSeasonStrategy({
      today,
      weekStart,
      races: activeRaces2,
      goals: planGoals2.map(goal => ({
        id: null,
        title: goal.title,
        category: goal.category,
        targetDate: goal.targetDate,
        racePriority: goal.racePriority,
      })),
      fitnessLoad,
      availability: { availableDays: parsed.data.availableDays, weeklyHours: parsed.data.weeklyHours },
      coachPreferences: {
        preferredLongDays: coachPreferences2.preferredLongDays,
        dislikedWorkoutPatterns: coachPreferences2.dislikedWorkoutPatterns,
      },
    });
    const executionReview2 = buildExecutionReviewForPreviousWeek({
      currentWeekStart: weekStart,
      previousWorkouts: previousWorkoutRows2,
      activities: recentActs2,
      availableDays: deriveExecutionReviewAvailability({
        weekStart: previousWeekStart2,
        plannedWorkouts: previousWorkoutRows2,
        skippedAvailableDays: planLearning2.previousWeek?.skippedAvailableDays ?? [],
      }),
      recovery: recoveryFromFitnessLoad(fitnessLoad),
      today,
    });
    const planLearningWithExecution2 = executionReview2
      ? { ...planLearning2, executionReview: executionReview2 }
      : planLearning2;
    const mesocycleWeek2 = getMesocycleWeek(weekStart);
    const planDecision2 = decidePlanDays({
      availableDays: parsed.data.availableDays,
      weeklyHoursTarget: parsed.data.weeklyHours,
      tsb: fitnessLoad.tsb,
      phase,
      mesocycleWeek: mesocycleWeek2,
      goals: planGoals2,
      riskSignals: riskSignals2,
      recentActivities: recentPlanActivities2,
      planLearning: planLearningWithExecution2,
      executionReview: executionReview2,
      seasonStrategy: seasonStrategy2,
    });

    let generated: Awaited<ReturnType<typeof generateWeekWorkouts>>;
    try {
      generated = await generateScientificWeekPlan({
        weekStart, phase,
        weeklyHoursTarget: parsed.data.weeklyHours,
        availableDays:     parsed.data.availableDays,
        ctl: fitnessLoad.ctl, atl: fitnessLoad.atl, tsb: fitnessLoad.tsb,
        ftpWatts:  profile?.ftpWatts ?? 250,
        maxHrBpm:  profile?.maxHrBpm ?? 185,
        lthrBpm:   profile?.lthrBpm ?? undefined,
        recentActivities: recentPlanActivities2,
        goals: planGoals2,
        riskSignals: riskSignals2,
        planLearning: planLearningWithExecution2,
        executionReview: executionReview2,
        seasonStrategy: seasonStrategy2,
        recentFeedback: recentFeedback2
          .filter(w => w.workoutFeedback != null)
          .map(w => ({
            date:               w.plannedDate,
            activityType:       w.activityType,
            plannedZone:        w.zone,
            plannedDurationMin: w.durationMin,
            feedback:           w.workoutFeedback!,
            complianceScore:    w.complianceScore ?? 0.7,
          })),
        healthStates: activeHealthStates2.map(s => ({
          type:      s.type as 'illness' | 'injury' | 'fatigue' | 'travel',
          severity:  s.severity as 'mild' | 'moderate' | 'severe',
          bodyPart:  s.bodyPart,
          startDate: s.startDate,
          endDate:   s.endDate,
          notes:     s.notes,
        })),
        races: activeRaces2.map(r => ({
          title:      r.title,
          date:       r.date,
          daysUntil:  r.daysUntil,
          priority:   r.priority,
          discipline: r.discipline,
          distanceKm: r.distanceKm,
        })),
      });
    } catch {
      generated = generateWeekWorkouts({
        weekStart,
        phase,
        weeklyHoursTarget: parsed.data.weeklyHours,
        availableDays: planDecision2.selectedDays,
      });
    }
    const replacementCutoff2 = determinePlanReplacementCutoff(weekStart, today);
    const generatedForInsert2 = generated.filter(w => w.plannedDate >= replacementCutoff2);
    const preservedWorkoutRows2 = replacementCutoff2 > weekStart
      ? await db.select().from(pulsePlannedWorkouts).where(and(
          eq(pulsePlannedWorkouts.userId, userId),
          gte(pulsePlannedWorkouts.plannedDate, weekStart),
          lt(pulsePlannedWorkouts.plannedDate, replacementCutoff2),
        ))
      : [];

    // Clean up old Garmin workouts before deleting (prevents duplicates)
    const oldAvailWorkouts = await db.select({
      garminWorkoutId:   pulsePlannedWorkouts.garminWorkoutId,
      garminScheduledId: pulsePlannedWorkouts.garminScheduledId,
    }).from(pulsePlannedWorkouts).where(and(
      eq(pulsePlannedWorkouts.userId, userId),
      gte(pulsePlannedWorkouts.plannedDate, replacementCutoff2),
      eq(pulsePlannedWorkouts.status, 'planned'),
    ));
    const oldAvailWithGarmin = oldAvailWorkouts.filter(w => w.garminWorkoutId);
    if (oldAvailWithGarmin.length > 0) {
      try {
        const { getGarminClient } = await import('../lib/garmin-client.js');
        const gc = await getGarminClient();
        await Promise.allSettled(oldAvailWithGarmin.map(async (w) => {
          if (w.garminScheduledId) {
            await garminApi.deleteWorkoutSchedule(gc, w.garminScheduledId);
          }
          await garminApi.deleteWorkout(gc, w.garminWorkoutId!);
        }));
      } catch { /* non-fatal */ }
    }

    await db.delete(pulsePlannedWorkouts).where(and(
      eq(pulsePlannedWorkouts.userId, userId),
      gte(pulsePlannedWorkouts.plannedDate, replacementCutoff2),
      eq(pulsePlannedWorkouts.status, 'planned'),
    ));

    const inserted2 = generatedForInsert2.length > 0
      ? await db.insert(pulsePlannedWorkouts).values(
          generatedForInsert2.map(w => ({
            userId,
            plannedDate: w.plannedDate,
            activityType: w.activityType,
            zone: w.zone,
            durationMin: w.durationMin,
            targetTss: w.targetTss,
            description: w.description,
            adjustedReason: w.adjustedReason ?? null,
            adjustedAt: w.adjustedReason ? new Date() : null,
          })),
        ).returning()
      : [];

    const workouts = await Promise.all(
      inserted2.map(async (w) => {
        try {
          const { steps, updatedDescription } = await buildWorkoutSteps(w, profile ?? undefined);
          await db.update(pulsePlannedWorkouts)
            .set({ steps, description: updatedDescription })
            .where(eq(pulsePlannedWorkouts.id, w.id));
          return { ...w, steps, description: updatedDescription };
        } catch {
          return w;
        }
      }),
    );

    const traceWorkouts2 = mergeRegeneratedWorkoutsForTrace(preservedWorkoutRows2, workouts);
    const finalPlanDecision2 = reconcilePlanDecisionWithWorkouts({
      decision: planDecision2,
      weekStart,
      availableDays: parsed.data.availableDays,
      workouts: traceWorkouts2,
    });
    const planTracePayload = buildPlanTrace({
      weekStart,
      phase,
      mesocycleWeek: mesocycleWeek2,
      weeklyHoursTarget: parsed.data.weeklyHours,
      availableDays: parsed.data.availableDays,
      load: fitnessLoad,
      profile: {
        ftpWatts: profile?.ftpWatts ?? null,
        maxHrBpm: profile?.maxHrBpm ?? null,
        lthrBpm: profile?.lthrBpm ?? null,
        provenance: profileProvenance2,
      },
      goals: planGoals2,
      riskSignals: riskSignals2,
      planLearning: planLearningWithExecution2,
      executionReview: executionReview2,
      healthStates: activeHealthStates2.map(s => ({
        type:      s.type,
        severity:  s.severity,
        bodyPart:  s.bodyPart,
        startDate: s.startDate,
        endDate:   s.endDate,
      })),
      recentActivities: recentPlanActivities2,
      planDecision: finalPlanDecision2,
      workouts: traceWorkouts2,
      seasonStrategy: seasonStrategy2,
    });
    const planTrace = await persistPlanTrace(app, {
      userId,
      weekStart,
      ...planTracePayload,
    });
    await invalidateUser(userId);

    return {
      ok: true,
      workouts: [...preservedWorkoutRows2, ...workouts].sort((a, b) => a.plannedDate.localeCompare(b.plannedDate)),
      planDecision: finalPlanDecision2,
      planTrace,
    };
  });

  // ─── Weekly review ────────────────────────────────────────────────────────────
  app.get('/review/latest', { onRequest: [app.authenticate] }, async (req) => {
    const userId = req.user.sub;
    const [review] = await db.select()
      .from(pulseWeeklyReviews)
      .where(eq(pulseWeeklyReviews.userId, userId))
      .orderBy(desc(pulseWeeklyReviews.weekStart))
      .limit(1);
    return review ?? null;
  });

  app.post('/review/generate', { onRequest: [app.authenticate] }, async (req) => {
    const userId = req.user.sub;
    const now = new Date();
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const lastMonday = new Date(now);
    lastMonday.setDate(now.getDate() + mondayOffset - 7);
    const weekStartStr = lastMonday.toISOString().split('T')[0]!;
    return generateWeeklyReview(userId, weekStartStr);
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

  // GET /api/pulse/training-analytics?weeks=12
  app.get('/training-analytics', { onRequest: [app.authenticate] }, async (req) => {
    const userId = req.user.sub;
    const q = req.query as { weeks?: string };
    const weeks = Math.min(24, Math.max(4, parseInt(q.weeks ?? '12', 10)));
    const since = new Date(Date.now() - weeks * 7 * 86_400_000);
    const today = new Date().toISOString().split('T')[0]!;

    const [activities, profileRows] = await Promise.all([
      db.select({
        id:               pulseActivities.id,
        startTime:        pulseActivities.startTime,
        activityType:     pulseActivities.activityType,
        durationSec:      pulseActivities.durationSec,
        tss:              pulseActivities.tss,
        normalizedPowerW: pulseActivities.normalizedPowerW,
        vo2maxEstimate:   pulseActivities.vo2maxEstimate,
        rpe:              pulseActivities.rpe,
      }).from(pulseActivities)
        .where(and(eq(pulseActivities.userId, userId), gte(pulseActivities.startTime, since)))
        .orderBy(pulseActivities.startTime),
      db.select({ ftpWatts: pulseUserProfile.ftpWatts })
        .from(pulseUserProfile).where(eq(pulseUserProfile.userId, userId)).limit(1),
    ]);

    const ftp = profileRows[0]?.ftpWatts ?? null;
    const ratedActivityIds = activities.filter(a => a.rpe != null).map(a => a.id);
    const completedPlans = ratedActivityIds.length > 0
      ? await db.select({
          completedActivityId: pulsePlannedWorkouts.completedActivityId,
          zone: pulsePlannedWorkouts.zone,
        }).from(pulsePlannedWorkouts)
          .where(and(
            eq(pulsePlannedWorkouts.userId, userId),
            inArray(pulsePlannedWorkouts.completedActivityId, ratedActivityIds),
          ))
      : [];
    const plannedZoneByActivityId = new Map(completedPlans.map(p => [p.completedActivityId, p.zone]));

    // ── TSS Heatmap: one entry per day ────────────────────────────────────────
    const tssByDate = new Map<string, number>();
    for (const a of activities) {
      const d = a.startTime.toISOString().split('T')[0]!;
      tssByDate.set(d, (tssByDate.get(d) ?? 0) + (a.tss ?? 0));
    }

    const tssHeatmap: Array<{ date: string; tss: number }> = [];
    const cur = new Date(since);
    while (cur.toISOString().split('T')[0]! <= today) {
      const ds = cur.toISOString().split('T')[0]!;
      tssHeatmap.push({ date: ds, tss: Math.round(tssByDate.get(ds) ?? 0) });
      cur.setDate(cur.getDate() + 1);
    }

    // ── Zone distribution per ISO week ────────────────────────────────────────
    function getZone(a: typeof activities[0]): number | null {
      const plannedZone = plannedZoneByActivityId.get(a.id);
      if (plannedZone != null) return plannedZone;
      if (ftp && a.normalizedPowerW && a.activityType === 'bike') {
        const IF = a.normalizedPowerW / ftp;
        if (IF < 0.55) return 1;
        if (IF < 0.75) return 2;
        if (IF < 0.87) return 3;
        if (IF < 0.95) return 4;
        return 5;
      }
      if (a.tss && a.durationSec && a.durationSec > 0) {
        const tssH = (a.tss / a.durationSec) * 3600;
        if (tssH < 45)  return 1;
        if (tssH < 65)  return 2;
        if (tssH < 85)  return 3;
        if (tssH < 100) return 4;
        return 5;
      }
      return null;
    }

    function weekStart(d: Date): string {
      const day = d.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      const mon = new Date(d);
      mon.setDate(d.getDate() + diff);
      return mon.toISOString().split('T')[0]!;
    }

    type ZoneMap = { z1: number; z2: number; z3: number; z4: number; z5: number };
    const zByWeek = new Map<string, ZoneMap>();
    for (const a of activities) {
      const zone = getZone(a);
      if (!zone || !a.durationSec) continue;
      const ws = weekStart(a.startTime);
      const entry = zByWeek.get(ws) ?? { z1: 0, z2: 0, z3: 0, z4: 0, z5: 0 };
      entry[`z${zone}` as keyof ZoneMap] += a.durationSec / 3600;
      zByWeek.set(ws, entry);
    }

    const zoneDistribution = [...zByWeek.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([ws, z]) => ({
        weekStart: ws,
        zones: {
          z1: Math.round(z.z1 * 10) / 10, z2: Math.round(z.z2 * 10) / 10,
          z3: Math.round(z.z3 * 10) / 10, z4: Math.round(z.z4 * 10) / 10,
          z5: Math.round(z.z5 * 10) / 10,
        },
        totalH: Math.round((z.z1 + z.z2 + z.z3 + z.z4 + z.z5) * 10) / 10,
      }));

    // ── VO2max trend ──────────────────────────────────────────────────────────
    const vo2maxTrend = activities
      .filter(a => a.vo2maxEstimate != null)
      .map(a => ({ date: a.startTime.toISOString().split('T')[0]!, vo2max: a.vo2maxEstimate! }));

    const recentRpe = new Map<number, { sum: number; count: number }>();
    const previousRpe = new Map<number, { sum: number; count: number }>();
    const now = new Date();
    const recentCutoff = new Date(now.getTime() - 30 * 86_400_000);
    const previousCutoff = new Date(now.getTime() - 60 * 86_400_000);
    for (const a of activities) {
      if (a.rpe == null) continue;
      const zone = getZone(a);
      if (!zone) continue;
      const bucket = a.startTime >= recentCutoff
        ? recentRpe
        : a.startTime >= previousCutoff
        ? previousRpe
        : null;
      if (!bucket) continue;
      const entry = bucket.get(zone) ?? { sum: 0, count: 0 };
      entry.sum += a.rpe;
      entry.count += 1;
      bucket.set(zone, entry);
    }
    const rpeByZone = [1, 2, 3, 4, 5].map(zone => {
      const recent = recentRpe.get(zone);
      const previous = previousRpe.get(zone);
      const avgRpe = recent && recent.count > 0 ? Math.round((recent.sum / recent.count) * 10) / 10 : null;
      const previousAvgRpe = previous && previous.count > 0 ? Math.round((previous.sum / previous.count) * 10) / 10 : null;
      const drift = avgRpe != null && previousAvgRpe != null ? Math.round((avgRpe - previousAvgRpe) * 10) / 10 : null;
      return { zone, avgRpe, count: recent?.count ?? 0, previousAvgRpe, drift };
    });
    const totalRated = [...recentRpe.values()].reduce((sum, z) => sum + z.count, 0);

    return { weeks, tssHeatmap, zoneDistribution, vo2maxTrend, rpeByZone: { totalRated, zones: rpeByZone } };
  });
}
