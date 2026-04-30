import type { FastifyInstance } from 'fastify';
import type { Job, Queue, Worker } from 'bullmq';
import { and, eq } from 'drizzle-orm';
import { createQueue, createWorker } from '../lib/queue.js';
import { db } from '../lib/db.js';
import { users } from '../db/schema.js';
import { pulseMentalCheckins } from '../db/pulse-schema.js';
import { sendPushToUser } from '../lib/push.js';

export const CHECKIN_REMINDER_QUEUE_NAME = 'checkin-reminder';
export const CHECKIN_REMINDER_TIME_ZONE = 'Europe/Berlin';
export const CHECKIN_REMINDER_PATTERN = '30 19 * * *';

export interface CheckinReminderJobData {
  userId?: string;
  date?: string;
}

export function dateInTimeZone(now = new Date(), timeZone = CHECKIN_REMINDER_TIME_ZONE): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

async function getReminderUserIds(userId?: string): Promise<string[]> {
  if (userId) return [userId];
  const rows = await db.select({ id: users.id }).from(users).limit(1);
  return rows.map(row => row.id);
}

export async function processCheckinReminderJob(
  job: Job<CheckinReminderJobData>,
  app: FastifyInstance,
): Promise<void> {
  const date = job.data.date ?? dateInTimeZone();
  const userIds = await getReminderUserIds(job.data.userId);

  for (const userId of userIds) {
    const [checkin] = await db.select({ id: pulseMentalCheckins.id })
      .from(pulseMentalCheckins)
      .where(and(
        eq(pulseMentalCheckins.userId, userId),
        eq(pulseMentalCheckins.date, date),
      ))
      .limit(1);

    if (checkin) {
      app.log.info(`[checkin-reminder] Skipped for ${userId} on ${date}: check-in exists`);
      continue;
    }

    try {
      const result = await sendPushToUser(userId, {
        topic: 'checkin_reminder',
        title: 'Wie war dein Tag?',
        body: 'Kurzer Mental-Check-in (30s).',
        url: '/coach',
        tag: `checkin-${date}`,
      });
      app.log.info(`[checkin-reminder] Push processed for ${userId} on ${date}: ${JSON.stringify(result)}`);
    } catch (err) {
      app.log.warn(`[checkin-reminder] Push failed for ${userId} on ${date}: ${err}`);
    }
  }
}

export function startCheckinReminderWorker(
  app: FastifyInstance,
): { queue: Queue; worker: Worker } {
  const queue = createQueue(CHECKIN_REMINDER_QUEUE_NAME);
  const worker = createWorker(
    CHECKIN_REMINDER_QUEUE_NAME,
    (job: Job<CheckinReminderJobData>) => processCheckinReminderJob(job, app),
  );

  void queue.add('daily-checkin-reminder', {}, {
    repeat: { pattern: CHECKIN_REMINDER_PATTERN, tz: CHECKIN_REMINDER_TIME_ZONE },
    removeOnComplete: { count: 50 },
    removeOnFail: { count: 20 },
  }).catch(err => app.log.error('[checkin-reminder] schedule error:', err));

  app.log.info('[checkin-reminder] Worker scheduled (19:30 Europe/Berlin)');
  return { queue, worker };
}
