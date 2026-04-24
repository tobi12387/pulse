import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { db } from '../lib/db.js';
import { users, garminDailyHealth, checkIns, dailyBriefings } from '../db/schema.js';
import { hashPassword } from '../lib/auth.js';
import type { Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import { processBriefingJob } from './briefing-generation.job.js';
import type { BriefingJobData } from './briefing-generation.job.js';

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
  await db.delete(checkIns);
  await db.delete(garminDailyHealth);
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
  await db.delete(checkIns);
  await db.delete(garminDailyHealth);
  await db.delete(users);
});

beforeEach(async () => {
  await db.delete(dailyBriefings);
  await db.delete(checkIns);
  await db.delete(garminDailyHealth);
});

describe('processBriefingJob', () => {
  it('generates and saves a briefing for check-in trigger', async () => {
    const date = '2026-04-23';

    await db.insert(garminDailyHealth).values({
      userId,
      date,
      sleepDurationH: 7.2,
      sleepScore: 78,
      hrvStatus: 'balanced',
      restingHr: 52,
      bodyBatteryMax: 74,
      steps: 8400,
    });
    await db.insert(checkIns).values({
      userId, date, energyLevel: 7, stressLevel: 3, notes: null,
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
  });

  it('generates a briefing for garmin-alarm trigger (no check-in)', async () => {
    const date = '2026-04-23';

    await db.insert(garminDailyHealth).values({
      userId, date, sleepDurationH: 5.0, hrvStatus: 'poor',
      bodyBatteryMax: 18, steps: null,
    });

    const job = { data: { userId, triggerType: 'garmin-alarm', date } } as Job<BriefingJobData>;
    await processBriefingJob(job, mockApp);

    const [saved] = await db.select().from(dailyBriefings).where(
      eq(dailyBriefings.userId, userId)
    );
    expect(saved!.triggerType).toBe('garmin-alarm');
    expect(saved!.checkinSnapshot).toBeNull();
  });

  it('generates briefing even with no garmin data', async () => {
    const date = '2026-04-24';

    const job = { data: { userId, triggerType: 'check-in', date } } as Job<BriefingJobData>;
    await processBriefingJob(job, mockApp);

    const rows = await db.select().from(dailyBriefings);
    expect(rows.length).toBe(1);
  });
});
