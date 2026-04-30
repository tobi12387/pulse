import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { inArray, eq, or } from 'drizzle-orm';
import { buildApp } from '../app.js';
import { db } from '../lib/db.js';
import { hashPassword } from '../lib/auth.js';
import { users } from '../db/schema.js';
import {
  pulseActivities,
  pulseEquipment,
  pulseEquipmentActivity,
  pulseEquipmentDefault,
  pulsePlannedWorkouts,
  pulseStrengthSession,
  pulseStrengthSet,
} from '../db/pulse-schema.js';
import { autoAssignDefaultEquipmentForActivity, computeE1rmKg } from './services/strength-equipment.js';

let app: FastifyInstance;
let token: string;
let userId: string;

async function cleanupUserData() {
  if (!userId) return;

  const [equipmentRows, activityRows, sessionRows] = await Promise.all([
    db.select({ id: pulseEquipment.id }).from(pulseEquipment).where(eq(pulseEquipment.userId, userId)),
    db.select({ id: pulseActivities.id }).from(pulseActivities).where(eq(pulseActivities.userId, userId)),
    db.select({ id: pulseStrengthSession.id }).from(pulseStrengthSession).where(eq(pulseStrengthSession.userId, userId)),
  ]);
  const equipmentIds = equipmentRows.map(row => row.id);
  const activityIds = activityRows.map(row => row.id);
  const sessionIds = sessionRows.map(row => row.id);

  const equipmentActivityConds = [
    equipmentIds.length > 0 ? inArray(pulseEquipmentActivity.equipmentId, equipmentIds) : null,
    activityIds.length > 0 ? inArray(pulseEquipmentActivity.activityId, activityIds) : null,
  ].filter((cond): cond is NonNullable<typeof cond> => cond != null);
  if (equipmentActivityConds.length === 1) {
    await db.delete(pulseEquipmentActivity).where(equipmentActivityConds[0]);
  } else if (equipmentActivityConds.length > 1) {
    await db.delete(pulseEquipmentActivity).where(or(...equipmentActivityConds));
  }

  if (sessionIds.length > 0) {
    await db.delete(pulseStrengthSet).where(inArray(pulseStrengthSet.sessionId, sessionIds));
  }
  await db.delete(pulseEquipmentDefault).where(eq(pulseEquipmentDefault.userId, userId));
  await db.delete(pulseEquipment).where(eq(pulseEquipment.userId, userId));
  await db.delete(pulseStrengthSession).where(eq(pulseStrengthSession.userId, userId));
  await db.delete(pulseActivities).where(eq(pulseActivities.userId, userId));
  await db.delete(pulsePlannedWorkouts).where(eq(pulsePlannedWorkouts.userId, userId));
}

beforeAll(async () => {
  app = await buildApp();
  await db.delete(users).where(eq(users.email, 'strength-equipment@coaching.os'));
  const [user] = await db.insert(users).values({
    email: 'strength-equipment@coaching.os',
    passwordHash: await hashPassword('TestPassword123!'),
    name: 'Strength Equipment Test',
  }).returning({ id: users.id });
  userId = user!.id;

  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: 'strength-equipment@coaching.os', password: 'TestPassword123!' },
  });
  token = res.json<{ token: string }>().token;
});

afterAll(async () => {
  await cleanupUserData();
  await db.delete(users).where(eq(users.email, 'strength-equipment@coaching.os'));
  await app.close();
});

beforeEach(async () => {
  await cleanupUserData();
});

describe('strength sessions', () => {
  it('computes Epley e1RM and supports session CRUD', async () => {
    expect(computeE1rmKg(100, 5)).toBe(116.7);
    expect(computeE1rmKg(null, 5)).toBeNull();

    const create = await app.inject({
      method: 'POST',
      url: '/api/pulse/strength/sessions',
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        date: '2026-04-30',
        durationMin: 45,
        notes: 'Lower body',
        sets: [
          { exercise: 'Squat', reps: 5, weightKg: 100, rpe: 8 },
          { exercise: 'Squat', reps: 5, weightKg: 102.5, rpe: 9 },
        ],
      },
    });
    expect(create.statusCode).toBe(201);
    const session = create.json<{ id: string; sets: Array<{ e1rmKg: number }> }>();
    expect(session.sets[0]!.e1rmKg).toBe(116.7);

    const list = await app.inject({
      method: 'GET',
      url: '/api/pulse/strength/sessions?days=90&exercise=Squat',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(list.statusCode).toBe(200);
    const body = list.json<{ sessions: unknown[]; trends: Array<{ exercise: string; e1rmKg: number }> }>();
    expect(body.sessions).toHaveLength(1);
    expect(body.trends).toEqual(expect.arrayContaining([
      expect.objectContaining({ exercise: 'Squat', e1rmKg: 116.7 }),
    ]));

    const patch = await app.inject({
      method: 'PATCH',
      url: `/api/pulse/strength/sessions/${session.id}`,
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        sets: [{ exercise: 'Deadlift', reps: 3, weightKg: 140, rpe: 8 }],
      },
    });
    expect(patch.statusCode).toBe(200);
    expect(patch.json<{ sets: Array<{ exercise: string; e1rmKg: number }> }>().sets).toEqual([
      expect.objectContaining({ exercise: 'Deadlift', e1rmKg: 154 }),
    ]);

    const del = await app.inject({
      method: 'DELETE',
      url: `/api/pulse/strength/sessions/${session.id}`,
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(del.statusCode).toBe(204);
  });

  it('rejects planned workout links owned by another user', async () => {
    const [otherUser] = await db.insert(users).values({
      email: 'strength-other@coaching.os',
      passwordHash: await hashPassword('TestPassword123!'),
      name: 'Other Strength User',
    }).returning({ id: users.id });
    const [otherWorkout] = await db.insert(pulsePlannedWorkouts).values({
      userId: otherUser!.id,
      plannedDate: '2026-04-30',
      activityType: 'strength',
      zone: 2,
      durationMin: 45,
    }).returning({ id: pulsePlannedWorkouts.id });

    const create = await app.inject({
      method: 'POST',
      url: '/api/pulse/strength/sessions',
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        date: '2026-04-30',
        plannedWorkoutId: otherWorkout!.id,
        sets: [{ exercise: 'Squat', reps: 5, weightKg: 100, rpe: 8 }],
      },
    });

    expect(create.statusCode).toBe(404);
    await db.delete(pulsePlannedWorkouts).where(eq(pulsePlannedWorkouts.userId, otherUser!.id));
    await db.delete(users).where(eq(users.id, otherUser!.id));
  });
});

describe('equipment', () => {
  it('tracks equipment mileage idempotently including child equipment', async () => {
    const bikeRes = await app.inject({
      method: 'POST',
      url: '/api/pulse/equipment',
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        name: 'Standard-Bike',
        category: 'bike',
        activityTypes: ['bike'],
        installedDate: '2026-01-01',
        initialKm: 100,
      },
    });
    expect(bikeRes.statusCode).toBe(201);
    const bike = bikeRes.json<{ id: string }>();

    const chainRes = await app.inject({
      method: 'POST',
      url: '/api/pulse/equipment',
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        name: 'Kette',
        category: 'chain',
        parentEquipmentId: bike.id,
        activityTypes: ['bike'],
        installedDate: '2026-01-01',
        retirementKm: 10,
      },
    });
    expect(chainRes.statusCode).toBe(201);
    const chain = chainRes.json<{ id: string }>();

    const defaultRes = await app.inject({
      method: 'PUT',
      url: '/api/pulse/equipment/defaults/bike',
      headers: { Authorization: `Bearer ${token}` },
      payload: { equipmentId: bike.id },
    });
    expect(defaultRes.statusCode).toBe(200);

    const [activity] = await db.insert(pulseActivities).values({
      userId,
      startTime: new Date('2026-04-30T10:00:00Z'),
      activityType: 'bike',
      durationSec: 3600,
      distanceM: 10_000,
      source: 'garmin',
    }).returning({ id: pulseActivities.id });

    const assign = await app.inject({
      method: 'PUT',
      url: `/api/pulse/activities/${activity!.id}/equipment`,
      headers: { Authorization: `Bearer ${token}` },
      payload: { equipmentIds: [bike.id] },
    });
    expect(assign.statusCode).toBe(200);
    expect(assign.json<{ equipmentIds: string[]; kmAdded: number }>()).toMatchObject({
      equipmentIds: expect.arrayContaining([bike.id, chain.id]),
      kmAdded: 10,
    });

    const repeat = await app.inject({
      method: 'PUT',
      url: `/api/pulse/activities/${activity!.id}/equipment`,
      headers: { Authorization: `Bearer ${token}` },
      payload: { equipmentIds: [bike.id] },
    });
    expect(repeat.statusCode).toBe(200);

    const equipmentList = await app.inject({
      method: 'GET',
      url: '/api/pulse/equipment',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(equipmentList.statusCode).toBe(200);
    const equipment = equipmentList.json<{ equipment: Array<{ id: string; totalKm: number; warning: boolean }> }>().equipment;
    expect(equipment.find(item => item.id === bike.id)).toMatchObject({ totalKm: 110, warning: false });
    expect(equipment.find(item => item.id === chain.id)).toMatchObject({ totalKm: 10, warning: true });

    const links = await db.select().from(pulseEquipmentActivity);
    expect(links.filter(link => link.activityId === activity!.id)).toHaveLength(2);
  });

  it('does not overwrite existing manual equipment links during default auto-assignment', async () => {
    const runShoeA = await app.inject({
      method: 'POST',
      url: '/api/pulse/equipment',
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        name: 'Shoe A',
        category: 'running_shoe',
        activityTypes: ['run'],
        installedDate: '2026-01-01',
      },
    });
    const runShoeB = await app.inject({
      method: 'POST',
      url: '/api/pulse/equipment',
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        name: 'Shoe B',
        category: 'running_shoe',
        activityTypes: ['run'],
        installedDate: '2026-01-01',
      },
    });
    const shoeA = runShoeA.json<{ id: string }>();
    const shoeB = runShoeB.json<{ id: string }>();

    await app.inject({
      method: 'PUT',
      url: '/api/pulse/equipment/defaults/run',
      headers: { Authorization: `Bearer ${token}` },
      payload: { equipmentId: shoeB.id },
    });
    const [activity] = await db.insert(pulseActivities).values({
      userId,
      startTime: new Date('2026-04-30T10:00:00Z'),
      activityType: 'run',
      durationSec: 1800,
      distanceM: 5000,
      source: 'garmin',
    }).returning({ id: pulseActivities.id });

    await app.inject({
      method: 'PUT',
      url: `/api/pulse/activities/${activity!.id}/equipment`,
      headers: { Authorization: `Bearer ${token}` },
      payload: { equipmentIds: [shoeA.id] },
    });
    await autoAssignDefaultEquipmentForActivity(userId, activity!.id);

    const links = await db.select().from(pulseEquipmentActivity)
      .where(eq(pulseEquipmentActivity.activityId, activity!.id));
    expect(links).toEqual([
      expect.objectContaining({ equipmentId: shoeA.id }),
    ]);
  });
});
