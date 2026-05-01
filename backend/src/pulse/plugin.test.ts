import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { buildApp } from '../app.js';
import { db } from '../lib/db.js';
import { users } from '../db/schema.js';
import {
  pulseActivities,
  pulseCoachSessions,
  pulseDailyMetrics,
  pulseMentalCheckins,
  pulsePlanGenerations,
  pulsePlannedWorkouts,
  pulsePushSubscriptions,
  pulseSleepSessions,
  pulseUserProfile,
  pulseWeightLog,
} from '../db/pulse-schema.js';
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

const pushMocks = vi.hoisted(() => ({
  isPushConfigured: vi.fn(),
  sendPushToUser: vi.fn(),
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

vi.mock('../lib/push.js', () => ({
  isPushConfigured: pushMocks.isPushConfigured,
  normalizePushTopics: (value: unknown) => {
    const raw = typeof value === 'object' && value != null
      ? value as { briefing?: boolean; checkin_reminder?: boolean; risk_critical?: boolean }
      : {};
    return {
      briefing: raw.briefing ?? true,
      checkin_reminder: raw.checkin_reminder ?? true,
      risk_critical: raw.risk_critical ?? true,
    };
  },
  sendPushToUser: pushMocks.sendPushToUser,
}));

let app: FastifyInstance;
let token: string;
let userId: string;

function dateDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split('T')[0]!;
}

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
    await db.delete(pulseWeightLog).where(eq(pulseWeightLog.userId, userId));
    await db.delete(pulseActivities).where(eq(pulseActivities.userId, userId));
    await db.delete(pulseSleepSessions).where(eq(pulseSleepSessions.userId, userId));
    await db.delete(pulseDailyMetrics).where(eq(pulseDailyMetrics.userId, userId));
    await db.delete(pulsePlanGenerations).where(eq(pulsePlanGenerations.userId, userId));
    await db.delete(pulsePlannedWorkouts).where(eq(pulsePlannedWorkouts.userId, userId));
    await db.delete(pulsePushSubscriptions).where(eq(pulsePushSubscriptions.userId, userId));
    await db.delete(pulseUserProfile).where(eq(pulseUserProfile.userId, userId));
    await db.delete(pulseCoachSessions).where(eq(pulseCoachSessions.userId, userId));
    await db.delete(pulseMentalCheckins).where(eq(pulseMentalCheckins.userId, userId));
  }
  await db.delete(users).where(eq(users.email, 'pulse-test@coaching.os'));
  await app.close();
});

beforeEach(async () => {
  await db.delete(pulseWeightLog).where(eq(pulseWeightLog.userId, userId));
  await db.delete(pulseActivities).where(eq(pulseActivities.userId, userId));
  await db.delete(pulseSleepSessions).where(eq(pulseSleepSessions.userId, userId));
  await db.delete(pulseDailyMetrics).where(eq(pulseDailyMetrics.userId, userId));
  await db.delete(pulsePlanGenerations).where(eq(pulsePlanGenerations.userId, userId));
  await db.delete(pulsePlannedWorkouts).where(eq(pulsePlannedWorkouts.userId, userId));
  await db.delete(pulsePushSubscriptions).where(eq(pulsePushSubscriptions.userId, userId));
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
  pushMocks.isPushConfigured.mockReset().mockReturnValue(true);
  pushMocks.sendPushToUser.mockReset().mockResolvedValue({ sent: 1, failed: 0, gone: 0, skipped: 0 });
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
    const body = res.json<{ date: string; readiness: { score: number }; nextBestActions: unknown[] }>();
    expect(body).toHaveProperty('date');
    expect(body).toHaveProperty('readiness');
    expect(body.readiness).toHaveProperty('score');
    expect(Array.isArray(body.nextBestActions)).toBe(true);
  });
});

describe('Web Push settings', () => {
  const subscriptionPayload = {
    endpoint: 'https://push.example.test/sub/abc',
    keys: { p256dh: 'p256dh-key', auth: 'auth-key' },
    deviceLabel: 'Vitest Browser',
  };

  it('requires auth for push settings', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/pulse/push/settings' });
    expect(res.statusCode).toBe(401);
  });

  it('upserts and lists push subscriptions scoped to the user', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/api/pulse/push/subscribe',
      headers: { Authorization: `Bearer ${token}` },
      payload: subscriptionPayload,
    });
    expect(create.statusCode).toBe(201);

    const update = await app.inject({
      method: 'POST',
      url: '/api/pulse/push/subscribe',
      headers: { Authorization: `Bearer ${token}` },
      payload: { ...subscriptionPayload, deviceLabel: 'Mac Safari' },
    });
    expect(update.statusCode).toBe(201);

    const settings = await app.inject({
      method: 'GET',
      url: '/api/pulse/push/settings',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(settings.statusCode).toBe(200);
    const body = settings.json<{ subscriptions: Array<{ endpoint: string; deviceLabel: string }>; topics: Record<string, boolean>; quietHours: { start: string; end: string }; configured: boolean }>();
    expect(body.configured).toBe(true);
    expect(body.topics).toMatchObject({ briefing: true, checkin_reminder: true, risk_critical: true });
    expect(body.quietHours).toEqual({ start: '22:00', end: '06:30' });
    expect(body.subscriptions).toHaveLength(1);
    expect(body.subscriptions[0]).toMatchObject({ endpoint: subscriptionPayload.endpoint, deviceLabel: 'Mac Safari' });
  });

  it('updates topics and quiet hours', async () => {
    const topics = await app.inject({
      method: 'PATCH',
      url: '/api/pulse/push/topics',
      headers: { Authorization: `Bearer ${token}` },
      payload: { briefing: false },
    });
    expect(topics.statusCode).toBe(200);
    expect(topics.json()).toMatchObject({ briefing: false, checkin_reminder: true, risk_critical: true });

    const quiet = await app.inject({
      method: 'PATCH',
      url: '/api/pulse/push/quiet-hours',
      headers: { Authorization: `Bearer ${token}` },
      payload: { start: '21:15', end: '06:45' },
    });
    expect(quiet.statusCode).toBe(200);
    expect(quiet.json()).toEqual({ start: '21:15', end: '06:45' });
  });

  it('sends test pushes only when VAPID is configured', async () => {
    const ok = await app.inject({
      method: 'POST',
      url: '/api/pulse/push/test',
      headers: { Authorization: `Bearer ${token}` },
      payload: {},
    });
    expect(ok.statusCode).toBe(200);
    expect(pushMocks.sendPushToUser).toHaveBeenCalledWith(userId, expect.objectContaining({
      topic: 'briefing',
      tag: 'pulse-test',
    }));

    pushMocks.isPushConfigured.mockReturnValueOnce(false);
    const missing = await app.inject({
      method: 'POST',
      url: '/api/pulse/push/test',
      headers: { Authorization: `Bearer ${token}` },
      payload: {},
    });
    expect(missing.statusCode).toBe(503);
  });

  it('deletes push subscriptions by endpoint', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/pulse/push/subscribe',
      headers: { Authorization: `Bearer ${token}` },
      payload: subscriptionPayload,
    });

    const del = await app.inject({
      method: 'DELETE',
      url: '/api/pulse/push/subscribe',
      headers: { Authorization: `Bearer ${token}` },
      payload: { endpoint: subscriptionPayload.endpoint },
    });
    expect(del.statusCode).toBe(204);

    const settings = await app.inject({
      method: 'GET',
      url: '/api/pulse/push/settings',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(settings.json<{ subscriptions: unknown[] }>().subscriptions).toHaveLength(0);
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

describe('GET /api/pulse/mental/themes', () => {
  it('aggregates recurring themes and deduplicates theme variants per check-in', async () => {
    await db.insert(pulseMentalCheckins).values([
      {
        userId,
        date: dateDaysAgo(1),
        mood: 5,
        energy: 5,
        stress: 8,
        motivation: 4,
        notes: 'Arbeit doppelt genannt.',
        themes: ['Work-Stress', 'work-stress', '  WORK-STRESS  '],
        source: 'voice',
      },
      {
        userId,
        date: dateDaysAgo(3),
        mood: 6,
        energy: 6,
        stress: 6,
        motivation: 6,
        notes: 'Arbeit taucht erneut auf.',
        themes: ['work-stress', 'schlaf'],
        source: 'voice',
      },
      {
        userId,
        date: dateDaysAgo(6),
        mood: 7,
        energy: 7,
        stress: 3,
        motivation: 7,
        notes: 'Ein einzelnes Thema.',
        themes: ['einmalig'],
        source: 'voice',
      },
    ]);

    const res = await app.inject({
      method: 'GET',
      url: '/api/pulse/mental/themes?days=90',
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<{
      totalCheckins: number;
      themes: Array<{
        theme: string;
        count: number;
        isResurfacing: boolean;
        occurrences: Array<{ id: string; notes: string | null }>;
      }>;
    }>();

    expect(body.totalCheckins).toBe(3);
    expect(body.themes).toHaveLength(1);
    expect(body.themes[0]).toMatchObject({
      theme: 'work-stress',
      count: 2,
      isResurfacing: true,
    });
    expect(body.themes[0]!.occurrences).toHaveLength(2);
    expect(body.themes[0]!.occurrences.map((occurrence) => occurrence.notes)).toEqual([
      'Arbeit taucht erneut auf.',
      'Arbeit doppelt genannt.',
    ]);
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

describe('GET /api/pulse/data-coverage', () => {
  it('reports daily domain coverage and profile gaps', async () => {
    const yesterday = dateDaysAgo(1);
    await db.insert(pulseDailyMetrics).values({
      userId,
      date: yesterday,
      hrvRmssd: 42,
      restingHr: 48,
      sleepHours: 7.2,
      bodyBatteryMax: 86,
      stressAvg: 21,
      steps: 11_200,
      source: 'garmin',
      syncedAt: new Date(),
    });
    await db.insert(pulseSleepSessions).values({
      userId,
      date: yesterday,
      durationH: 7.2,
      deepSleepH: 1.1,
      remSleepH: 1.4,
      lightSleepH: 4.3,
      awakeH: 0.4,
      source: 'garmin',
    });
    await db.insert(pulseActivities).values({
      userId,
      startTime: new Date(`${yesterday}T08:00:00.000Z`),
      activityType: 'run',
      durationSec: 2400,
      weather: { tempC: 12 },
    });
    await db.insert(pulseWeightLog).values({
      userId,
      date: yesterday,
      weightKg: 78.4,
      source: 'garmin',
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/pulse/data-coverage?days=2',
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<{
      range: { days: number };
      summary: { dailyMetricsDays: number; sleepDays: number; activities: number; weatherActivities: number; weightDays: number };
      profile: { missing: string[] };
      days: Array<{ date: string; dailyMetrics: { status: string }; activities: { count: number; weatherCount: number } }>;
    }>();
    expect(body.range.days).toBe(2);
    expect(body.summary).toMatchObject({
      dailyMetricsDays: 1,
      sleepDays: 1,
      activities: 1,
      weatherActivities: 1,
      weightDays: 1,
    });
    expect(body.profile.missing).toContain('ftpWatts');
    expect(body.days.find(day => day.date === yesterday)).toMatchObject({
      dailyMetrics: { status: 'present' },
      activities: { count: 1, weatherCount: 1 },
    });
  });
});

describe('POST /api/pulse/garmin/backfill', () => {
  it('previews bounded backfill days without calling Garmin', async () => {
    const from = dateDaysAgo(3);
    const to = dateDaysAgo(1);
    const res = await app.inject({
      method: 'POST',
      url: '/api/pulse/garmin/backfill',
      headers: { Authorization: `Bearer ${token}` },
      payload: { from, to, dryRun: true },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<{
      dryRun: boolean;
      range: { days: number };
      summary: { planned: number; synced: number; failed: number };
      days: Array<{ status: string; reason: string | null }>;
    }>();
    expect(body.dryRun).toBe(true);
    expect(body.range.days).toBe(3);
    expect(body.summary.planned).toBe(3);
    expect(body.summary.synced).toBe(0);
    expect(body.summary.failed).toBe(0);
    expect(body.days.every(day => day.status === 'planned')).toBe(true);
    expect(body.days[0]?.reason).toContain('not_synced');
  });

  it('rejects ranges over 31 days and future dates', async () => {
    const tooLong = await app.inject({
      method: 'POST',
      url: '/api/pulse/garmin/backfill',
      headers: { Authorization: `Bearer ${token}` },
      payload: { from: dateDaysAgo(40), to: dateDaysAgo(1), dryRun: true },
    });
    expect(tooLong.statusCode).toBe(400);

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const future = await app.inject({
      method: 'POST',
      url: '/api/pulse/garmin/backfill',
      headers: { Authorization: `Bearer ${token}` },
      payload: { from: dateDaysAgo(1), to: tomorrow.toISOString().split('T')[0]!, dryRun: true },
    });
    expect(future.statusCode).toBe(400);
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
  it('generates workouts and returns a persisted trace', async () => {
    await db.insert(pulseUserProfile).values({
      userId,
      ftpWatts: 260,
      maxHrBpm: 186,
      lthrBpm: 172,
      weeklyHoursTarget: 7,
      updatedAt: new Date(),
    });

    const res = await app.inject({
      method: 'POST', url: '/api/pulse/plan/generate',
      headers: { Authorization: `Bearer ${token}` },
      payload: { weekStart: '2026-05-04' },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json<{
      workouts: unknown[];
      planDecision: { targetSessionCount: number; selectedDays: number[] };
      planTrace: {
        id: string;
        weekStart: string;
        inputSnapshot: { weeklyHoursTarget: number; profile: { maxHrBpm: number | null }; dataWarnings: string[] };
        sportMix: Record<string, { sessions: number }>;
      };
    }>();
    expect(body.workouts.length).toBeGreaterThan(0);
    expect(body.planTrace).toMatchObject({
      weekStart: '2026-05-04',
      inputSnapshot: {
        weeklyHoursTarget: 7,
        profile: { maxHrBpm: 186 },
      },
    });
    expect(body.planTrace.inputSnapshot.dataWarnings).toContain('Kein aktives Ziel hinterlegt.');
    expect(Object.keys(body.planTrace.sportMix).length).toBeGreaterThan(0);

    const [persisted] = await db.select()
      .from(pulsePlanGenerations)
      .where(eq(pulsePlanGenerations.userId, userId));
    expect(persisted?.id).toBe(body.planTrace.id);
    expect(persisted?.planDecision).toMatchObject({ targetSessionCount: body.planDecision.targetSessionCount });

    const traceRes = await app.inject({
      method: 'GET',
      url: '/api/pulse/plan/trace/2026-05-04',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(traceRes.statusCode).toBe(200);
    expect(traceRes.json<{ trace: { id: string; weekStart: string } }>().trace).toMatchObject({
      id: body.planTrace.id,
      weekStart: '2026-05-04',
    });
  });

  it('includes previous-week learning in the persisted trace', async () => {
    await db.insert(pulseUserProfile).values({
      userId,
      ftpWatts: 260,
      maxHrBpm: 186,
      weeklyHoursTarget: 8,
      updatedAt: new Date(),
    });
    await db.insert(pulsePlannedWorkouts).values({
      userId,
      plannedDate: '2026-04-28',
      activityType: 'bike',
      zone: 4,
      durationMin: 60,
      targetTss: 80,
      status: 'completed',
      complianceScore: 0.55,
      description: 'Vorwochenreiz',
    });
    await db.insert(pulsePlanGenerations).values({
      userId,
      weekStart: '2026-04-27',
      inputSnapshot: {
        phase: 'build',
        mesocycleWeek: 1,
        weeklyHoursTarget: 8,
        availableDays: [0, 1, 3, 5],
        load: { ctl: 35, atl: 32, tsb: 3, date: '2026-04-27' },
        profile: { ftpWatts: 260, maxHrBpm: 186, lthrBpm: null },
        goals: [],
        riskSignals: [],
        healthStates: [],
        recentRpe: [],
        rpeReasons: [],
        dataWarnings: [],
        recentSportMix: { bike: { sessions: 2, totalMinutes: 120, totalTss: 120 } },
      },
      planDecision: {
        selectedDays: [0, 1, 3, 5],
        skippedAvailableDays: [6],
        targetSessionCount: 4,
        primaryGoal: 'ftp',
        reasons: [],
      },
      sportMix: { bike: { sessions: 4, totalMinutes: 240, totalTss: 260 } },
      hardDays: [{ date: '2026-04-28', activityType: 'bike', zone: 4, durationMin: 60 }],
      generatedSummary: ['Vorwoche'],
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/pulse/plan/generate',
      headers: { Authorization: `Bearer ${token}` },
      payload: { weekStart: '2026-05-04' },
    });

    expect(res.statusCode).toBe(201);
    const learning = res.json<{
      planTrace: {
        inputSnapshot: {
          learningSnapshot: {
            previousWeek: { weekStart: string; avgComplianceScore: number | null } | null;
            learnedFromLastWeek: string[];
            variationComparedToLastWeek: string[];
            flags: string[];
          };
        };
      };
    }>().planTrace.inputSnapshot.learningSnapshot;
    expect(learning.previousWeek).toMatchObject({ weekStart: '2026-04-27', avgComplianceScore: 0.55 });
    expect(learning.flags).toContain('low_compliance');
    expect(learning.learnedFromLastWeek.join(' ')).toContain('Compliance');
    expect(learning.variationComparedToLastWeek.length).toBeGreaterThan(0);
  });
});

describe('PATCH /api/pulse/plan/workout/:id', () => {
  it('preserves generated steps for schedule/status alternatives and recalculates TSS for prescription changes', async () => {
    const [workout] = await db.insert(pulsePlannedWorkouts).values({
      userId,
      plannedDate: '2026-05-04',
      activityType: 'bike',
      zone: 4,
      durationMin: 90,
      targetTss: 130,
      description: 'Schwellenintervalle',
      steps: [{ type: 'steady', durationMin: 90, zone: 4, description: 'Original' }],
    }).returning();

    const moved = await app.inject({
      method: 'PATCH',
      url: `/api/pulse/plan/workout/${workout!.id}`,
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        plannedDate: '2026-05-05',
        status: 'planned',
        description: 'Alternative: verschoben',
      },
    });

    expect(moved.statusCode).toBe(200);
    const movedWorkout = moved.json<{ workout: { plannedDate: string; steps: unknown[] | null; targetTss: number | null } }>().workout;
    expect(movedWorkout.plannedDate).toBe('2026-05-05');
    expect(movedWorkout.steps).toEqual([{ type: 'steady', durationMin: 90, zone: 4, description: 'Original' }]);
    expect(movedWorkout.targetTss).toBe(130);

    const easier = await app.inject({
      method: 'PATCH',
      url: `/api/pulse/plan/workout/${workout!.id}`,
      headers: { Authorization: `Bearer ${token}` },
      payload: { zone: 2, durationMin: 75 },
    });

    expect(easier.statusCode).toBe(200);
    const easierWorkout = easier.json<{ workout: { zone: number; durationMin: number; steps: unknown[] | null; targetTss: number | null } }>().workout;
    expect(easierWorkout.zone).toBe(2);
    expect(easierWorkout.durationMin).toBe(75);
    expect(easierWorkout.steps).toBeNull();
    expect(easierWorkout.targetTss).toBe(61);
  });

  it('rejects empty updates and impossible planned dates', async () => {
    const [workout] = await db.insert(pulsePlannedWorkouts).values({
      userId,
      plannedDate: '2026-05-04',
      activityType: 'run',
      zone: 2,
      durationMin: 45,
      targetTss: 37,
    }).returning();

    const empty = await app.inject({
      method: 'PATCH',
      url: `/api/pulse/plan/workout/${workout!.id}`,
      headers: { Authorization: `Bearer ${token}` },
      payload: {},
    });
    expect(empty.statusCode).toBe(400);

    const invalidDate = await app.inject({
      method: 'PATCH',
      url: `/api/pulse/plan/workout/${workout!.id}`,
      headers: { Authorization: `Bearer ${token}` },
      payload: { plannedDate: '2026-02-31' },
    });
    expect(invalidDate.statusCode).toBe(400);
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
