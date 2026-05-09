import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { and, desc, eq, gte, inArray, isNull, lt, lte, or, sql } from 'drizzle-orm';
import type { PulseFuelingRecoveryGuidanceResponse, PulseRaceCommandResponse, PulseSeasonStrategyResponse } from '@coaching-os/shared/pulse';
import { db } from '../../lib/db.js';
import { garminApi, getGarminClient } from '../../lib/garmin-client.js';
import {
  pulseActivities,
  pulseCoachPreferences,
  pulseGoals,
  pulseHealthState,
  pulseNutritionLogs,
  pulsePlanGenerations,
  pulsePlannedWorkouts,
  pulseUserProfile,
  pulseWeeklyReviews,
  pulseWeekAvailability,
} from '../../db/pulse-schema.js';
import { invalidateUser } from '../lib/pulse-cache.js';
import { proposeTodayAdjustment, deriveCurrentPhase } from '../services/adapt-engine.js';
import { computeFitnessLoad } from '../services/load-engine.js';
import { buildPlanLearningSnapshot } from '../services/plan-learning.js';
import { buildPlanTrace } from '../services/plan-trace.js';
import {
  decidePlanDays,
  generateScientificWeekPlan,
  generateWeekWorkouts,
  getMesocycleWeek,
  tssFromWorkout,
} from '../services/plan-engine.js';
import {
  deriveExecutionReviewAvailability,
  determinePlanReplacementCutoff,
  mergeRegeneratedWorkoutsForTrace,
  recoveryFromFitnessLoad,
} from '../services/plan-regeneration.js';
import {
  buildExecutionReviewForPreviousWeek,
  getPlannedZoneByActivityId,
  mapPlanTrace,
  currentWeekStartIso,
  normalizeRacePriority,
  persistPlanTrace,
  reconcilePlanDecisionWithWorkouts,
  shiftIsoDate,
} from '../services/plan-route-helpers.js';
import { buildSeasonStrategy } from '../services/season-strategy.js';
import { buildRaceCommandSummary } from '../services/race-command.js';
import { serializeCoachPreferences } from '../services/coach.js';
import { buildWorkoutSteps } from '../services/workout-steps.js';
import { buildGarminWorkoutJson } from '../services/garmin-workout.js';
import { deriveWorkoutExecutionState, scoreActivityWorkoutMatch } from '../services/workout-reconciliation.js';
import { getActiveRiskSignals } from '../services/risk-engine.js';
import { getActiveRaces } from '../services/race-engine.js';
import { getFitnessLoadCached } from '../services/daily-loop.js';
import { profileWithProvenance } from '../services/profile-sync.js';
import { fetchGarminCalendarWorkouts } from '../services/garmin-calendar-workouts.js';
import { generateWeeklyReview } from '../services/review-engine.js';
import { buildFuelingRecoveryGuidanceForPlannedWorkout } from '../services/fueling-recovery-planned-workout.js';
import {
  assignEquipmentToActivity,
  createEquipment,
  createStrengthSession,
  deleteStrengthSession,
  EQUIPMENT_CATEGORIES,
  getStrengthSession,
  listEquipment,
  listStrengthSessions,
  retireEquipment,
  setEquipmentDefault,
  updateEquipment,
  updateStrengthSession,
} from '../services/strength-equipment.js';

const pulseActivityTypeSchema = z.enum(['run', 'bike', 'swim', 'strength', 'hike', 'other']);

const strengthSetSchema = z.object({
  exercise: z.string().trim().min(1).max(80),
  setNumber: z.number().int().min(1).max(20).optional(),
  reps: z.number().int().min(1).max(200),
  weightKg: z.number().min(0).max(1000).nullable().optional(),
  rpe: z.number().int().min(1).max(10).nullable().optional(),
});

const strengthSessionCreateSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  plannedWorkoutId: z.string().uuid().nullable().optional(),
  durationMin: z.number().int().min(1).max(360).nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
  sets: z.array(strengthSetSchema).min(1).max(80),
});

const strengthSessionPatchSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  plannedWorkoutId: z.string().uuid().nullable().optional(),
  durationMin: z.number().int().min(1).max(360).nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
  sets: z.array(strengthSetSchema).max(80).optional(),
}).strict().refine(value => Object.keys(value).length > 0, { message: 'Mindestens ein Feld erforderlich' });

const equipmentCategorySchema = z.enum(EQUIPMENT_CATEGORIES as [typeof EQUIPMENT_CATEGORIES[number], ...typeof EQUIPMENT_CATEGORIES[number][]]);

const equipmentCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  category: equipmentCategorySchema,
  parentEquipmentId: z.string().uuid().nullable().optional(),
  activityTypes: z.array(pulseActivityTypeSchema).min(1).max(6),
  installedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  initialKm: z.number().min(0).max(200_000).nullable().optional(),
  retirementKm: z.number().min(0).max(200_000).nullable().optional(),
  retirementDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
});

const equipmentPatchSchema = equipmentCreateSchema.partial().strict()
  .refine(value => Object.keys(value).length > 0, { message: 'Mindestens ein Feld erforderlich' });

const equipmentAssignSchema = z.object({
  equipmentIds: z.array(z.string().uuid()).max(20),
});

const equipmentDefaultSchema = z.object({
  equipmentId: z.string().uuid(),
});

const isoDateSchema = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(value + 'T00:00:00Z');
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, { message: 'Ungültiges Datum' });

function addDateDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function toIsoDate(date: Date): string {
  return date.toISOString().split('T')[0]!;
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

type PlannedWorkoutRow = typeof pulsePlannedWorkouts.$inferSelect;
type GarminClient = Awaited<ReturnType<typeof getGarminClient>>;

function extractGarminScheduledId(scheduled: unknown): string | null {
  if (!scheduled || typeof scheduled !== 'object') return null;
  const row = scheduled as { workoutScheduleId?: unknown; scheduledWorkoutId?: unknown; id?: unknown };
  const id = row.workoutScheduleId ?? row.scheduledWorkoutId ?? row.id;
  return id != null ? String(id) : null;
}

function hasGarminRemote(workout: Pick<PlannedWorkoutRow, 'garminWorkoutId' | 'garminScheduledId'>): boolean {
  return Boolean(workout.garminWorkoutId || workout.garminScheduledId);
}

async function removeGarminRemoteForWorkout(
  app: FastifyInstance,
  gc: GarminClient,
  workout: Pick<PlannedWorkoutRow, 'id' | 'garminWorkoutId' | 'garminScheduledId'>,
  context: string,
): Promise<void> {
  if (workout.garminScheduledId) {
    await garminApi.deleteWorkoutSchedule(gc, workout.garminScheduledId).catch((err: unknown) => {
      app.log.warn(`[${context}] Failed to remove Garmin schedule ${workout.garminScheduledId} for ${workout.id}: ${err}`);
    });
  }
  if (workout.garminWorkoutId) {
    await garminApi.deleteWorkout(gc, workout.garminWorkoutId).catch((err: unknown) => {
      app.log.warn(`[${context}] Failed to remove Garmin workout ${workout.garminWorkoutId} for ${workout.id}: ${err}`);
    });
  }
}

async function uploadWorkoutToGarmin(
  app: FastifyInstance,
  userId: string,
  workout: PlannedWorkoutRow,
  gc: GarminClient,
  context: string,
): Promise<PlannedWorkoutRow> {
  const fuelingGuidance = await buildFuelingRecoveryGuidanceForPlannedWorkout(userId, workout).catch((err: unknown) => {
    app.log.warn(`[${context}] Fueling guidance failed for ${workout.id}: ${err}`);
    return null;
  });
  const garminWorkout = buildGarminWorkoutJson(workout, { fuelingGuidance });
  const created = await gc.addWorkout(garminWorkout) as { workoutId: number };
  const garminWorkoutId = String(created.workoutId);
  const scheduled = await garminApi.scheduleWorkout(gc, garminWorkoutId, workout.plannedDate) as unknown;
  const garminScheduledId = extractGarminScheduledId(scheduled);
  const executionStatus = garminScheduledId ? 'garmin_scheduled' : 'garmin_template';
  const executionNotes = garminScheduledId
    ? 'Workout ist auf Garmin im Kalender geplant.'
    : 'Workout-Vorlage ist auf Garmin, aber kein Kalendertermin ist bekannt.';

  const [updated] = await db.update(pulsePlannedWorkouts)
    .set({ garminWorkoutId, garminScheduledId, executionStatus, executionNotes })
    .where(eq(pulsePlannedWorkouts.id, workout.id))
    .returning();

  return updated ?? { ...workout, garminWorkoutId, garminScheduledId, executionStatus, executionNotes };
}

async function replaceGarminRemoteForWorkout(
  app: FastifyInstance,
  userId: string,
  previousWorkout: PlannedWorkoutRow,
  workout: PlannedWorkoutRow,
  context: string,
): Promise<PlannedWorkoutRow> {
  const gc = await getGarminClient();
  if (hasGarminRemote(previousWorkout)) {
    await removeGarminRemoteForWorkout(app, gc, previousWorkout, context);
  }
  return uploadWorkoutToGarmin(app, userId, workout, gc, context);
}

export async function registerPulseTrainingRoutes(app: FastifyInstance) {
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
    const [current] = await db.select().from(pulsePlannedWorkouts)
      .where(and(eq(pulsePlannedWorkouts.id, id), eq(pulsePlannedWorkouts.userId, userId)));
    if (!current) return reply.status(404).send({ error: 'Not found' });

    const activityTypeChanged = parsed.data.activityType !== undefined && parsed.data.activityType !== current.activityType;
    const zoneChanged = parsed.data.zone !== undefined && parsed.data.zone !== current.zone;
    const durationChanged = parsed.data.durationMin !== undefined && parsed.data.durationMin !== current.durationMin;
    const plannedDateChanged = parsed.data.plannedDate !== undefined && parsed.data.plannedDate !== current.plannedDate;
    const statusChanged = parsed.data.status !== undefined && parsed.data.status !== current.status;
    const descriptionChanged = parsed.data.description !== undefined && parsed.data.description !== current.description;
    const changesPrescription =
      activityTypeChanged ||
      zoneChanged ||
      durationChanged;
    const changesGarminRelevant =
      changesPrescription ||
      plannedDateChanged ||
      statusChanged ||
      descriptionChanged;
    const nextStatus = parsed.data.status ?? current.status;
    const nextActivityType = parsed.data.activityType ?? current.activityType;
    const nextZone = parsed.data.zone ?? current.zone;
    const nextDurationMin = parsed.data.durationMin ?? current.durationMin;
    const targetTss = zoneChanged || durationChanged
      ? tssFromWorkout(nextDurationMin, nextZone)
      : undefined;

    let generatedDetail: { steps: PlannedWorkoutRow['steps']; description: string | null } | null = null;
    if (changesPrescription && nextStatus === 'planned') {
      const [profile] = await db.select().from(pulseUserProfile).where(eq(pulseUserProfile.userId, userId));
      const detailSource = {
        ...current,
        activityType: nextActivityType,
        zone: nextZone,
        durationMin: nextDurationMin,
        description: parsed.data.description !== undefined ? parsed.data.description : null,
      };
      const { steps, updatedDescription } = await buildWorkoutSteps(detailSource, profile ?? undefined);
      generatedDetail = { steps, description: updatedDescription };
    }

    const [updated] = await db.update(pulsePlannedWorkouts)
      .set({
        ...parsed.data,
        ...(changesPrescription
          ? generatedDetail
            ? { steps: generatedDetail.steps, description: generatedDetail.description }
            : { steps: null }
          : {}),
        ...(targetTss !== undefined ? { targetTss } : {}),
        ...(changesGarminRelevant ? {
          garminWorkoutId: null,
          garminScheduledId: null,
          executionStatus: null,
          executionNotes: null,
          executionMatchConfidence: null,
          executionMatchedAt: null,
        } : {}),
      })
      .where(and(eq(pulsePlannedWorkouts.id, id), eq(pulsePlannedWorkouts.userId, userId)))
      .returning();
    if (!updated) return reply.status(404).send({ error: 'Not found' });

    let finalWorkout = updated;
    let garminSync: { status: 'unchanged' | 'removed' | 'synced' | 'failed'; error?: string } = { status: 'unchanged' };
    if (changesGarminRelevant) {
      if (nextStatus === 'skipped') {
        garminSync = { status: 'removed' };
        if (hasGarminRemote(current)) {
          try {
            const gc = await getGarminClient();
            await removeGarminRemoteForWorkout(app, gc, current, 'plan-workout-update');
          } catch (err) {
            app.log.warn(`[plan-workout-update] Garmin cleanup failed for skipped workout ${id}: ${err}`);
            garminSync = { status: 'failed', error: String(err).slice(0, 120) };
          }
        }
      } else if (nextStatus === 'planned') {
        try {
          finalWorkout = await replaceGarminRemoteForWorkout(app, userId, current, updated, 'plan-workout-update');
          garminSync = { status: 'synced' };
        } catch (err) {
          app.log.warn(`[plan-workout-update] Garmin resync failed for ${id}: ${err}`);
          garminSync = { status: 'failed', error: String(err).slice(0, 120) };
        }
      }
    }

    await invalidateUser(userId);
    return { workout: finalWorkout, garminSync };
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
      const gc = await getGarminClient();
      if (hasGarminRemote(workout)) {
        await removeGarminRemoteForWorkout(app, gc, workout, 'sync-garmin');
        await db.update(pulsePlannedWorkouts)
          .set({
            garminWorkoutId: null,
            garminScheduledId: null,
            executionStatus: null,
            executionNotes: null,
            executionMatchConfidence: null,
            executionMatchedAt: null,
          })
          .where(eq(pulsePlannedWorkouts.id, id));
        workout.garminWorkoutId = null;
        workout.garminScheduledId = null;
        workout.executionStatus = null;
        workout.executionNotes = null;
        workout.executionMatchConfidence = null;
        workout.executionMatchedAt = null;
      }

      const updated = await uploadWorkoutToGarmin(app, userId, workout, gc, 'sync-garmin');

      return {
        garminWorkoutId: updated.garminWorkoutId,
        garminScheduledId: updated.garminScheduledId,
        date: updated.plannedDate,
        workout: enrichWorkoutExecutionState(updated, [], new Date()),
      };
    } catch (err) {
      app.log.error(`Garmin workout sync failed: ${err}`);
      return reply.status(502).send({ error: `Garmin-Sync fehlgeschlagen: ${String(err).slice(0, 120)}` });
    }
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
        const gc = await getGarminClient();
        const syncCutoff = replacementCutoff;

        // Upload new workouts to Garmin
        for (const w of withSteps.filter(ww => !ww.garminWorkoutId)) {
          try {
            const fuelingGuidance = await buildFuelingRecoveryGuidanceForPlannedWorkout(userId, w).catch((err: unknown) => {
              app.log.warn(`[plan-generate] Fueling guidance failed for ${w.id}: ${err}`);
              return null;
            });
            const garminWorkout = buildGarminWorkoutJson(w, { fuelingGuidance });
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

  // ─── Goals and race strategy ─────────────────────────────────────────────────
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

  // ─── Nutrition logs and weekly review ────────────────────────────────────────
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

  app.get('/fueling-recovery/guidance', { onRequest: [app.authenticate] }, async (req, reply): Promise<PulseFuelingRecoveryGuidanceResponse | void> => {
    const parsed = z.object({ workoutId: z.string().uuid() }).safeParse(req.query);
    if (!parsed.success) return reply.status(400).send({ error: 'workoutId fehlt oder ist ungültig' });

    const userId = req.user.sub;
    const [workout] = await db.select().from(pulsePlannedWorkouts)
      .where(and(eq(pulsePlannedWorkouts.id, parsed.data.workoutId), eq(pulsePlannedWorkouts.userId, userId)));
    if (!workout) return reply.status(404).send({ error: 'Workout nicht gefunden' });

    return buildFuelingRecoveryGuidanceForPlannedWorkout(userId, workout);
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

  app.put('/activities/:id/equipment', { onRequest: [app.authenticate] }, async (req, reply) => {
    const parsed = equipmentAssignSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Ungültige Equipment-Zuordnung' });

    const { id } = req.params as { id: string };
    const userId = req.user.sub;
    const result = await assignEquipmentToActivity(userId, id, parsed.data.equipmentIds);
    if (!result) return reply.status(404).send({ error: 'Aktivität nicht gefunden' });

    await invalidateUser(userId);
    return result;
  });

  app.get('/strength/sessions', { onRequest: [app.authenticate] }, async (req, reply) => {
    const querySchema = z.object({
      days: z.coerce.number().int().min(1).max(365).optional(),
      exercise: z.string().trim().min(1).max(80).optional(),
    });
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) return reply.status(400).send({ error: 'Ungültige Abfrage' });

    return listStrengthSessions(req.user.sub, parsed.data);
  });

  app.post('/strength/sessions', { onRequest: [app.authenticate] }, async (req, reply) => {
    const parsed = strengthSessionCreateSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Ungültige Krafteinheit' });

    let session;
    try {
      session = await createStrengthSession(req.user.sub, {
        ...parsed.data,
        date: parsed.data.date ?? new Date().toISOString().split('T')[0]!,
      });
    } catch {
      return reply.status(404).send({ error: 'Geplantes Workout nicht gefunden' });
    }
    await invalidateUser(req.user.sub);
    return reply.status(201).send(session);
  });

  app.get('/strength/sessions/:id', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const session = await getStrengthSession(req.user.sub, id);
    if (!session) return reply.status(404).send({ error: 'Krafteinheit nicht gefunden' });
    return session;
  });

  app.patch('/strength/sessions/:id', { onRequest: [app.authenticate] }, async (req, reply) => {
    const parsed = strengthSessionPatchSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Ungültige Krafteinheit' });

    const { id } = req.params as { id: string };
    const session = await updateStrengthSession(req.user.sub, id, parsed.data);
    if (!session) return reply.status(404).send({ error: 'Krafteinheit nicht gefunden' });
    await invalidateUser(req.user.sub);
    return session;
  });

  app.delete('/strength/sessions/:id', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const deleted = await deleteStrengthSession(req.user.sub, id);
    if (!deleted) return reply.status(404).send({ error: 'Krafteinheit nicht gefunden' });
    await invalidateUser(req.user.sub);
    return reply.status(204).send();
  });

  app.get('/equipment', { onRequest: [app.authenticate] }, async (req, reply) => {
    const querySchema = z.object({
      includeRetired: z.coerce.boolean().optional(),
    });
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) return reply.status(400).send({ error: 'Ungültige Abfrage' });
    return listEquipment(req.user.sub, { includeRetired: parsed.data.includeRetired });
  });

  app.post('/equipment', { onRequest: [app.authenticate] }, async (req, reply) => {
    const parsed = equipmentCreateSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Ungültiges Equipment' });

    const equipment = await createEquipment(req.user.sub, parsed.data);
    if (!equipment) return reply.status(404).send({ error: 'Parent-Equipment nicht gefunden' });
    await invalidateUser(req.user.sub);
    return reply.status(201).send(equipment);
  });

  app.patch('/equipment/:id', { onRequest: [app.authenticate] }, async (req, reply) => {
    const parsed = equipmentPatchSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Ungültiges Equipment' });

    const { id } = req.params as { id: string };
    const equipment = await updateEquipment(req.user.sub, id, parsed.data);
    if (!equipment) return reply.status(404).send({ error: 'Equipment nicht gefunden' });
    await invalidateUser(req.user.sub);
    return equipment;
  });

  app.post('/equipment/:id/retire', { onRequest: [app.authenticate] }, async (req, reply) => {
    const parsed = z.object({
      retirementDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    }).safeParse(req.body ?? {});
    if (!parsed.success) return reply.status(400).send({ error: 'Ungültiges Retirement-Datum' });

    const { id } = req.params as { id: string };
    const equipment = await retireEquipment(req.user.sub, id, parsed.data.retirementDate);
    if (!equipment) return reply.status(404).send({ error: 'Aktives Equipment nicht gefunden' });
    await invalidateUser(req.user.sub);
    return equipment;
  });

  app.put('/equipment/defaults/:activityType', { onRequest: [app.authenticate] }, async (req, reply) => {
    const activityType = pulseActivityTypeSchema.safeParse((req.params as { activityType: string }).activityType);
    const body = equipmentDefaultSchema.safeParse(req.body);
    if (!activityType.success || !body.success) return reply.status(400).send({ error: 'Ungültiges Default-Equipment' });

    const result = await setEquipmentDefault(req.user.sub, activityType.data, body.data.equipmentId);
    if (!result) return reply.status(404).send({ error: 'Equipment nicht gefunden' });
    await invalidateUser(req.user.sub);
    return result;
  });
}
