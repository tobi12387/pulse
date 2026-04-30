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
import { buildBriefingUserContentRich, processBriefingJob } from './briefing-generation.job.js';
import type { BriefingJobData } from './briefing-generation.job.js';
import { llmComplete } from '../lib/llm.js';
import type { PulseContext } from '../pulse/lib/pulse-context.js';

vi.mock('../lib/llm.js', () => ({
  llmComplete: vi.fn().mockResolvedValue('Deine Erholung sieht gut aus. Heute Zone 2.'),
  SMART_MODEL: 'test-model',
}));

const mockApp = {
  log: { info: vi.fn(), error: vi.fn() },
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

    const userContent = vi.mocked(llmComplete).mock.calls[0]?.[1] ?? '';
    expect(userContent).toContain('CTL');
    expect(userContent).toContain('ATL');
    expect(userContent).toContain('TSB');
    expect(userContent).toContain('Readiness');
    expect(userContent).toContain('Nächstes Training');
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

  it('generates briefing even with no garmin data', async () => {
    const date = '2026-04-24';

    const job = { data: { userId, triggerType: 'check-in', date } } as Job<BriefingJobData>;
    await processBriefingJob(job, mockApp);

    const rows = await db.select().from(dailyBriefings);
    expect(rows.length).toBe(1);
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
    } as unknown as PulseContext;

    const prompt = buildBriefingUserContentRich(ctx, 'check-in');
    expect(prompt).toContain('RPE 8/10');
    expect(prompt).toContain('aerobe Müdigkeit');
  });
});
