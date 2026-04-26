import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../app.js';
import { db } from '../lib/db.js';
import { users } from '../db/schema.js';
import { hashPassword } from '../lib/auth.js';
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';

let app: FastifyInstance;
let token: string;

beforeAll(async () => {
  app = await buildApp();
  await db.delete(users).where(eq(users.email, 'pulse-test@coaching.os'));
  const [u] = await db.insert(users).values({
    email: 'pulse-test@coaching.os',
    passwordHash: await hashPassword('TestPass123!'),
    name: 'Pulse Test',
  }).returning({ id: users.id });
  const res = await app.inject({
    method: 'POST', url: '/api/auth/login',
    payload: { email: 'pulse-test@coaching.os', password: 'TestPass123!' },
  });
  token = res.json<{ token: string }>().token;
  void u;
});

afterAll(async () => {
  await db.delete(users).where(eq(users.email, 'pulse-test@coaching.os'));
  await app.close();
});

describe('GET /api/pulse/health', () => {
  it('returns 200 without auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/pulse/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok', namespace: 'pulse' });
  });
});

describe('GET /api/pulse/home', () => {
  it('returns 401 without token', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/pulse/home' });
    expect(res.statusCode).toBe(401);
  });

  it('returns 200 with token', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/pulse/home',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ date: string; readiness: { score: number } }>();
    expect(body).toHaveProperty('date');
    expect(body).toHaveProperty('readiness');
    expect(body.readiness).toHaveProperty('score');
  });
});

describe('POST /api/pulse/coach', () => {
  it('returns 401 without token', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/pulse/coach',
      payload: { message: 'Hallo' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('returns 400 for empty message', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/pulse/coach',
      payload: { message: '' },
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns coach reply for valid message', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/pulse/coach',
      payload: { message: 'Hallo' },
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ reply: string }>();
    expect(body).toHaveProperty('reply');
    expect(typeof body.reply).toBe('string');
    expect(body.reply.length).toBeGreaterThan(0);
  });
});

describe('GET /api/pulse/sleep', () => {
  it('returns 200 with empty sessions', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/pulse/sleep',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveProperty('sessions');
    expect(Array.isArray(res.json<{ sessions: unknown[] }>().sessions)).toBe(true);
  });
});

describe('GET /api/pulse/activities', () => {
  it('returns 200 with empty activities', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/pulse/activities',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveProperty('activities');
  });
});

describe('GET /api/pulse/plan', () => {
  it('returns 200 with empty workouts', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/pulse/plan',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveProperty('workouts');
  });
});

describe('POST /api/pulse/plan/generate', () => {
  it('generates workouts and returns 201', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/pulse/plan/generate',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toHaveProperty('workouts');
  });
});

describe('GET /api/pulse/goals', () => {
  it('returns 200 with empty goals', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/pulse/goals',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveProperty('goals');
  });
});

describe('POST /api/pulse/goals', () => {
  it('creates a goal and returns 201', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/pulse/goals',
      payload: { title: 'Test-Ziel', description: 'Testbeschreibung' },
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json<{ id: string; title: string }>();
    expect(body.title).toBe('Test-Ziel');
  });

  it('returns 400 for missing title', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/pulse/goals',
      payload: {},
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('GET /api/pulse/review/latest', () => {
  it('returns 200 (null when no review exists)', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/pulse/review/latest',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
  });
});

describe('POST /api/pulse/garmin/sync', () => {
  it('returns 200 or 503 depending on Redis availability', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/pulse/garmin/sync',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect([200, 503]).toContain(res.statusCode);
  });
});
