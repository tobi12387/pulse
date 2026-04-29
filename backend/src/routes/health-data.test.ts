import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../app.js';
import { db } from '../lib/db.js';
import { users } from '../db/schema.js';
import { pulseDailyMetrics } from '../db/pulse-schema.js';
import { hashPassword } from '../lib/auth.js';
import type { FastifyInstance } from 'fastify';
import type { HealthSummaryResponse } from '@coaching-os/shared/health';

let app: FastifyInstance;
let token: string;
let userId: string;

beforeAll(async () => {
  app = await buildApp();
  await db.delete(pulseDailyMetrics);
  await db.delete(users);

  const [user] = await db.insert(users).values({
    email: 'health@coaching.os',
    passwordHash: await hashPassword('TestPassword123!'),
    name: 'Health Test',
  }).returning({ id: users.id });
  userId = user!.id;

  const loginRes = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: 'health@coaching.os', password: 'TestPassword123!' },
  });
  token = loginRes.json<{ token: string }>().token;
});

afterAll(async () => {
  await db.delete(pulseDailyMetrics);
  await db.delete(users);
  await app.close();
});

describe('GET /api/health/summary', () => {
  it('returns 401 without token', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health/summary' });
    expect(res.statusCode).toBe(401);
  });

  it('returns empty state when no data exists', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/health/summary',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<HealthSummaryResponse>();
    expect(body.today).toBeNull();
    expect(body.trend7d).toEqual([]);
    expect(body.lastSync).toBeNull();
    expect(body.circuitOpen).toBe(false);
  });

  it('returns today and trend7d when data exists', async () => {
    await db.insert(pulseDailyMetrics).values([
      {
        userId,
        date: '2026-04-13',
        sleepHours: 7.5,
        sleepScore: 82,
        hrvStatus: 'balanced',
        restingHr: 52,
        bodyBatteryMax: 85,
        steps: 10234,
        stressAvg: 22,
        caloriesActive: 450,
      },
      {
        userId,
        date: '2026-04-14',
        sleepHours: 6.2,
        sleepScore: 71,
        hrvStatus: 'unbalanced',
        restingHr: 58,
        bodyBatteryMax: 65,
        steps: 7800,
        stressAvg: 35,
        caloriesActive: 380,
      },
      {
        userId,
        date: '2026-04-15',
        sleepHours: 6.4,
        sleepScore: 74,
        hrvStatus: 'balanced',
        restingHr: 59,
        bodyBatteryMax: 28,
        steps: 12086,
        stressAvg: 27,
        caloriesActive: 390,
      },
    ]);

    const res = await app.inject({
      method: 'GET',
      url: '/api/health/summary',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<HealthSummaryResponse>();

    // today = neueste Zeile
    expect(body.today).not.toBeNull();
    expect(body.today!.date).toBe('2026-04-15');
    expect(body.today!.sleepDurationH).toBeCloseTo(6.4);
    expect(body.today!.hrvStatus).toBe('balanced');
    expect(body.today!.restingHr).toBe(59);

    // trend7d = alle 3 Zeilen, aufsteigend
    expect(body.trend7d).toHaveLength(3);
    expect(body.trend7d[0]!.date).toBe('2026-04-13');
    expect(body.trend7d[2]!.date).toBe('2026-04-15');

    expect(body.lastSync).not.toBeNull();
    expect(body.circuitOpen).toBe(false);
  });
});
