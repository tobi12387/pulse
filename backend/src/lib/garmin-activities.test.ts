import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { db } from './db.js';
import { users } from '../db/schema.js';
import { pulseActivities } from '../db/pulse-schema.js';
import { upsertGarminActivity } from './garmin-activities.js';

const email = 'garmin-activities@coaching.os';

let userId: string;

beforeAll(async () => {
  await db.delete(users).where(eq(users.email, email));
  const [user] = await db.insert(users).values({
    email,
    passwordHash: 'test-password-hash',
    name: 'Garmin Activities Test',
  }).returning({ id: users.id });
  userId = user!.id;
});

beforeEach(async () => {
  await db.delete(pulseActivities).where(eq(pulseActivities.userId, userId));
});

afterAll(async () => {
  if (userId) {
    await db.delete(pulseActivities).where(eq(pulseActivities.userId, userId));
  }
  await db.delete(users).where(eq(users.email, email));
});

describe('upsertGarminActivity', () => {
  it('stores the original Garmin activity summary raw snapshot', async () => {
    const activitySummary = {
      activityId: 123456789,
      activityName: 'Lunch Ride',
      activityType: { typeKey: 'cycling' },
      startTimeGMT: '2026-05-01 10:15:00',
      duration: 3_600.2,
      distance: 22_400,
      averageHR: 143,
      maxHR: 169,
      avgPower: 211.4,
      normPower: 226.8,
      trainingStressScore: 58.7,
      calories: 740,
      eventType: { typeKey: 'cycling' },
      providerSummary: true,
    };

    const result = await upsertGarminActivity(userId, activitySummary);

    expect(result).toMatchObject({
      date: '2026-05-01',
      activityType: 'bike',
    });

    const [saved] = await db.select({
      externalId: pulseActivities.externalId,
      rawData: pulseActivities.rawData,
    }).from(pulseActivities).where(and(
      eq(pulseActivities.userId, userId),
      eq(pulseActivities.externalId, String(activitySummary.activityId)),
    ));

    expect(saved?.externalId).toBe(String(activitySummary.activityId));
    expect(saved?.rawData).toEqual(activitySummary);
  });
});
