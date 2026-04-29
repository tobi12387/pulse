import { describe, it, expect, vi } from 'vitest';

vi.mock('../../lib/queue.js', () => ({
  createQueue: vi.fn(() => ({ add: vi.fn(), close: vi.fn() })),
  createWorker: vi.fn(() => ({ close: vi.fn() })),
}));

vi.mock('../../lib/env.js', () => ({
  env: {
    REDIS_URL: 'redis://localhost:6380',
    DATABASE_URL: 'postgresql://postgres:postgres@localhost:5433/coaching_os_v2',
    DATABASE_URL_TEST: 'postgresql://postgres:postgres@localhost:5433/coaching_os_v2_test',
    NODE_ENV: 'test',
    FAST_MODEL: 'test-model',
    SMART_MODEL: 'test-model',
    OPENROUTER_API_KEY: 'test-key',
    APP_URL: 'http://localhost:3000',
    GARMIN_SIDECAR_URL: 'http://localhost:8001',
    LLM_MONTHLY_BUDGET_USD: 50,
  },
}));

describe('pulse queue names', () => {
  it('exports the five queue name constants', async () => {
    const { PULSE_QUEUE_NAMES } = await import('./queues.js');
    expect(PULSE_QUEUE_NAMES).toEqual(expect.arrayContaining([
      'pulse-garmin-sync',
      'pulse-calendar-sync',
      'pulse-morning-brief',
      'pulse-weekly-review',
      'pulse-insight-precompute',
    ]));
  });
});

describe('startPulseWorkers', () => {
  it('returns a shutdown function', async () => {
    const { startPulseWorkers } = await import('./workers.js');
    const shutdown = startPulseWorkers();
    expect(typeof shutdown).toBe('function');
    await shutdown();
  });
});
