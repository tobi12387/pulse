import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { hashPassword } from '../lib/auth.js';
import { users } from '../db/schema.js';
import { pulseActionDecisions, pulseMentalCheckins } from '../db/pulse-schema.js';
import { sendPushToUser } from '../lib/push.js';
import {
  CHECKIN_REMINDER_PATTERN,
  CHECKIN_REMINDER_QUEUE_NAME,
  CHECKIN_REMINDER_TIME_ZONE,
  dateInTimeZone,
  processCheckinReminderJob,
  startCheckinReminderWorker,
} from './checkin-reminder.job.js';
import type { CheckinReminderJobData } from './checkin-reminder.job.js';

const pushMocks = vi.hoisted(() => ({
  sendPushToUser: vi.fn(),
}));

const queueMocks = vi.hoisted(() => {
  const queue = { add: vi.fn().mockResolvedValue(undefined), close: vi.fn() };
  const worker = { close: vi.fn() };
  return {
    queue,
    worker,
    createQueue: vi.fn(() => queue),
    createWorker: vi.fn(() => worker),
  };
});

vi.mock('../lib/push.js', () => ({
  isPushConfigured: vi.fn().mockReturnValue(true),
  sendPushToUser: pushMocks.sendPushToUser,
}));

vi.mock('../lib/queue.js', () => ({
  createQueue: queueMocks.createQueue,
  createWorker: queueMocks.createWorker,
}));

const mockApp = {
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
} as unknown as FastifyInstance;

let userId: string;

beforeAll(async () => {
  await db.delete(users).where(eq(users.email, 'checkin-reminder@coaching.os'));
  const [user] = await db.insert(users).values({
    email: 'checkin-reminder@coaching.os',
    passwordHash: await hashPassword('TestPassword123!'),
    name: 'Checkin Reminder Test',
  }).returning({ id: users.id });
  userId = user!.id;
});

afterAll(async () => {
  if (userId) {
    await db.delete(pulseActionDecisions).where(eq(pulseActionDecisions.userId, userId));
    await db.delete(pulseMentalCheckins).where(eq(pulseMentalCheckins.userId, userId));
  }
  await db.delete(users).where(eq(users.email, 'checkin-reminder@coaching.os'));
});

beforeEach(async () => {
  await db.delete(pulseActionDecisions).where(eq(pulseActionDecisions.userId, userId));
  await db.delete(pulseMentalCheckins).where(eq(pulseMentalCheckins.userId, userId));
  vi.mocked(sendPushToUser).mockReset().mockResolvedValue({ sent: 1, failed: 0, gone: 0, skipped: 0 });
  queueMocks.queue.add.mockClear().mockResolvedValue(undefined);
  queueMocks.createQueue.mockClear();
  queueMocks.createWorker.mockClear();
});

describe('processCheckinReminderJob', () => {
  it('sends a check-in reminder when today has no mental check-in', async () => {
    const date = '2026-04-30';
    const job = { data: { userId, date } } as Job<CheckinReminderJobData>;

    await processCheckinReminderJob(job, mockApp);

    expect(sendPushToUser).toHaveBeenCalledWith(userId, {
      topic: 'checkin_reminder',
      title: 'Wie war dein Tag?',
      body: 'Kurzer Mental-Check-in (30s).',
      url: expect.stringMatching(/^\/coach\?actionId=checkin%3A%2Fcoach%3A0&decisionId=[0-9a-f-]{36}$/),
      tag: `checkin-${date}`,
    });

    const rows = await db.select().from(pulseActionDecisions).where(eq(pulseActionDecisions.userId, userId));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      source: 'next_best_action',
      sourceId: 'checkin:/coach:0',
      kind: 'checkin',
      title: 'Check-in eintragen',
      status: 'open',
    });
  });

  it('does not send a reminder when a mental check-in exists for the date', async () => {
    const date = '2026-04-30';
    await db.insert(pulseMentalCheckins).values({
      userId,
      date,
      mood: 7,
      energy: 6,
      stress: 3,
      motivation: 8,
    });

    const job = { data: { userId, date } } as Job<CheckinReminderJobData>;
    await processCheckinReminderJob(job, mockApp);

    expect(sendPushToUser).not.toHaveBeenCalled();
  });

  it('does not send a reminder when the check-in action was already deferred', async () => {
    const date = '2026-04-30';
    await db.insert(pulseActionDecisions).values({
      userId,
      source: 'next_best_action',
      sourceId: 'checkin:/coach:0',
      kind: 'checkin',
      title: 'Check-in eintragen',
      status: 'deferred',
      resolvedAt: new Date(`${date}T12:00:00.000Z`),
      resolutionReason: 'Heute nicht relevant.',
      targetRoute: '/coach',
      rawContext: {
        actionId: 'checkin:/coach:0',
        openedAt: date,
        priority: 'high',
        evidence: ['Tages-Check-in fehlt'],
      },
    });

    const job = { data: { userId, date } } as Job<CheckinReminderJobData>;
    await processCheckinReminderJob(job, mockApp);

    expect(sendPushToUser).not.toHaveBeenCalled();
  });

  it('keeps the job successful when push delivery fails', async () => {
    vi.mocked(sendPushToUser).mockRejectedValueOnce(new Error('push unavailable'));
    const job = { data: { userId, date: '2026-04-30' } } as Job<CheckinReminderJobData>;

    await expect(processCheckinReminderJob(job, mockApp)).resolves.toBeUndefined();
  });
});

describe('startCheckinReminderWorker', () => {
  it('schedules the daily reminder for 19:30 Europe/Berlin', () => {
    startCheckinReminderWorker(mockApp);

    expect(queueMocks.createQueue).toHaveBeenCalledWith(CHECKIN_REMINDER_QUEUE_NAME);
    expect(queueMocks.createWorker).toHaveBeenCalledWith(CHECKIN_REMINDER_QUEUE_NAME, expect.any(Function));
    expect(queueMocks.queue.add).toHaveBeenCalledWith('daily-checkin-reminder', {}, {
      repeat: { pattern: CHECKIN_REMINDER_PATTERN, tz: CHECKIN_REMINDER_TIME_ZONE },
      removeOnComplete: { count: 50 },
      removeOnFail: { count: 20 },
    });
  });
});

describe('dateInTimeZone', () => {
  it('formats dates in the requested time zone', () => {
    expect(dateInTimeZone(new Date('2026-04-30T21:30:00.000Z'), 'Europe/Berlin')).toBe('2026-04-30');
  });
});
