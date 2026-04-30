import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { buildApp } from '../app.js';
import { db } from '../lib/db.js';
import { users } from '../db/schema.js';
import { pulseCoachSessions, pulseMentalCheckins, pulsePlannedWorkouts, pulseUserProfile } from '../db/pulse-schema.js';
import { hashPassword } from '../lib/auth.js';
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { llmChat, llmComplete } from '../lib/llm.js';
import { transcribeAudio } from '../lib/whisper.js';
import { invalidateUser } from './lib/pulse-cache.js';

const garminMocks = vi.hoisted(() => ({
  addWorkout: vi.fn(),
  post: vi.fn(),
  get: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('../lib/llm.js', () => ({
  SMART_MODEL: 'test-model',
  FAST_MODEL: 'test-model',
  llmChat: vi.fn().mockResolvedValue('Heute locker bleiben: 45 Minuten Zone 2 reichen.'),
  llmComplete: vi.fn().mockResolvedValue('[{"index":0,"description":"Test-Workout"}]'),
}));

vi.mock('../lib/whisper.js', () => ({
  transcribeAudio: vi.fn().mockResolvedValue('Ich bin heute muede und gestresst.'),
}));

vi.mock('../lib/garmin-client.js', () => ({
  getGarminClient: vi.fn().mockResolvedValue({
    addWorkout: garminMocks.addWorkout,
    client: {
      post: garminMocks.post,
      get: garminMocks.get,
      delete: garminMocks.delete,
    },
  }),
}));

let app: FastifyInstance;
let token: string;
let userId: string;

beforeAll(async () => {
  app = await buildApp();
  await db.delete(users).where(eq(users.email, 'pulse-test@coaching.os'));
  const [u] = await db.insert(users).values({
    email: 'pulse-test@coaching.os',
    passwordHash: await hashPassword('TestPass123!'),
    name: 'Pulse Test',
  }).returning({ id: users.id });
  userId = u!.id;
  const res = await app.inject({
    method: 'POST', url: '/api/auth/login',
    payload: { email: 'pulse-test@coaching.os', password: 'TestPass123!' },
  });
  token = res.json<{ token: string }>().token;
});

afterAll(async () => {
  if (userId) {
    await db.delete(pulsePlannedWorkouts).where(eq(pulsePlannedWorkouts.userId, userId));
    await db.delete(pulseUserProfile).where(eq(pulseUserProfile.userId, userId));
    await db.delete(pulseCoachSessions).where(eq(pulseCoachSessions.userId, userId));
    await db.delete(pulseMentalCheckins).where(eq(pulseMentalCheckins.userId, userId));
  }
  await db.delete(users).where(eq(users.email, 'pulse-test@coaching.os'));
  await app.close();
});

beforeEach(async () => {
  await db.delete(pulsePlannedWorkouts).where(eq(pulsePlannedWorkouts.userId, userId));
  await db.delete(pulseUserProfile).where(eq(pulseUserProfile.userId, userId));
  await db.delete(pulseCoachSessions).where(eq(pulseCoachSessions.userId, userId));
  await db.delete(pulseMentalCheckins).where(eq(pulseMentalCheckins.userId, userId));
  await invalidateUser(userId);
  vi.mocked(llmChat).mockReset().mockResolvedValue('Heute locker bleiben: 45 Minuten Zone 2 reichen.');
  vi.mocked(llmComplete).mockReset().mockResolvedValue('[{"index":0,"description":"Test-Workout"}]');
  vi.mocked(transcribeAudio).mockReset().mockResolvedValue('Ich bin heute muede und gestresst.');
  garminMocks.addWorkout.mockReset().mockResolvedValue({ workoutId: 12345 });
  garminMocks.post.mockReset().mockResolvedValue({ workoutScheduleId: 67890 });
  garminMocks.get.mockReset().mockResolvedValue({ calendarItems: [] });
  garminMocks.delete.mockReset().mockResolvedValue(undefined);
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

describe('GET /api/pulse/briefing', () => {
  it('builds live briefings from the shared rich PulseContext prompt', async () => {
    const today = new Date().toISOString().split('T')[0]!;
    await db.insert(pulseMentalCheckins).values({
      userId,
      date: today,
      mood: 6,
      energy: 5,
      stress: 7,
      motivation: 6,
      notes: 'Schlecht geschlafen',
    });
    vi.mocked(llmComplete).mockResolvedValueOnce('Briefing aus PulseContext.');

    const res = await app.inject({
      method: 'GET', url: '/api/pulse/briefing',
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json<{ briefing: string }>().briefing).toBe('Briefing aus PulseContext.');

    const systemPrompt = vi.mocked(llmComplete).mock.calls[0]?.[0] ?? '';
    const userContent = vi.mocked(llmComplete).mock.calls[0]?.[1] ?? '';
    expect(systemPrompt).toContain('Risk-Signal critical');
    expect(userContent).toContain('RISIKO-SIGNALE');
    expect(userContent).toContain('Readiness');
    expect(userContent).toContain('Trainingslast');
    expect(userContent).toContain('Tobis Check-in: Stimmung 6/10');
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

describe('GET/DELETE /api/pulse/coach/history', () => {
  it('returns 401 without token', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/pulse/coach/history' });
    expect(res.statusCode).toBe(401);
  });

  it('returns an empty history for a fresh user', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/pulse/coach/history',
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json<{ messages: unknown[] }>().messages).toEqual([]);
  });

  it('returns Pulse coach messages after sending one and clears them on delete', async () => {
    await app.inject({
      method: 'POST', url: '/api/pulse/coach',
      payload: { message: 'Hallo Coach' },
      headers: { Authorization: `Bearer ${token}` },
    });

    const history = await app.inject({
      method: 'GET', url: '/api/pulse/coach/history',
      headers: { Authorization: `Bearer ${token}` },
    });
    const messages = history.json<{ messages: Array<{ role: string; content: string; timestamp: string }> }>().messages;
    expect(messages).toHaveLength(2);
    expect(messages[0]!.role).toBe('user');
    expect(messages[1]!.role).toBe('assistant');
    expect(messages[0]!.timestamp).toEqual(expect.any(String));

    const del = await app.inject({
      method: 'DELETE', url: '/api/pulse/coach/history',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(del.statusCode).toBe(204);

    const empty = await app.inject({
      method: 'GET', url: '/api/pulse/coach/history',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(empty.json<{ messages: unknown[] }>().messages).toEqual([]);
  });
});

describe('POST /api/pulse/checkin/voice', () => {
  it('generates the final reply from fresh PulseContext after persisting the check-in', async () => {
    vi.mocked(transcribeAudio).mockResolvedValueOnce('Ich bin heute muede, Energie niedrig, Stress hoch.');
    vi.mocked(llmComplete).mockResolvedValueOnce(JSON.stringify({
      isCheckin: true,
      extraction: {
        mood: 4,
        energy: 3,
        stress: 8,
        motivation: 5,
        themes: ['Muedigkeit', 'Arbeit'],
        followUpQuestions: ['Seit wann ist die Muedigkeit so stark?'],
      },
      coachReply: 'Vorlaeufige Klassifikationsantwort.',
    }));
    vi.mocked(llmChat).mockResolvedValueOnce('Frische Coach-Antwort nach Check-in.');

    const res = await app.inject({
      method: 'POST', url: '/api/pulse/checkin/voice',
      payload: { audio: 'ZmFrZQ==', mimeType: 'audio/webm' },
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<{ reply: string; isCheckin: boolean; checkinId: string | null }>();
    expect(body.isCheckin).toBe(true);
    expect(body.checkinId).toEqual(expect.any(String));
    expect(body.reply).toBe('Frische Coach-Antwort nach Check-in.');

    const [checkin] = await db.select().from(pulseMentalCheckins).where(eq(pulseMentalCheckins.userId, userId));
    expect(checkin).toMatchObject({ mood: 4, energy: 3, stress: 8, motivation: 5, source: 'voice' });

    const systemPrompt = vi.mocked(llmChat).mock.calls[0]?.[0]?.[0]?.content ?? '';
    expect(systemPrompt).toContain('Check-in: Stimmung 4/10 Energie 3/10 Stress 8/10 Motivation 5/10');

    const history = await app.inject({
      method: 'GET', url: '/api/pulse/coach/history',
      headers: { Authorization: `Bearer ${token}` },
    });
    const messages = history.json<{ messages: Array<{ role: string; content: string }> }>().messages;
    expect(messages.at(-1)).toMatchObject({ role: 'assistant', content: 'Frische Coach-Antwort nach Check-in.' });
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

describe('POST /api/pulse/plan/workout/:id/detail', () => {
  it('adds deterministic HR targets to generated endurance steps', async () => {
    await db.insert(pulseUserProfile).values({
      userId,
      ftpWatts: 250,
      maxHrBpm: 185,
      lthrBpm: 170,
      updatedAt: new Date(),
    });
    const [workout] = await db.insert(pulsePlannedWorkouts).values({
      userId,
      plannedDate: '2026-05-04',
      activityType: 'bike',
      zone: 2,
      durationMin: 60,
      targetTss: 50,
      description: 'Z2 Grundlage',
    }).returning();
    vi.mocked(llmComplete).mockResolvedValueOnce(JSON.stringify({
      steps: [
        { type: 'warmup', durationMin: 10, zone: 1, description: 'Einrollen' },
        { type: 'steady', durationMin: 40, zone: 2, description: 'Locker aerober Block' },
        { type: 'cooldown', durationMin: 10, zone: 1, description: 'Ausschwingen' },
      ],
      coachingNote: 'Sauber nach Puls fahren.',
    }));

    const res = await app.inject({
      method: 'POST',
      url: `/api/pulse/plan/workout/${workout!.id}/detail`,
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const steps = res.json<{ workout: { steps: Array<{ targetHrMinBpm?: number; targetHrMaxBpm?: number; targetLabel?: string; description?: string }> } }>().workout.steps;
    expect(steps[0]).toMatchObject({ targetHrMaxBpm: 138, targetLabel: '<138 bpm' });
    expect(steps[1]).toMatchObject({ targetHrMinBpm: 139, targetHrMaxBpm: 150, targetLabel: '139-150 bpm' });
    expect(steps[1]!.description).toContain('HR 139-150 bpm');
  });
});

describe('POST /api/pulse/plan/workout/:id/sync-garmin', () => {
  it('uploads run and bike steps with Garmin heart-rate zone targets', async () => {
    const [workout] = await db.insert(pulsePlannedWorkouts).values({
      userId,
      plannedDate: '2026-05-04',
      activityType: 'run',
      zone: 2,
      durationMin: 50,
      targetTss: 45,
      description: 'HR-first Lauf',
      steps: [
        { type: 'warmup', durationMin: 10, zone: 1, description: 'Einlaufen', targetHrMaxBpm: 138, targetLabel: '<138 bpm' },
        { type: 'steady', durationMin: 30, zone: 2, description: 'Aerob', targetHrMinBpm: 139, targetHrMaxBpm: 150, targetLabel: '139-150 bpm' },
        { type: 'cooldown', durationMin: 10, zone: 1, description: 'Auslaufen', targetHrMaxBpm: 138, targetLabel: '<138 bpm' },
      ],
    }).returning();

    const res = await app.inject({
      method: 'POST',
      url: `/api/pulse/plan/workout/${workout!.id}/sync-garmin`,
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(garminMocks.addWorkout).toHaveBeenCalledTimes(1);
    const payload = garminMocks.addWorkout.mock.calls[0]![0] as {
      workoutSegments: Array<{ workoutSteps: Array<{ targetType: { workoutTargetTypeKey: string }; zoneNumber: number | null }> }>;
    };
    const steps = payload.workoutSegments[0]!.workoutSteps;
    expect(steps.map(s => s.targetType.workoutTargetTypeKey)).toEqual([
      'heart.rate.zone',
      'heart.rate.zone',
      'heart.rate.zone',
    ]);
    expect(steps.map(s => s.zoneNumber)).toEqual([1, 2, 1]);
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
