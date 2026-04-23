import { Queue, Worker } from 'bullmq';
import type { Job } from 'bullmq';
import { env } from './env.js';

const connection = { url: env.REDIS_URL, maxRetriesPerRequest: null as null };

export function createQueue(name: string): Queue {
  return new Queue(name, { connection });
}

export function createWorker(
  name: string,
  handler: (job: Job) => Promise<void>,
): Worker {
  return new Worker(name, handler, { connection });
}
