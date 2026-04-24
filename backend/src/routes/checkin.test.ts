import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { buildApp } from '../app.js';
import { db } from '../lib/db.js';
import { users, checkIns } from '../db/schema.js';
import { hashPassword } from '../lib/auth.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
let token: string;
let userId: string;

beforeAll(async () => {
  app = await buildApp();
  await db.delete(checkIns);
  await db.delete(users);
  const [u] = await db.insert(users).values({
    email: 'checkin@coaching.os',
    passwordHash: await hashPassword('TestPassword123!'),
    name: 'Checkin Test',
  }).returning({ id: users.id });
  userId = u!.id;
  const res = await app.inject({
    method: 'POST', url: '/api/auth/login',
    payload: { email: 'checkin@coaching.os', password: 'TestPassword123!' },
  });
  token = res.json<{ token: string }>().token;
});

afterAll(async () => {
  await db.delete(checkIns);
  await db.delete(users);
  await app.close();
});

beforeEach(async () => {
  await db.delete(checkIns);
});

describe('POST /api/checkin', () => {
  it('returns 401 without token', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/checkin', payload: { energy_level: 7, stress_level: 3 } });
    expect(res.statusCode).toBe(401);
  });

  it('creates check-in and returns 201', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/checkin',
      headers: { authorization: `Bearer ${token}` },
      payload: { energy_level: 7, stress_level: 3, notes: 'Feeling good' },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json<{ id: string; date: string; energy_level: number }>();
    expect(body.energy_level).toBe(7);
    expect(body.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('returns 400 for invalid payload', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/checkin',
      headers: { authorization: `Bearer ${token}` },
      payload: { energy_level: 11, stress_level: 3 },
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 409 when check-in already exists today', async () => {
    await app.inject({
      method: 'POST', url: '/api/checkin',
      headers: { authorization: `Bearer ${token}` },
      payload: { energy_level: 5, stress_level: 5 },
    });
    const res = await app.inject({
      method: 'POST', url: '/api/checkin',
      headers: { authorization: `Bearer ${token}` },
      payload: { energy_level: 6, stress_level: 4 },
    });
    expect(res.statusCode).toBe(409);
  });
});

describe('GET /api/checkin/today', () => {
  it('returns null when no check-in today', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/checkin/today',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json<{ checkin: null }>().checkin).toBeNull();
  });

  it('returns today check-in when present', async () => {
    await app.inject({
      method: 'POST', url: '/api/checkin',
      headers: { authorization: `Bearer ${token}` },
      payload: { energy_level: 8, stress_level: 2 },
    });
    const res = await app.inject({
      method: 'GET', url: '/api/checkin/today',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.json<{ checkin: { energy_level: number } }>().checkin!.energy_level).toBe(8);
  });
});
