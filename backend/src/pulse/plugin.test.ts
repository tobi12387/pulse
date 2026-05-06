import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { buildApp } from '../app.js';
import { db } from '../lib/db.js';
import { users } from '../db/schema.js';
import {
  pulseActivities,
  pulseActionDecisions,
  pulseCoachPreferences,
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
  getActivities: vi.fn(),
  getUserSettings: vi.fn(),
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
  garminApi: {
    getDailyUserSummary: vi.fn((gc: any, displayName: string, date: string) =>
      gc.client.get(`https://connectapi.garmin.com/usersummary-service/usersummary/daily/${encodeURIComponent(displayName)}?calendarDate=${date}`)),
    getActivitySplits: vi.fn((gc: any, activityId: string) =>
      gc.get(`https://connectapi.garmin.com/activity-service/activity/${activityId}/splits`)),
    getActivityHrTimeInZones: vi.fn((gc: any, activityId: string) =>
      gc.get(`https://connectapi.garmin.com/activity-service/activity/${activityId}/hrTimeInZones`)),
    scheduleWorkout: vi.fn((gc: any, workoutId: string, date: string) =>
      gc.client.post(`https://connectapi.garmin.com/workout-service/schedule/${workoutId}`, { date })),
    getWorkout: vi.fn((gc: any, workoutId: string) =>
      gc.client.get(`https://connectapi.garmin.com/workout-service/workout/${workoutId}`)),
    deleteWorkout: vi.fn((gc: any, workoutId: string) =>
      gc.client.delete(`https://connectapi.garmin.com/workout-service/workout/${workoutId}`)),
    deleteWorkoutSchedule: vi.fn((gc: any, scheduleId: string) =>
      gc.client.delete(`https://connectapi.garmin.com/workout-service/schedule/${scheduleId}`)),
    getCalendarMonth: vi.fn((gc: any, year: number, month: number) =>
      gc.client.get(`https://connectapi.garmin.com/calendar-service/year/${year}/month/${month}`)),
  },
  getGarminClient: vi.fn().mockResolvedValue({
    addWorkout: garminMocks.addWorkout,
    getActivities: garminMocks.getActivities,
    getUserSettings: garminMocks.getUserSettings,
    get: garminMocks.get,
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

function dateDaysFrom(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
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
    await db.delete(pulseActionDecisions).where(eq(pulseActionDecisions.userId, userId));
    await db.delete(pulseCoachPreferences).where(eq(pulseCoachPreferences.userId, userId));
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
  await db.delete(pulseActionDecisions).where(eq(pulseActionDecisions.userId, userId));
  await db.delete(pulseCoachPreferences).where(eq(pulseCoachPreferences.userId, userId));
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
  garminMocks.getActivities.mockReset().mockResolvedValue([]);
  garminMocks.getUserSettings.mockReset().mockResolvedValue({ userData: {} });
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

  it('exposes completed planned training for today and skips it as the next workout', async () => {
    const today = dateDaysAgo(0);
    const tomorrow = dateDaysFrom(1);
    const [activity] = await db.insert(pulseActivities).values({
      userId,
      externalId: 'home-completed-planned-training',
      source: 'garmin',
      startTime: new Date(`${today}T08:00:00.000Z`),
      activityType: 'bike',
      name: 'Grundlage draussen',
      durationSec: 4_800,
      tss: 65,
    }).returning({ id: pulseActivities.id });

    await db.insert(pulsePlannedWorkouts).values([
      {
        userId,
        plannedDate: today,
        activityType: 'bike',
        zone: 2,
        durationMin: 80,
        targetTss: 65,
        status: 'planned',
        garminWorkoutId: 'home-garmin-workout',
        garminScheduledId: 'home-garmin-scheduled',
      },
      {
        userId,
        plannedDate: tomorrow,
        activityType: 'run',
        zone: 2,
        durationMin: 45,
        targetTss: 40,
        status: 'planned',
      },
    ]);

    const res = await app.inject({
      method: 'GET',
      url: '/api/pulse/home',
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<{
      todayWorkout: { completedActivityId: string | null; executionStatus: string | null; executionMatchConfidence: number | null } | null;
      nextWorkout: { plannedDate: string; activityType: string } | null;
    }>();
    expect(body.todayWorkout).toMatchObject({
      completedActivityId: activity!.id,
      executionStatus: 'completed_matched',
    });
    expect(body.todayWorkout?.executionMatchConfidence).toBeGreaterThanOrEqual(0.8);
    expect(body.nextWorkout).toMatchObject({
      plannedDate: tomorrow,
      activityType: 'run',
    });
  });
});

describe('Pulse action closure', () => {
  it('returns current actions with persisted open decision ids', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/pulse/actions',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<{ actions: Array<{ id: string; decisionId: string; status: string; title: string }> }>();
    expect(body.actions[0]).toMatchObject({
      source: 'checkin',
      status: 'open',
      title: 'Check-in eintragen',
    });
    expect(body.actions[0]!.decisionId).toMatch(/[0-9a-f-]{36}/);

    const rows = await db.select().from(pulseActionDecisions).where(eq(pulseActionDecisions.userId, userId));
    expect(rows).toHaveLength(body.actions.length);
    expect(rows[0]).toMatchObject({
      source: 'next_best_action',
      status: 'open',
      title: body.actions[0]!.title,
    });
  });

  it('closes an action and suppresses it from the next home payload', async () => {
    const actionRes = await app.inject({
      method: 'GET',
      url: '/api/pulse/actions',
      headers: { authorization: `Bearer ${token}` },
    });
    const action = actionRes.json<{ actions: Array<{ decisionId: string; source: string }> }>().actions
      .find(candidate => candidate.source === 'checkin')!;

    const patchRes = await app.inject({
      method: 'PATCH',
      url: `/api/pulse/actions/${action.decisionId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { status: 'completed', reason: 'Heute erledigt.' },
    });

    expect(patchRes.statusCode).toBe(200);
    expect(patchRes.json()).toMatchObject({
      decision: {
        id: action.decisionId,
        status: 'completed',
        resolutionReason: 'Heute erledigt.',
      },
    });

    const homeRes = await app.inject({
      method: 'GET',
      url: '/api/pulse/home',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(homeRes.statusCode).toBe(200);
    expect(homeRes.json<{ nextBestActions: Array<{ source: string }> }>().nextBestActions)
      .not.toContainEqual(expect.objectContaining({ source: 'checkin' }));
  });

  it('returns hidden action reasons and recent decisions when history is requested', async () => {
    const actionRes = await app.inject({
      method: 'GET',
      url: '/api/pulse/actions',
      headers: { authorization: `Bearer ${token}` },
    });
    const action = actionRes.json<{ actions: Array<{ decisionId: string; source: string }> }>().actions
      .find(candidate => candidate.source === 'checkin')!;

    await app.inject({
      method: 'PATCH',
      url: `/api/pulse/actions/${action.decisionId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { status: 'completed', reason: 'Heute erledigt.' },
    });

    const historyRes = await app.inject({
      method: 'GET',
      url: '/api/pulse/actions?includeHistory=true',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(historyRes.statusCode).toBe(200);
    const body = historyRes.json<{
      actions: Array<{ source: string }>;
      suppressed: Array<{ source: string; suppressedReason: string; decisionId: string | null }>;
      recentDecisions: Array<{ decisionId: string; status: string; resolutionReason: string | null }>;
    }>();
    expect(body.actions).not.toContainEqual(expect.objectContaining({ source: 'checkin' }));
    expect(body.suppressed).toContainEqual(expect.objectContaining({
      source: 'checkin',
      suppressedReason: 'already_completed_today',
      decisionId: action.decisionId,
    }));
    expect(body.recentDecisions).toContainEqual(expect.objectContaining({
      decisionId: action.decisionId,
      status: 'completed',
      resolutionReason: 'Heute erledigt.',
    }));
  });
});

describe('Daily outcome learning', () => {
  it('returns deterministic learning items from closed actions and follow-up data', async () => {
    const yesterday = dateDaysAgo(1);
    await db.insert(pulseActionDecisions).values({
      userId,
      source: 'next_best_action',
      sourceId: 'checkin',
      kind: 'checkin',
      title: 'Check-in eintragen',
      status: 'completed',
      targetRoute: '/data',
      createdAt: new Date(`${yesterday}T07:00:00.000Z`),
      resolvedAt: new Date(`${yesterday}T08:00:00.000Z`),
      resolutionReason: 'Erledigt.',
    });
    await db.insert(pulseMentalCheckins).values({
      userId,
      date: yesterday,
      mood: 7,
      energy: 6,
      stress: 4,
      motivation: 8,
      source: 'text',
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/pulse/outcomes/daily?days=7',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<{ items: Array<{ date: string; status: string; actionTitle: string; evidence: string[] }> }>();
    expect(body.items[0]).toMatchObject({
      date: yesterday,
      status: 'reinforced',
      actionTitle: 'Check-in eintragen',
    });
    expect(body.items[0]!.evidence).toContain('Check-in am selben Tag vorhanden');
  });
});

describe('Daily decision quality', () => {
  it('returns a read-only quality signal from closed actions, outcomes and Garmin metrics', async () => {
    const yesterday = dateDaysAgo(1);
    const today = dateDaysAgo(0);
    await db.insert(pulseActionDecisions).values({
      userId,
      source: 'next_best_action',
      sourceId: 'checkin',
      kind: 'checkin',
      title: 'Check-in eintragen',
      status: 'completed',
      targetRoute: '/data',
      createdAt: new Date(`${yesterday}T07:00:00.000Z`),
      resolvedAt: new Date(`${yesterday}T08:00:00.000Z`),
      resolutionReason: 'Erledigt.',
    });
    await db.insert(pulseMentalCheckins).values([
      { userId, date: yesterday, mood: 7, energy: 6, stress: 4, motivation: 8, source: 'text' },
      { userId, date: today, mood: 7, energy: 7, stress: 3, motivation: 8, source: 'text' },
    ]);
    await db.insert(pulseDailyMetrics).values([
      { userId, date: yesterday, sleepHours: 7.3, hrvStatus: 'normal', bodyBatteryMax: 68, bodyBatteryAtWake: 55, stressAvg: 36 },
      { userId, date: today, sleepHours: 7.5, hrvStatus: 'normal', bodyBatteryMax: 73, bodyBatteryAtWake: 60, stressAvg: 32 },
    ]);

    const beforeRows = await db.select().from(pulseActionDecisions).where(eq(pulseActionDecisions.userId, userId));
    const res = await app.inject({
      method: 'GET',
      url: '/api/pulse/decisions/quality?days=7',
      headers: { authorization: `Bearer ${token}` },
    });
    const afterRows = await db.select().from(pulseActionDecisions).where(eq(pulseActionDecisions.userId, userId));

    expect(res.statusCode).toBe(200);
    const body = res.json<{ status: string; qualityScore: number; bestEvidence: string[]; suggestedAdjustment: string }>();
    expect(body.status).toBe('helpful');
    expect(body.qualityScore).toBeGreaterThanOrEqual(70);
    expect(body.bestEvidence.join(' ')).toContain('bestätigt');
    expect(body.suggestedAdjustment).toContain('beibehalten');
    expect(afterRows).toHaveLength(beforeRows.length);
  });
});

describe('Coach preferences', () => {
  it('returns defaults and persists explicit visible preferences', async () => {
    const defaults = await app.inject({
      method: 'GET',
      url: '/api/pulse/coach/preferences',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(defaults.statusCode).toBe(200);
    expect(defaults.json()).toMatchObject({
      preferences: {
        timeWindows: '',
        dislikedWorkoutPatterns: [],
        preferredLongDays: [],
        injurySensitiveConstraints: [],
        communicationStyle: 'data_first',
        updatedAt: null,
      },
    });

    const patch = await app.inject({
      method: 'PATCH',
      url: '/api/pulse/coach/preferences',
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        timeWindows: 'Werktags vor 07:30 oder nach 18:30.',
        dislikedWorkoutPatterns: ['lange Sweetspot-Blöcke'],
        preferredLongDays: [6, 6, 5],
        injurySensitiveConstraints: ['Achillessehne vorsichtig steigern'],
        communicationStyle: 'data_first',
      },
    });

    expect(patch.statusCode).toBe(200);
    const body = patch.json<{ preferences: { preferredLongDays: number[]; updatedAt: string | null } }>();
    expect(body.preferences).toMatchObject({
      timeWindows: 'Werktags vor 07:30 oder nach 18:30.',
      dislikedWorkoutPatterns: ['lange Sweetspot-Blöcke'],
      preferredLongDays: [5, 6],
      injurySensitiveConstraints: ['Achillessehne vorsichtig steigern'],
      communicationStyle: 'data_first',
    });
    expect(body.preferences.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    const rows = await db.select().from(pulseCoachPreferences).where(eq(pulseCoachPreferences.userId, userId));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ timeWindows: 'Werktags vor 07:30 oder nach 18:30.' });
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

describe('POST /api/pulse/checkin/text', () => {
  it('returns an editable extraction preview without persisting a check-in', async () => {
    vi.mocked(llmComplete).mockResolvedValueOnce(JSON.stringify({
      isCheckin: true,
      extraction: {
        mood: 5,
        energy: 4,
        stress: 7,
        motivation: 6,
        themes: ['Arbeit', 'Muedigkeit'],
        followUpQuestions: ['Was waere heute eine gute Grenze?'],
      },
      coachReply: 'Ich habe daraus einen Check-in-Vorschlag gemacht.',
    }));

    const res = await app.inject({
      method: 'POST', url: '/api/pulse/checkin/text',
      payload: { text: 'Heute ist der Kopf voll, Energie begrenzt und der Druck spuerbar.' },
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<{
      text: string;
      isCheckin: boolean;
      extraction: { mood: number; energy: number; stress: number; motivation: number; themes: string[] } | null;
      followUpQuestions: string[];
    }>();
    expect(body).toMatchObject({
      text: 'Heute ist der Kopf voll, Energie begrenzt und der Druck spuerbar.',
      isCheckin: true,
      extraction: {
        mood: 5,
        energy: 4,
        stress: 7,
        motivation: 6,
        themes: ['Arbeit', 'Muedigkeit'],
      },
      followUpQuestions: ['Was waere heute eine gute Grenze?'],
    });

    const rows = await db.select().from(pulseMentalCheckins).where(eq(pulseMentalCheckins.userId, userId));
    expect(rows).toHaveLength(0);
  });
});

describe('GET /api/pulse/checkin/guidance', () => {
  it('returns rest-day guided questions without treating a future workout as today', async () => {
    const today = dateDaysAgo(0);
    const future = dateDaysFrom(3);
    await db.insert(pulsePlannedWorkouts).values({
      userId,
      plannedDate: future,
      activityType: 'bike',
      zone: 2,
      durationMin: 80,
      description: 'Aerobe Grundlage.',
      status: 'planned',
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/pulse/checkin/guidance',
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<{
      date: string;
      questions: Array<{ id: string; label: string; rationale: string }>;
      action: unknown | null;
    }>();
    expect(body.date).toBe(today);
    expect(body.questions.map(question => question.id)).toEqual(expect.arrayContaining(['rest-boundary', 'mental-load']));
    const text = body.questions.map(question => `${question.label} ${question.rationale}`).join(' ');
    expect(text).toContain('freier Tag');
    expect(text).not.toContain(future);
  });

  it('surfaces mental support through the existing action closure endpoint', async () => {
    const today = dateDaysAgo(0);
    await db.insert(pulseDailyMetrics).values({
      userId,
      date: today,
      stressAvg: 82,
      source: 'test',
    });
    await db.insert(pulseMentalCheckins).values({
      userId,
      date: today,
      mood: 4,
      energy: 4,
      stress: 8,
      motivation: 3,
      notes: 'Viel Arbeit.',
      themes: ['arbeit'],
      source: 'manual',
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/pulse/actions',
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<{ actions: Array<{ source: string; title: string; targetPath: string; resolvedBy: string }> }>();
    expect(body.actions).toContainEqual(expect.objectContaining({
      source: 'mental',
      title: 'Eine Grenze für heute setzen',
      targetPath: '/coach',
      resolvedBy: 'Mentale Support-Aktion abschließen, verschieben oder bewusst verwerfen.',
    }));
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

describe('GET /api/pulse/activities/:id', () => {
  it('caches Garmin detail data without replacing the activity summary rawData', async () => {
    const activitySummary = {
      activityId: 998877,
      activityName: 'Morning Ride',
      activityType: { typeKey: 'cycling' },
      providerSummary: true,
    };
    const [activity] = await db.insert(pulseActivities).values({
      userId,
      externalId: '998877',
      source: 'garmin',
      startTime: new Date('2026-05-01T08:00:00.000Z'),
      activityType: 'bike',
      durationSec: 3600,
      rawData: activitySummary,
    }).returning({ id: pulseActivities.id });

    garminMocks.get.mockImplementation(async (url: string) => {
      if (url.endsWith('/splits')) {
        return {
          lapDTOs: [{
            distance: 10_000,
            duration: 1_800,
            averageHR: 142,
            maxHR: 158,
            averagePower: 210,
            averageSpeed: 5.55,
            elevationGain: 80,
          }],
        };
      }
      if (url.endsWith('/hrTimeInZones')) {
        return [{ zoneNumber: 2, secsInZone: 1_200, zoneLowBoundary: 130 }];
      }
      return {};
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/pulse/activities/${activity!.id}`,
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<{ laps: unknown[]; hrZones: unknown[] }>();
    expect(body.laps).toHaveLength(1);
    expect(body.hrZones).toHaveLength(1);

    const [saved] = await db.select({
      rawData: pulseActivities.rawData,
      garminLaps: pulseActivities.garminLaps,
      garminHrZones: pulseActivities.garminHrZones,
      garminDetailSyncedAt: pulseActivities.garminDetailSyncedAt,
    }).from(pulseActivities).where(eq(pulseActivities.id, activity!.id));

    expect(saved?.rawData).toEqual(activitySummary);
    expect(saved?.garminLaps).toEqual(body.laps);
    expect(saved?.garminHrZones).toEqual(body.hrZones);
    expect(saved?.garminDetailSyncedAt).toBeInstanceOf(Date);
  });

  it('continues to read legacy cached laps and HR zones from rawData', async () => {
    const legacyCache = {
      laps: [{ index: 1, durationSec: 900, avgHr: 138, avgPowerW: 185, avgSpeedMs: 4.8 }],
      hrZones: [{ zone: 2, secsInZone: 700, zoneLowBoundary: 130 }],
    };
    const [activity] = await db.insert(pulseActivities).values({
      userId,
      externalId: '112233',
      source: 'garmin',
      startTime: new Date('2026-05-01T09:00:00.000Z'),
      activityType: 'bike',
      durationSec: 900,
      rawData: legacyCache,
    }).returning({ id: pulseActivities.id });

    const res = await app.inject({
      method: 'GET',
      url: `/api/pulse/activities/${activity!.id}`,
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<{ laps: unknown[]; hrZones: unknown[] }>();
    expect(body.laps).toEqual(legacyCache.laps);
    expect(body.hrZones).toEqual(legacyCache.hrZones);
    expect(garminMocks.get).not.toHaveBeenCalled();
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

describe('GET /api/pulse/garmin/signal-usefulness', () => {
  it('reports already-present Garmin signals that are not yet decision consumers', async () => {
    const yesterday = dateDaysAgo(1);
    await db.insert(pulseDailyMetrics).values({
      userId,
      date: yesterday,
      hrvRmssd: 42,
      sleepHours: 7.2,
      bodyBatteryMax: 86,
      bodyBatteryCharged: 48,
      bodyBatteryDrained: 61,
      bodyBatteryAtWake: 74,
      highStressSec: 3600,
      mediumStressSec: 7200,
      avgWakingRespiration: 13.2,
      latestSpo2: 97,
      source: 'garmin',
      syncedAt: new Date(),
    });
    await db.insert(pulseActivities).values({
      userId,
      startTime: new Date(`${yesterday}T08:00:00.000Z`),
      activityType: 'run',
      durationSec: 2400,
      weather: { tempC: 12 },
      garminHrZones: [{ zone: 2, secsInZone: 1800, zoneLowBoundary: 130 }],
      garminLaps: [{ index: 1, durationSec: 1200, avgHr: 142 }],
      garminDetailData: { source: 'garmin', fetchedAt: `${yesterday}T10:00:00.000Z` },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/pulse/garmin/signal-usefulness?days=2',
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<{
      summary: { underused: number; used: number };
      topUnderused: Array<{ signalKey: string; status: string }>;
      items: Array<{ signalKey: string; status: string; recommendedNextConsumer: string | null }>;
    }>();
    expect(body.summary.used).toBeGreaterThan(0);
    expect(body.summary.underused).toBeGreaterThan(0);
    expect(body.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ signalKey: 'body_battery_depth', status: 'underused', recommendedNextConsumer: 'daily_decision' }),
      expect.objectContaining({ signalKey: 'activity_hr_zones_laps', status: 'underused', recommendedNextConsumer: 'plan_generation' }),
    ]));
    expect(body.topUnderused.length).toBeLessThanOrEqual(3);
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

  it('returns derived Garmin execution states for planned workouts', async () => {
    const yesterday = dateDaysAgo(1);
    const today = dateDaysAgo(0);
    const tomorrow = dateDaysAgo(-1);

    const [completedActivity] = await db.insert(pulseActivities).values({
      userId,
      externalId: 'completed-activity',
      source: 'garmin',
      startTime: new Date(`${today}T09:00:00.000Z`),
      activityType: 'bike',
      durationSec: 5_200,
    }).returning({ id: pulseActivities.id });

    await db.insert(pulseActivities).values({
      userId,
      externalId: 'off-plan-activity',
      source: 'garmin',
      startTime: new Date(`${today}T12:00:00.000Z`),
      activityType: 'run',
      durationSec: 2_700,
    });

    await db.insert(pulsePlannedWorkouts).values([
      { userId, plannedDate: tomorrow, activityType: 'bike', zone: 2, durationMin: 60, status: 'planned' },
      { userId, plannedDate: tomorrow, activityType: 'run', zone: 2, durationMin: 45, status: 'planned', garminWorkoutId: 'gw-1' },
      { userId, plannedDate: tomorrow, activityType: 'swim', zone: 2, durationMin: 40, status: 'planned', garminWorkoutId: 'gw-2', garminScheduledId: 'sched-2' },
      { userId, plannedDate: today, activityType: 'bike', zone: 2, durationMin: 90, status: 'completed', completedActivityId: completedActivity!.id },
      { userId, plannedDate: yesterday, activityType: 'run', zone: 2, durationMin: 45, status: 'planned' },
      { userId, plannedDate: today, activityType: 'swim', zone: 2, durationMin: 40, status: 'planned' },
    ]);

    const res = await app.inject({
      method: 'GET',
      url: '/api/pulse/plan',
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<{ workouts: Array<{ executionStatus: string; executionNotes: string | null; executionMatchConfidence: number | null }> }>();
    const statuses = body.workouts.map(w => w.executionStatus);
    expect(statuses).toContain('local_planned');
    expect(statuses).toContain('garmin_template');
    expect(statuses).toContain('garmin_scheduled');
    expect(statuses).toContain('completed_matched');
    expect(statuses).toContain('missed');
    expect(statuses).toContain('replaced_or_off_plan');
    expect(body.workouts.find(w => w.executionStatus === 'completed_matched')?.executionMatchConfidence).toBeGreaterThanOrEqual(0.8);
    expect(body.workouts.find(w => w.executionStatus === 'replaced_or_off_plan')?.executionNotes).toContain('andere Aktivität');
  });
});

describe('Pulse profile provenance', () => {
  it('persists explicit fueling preferences on the athlete profile', async () => {
    const patch = await app.inject({
      method: 'PATCH',
      url: '/api/pulse/profile',
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        fuelingEnabled: true,
        dietaryConstraints: [],
        preferredFuelingProducts: 'Ministry',
        carbGuidanceStyle: 'suggest_ranges',
        sodiumGuidanceStyle: 'suggest_ranges',
        bodyWeightGuidanceEnabled: true,
      },
    });
    expect(patch.statusCode).toBe(200);

    const profile = await app.inject({
      method: 'GET',
      url: '/api/pulse/profile',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(profile.statusCode).toBe(200);
    expect(profile.json()).toMatchObject({
      fuelingEnabled: true,
      dietaryConstraints: [],
      preferredFuelingProducts: 'Ministry',
      carbGuidanceStyle: 'suggest_ranges',
      sodiumGuidanceStyle: 'suggest_ranges',
      bodyWeightGuidanceEnabled: true,
    });
  });

  it('marks manual profile edits and protects them from Garmin profile sync', async () => {
    const patch = await app.inject({
      method: 'PATCH',
      url: '/api/pulse/profile',
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        ftpWatts: 255,
        maxHrBpm: 184,
        lthrBpm: 171,
        vo2max: 52,
      },
    });
    expect(patch.statusCode).toBe(200);

    garminMocks.getUserSettings.mockResolvedValueOnce({
      userData: {
        vo2MaxRunning: 58,
        vo2MaxCycling: 56,
        lactateThresholdHeartRate: 176,
        maxHeartRate: 190,
      },
    });
    await db.insert(pulseActivities).values({
      userId,
      externalId: 'profile-activity-1',
      startTime: new Date('2026-04-30T08:00:00.000Z'),
      activityType: 'bike',
      durationSec: 3600,
      maxHr: 192,
      rawData: { max20MinPower: 310 },
    });

    const sync = await app.inject({
      method: 'POST',
      url: '/api/pulse/garmin/sync-profile',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(sync.statusCode).toBe(200);
    const syncBody = sync.json<{
      synced: {
        ftpWatts: { value: number | null; source: string; status: string };
        maxHrBpm: { value: number | null; source: string; status: string };
        lthrBpm: { value: number | null; source: string; status: string };
        vo2max: { value: number | null; source: string; status: string };
      };
    }>();
    expect(syncBody.synced.ftpWatts).toMatchObject({ value: 255, source: 'manual', status: 'kept_manual' });
    expect(syncBody.synced.maxHrBpm).toMatchObject({ value: 184, source: 'manual', status: 'kept_manual' });
    expect(syncBody.synced.lthrBpm).toMatchObject({ value: 171, source: 'manual', status: 'kept_manual' });
    expect(syncBody.synced.vo2max).toMatchObject({ value: 52, source: 'manual', status: 'kept_manual' });

    const profile = await app.inject({
      method: 'GET',
      url: '/api/pulse/profile',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(profile.statusCode).toBe(200);
    expect(profile.json<{
      ftpWatts: number;
      maxHrBpm: number;
      lthrBpm: number;
      vo2max: number;
      provenance: { fields: { ftpWatts: { source: string }; maxHrBpm: { source: string }; lthrBpm: { source: string }; vo2max: { source: string } } };
    }>()).toMatchObject({
      ftpWatts: 255,
      maxHrBpm: 184,
      lthrBpm: 171,
      vo2max: 52,
      provenance: {
        fields: {
          ftpWatts: { source: 'manual' },
          maxHrBpm: { source: 'manual' },
          lthrBpm: { source: 'manual' },
          vo2max: { source: 'manual' },
        },
      },
    });
  });

  it('fills missing profile values from Garmin and stored activities with sources', async () => {
    garminMocks.getUserSettings.mockResolvedValueOnce({
      userData: {
        vo2MaxRunning: 54,
        vo2MaxCycling: 56,
        lactateThresholdHeartRate: 172,
      },
    });
    await db.insert(pulseActivities).values({
      userId,
      externalId: 'profile-activity-2',
      startTime: new Date('2026-04-29T08:00:00.000Z'),
      activityType: 'bike',
      durationSec: 3600,
      maxHr: 189,
      rawData: { max20MinPower: 300 },
    });

    const sync = await app.inject({
      method: 'POST',
      url: '/api/pulse/garmin/sync-profile',
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(sync.statusCode).toBe(200);
    const profile = await app.inject({
      method: 'GET',
      url: '/api/pulse/profile',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(profile.json<{
      ftpWatts: number;
      maxHrBpm: number;
      lthrBpm: number;
      vo2max: number;
      provenance: { fields: Record<string, { source: string }> };
    }>()).toMatchObject({
      ftpWatts: 285,
      maxHrBpm: 189,
      lthrBpm: 172,
      vo2max: 55,
      provenance: {
        fields: {
          ftpWatts: { source: 'activity_derived' },
          maxHrBpm: { source: 'activity_derived' },
          lthrBpm: { source: 'garmin_settings' },
          vo2max: { source: 'garmin_settings' },
        },
      },
    });
  });

  it('can explicitly switch selected manual profile values back to automatic sources', async () => {
    const patch = await app.inject({
      method: 'PATCH',
      url: '/api/pulse/profile',
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        ftpWatts: 255,
        maxHrBpm: 184,
        lthrBpm: 171,
        vo2max: 52,
      },
    });
    expect(patch.statusCode).toBe(200);

    garminMocks.getUserSettings.mockResolvedValueOnce({
      userData: {
        vo2MaxRunning: 58,
        vo2MaxCycling: 56,
        lactateThresholdHeartRate: 176,
        maxHeartRate: 190,
      },
    });
    await db.insert(pulseActivities).values({
      userId,
      externalId: 'profile-auto-activity-1',
      startTime: new Date('2026-05-01T08:00:00.000Z'),
      activityType: 'bike',
      durationSec: 3600,
      maxHr: 192,
      rawData: { max20MinPower: 310 },
    });

    const sync = await app.inject({
      method: 'POST',
      url: '/api/pulse/garmin/sync-profile',
      headers: { Authorization: `Bearer ${token}` },
      payload: { overrideManualFields: ['ftpWatts', 'lthrBpm'] },
    });

    expect(sync.statusCode).toBe(200);
    const syncBody = sync.json<{
      synced: {
        ftpWatts: { value: number | null; source: string; status: string };
        maxHrBpm: { value: number | null; source: string; status: string };
        lthrBpm: { value: number | null; source: string; status: string };
        vo2max: { value: number | null; source: string; status: string };
      };
    }>();
    expect(syncBody.synced.ftpWatts).toMatchObject({ value: 295, source: 'activity_derived', status: 'updated' });
    expect(syncBody.synced.lthrBpm).toMatchObject({ value: 176, source: 'garmin_settings', status: 'updated' });
    expect(syncBody.synced.maxHrBpm).toMatchObject({ value: 184, source: 'manual', status: 'kept_manual' });
    expect(syncBody.synced.vo2max).toMatchObject({ value: 52, source: 'manual', status: 'kept_manual' });
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
        inputSnapshot: {
          weeklyHoursTarget: number;
          profile: {
            maxHrBpm: number | null;
            provenance: { fields: { maxHrBpm: { source: string }; lthrBpm: { source: string } } };
          };
          dataWarnings: string[];
        };
        sportMix: Record<string, { sessions: number }>;
      };
    }>();
    expect(body.workouts.length).toBeGreaterThan(0);
    expect(body.planTrace).toMatchObject({
      weekStart: '2026-05-04',
      inputSnapshot: {
        weeklyHoursTarget: 7,
        profile: {
          maxHrBpm: 186,
          provenance: {
            fields: {
              maxHrBpm: { source: 'manual' },
              lthrBpm: { source: 'manual' },
            },
          },
        },
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
            executionReview?: {
              signals: string[];
              learnedFromLastWeek: string[];
            } | null;
          };
          adaptation?: { learnedFromExecution: string[]; signals?: string[] } | null;
        };
      };
    }>().planTrace.inputSnapshot.learningSnapshot;
    expect(learning.previousWeek).toMatchObject({ weekStart: '2026-04-27', avgComplianceScore: 0.55 });
    expect(learning.flags).toContain('low_compliance');
    expect(learning.learnedFromLastWeek.join(' ')).toContain('Compliance');
    expect(learning.variationComparedToLastWeek.length).toBeGreaterThan(0);
    expect(learning.executionReview?.signals).toContain('matched');
    expect(learning.executionReview?.learnedFromLastWeek.join(' ')).toContain('abgeglichen');
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

  it('falls back to deterministic HR-first steps when LLM detail generation is unavailable', async () => {
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
      zone: 4,
      durationMin: 60,
      targetTss: 86,
      description: 'Schwellenreiz',
    }).returning();
    vi.mocked(llmComplete).mockRejectedValueOnce(new Error('OpenRouter error: 402'));

    const res = await app.inject({
      method: 'POST',
      url: `/api/pulse/plan/workout/${workout!.id}/detail`,
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<{ workout: { steps: Array<{ type: string; targetLabel?: string; targetHrMinBpm?: number; targetHrMaxBpm?: number }> } }>();
    expect(body.workout.steps.length).toBeGreaterThan(0);
    expect(body.workout.steps.some(step => step.type === 'interval')).toBe(true);
    expect(body.workout.steps.every(step => step.targetLabel != null)).toBe(true);
    expect(body.workout.steps.some(step => step.targetHrMinBpm != null || step.targetHrMaxBpm != null)).toBe(true);
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

  it('exports interval repeats as Garmin iteration end conditions', async () => {
    const [workout] = await db.insert(pulsePlannedWorkouts).values({
      userId,
      plannedDate: '2026-05-05',
      activityType: 'bike',
      zone: 4,
      durationMin: 26,
      targetTss: 40,
      description: 'Repeat-Test',
      steps: [
        { type: 'warmup', durationMin: 8, zone: 1, description: 'Warmup' },
        { type: 'interval', durationMin: 5, zone: 4, reps: 2, restMin: 3, description: 'Z4' },
        { type: 'cooldown', durationMin: 5, zone: 1, description: 'Cooldown' },
      ],
    }).returning();

    const res = await app.inject({
      method: 'POST',
      url: `/api/pulse/plan/workout/${workout!.id}/sync-garmin`,
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const payload = garminMocks.addWorkout.mock.calls[0]![0] as {
      workoutSegments: Array<{ workoutSteps: Array<{
        type: string;
        endConditionValue: number | null;
        numberOfIterations: number | null;
        endCondition: { conditionTypeKey: string };
        workoutSteps?: Array<{ stepType: { stepTypeKey: string } }>;
      }> }>;
    };
    const repeat = payload.workoutSegments[0]!.workoutSteps.find(step => step.type === 'RepeatGroupDTO');
    expect(repeat).toBeDefined();
    expect(repeat!.endCondition.conditionTypeKey).toBe('iterations');
    expect(repeat!.endConditionValue).toBe(2);
    expect(repeat!.numberOfIterations).toBe(2);
    expect(repeat!.workoutSteps?.map(step => step.stepType.stepTypeKey)).toEqual(['interval', 'recovery']);
  });

  it('uploads deterministic Garmin steps when a workout has no steps and LLM is unavailable', async () => {
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
      durationMin: 80,
      targetTss: 65,
      description: 'Aerobe Grundlage',
    }).returning();
    vi.mocked(llmComplete).mockRejectedValueOnce(new Error('OpenRouter error: 402'));

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
    expect(steps.length).toBeGreaterThan(0);
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
