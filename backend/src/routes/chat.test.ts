import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { buildApp } from '../app.js';
import { db } from '../lib/db.js';
import { users, chatMessages } from '../db/schema.js';
import { hashPassword } from '../lib/auth.js';
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';

vi.mock('../lib/llm.js', () => ({
  FAST_MODEL: 'test-model',
  llmChat: vi.fn().mockResolvedValue('Zone 2 heute, 45 Minuten.'),
}));

let app: FastifyInstance;
let token: string;
let userId: string;

beforeAll(async () => {
  app = await buildApp();
  await db.delete(chatMessages);
  await db.delete(users);
  const [u] = await db.insert(users).values({
    email: 'chat@coaching.os',
    passwordHash: await hashPassword('TestPassword123!'),
    name: 'Chat Test',
  }).returning({ id: users.id });
  userId = u!.id;
  const res = await app.inject({
    method: 'POST', url: '/api/auth/login',
    payload: { email: 'chat@coaching.os', password: 'TestPassword123!' },
  });
  token = res.json<{ token: string }>().token;
});

afterAll(async () => {
  await db.delete(chatMessages);
  await db.delete(users);
  await app.close();
});

beforeEach(async () => {
  await db.delete(chatMessages);
});

describe('POST /api/chat/message', () => {
  it('returns 401 without token', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/chat/message', payload: { message: 'Hi' } });
    expect(res.statusCode).toBe(401);
  });

  it('returns 400 for empty message', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/chat/message',
      headers: { authorization: `Bearer ${token}` },
      payload: { message: '' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns coach response and saves both messages to DB', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/chat/message',
      headers: { authorization: `Bearer ${token}` },
      payload: { message: 'Wie trainiere ich heute?' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json<{ response: string }>().response).toBe('Zone 2 heute, 45 Minuten.');

    const rows = await db.select().from(chatMessages).where(eq(chatMessages.userId, userId));
    expect(rows.length).toBe(2);
    expect(rows[0]!.role).toBe('user');
    expect(rows[1]!.role).toBe('assistant');
  });
});

describe('GET /api/chat/history', () => {
  it('returns empty array when no history', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/chat/history',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json<{ messages: unknown[] }>().messages).toEqual([]);
  });

  it('returns messages after sending one', async () => {
    await app.inject({
      method: 'POST', url: '/api/chat/message',
      headers: { authorization: `Bearer ${token}` },
      payload: { message: 'Hallo Coach' },
    });
    const res = await app.inject({
      method: 'GET', url: '/api/chat/history',
      headers: { authorization: `Bearer ${token}` },
    });
    const { messages } = res.json<{ messages: Array<{ role: string }> }>();
    expect(messages.length).toBe(2);
    expect(messages[0]!.role).toBe('user');
  });
});

describe('DELETE /api/chat/history', () => {
  it('clears history and returns 204', async () => {
    await app.inject({
      method: 'POST', url: '/api/chat/message',
      headers: { authorization: `Bearer ${token}` },
      payload: { message: 'Test' },
    });
    const del = await app.inject({
      method: 'DELETE', url: '/api/chat/history',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(del.statusCode).toBe(204);
    const res = await app.inject({
      method: 'GET', url: '/api/chat/history',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.json<{ messages: unknown[] }>().messages).toEqual([]);
  });
});
