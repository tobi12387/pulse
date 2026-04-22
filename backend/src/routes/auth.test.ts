import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../app.js';
import { db } from '../lib/db.js';
import { users } from '../db/schema.js';
import { hashPassword } from '../lib/auth.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp();
  await db.delete(users);
  await db.insert(users).values({
    email: 'test@coaching.os',
    passwordHash: await hashPassword('TestPassword123!'),
    name: 'Test User',
  });
});

afterAll(async () => {
  await db.delete(users);
  await app.close();
});

describe('POST /api/auth/login', () => {
  it('returns token for valid credentials', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'test@coaching.os', password: 'TestPassword123!' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ token: string; user: { email: string } }>();
    expect(body.token).toBeDefined();
    expect(body.user.email).toBe('test@coaching.os');
  });

  it('returns 401 for wrong password', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'test@coaching.os', password: 'wrongpassword' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('returns 401 for unknown email', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'nobody@coaching.os', password: 'TestPassword123!' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('returns 400 for invalid input', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'not-an-email', password: 'x' },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('GET /api/auth/me', () => {
  it('returns user for valid JWT', async () => {
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'test@coaching.os', password: 'TestPassword123!' },
    });
    const { token } = loginRes.json<{ token: string }>();

    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json<{ email: string }>().email).toBe('test@coaching.os');
  });

  it('returns 401 without token', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/auth/me' });
    expect(res.statusCode).toBe(401);
  });
});
