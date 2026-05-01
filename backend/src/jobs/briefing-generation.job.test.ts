import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { db } from '../lib/db.js';
import { dailyBriefings, users } from '../db/schema.js';
import {
  pulseActivities,
  pulseDailyMetrics,
  pulseHealthState,
  pulseMentalCheckins,
  pulsePlannedWorkouts,
} from '../db/pulse-schema.js';
import { hashPassword } from '../lib/auth.js';
import type { Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import { buildBriefingPushBody, buildBriefingUserContentRich, processBriefingJob } from './briefing-generation.job.js';
import type { BriefingJobData } from './briefing-generation.job.js';
import { llmComplete } from '../lib/llm.js';
import { sendPushToUser } from '../lib/push.js';
import type { PulseContext } from '../pulse/lib/pulse-context.js';

const pushMocks = vi.hoisted(() => ({
  sendPushToUser: vi.fn(),
}));

vi.mock('../lib/llm.js', () => ({
  llmComplete: vi.fn().mockResolvedValue('Deine Erholung sieht gut aus. Heute Zone 2.'),
  SMART_MODEL: 'test-model',
}));

vi.mock('../lib/push.js', () => ({
  isPushConfigured: vi.fn().mockReturnValue(true),
  sendPushToUser: pushMocks.sendPushToUser,
}));

const mockApp = {
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
} as unknown as FastifyInstance;

let userId: string;

beforeAll(async () => {
  await db.delete(dailyBriefings);
  await db.delete(pulseHealthState);
  await db.delete(pulsePlannedWorkouts);
  await db.delete(pulseActivities);
  await db.delete(pulseMentalCheckins);
  await db.delete(pulseDailyMetrics);
  await db.delete(users);
  const [u] = await db.insert(users).values({
    email: 'briefing@coaching.os',
    passwordHash: await hashPassword('TestPassword123!'),
    name: 'Briefing Test',
  }).returning({ id: users.id });
  userId = u!.id;
});

afterAll(async () => {
  await db.delete(dailyBriefings);
  await db.delete(pulseHealthState);
  await db.delete(pulsePlannedWorkouts);
  await db.delete(pulseActivities);
  await db.delete(pulseMentalCheckins);
  await db.delete(pulseDailyMetrics);
  await db.delete(users);
});

beforeEach(async () => {
  await db.delete(dailyBriefings);
  await db.delete(pulseHealthState);
  await db.delete(pulsePlannedWorkouts);
  await db.delete(pulseActivities);
  await db.delete(pulseMentalCheckins);
  await db.delete(pulseDailyMetrics);
  vi.mocked(llmComplete).mockClear();
  vi.mocked(sendPushToUser).mockReset().mockResolvedValue({ sent: 1, failed: 0, gone: 0, skipped: 0 });
});

describe('processBriefingJob', () => {
  it('generates and saves a briefing for check-in trigger', async () => {
    const date = '2026-04-23';

    await db.insert(pulseDailyMetrics).values({
      userId,
      date,
      sleepHours: 7.2,
      sleepScore: 78,
      hrvStatus: 'balanced',
      hrvRmssd: 58,
      restingHr: 52,
      bodyBatteryMax: 74,
      steps: 8400,
    });
    await db.insert(pulseMentalCheckins).values({
      userId, date, mood: 7, energy: 7, stress: 3, motivation: 8, notes: null,
    });
    await db.insert(pulsePlannedWorkouts).values({
      userId, plannedDate: date, activityType: 'bike', zone: 2, durationMin: 60,
      description: 'Locker rollen',
    });

    const job = { data: { userId, triggerType: 'check-in', date } } as Job<BriefingJobData>;
    await processBriefingJob(job, mockApp);

    const [saved] = await db.select().from(dailyBriefings).where(
      eq(dailyBriefings.userId, userId)
    );
    expect(saved).toBeDefined();
    expect(saved!.triggerType).toBe('check-in');
    expect(saved!.briefingText).toBe('Deine Erholung sieht gut aus. Heute Zone 2.');
    expect(saved!.date).toBe(date);
    expect(saved!.garminSnapshot).toMatchObject({ sleepHours: 7.2, hrvStatus: 'balanced' });
    expect(saved!.checkinSnapshot).toMatchObject({ energy: 7, stress: 3 });
    expect(sendPushToUser).toHaveBeenCalledWith(userId, {
      topic: 'briefing',
      title: 'Daily Briefing',
      body: 'Deine Erholung sieht gut aus. Heute Zone 2.',
      url: '/',
      tag: `briefing-${date}`,
    });

    const userContent = vi.mocked(llmComplete).mock.calls[0]?.[1] ?? '';
    const systemPrompt = vi.mocked(llmComplete).mock.calls[0]?.[0] ?? '';
    expect(systemPrompt).toContain('Risk-Signal critical');
    expect(userContent).toContain('CTL');
    expect(userContent).toContain('ATL');
    expect(userContent).toContain('TSB');
    expect(userContent).toContain('Readiness');
    expect(userContent).toContain('Nächstes Training');
    expect(userContent).toContain('RISIKO-SIGNALE');
  });

  it('generates a briefing for garmin-alarm trigger (no check-in)', async () => {
    const date = '2026-04-23';

    await db.insert(pulseDailyMetrics).values({
      userId, date, sleepHours: 5.0, hrvStatus: 'poor',
      bodyBatteryMax: 18, steps: null,
    });
    await db.insert(pulseHealthState).values({
      userId, type: 'fatigue', severity: 'moderate', startDate: date,
      notes: 'Schwere Beine',
    });

    const job = { data: { userId, triggerType: 'garmin-alarm', date } } as Job<BriefingJobData>;
    await processBriefingJob(job, mockApp);

    const [saved] = await db.select().from(dailyBriefings).where(
      eq(dailyBriefings.userId, userId)
    );
    expect(saved!.triggerType).toBe('garmin-alarm');
    expect(saved!.checkinSnapshot).toBeNull();

    const userContent = vi.mocked(llmComplete).mock.calls[0]?.[1] ?? '';
    expect(userContent).toContain('Aktive Health-States');
    expect(userContent).toContain('fatigue/moderate');
  });

  it('does not send another briefing push when a briefing already exists for the date', async () => {
    const date = '2026-04-23';
    await db.insert(dailyBriefings).values({
      userId,
      date,
      triggerType: 'check-in',
      briefingText: 'Früheres Briefing.',
      createdAt: new Date('2026-04-23T06:00:00Z'),
    });

    const job = { data: { userId, triggerType: 'garmin-alarm', date } } as Job<BriefingJobData>;
    await processBriefingJob(job, mockApp);

    const rows = await db.select().from(dailyBriefings).where(eq(dailyBriefings.userId, userId));
    expect(rows).toHaveLength(2);
    expect(sendPushToUser).not.toHaveBeenCalled();
  });

  it('generates briefing even with no garmin data', async () => {
    const date = '2026-04-24';

    const job = { data: { userId, triggerType: 'check-in', date } } as Job<BriefingJobData>;
    await processBriefingJob(job, mockApp);

    const rows = await db.select().from(dailyBriefings);
    expect(rows.length).toBe(1);
  });

  it('keeps the briefing when push delivery fails', async () => {
    const date = '2026-04-25';
    vi.mocked(sendPushToUser).mockRejectedValueOnce(new Error('push unavailable'));

    const job = { data: { userId, triggerType: 'check-in', date } } as Job<BriefingJobData>;
    await expect(processBriefingJob(job, mockApp)).resolves.toBeUndefined();

    const rows = await db.select().from(dailyBriefings);
    expect(rows).toHaveLength(1);
  });

  it('adds RPE fatigue context for hard-feeling easy workouts', async () => {
    const date = '2026-04-24';
    const activityDate = '2026-04-23';

    const [activity] = await db.insert(pulseActivities).values({
      userId,
      startTime: new Date(`${activityDate}T16:00:00Z`),
      activityType: 'bike',
      durationSec: 3600,
      tss: 45,
      rpe: 8,
      rpeNote: 'Beine zäh',
    }).returning({ id: pulseActivities.id });
    await db.insert(pulsePlannedWorkouts).values({
      userId,
      plannedDate: activityDate,
      activityType: 'bike',
      zone: 2,
      durationMin: 60,
      status: 'completed',
      completedActivityId: activity!.id,
    });

    const job = { data: { userId, triggerType: 'check-in', date } } as Job<BriefingJobData>;
    await processBriefingJob(job, mockApp);

    const userContent = vi.mocked(llmComplete).mock.calls[0]?.[1] ?? '';
    expect(userContent).toContain('RPE 8/10');
    expect(userContent).toContain('aerobe Müdigkeit');
  });
});

describe('buildBriefingUserContentRich', () => {
  it('truncates briefing push bodies to notification-safe length', () => {
    const body = buildBriefingPushBody('a'.repeat(141));
    expect(body).toHaveLength(140);
    expect(body.endsWith('…')).toBe(true);
  });

  it('flags high RPE on easy workouts as aerobic fatigue context', () => {
    const ctx = {
      date: '2026-04-24',
      todayMetrics: null,
      todayCheckin: null,
      fitnessLoad: { ctl: 40, atl: 48, tsb: -8 },
      readiness: { score: 62, label: 'moderate' },
      recovery: null,
      activeHealthStates: [],
      upcomingWorkouts: [],
      recentActivities: [{
        id: 'activity-1',
        startTime: new Date('2026-04-23T16:00:00Z'),
        activityType: 'bike',
        durationSec: 3600,
        tss: 45,
        normalizedPowerW: null,
        avgHr: 130,
        rpe: 8,
        rpeNote: 'Beine zäh',
        plannedZone: 2,
      }],
      nextRace: null,
      activeRiskSignals: [],
    } as unknown as PulseContext;

    const prompt = buildBriefingUserContentRich(ctx, 'check-in');
    expect(prompt).toContain('RPE 8/10');
    expect(prompt).toContain('aerobe Müdigkeit');
  });

  it('adds active risk signals before objective data', () => {
    const ctx = {
      date: '2026-04-24',
      todayMetrics: null,
      todayCheckin: null,
      fitnessLoad: { ctl: 40, atl: 48, tsb: -8 },
      readiness: { score: 45, label: 'mäßig' },
      recovery: null,
      activeHealthStates: [],
      upcomingWorkouts: [],
      recentActivities: [],
      nextRace: null,
      activeRiskSignals: [{
        id: 'risk-1',
        ruleId: 'rhr_drift_7d',
        severity: 'critical',
        status: 'active',
        title: 'Ruhepuls seit 7 Tagen +6.0 bpm',
        description: 'Der Ruhepuls liegt deutlich über Baseline.',
        recommendation: 'Heute trainingsfrei oder kurzes Z1 unter 30 Minuten.',
        metric: { deltaBpm: 6 },
        triggeredAt: '2026-04-24T06:00:00.000Z',
        resolvedAt: null,
        snoozedUntil: null,
      }],
    } as unknown as PulseContext;

    const prompt = buildBriefingUserContentRich(ctx, 'garmin-alarm');
    expect(prompt.indexOf('RISIKO-SIGNALE')).toBeLessThan(prompt.indexOf('Keine Pulse-Metriken'));
    expect(prompt).toContain('[CRITICAL] Ruhepuls seit 7 Tagen +6.0 bpm (rhr_drift_7d)');
    expect(prompt).toContain('Heute trainingsfrei');
  });

  it('passes urgent next best actions into briefing context', () => {
    const ctx = {
      date: '2026-05-01',
      todayMetrics: null,
      todayCheckin: null,
      fitnessLoad: { ctl: 40, atl: 48, tsb: -8 },
      readiness: { score: 62, label: 'moderate' },
      recovery: null,
      activeHealthStates: [],
      upcomingWorkouts: [],
      recentActivities: [],
      nextRace: null,
      activeRiskSignals: [],
      nextBestActions: [{
        id: 'checkin:/coach:0',
        source: 'checkin',
        priority: 'high',
        title: 'Check-in eintragen',
        reason: 'Heute fehlt dein subjektives Signal.',
        cta: 'Zum Coach',
        targetPath: '/coach',
        resolvedBy: 'Check-in speichern.',
      }],
    } as unknown as PulseContext;

    const prompt = buildBriefingUserContentRich(ctx, 'check-in');
    expect(prompt).toContain('NÄCHSTE AKTIONEN');
    expect(prompt).toContain('[HIGH] Check-in eintragen');
    expect(prompt).toContain('Erledigt durch: Check-in speichern.');
    expect(prompt).toContain('Zum Coach (/coach)');
  });

  it('keeps normal next best actions out of briefing nudges', () => {
    const ctx = {
      date: '2026-05-01',
      todayMetrics: null,
      todayCheckin: null,
      fitnessLoad: { ctl: 40, atl: 48, tsb: -8 },
      readiness: { score: 62, label: 'moderate' },
      recovery: null,
      activeHealthStates: [],
      upcomingWorkouts: [],
      recentActivities: [],
      nextRace: null,
      activeRiskSignals: [],
      nextBestActions: [{
        id: 'plan:/plan:0',
        source: 'plan',
        priority: 'normal',
        title: 'Plan erzeugen',
        reason: 'Es gibt aktuell kein geplantes Training.',
        cta: 'Zum Plan',
        targetPath: '/plan',
      }],
    } as unknown as PulseContext;

    const prompt = buildBriefingUserContentRich(ctx, 'check-in');
    expect(prompt).toContain('keine dringenden Sofortaktionen');
    expect(prompt).not.toContain('[NORMAL] Plan erzeugen');
  });
});
