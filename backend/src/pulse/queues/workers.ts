import type { Job, Worker } from 'bullmq';
import { createWorker } from '../../lib/queue.js';
import { pulseQueues } from './queues.js';
import type { PulseJobData } from './queues.js';
import { syncGarminForDate } from '../adapters/garmin-client.js';
import { generateWeeklyReview } from '../services/review-engine.js';

async function handleGarminSync(job: Job<PulseJobData>): Promise<void> {
  const { userId, date } = job.data;
  const targetDate = date ?? new Date().toISOString().split('T')[0]!;
  await syncGarminForDate(userId, targetDate);
}

async function handleCalendarSync(job: Job<PulseJobData>): Promise<void> {
  const { userId } = job.data;
  console.log(`[pulse-calendar-sync] userId=${userId}`);
  // Phase 3c: call calendar adapter here
}

async function handleMorningBrief(job: Job<PulseJobData>): Promise<void> {
  const { userId } = job.data;
  console.log(`[pulse-morning-brief] userId=${userId}`);
  // Phase 3c: generate morning briefing here
}

async function handleWeeklyReview(job: Job<PulseJobData>): Promise<void> {
  const { userId } = job.data;
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - dayOfWeek - 7); // previous week
  const weekStartStr = weekStart.toISOString().split('T')[0]!;
  await generateWeeklyReview(userId, weekStartStr);
}

async function handleInsightPrecompute(job: Job<PulseJobData>): Promise<void> {
  const { userId } = job.data;
  console.log(`[pulse-insight-precompute] userId=${userId}`);
  // Phase 3c: call insight engine here
}

export function startPulseWorkers(): () => Promise<void> {
  const workers: Worker[] = [
    createWorker('pulse-garmin-sync',        handleGarminSync),
    createWorker('pulse-calendar-sync',      handleCalendarSync),
    createWorker('pulse-morning-brief',      handleMorningBrief),
    createWorker('pulse-weekly-review',      handleWeeklyReview),
    createWorker('pulse-insight-precompute', handleInsightPrecompute),
  ];

  return async () => {
    await Promise.all(workers.map((w) => w.close()));
    await Promise.all(Object.values(pulseQueues).map((q) => q.close()));
  };
}

export async function registerRepeatableJobs(userId: string): Promise<void> {
  await pulseQueues['pulse-garmin-sync'].add(
    'sync',
    { userId },
    { repeat: { pattern: '0 * * * *', tz: 'Europe/Berlin' }, removeOnComplete: { count: 10 } },
  );
  await pulseQueues['pulse-morning-brief'].add(
    'brief',
    { userId },
    { repeat: { pattern: '0 6 * * *', tz: 'Europe/Berlin' }, removeOnComplete: { count: 10 } },
  );
  await pulseQueues['pulse-weekly-review'].add(
    'review',
    { userId },
    { repeat: { pattern: '0 19 * * 0', tz: 'Europe/Berlin' }, removeOnComplete: { count: 10 } },
  );
  await pulseQueues['pulse-insight-precompute'].add(
    'precompute',
    { userId },
    { repeat: { pattern: '30 6 * * *', tz: 'Europe/Berlin' }, removeOnComplete: { count: 10 } },
  );
}
