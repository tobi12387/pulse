import { and, desc, eq, gte, inArray, isNull, sql } from 'drizzle-orm';
import type {
  EquipmentCategory,
  PulseActivityType,
  PulseEquipment,
  PulseEquipmentDefault,
  PulseStrengthSession,
  PulseStrengthSet,
  PulseStrengthTrendPoint,
} from '@coaching-os/shared/pulse';
import { db } from '../../lib/db.js';
import {
  pulseActivities,
  pulseEquipment,
  pulseEquipmentActivity,
  pulseEquipmentDefault,
  pulsePlannedWorkouts,
  pulseStrengthSession,
  pulseStrengthSet,
} from '../../db/pulse-schema.js';

export const EQUIPMENT_CATEGORIES: EquipmentCategory[] = [
  'chain',
  'tire',
  'brake_pad',
  'cassette',
  'running_shoe',
  'bike',
  'wetsuit',
  'other',
];

export const STRENGTH_EXERCISES = [
  'Squat',
  'Deadlift',
  'Bench',
  'OHP',
  'Pullup',
  'Lunges',
  'RDL',
  'Hip Thrust',
  'Calf Raise',
  'Plank',
] as const;

type StrengthSessionRow = typeof pulseStrengthSession.$inferSelect;
type StrengthSetRow = typeof pulseStrengthSet.$inferSelect;
type EquipmentRow = typeof pulseEquipment.$inferSelect;

export interface StrengthSetInput {
  exercise: string;
  setNumber?: number | undefined;
  reps: number;
  weightKg?: number | null | undefined;
  rpe?: number | null | undefined;
}

export interface StrengthSessionInput {
  date: string;
  plannedWorkoutId?: string | null | undefined;
  durationMin?: number | null | undefined;
  notes?: string | null | undefined;
  sets: StrengthSetInput[];
}

export interface StrengthSessionUpdateInput {
  date?: string | undefined;
  plannedWorkoutId?: string | null | undefined;
  durationMin?: number | null | undefined;
  notes?: string | null | undefined;
  sets?: StrengthSetInput[] | undefined;
}

export interface EquipmentInput {
  name: string;
  category: EquipmentCategory;
  parentEquipmentId?: string | null | undefined;
  activityTypes: PulseActivityType[];
  installedDate: string;
  initialKm?: number | null | undefined;
  retirementKm?: number | null | undefined;
  retirementDate?: string | null | undefined;
  notes?: string | null | undefined;
}

export interface EquipmentUpdateInput {
  name?: string | undefined;
  category?: EquipmentCategory | undefined;
  parentEquipmentId?: string | null | undefined;
  activityTypes?: PulseActivityType[] | undefined;
  installedDate?: string | undefined;
  initialKm?: number | null | undefined;
  retirementKm?: number | null | undefined;
  retirementDate?: string | null | undefined;
  notes?: string | null | undefined;
}

export function computeE1rmKg(weightKg: number | null | undefined, reps: number): number | null {
  if (weightKg == null || weightKg <= 0) return null;
  return Math.round(weightKg * (1 + reps / 30) * 10) / 10;
}

function mapSet(row: StrengthSetRow): PulseStrengthSet {
  return {
    id: row.id,
    sessionId: row.sessionId,
    exercise: row.exercise,
    setNumber: row.setNumber,
    reps: row.reps,
    weightKg: row.weightKg,
    rpe: row.rpe,
    e1rmKg: row.e1rmKg,
  };
}

function mapSession(row: StrengthSessionRow, sets: StrengthSetRow[]): PulseStrengthSession {
  return {
    id: row.id,
    userId: row.userId,
    plannedWorkoutId: row.plannedWorkoutId,
    date: row.date,
    durationMin: row.durationMin,
    notes: row.notes,
    createdAt: row.createdAt?.toISOString() ?? null,
    sets: sets
      .filter(set => set.sessionId === row.id)
      .sort((a, b) => a.exercise.localeCompare(b.exercise) || a.setNumber - b.setNumber)
      .map(mapSet),
  };
}

function strengthSetValues(sessionId: string, sets: StrengthSetInput[]) {
  return sets.map((set, index) => ({
    sessionId,
    exercise: set.exercise.trim(),
    setNumber: set.setNumber ?? index + 1,
    reps: set.reps,
    weightKg: set.weightKg ?? null,
    rpe: set.rpe ?? null,
    e1rmKg: computeE1rmKg(set.weightKg, set.reps),
  }));
}

async function canUsePlannedWorkout(userId: string, plannedWorkoutId: string | null | undefined): Promise<boolean> {
  if (!plannedWorkoutId) return true;
  const [row] = await db.select({ id: pulsePlannedWorkouts.id })
    .from(pulsePlannedWorkouts)
    .where(and(eq(pulsePlannedWorkouts.userId, userId), eq(pulsePlannedWorkouts.id, plannedWorkoutId)))
    .limit(1);
  return !!row;
}

function dateDaysAgo(days: number): string {
  const d = new Date(Date.now() - days * 86_400_000);
  return d.toISOString().split('T')[0]!;
}

export async function getStrengthSession(userId: string, id: string): Promise<PulseStrengthSession | null> {
  const [session] = await db.select().from(pulseStrengthSession)
    .where(and(eq(pulseStrengthSession.userId, userId), eq(pulseStrengthSession.id, id)))
    .limit(1);
  if (!session) return null;

  const sets = await db.select().from(pulseStrengthSet)
    .where(eq(pulseStrengthSet.sessionId, session.id));

  return mapSession(session, sets);
}

export async function listStrengthSessions(userId: string, options: {
  days?: number | undefined;
  exercise?: string | null | undefined;
} = {}): Promise<{ sessions: PulseStrengthSession[]; trends: PulseStrengthTrendPoint[] }> {
  const since = dateDaysAgo(options.days ?? 90);
  const sessions = await db.select().from(pulseStrengthSession)
    .where(and(eq(pulseStrengthSession.userId, userId), gte(pulseStrengthSession.date, since)))
    .orderBy(desc(pulseStrengthSession.date), desc(pulseStrengthSession.createdAt));

  if (sessions.length === 0) return { sessions: [], trends: [] };

  const sessionIds = sessions.map(session => session.id);
  const sets = await db.select().from(pulseStrengthSet)
    .where(and(
      inArray(pulseStrengthSet.sessionId, sessionIds),
      options.exercise ? eq(pulseStrengthSet.exercise, options.exercise) : sql`true`,
    ));

  const sessionsWithSets = sessions
    .map(session => mapSession(session, sets))
    .filter(session => !options.exercise || session.sets.length > 0);

  const sessionDateById = new Map(sessions.map(session => [session.id, session.date]));
  const trends = sets
    .filter(set => set.e1rmKg != null)
    .map(set => ({
      date: sessionDateById.get(set.sessionId)!,
      exercise: set.exercise,
      e1rmKg: set.e1rmKg!,
    }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.exercise.localeCompare(b.exercise));

  return { sessions: sessionsWithSets, trends };
}

export async function createStrengthSession(userId: string, input: StrengthSessionInput): Promise<PulseStrengthSession> {
  if (!await canUsePlannedWorkout(userId, input.plannedWorkoutId)) {
    throw new Error('Planned workout not found');
  }

  const session = await db.transaction(async (tx) => {
    const [created] = await tx.insert(pulseStrengthSession).values({
      userId,
      plannedWorkoutId: input.plannedWorkoutId ?? null,
      date: input.date,
      durationMin: input.durationMin ?? null,
      notes: input.notes?.trim() || null,
    }).returning();
    if (!created) throw new Error('Strength session could not be created');

    if (input.sets.length > 0) {
      await tx.insert(pulseStrengthSet).values(strengthSetValues(created.id, input.sets));
    }

    return created;
  });

  const result = await getStrengthSession(userId, session.id);
  if (!result) throw new Error('Created strength session could not be loaded');
  return result;
}

export async function updateStrengthSession(
  userId: string,
  id: string,
  input: StrengthSessionUpdateInput,
): Promise<PulseStrengthSession | null> {
  if (input.plannedWorkoutId !== undefined && !await canUsePlannedWorkout(userId, input.plannedWorkoutId)) {
    return null;
  }

  const session = await db.transaction(async (tx) => {
    const updates: Partial<typeof pulseStrengthSession.$inferInsert> = {};
    if (input.date !== undefined) updates.date = input.date;
    if (input.plannedWorkoutId !== undefined) updates.plannedWorkoutId = input.plannedWorkoutId;
    if (input.durationMin !== undefined) updates.durationMin = input.durationMin;
    if (input.notes !== undefined) updates.notes = input.notes?.trim() || null;

    const [updated] = Object.keys(updates).length > 0
      ? await tx.update(pulseStrengthSession)
        .set(updates)
        .where(and(eq(pulseStrengthSession.userId, userId), eq(pulseStrengthSession.id, id)))
        .returning()
      : await tx.select().from(pulseStrengthSession)
        .where(and(eq(pulseStrengthSession.userId, userId), eq(pulseStrengthSession.id, id)))
        .limit(1);
    if (!updated) return null;

    if (input.sets) {
      await tx.delete(pulseStrengthSet).where(eq(pulseStrengthSet.sessionId, id));
      if (input.sets.length > 0) {
        await tx.insert(pulseStrengthSet).values(strengthSetValues(id, input.sets));
      }
    }

    return updated;
  });

  return session ? getStrengthSession(userId, session.id) : null;
}

export async function deleteStrengthSession(userId: string, id: string): Promise<boolean> {
  const [deleted] = await db.delete(pulseStrengthSession)
    .where(and(eq(pulseStrengthSession.userId, userId), eq(pulseStrengthSession.id, id)))
    .returning({ id: pulseStrengthSession.id });
  return !!deleted;
}

function mapEquipment(row: EquipmentRow, addedKm: number): PulseEquipment {
  const totalKm = Math.round(((row.initialKm ?? 0) + addedKm) * 10) / 10;
  const pctConsumed = row.retirementKm && row.retirementKm > 0
    ? Math.round((totalKm / row.retirementKm) * 1000) / 10
    : null;
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    category: row.category,
    parentEquipmentId: row.parentEquipmentId,
    activityTypes: row.activityTypes,
    installedDate: row.installedDate,
    initialKm: row.initialKm,
    retirementKm: row.retirementKm,
    retirementDate: row.retirementDate,
    retiredAt: row.retiredAt?.toISOString() ?? null,
    notes: row.notes,
    createdAt: row.createdAt?.toISOString() ?? null,
    totalKm,
    pctConsumed,
    warning: pctConsumed != null && pctConsumed >= 90,
  };
}

export async function listEquipment(userId: string, options: { includeRetired?: boolean | undefined } = {}): Promise<{
  equipment: PulseEquipment[];
  defaults: PulseEquipmentDefault[];
}> {
  const rows = await db.select().from(pulseEquipment)
    .where(and(
      eq(pulseEquipment.userId, userId),
      options.includeRetired ? sql`true` : isNull(pulseEquipment.retiredAt),
    ))
    .orderBy(pulseEquipment.category, pulseEquipment.name);

  const equipmentIds = rows.map(row => row.id);
  const usageRows = equipmentIds.length > 0
    ? await db.select({
        equipmentId: pulseEquipmentActivity.equipmentId,
        km: sql<number>`coalesce(sum(${pulseEquipmentActivity.kmAdded}), 0)::float`,
      }).from(pulseEquipmentActivity)
        .where(inArray(pulseEquipmentActivity.equipmentId, equipmentIds))
        .groupBy(pulseEquipmentActivity.equipmentId)
    : [];
  const kmByEquipmentId = new Map(usageRows.map(row => [row.equipmentId, Number(row.km ?? 0)]));

  const defaults = await db.select({
    activityType: pulseEquipmentDefault.activityType,
    equipmentId: pulseEquipmentDefault.equipmentId,
  }).from(pulseEquipmentDefault).where(eq(pulseEquipmentDefault.userId, userId));

  return {
    equipment: rows.map(row => mapEquipment(row, kmByEquipmentId.get(row.id) ?? 0)),
    defaults,
  };
}

async function isOwnedEquipment(userId: string, equipmentId: string): Promise<boolean> {
  const [row] = await db.select({ id: pulseEquipment.id }).from(pulseEquipment)
    .where(and(eq(pulseEquipment.userId, userId), eq(pulseEquipment.id, equipmentId)))
    .limit(1);
  return !!row;
}

export async function createEquipment(userId: string, input: EquipmentInput): Promise<PulseEquipment | null> {
  if (input.parentEquipmentId && !await isOwnedEquipment(userId, input.parentEquipmentId)) {
    return null;
  }

  const [created] = await db.insert(pulseEquipment).values({
    userId,
    name: input.name.trim(),
    category: input.category,
    parentEquipmentId: input.parentEquipmentId ?? null,
    activityTypes: input.activityTypes,
    installedDate: input.installedDate,
    initialKm: input.initialKm ?? 0,
    retirementKm: input.retirementKm ?? null,
    retirementDate: input.retirementDate ?? null,
    notes: input.notes?.trim() || null,
  }).returning();
  if (!created) throw new Error('Equipment could not be created');
  return mapEquipment(created, 0);
}

export async function updateEquipment(userId: string, id: string, input: EquipmentUpdateInput): Promise<PulseEquipment | null> {
  if (input.parentEquipmentId === id) {
    return null;
  }
  if (input.parentEquipmentId && !await isOwnedEquipment(userId, input.parentEquipmentId)) {
    return null;
  }

  const updates: Partial<typeof pulseEquipment.$inferInsert> = {};
  if (input.name !== undefined) updates.name = input.name.trim();
  if (input.category !== undefined) updates.category = input.category;
  if (input.parentEquipmentId !== undefined) updates.parentEquipmentId = input.parentEquipmentId;
  if (input.activityTypes !== undefined) updates.activityTypes = input.activityTypes;
  if (input.installedDate !== undefined) updates.installedDate = input.installedDate;
  if (input.initialKm !== undefined) updates.initialKm = input.initialKm;
  if (input.retirementKm !== undefined) updates.retirementKm = input.retirementKm;
  if (input.retirementDate !== undefined) updates.retirementDate = input.retirementDate;
  if (input.notes !== undefined) updates.notes = input.notes?.trim() || null;

  const [updated] = await db.update(pulseEquipment)
    .set(updates)
    .where(and(eq(pulseEquipment.userId, userId), eq(pulseEquipment.id, id)))
    .returning();
  if (!updated) return null;

  const { equipment } = await listEquipment(userId, { includeRetired: true });
  return equipment.find(item => item.id === id) ?? null;
}

export async function retireEquipment(userId: string, id: string, retirementDate?: string): Promise<PulseEquipment | null> {
  const today = new Date().toISOString().split('T')[0]!;
  const [updated] = await db.update(pulseEquipment)
    .set({ retiredAt: new Date(), retirementDate: retirementDate ?? today })
    .where(and(eq(pulseEquipment.userId, userId), eq(pulseEquipment.id, id), isNull(pulseEquipment.retiredAt)))
    .returning();
  if (!updated) return null;

  await db.delete(pulseEquipmentDefault)
    .where(and(eq(pulseEquipmentDefault.userId, userId), eq(pulseEquipmentDefault.equipmentId, id)));

  const { equipment } = await listEquipment(userId, { includeRetired: true });
  return equipment.find(item => item.id === id) ?? null;
}

async function ownedActiveEquipmentIds(userId: string, equipmentIds: string[]): Promise<string[]> {
  const unique = [...new Set(equipmentIds)];
  if (unique.length === 0) return [];

  const direct = await db.select({ id: pulseEquipment.id }).from(pulseEquipment)
    .where(and(
      eq(pulseEquipment.userId, userId),
      isNull(pulseEquipment.retiredAt),
      inArray(pulseEquipment.id, unique),
    ));
  const directIds = direct.map(row => row.id);
  if (directIds.length === 0) return [];

  const children = await db.select({ id: pulseEquipment.id }).from(pulseEquipment)
    .where(and(
      eq(pulseEquipment.userId, userId),
      isNull(pulseEquipment.retiredAt),
      inArray(pulseEquipment.parentEquipmentId, directIds),
    ));

  return [...new Set([...directIds, ...children.map(row => row.id)])];
}

export async function assignEquipmentToActivity(userId: string, activityId: string, equipmentIds: string[]): Promise<{
  activityId: string;
  equipmentIds: string[];
  kmAdded: number;
} | null> {
  const [activity] = await db.select({
    id: pulseActivities.id,
    distanceM: pulseActivities.distanceM,
  }).from(pulseActivities)
    .where(and(eq(pulseActivities.userId, userId), eq(pulseActivities.id, activityId)))
    .limit(1);
  if (!activity) return null;

  const resolvedEquipmentIds = await ownedActiveEquipmentIds(userId, equipmentIds);
  const kmAdded = Math.round(Math.max(0, (activity.distanceM ?? 0) / 1000) * 10) / 10;

  await db.transaction(async (tx) => {
    await tx.delete(pulseEquipmentActivity)
      .where(eq(pulseEquipmentActivity.activityId, activityId));
    if (resolvedEquipmentIds.length > 0) {
      await tx.insert(pulseEquipmentActivity).values(
        resolvedEquipmentIds.map(equipmentId => ({ equipmentId, activityId, kmAdded })),
      );
    }
  });

  return { activityId, equipmentIds: resolvedEquipmentIds, kmAdded };
}

export async function setEquipmentDefault(
  userId: string,
  activityType: PulseActivityType,
  equipmentId: string,
): Promise<PulseEquipmentDefault | null> {
  const [equipment] = await db.select({ id: pulseEquipment.id }).from(pulseEquipment)
    .where(and(eq(pulseEquipment.userId, userId), eq(pulseEquipment.id, equipmentId), isNull(pulseEquipment.retiredAt)))
    .limit(1);
  if (!equipment) return null;

  const [row] = await db.insert(pulseEquipmentDefault)
    .values({ userId, activityType, equipmentId })
    .onConflictDoUpdate({
      target: [pulseEquipmentDefault.userId, pulseEquipmentDefault.activityType],
      set: { equipmentId },
    })
    .returning({
      activityType: pulseEquipmentDefault.activityType,
      equipmentId: pulseEquipmentDefault.equipmentId,
    });

  return row ?? null;
}

export async function autoAssignDefaultEquipmentForActivity(userId: string, activityId: string): Promise<boolean> {
  const [activity] = await db.select({
    id: pulseActivities.id,
    activityType: pulseActivities.activityType,
  }).from(pulseActivities)
    .where(and(eq(pulseActivities.userId, userId), eq(pulseActivities.id, activityId)))
    .limit(1);
  if (!activity) return false;

  const [existing] = await db.select({ equipmentId: pulseEquipmentActivity.equipmentId })
    .from(pulseEquipmentActivity)
    .where(eq(pulseEquipmentActivity.activityId, activityId))
    .limit(1);
  if (existing) return false;

  const [defaultRow] = await db.select({ equipmentId: pulseEquipmentDefault.equipmentId })
    .from(pulseEquipmentDefault)
    .where(and(
      eq(pulseEquipmentDefault.userId, userId),
      eq(pulseEquipmentDefault.activityType, activity.activityType),
    ))
    .limit(1);
  if (!defaultRow) return false;

  return (await assignEquipmentToActivity(userId, activityId, [defaultRow.equipmentId])) != null;
}
