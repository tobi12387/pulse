import { createQueue } from '../../lib/queue.js';
import type { Queue } from 'bullmq';

export const PULSE_QUEUE_NAMES = [
  'pulse-garmin-sync',
  'pulse-calendar-sync',
  'pulse-morning-brief',
  'pulse-weekly-review',
  'pulse-insight-precompute',
] as const;

export type PulseQueueName = typeof PULSE_QUEUE_NAMES[number];

export const pulseQueues: Record<PulseQueueName, Queue> = {
  'pulse-garmin-sync':        createQueue('pulse-garmin-sync'),
  'pulse-calendar-sync':      createQueue('pulse-calendar-sync'),
  'pulse-morning-brief':      createQueue('pulse-morning-brief'),
  'pulse-weekly-review':      createQueue('pulse-weekly-review'),
  'pulse-insight-precompute': createQueue('pulse-insight-precompute'),
};

export interface PulseJobData {
  userId: string;
  date?: string;
}
