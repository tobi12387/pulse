import type { FastifyInstance } from 'fastify';
import type { Redis } from 'ioredis';
import { redis } from '../lib/redis.js';
import { createQueue, createWorker } from '../lib/queue.js';
import type { Queue, Worker } from 'bullmq';
import { syncGarminDay } from '../routes/garmin.js';
import { db } from '../lib/db.js';
import { users } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { BRIEFING_QUEUE_NAME } from './briefing-generation.job.js';
import type { BriefingJobData } from './briefing-generation.job.js';
import { pulseDailyMetrics } from '../db/pulse-schema.js';
import { invalidateUser } from '../pulse/lib/pulse-cache.js';
import { evaluateAndPersistRiskSignals } from '../pulse/services/risk-engine.js';
import { syncProfileFromGarmin } from '../pulse/services/profile-sync.js';

export const CIRCUIT_FAILURES_KEY = 'garmin:circuit:failures';
export const CIRCUIT_OPEN_KEY     = 'garmin:circuit:open';

const QUEUE_NAME = 'garmin-sync';

export async function runWithCircuitBreaker(
  redisClient: Redis,
  fn: () => Promise<void>,
): Promise<void> {
  const isOpen = await redisClient.exists(CIRCUIT_OPEN_KEY);
  if (isOpen) return;

  try {
    await fn();
    await redisClient.del(CIRCUIT_FAILURES_KEY);
  } catch (err) {
    const errMsg = String(err);
    const isAuthError = errMsg.includes('401') || errMsg.includes('403');

    if (isAuthError) {
      await redisClient.set(CIRCUIT_OPEN_KEY, '1', 'EX', 3600);
      await redisClient.del(CIRCUIT_FAILURES_KEY);
    } else {
      const count = await redisClient.incr(CIRCUIT_FAILURES_KEY);
      if (count >= 3) {
        await redisClient.set(CIRCUIT_OPEN_KEY, '1', 'EX', 3600);
      }
    }
    throw err;
  }
}

export function detectAlarms(health: {
  hrvStatus: string | null;
  sleepHours: number | null;
  bodyBatteryMax: number | null;
}): boolean {
  return (
    health.hrvStatus === 'poor' ||
    (health.sleepHours !== null && health.sleepHours < 6.0) ||
    (health.bodyBatteryMax !== null && health.bodyBatteryMax < 20)
  );
}

async function syncGarminProfile(userId: string, app: FastifyInstance): Promise<void> {
  try {
    const gc = await import('../lib/garmin-client.js').then(m => m.getGarminClient());
    const result = await syncProfileFromGarmin(userId, gc, { logger: app.log });
    const updated = Object.values(result.synced)
      .filter(field => field.status === 'updated')
      .map(field => `${field.field}=${field.value} (${field.source})`)
      .join(', ');
    app.log.info(`[garmin-sync] profile provenance checked${updated ? ` — ${updated}` : ''}`);
  } catch (err) {
    app.log.warn(`[garmin-sync] profile sync failed: ${err}`);
  }
}

async function checkGarminAlarms(userId: string, app: FastifyInstance): Promise<void> {
  const today = new Date().toISOString().split('T')[0]!;
  const [health] = await db.select({
    hrvStatus:      pulseDailyMetrics.hrvStatus,
    sleepHours:     pulseDailyMetrics.sleepHours,
    bodyBatteryMax: pulseDailyMetrics.bodyBatteryMax,
  }).from(pulseDailyMetrics).where(
    and(eq(pulseDailyMetrics.userId, userId), eq(pulseDailyMetrics.date, today))
  );

  if (!health || !detectAlarms(health)) return;

  const alarmQueue = createQueue(BRIEFING_QUEUE_NAME);
  void alarmQueue.add('generate-briefing', {
    userId,
    triggerType: 'garmin-alarm',
    date: today,
  } satisfies BriefingJobData, {
    removeOnComplete: { count: 50 },
    removeOnFail: { count: 20 },
  }).catch(err => app.log.error('[garmin-sync] alarm queue error:', err));

  app.log.info(`[garmin-sync] Alarm detected for ${userId} on ${today}`);
}

export function startGarminSyncJob(app: FastifyInstance): { queue: Queue; worker: Worker } {
  const queue  = createQueue(QUEUE_NAME);
  const worker = createWorker(QUEUE_NAME, async (job) => {
    const [user] = await db.select({ id: users.id }).from(users).limit(1);
    if (!user) return;

    const today     = new Date();
    const yesterday = new Date(Date.now() - 86_400_000);
    const dates     = job.name === 'sync-nightly' ? [yesterday, today] : [today];

    await runWithCircuitBreaker(redis, async () => {
      for (const date of dates) {
        await syncGarminDay(user.id, date, app);
      }
      await invalidateUser(user.id);
      await evaluateAndPersistRiskSignals(user.id);
    });

    if (job.name === 'sync-nightly') {
      await checkGarminAlarms(user.id, app);
      await syncGarminProfile(user.id, app);
    }
  });

  const repeatOpts = (pattern: string) => ({
    repeat: { pattern },
    removeOnComplete: { count: 100 },
    removeOnFail:     { count: 50 },
  } as const);

  void queue.add('sync-nightly',   {}, repeatOpts('0 2 * * *')).catch(err => app.log.error('[garmin-sync] schedule error:', err));
  void queue.add('sync-intraday',  {}, repeatOpts('*/30 * * * *')).catch(err => app.log.error('[garmin-sync] schedule error:', err));

  app.log.info('[garmin-sync] BullMQ job scheduled (nightly 02:00 + every 30 min)');
  return { queue, worker };
}
