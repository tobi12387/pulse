import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../app.js';
import { db } from '../lib/db.js';
import { users, dailyBriefings } from '../db/schema.js';
import { hashPassword } from '../lib/auth.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
let token: string;
let userId: string;

beforeAll(async () => {
  app = await buildApp();
  await db.delete(dailyBriefings);
  await db.delete(users);
  const [u] = await db.insert(users).values({
    email: 'briefing-route@coaching.os',
    passwordHash: await hashPassword('TestPassword123!'),
    name: 'Briefing Route Test',
  }).returning({ id: users.id });
  userId = u!.id;
  const res = await app.inject({
    method: 'POST', url: '/api/auth/login',
    payload: { email: 'briefing-route@coaching.os', password: 'TestPassword123!' },
  });
  token = res.json<{ token: string }>().token;
});

afterAll(async () => {
  await db.delete(dailyBriefings);
  await db.delete(users);
  await app.close();
});

describe('GET /api/briefing/latest', () => {
  it('returns 401 without token', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/briefing/latest' });
    expect(res.statusCode).toBe(401);
  });

  it('returns null when no briefing exists', async () => {
    await db.delete(dailyBriefings);
    const res = await app.inject({
      method: 'GET', url: '/api/briefing/latest',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json<{ briefing: null }>().briefing).toBeNull();
  });

  it('returns latest briefing', async () => {
    await db.insert(dailyBriefings).values({
      userId,
      date: '2026-04-23',
      triggerType: 'check-in',
      briefingText: 'Heute Zone 2, 45 Min.',
    });
    const res = await app.inject({
      method: 'GET', url: '/api/briefing/latest',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ briefing: { trigger_type: string; briefing_text: string } }>();
    expect(body.briefing!.trigger_type).toBe('check-in');
    expect(body.briefing!.briefing_text).toBe('Heute Zone 2, 45 Min.');
  });
});
