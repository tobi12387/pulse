import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { Redis } from 'ioredis';
import {
  runWithCircuitBreaker,
  CIRCUIT_FAILURES_KEY,
  CIRCUIT_OPEN_KEY,
  detectAlarms,
} from './garmin-sync.job.js';

const redis = new Redis(process.env['REDIS_URL'] ?? 'redis://localhost:6380', {
  maxRetriesPerRequest: null,
});

beforeEach(async () => {
  await redis.del(CIRCUIT_FAILURES_KEY, CIRCUIT_OPEN_KEY);
});

afterAll(async () => {
  await redis.del(CIRCUIT_FAILURES_KEY, CIRCUIT_OPEN_KEY);
  await redis.quit();
});

describe('runWithCircuitBreaker', () => {
  it('calls fn when circuit is closed', async () => {
    const fn = vi.fn().mockResolvedValue(undefined);
    await runWithCircuitBreaker(redis, fn);
    expect(fn).toHaveBeenCalledOnce();
  });

  it('skips fn and does not throw when circuit is open', async () => {
    await redis.set(CIRCUIT_OPEN_KEY, '1', 'EX', 3600);
    const fn = vi.fn().mockRejectedValue(new Error('should not be called'));
    await expect(runWithCircuitBreaker(redis, fn)).resolves.toBeUndefined();
    expect(fn).not.toHaveBeenCalled();
  });

  it('opens circuit after 3 consecutive failures', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('sync failed'));
    for (let i = 0; i < 3; i++) {
      await expect(runWithCircuitBreaker(redis, fn)).rejects.toThrow('sync failed');
    }
    const isOpen = await redis.exists(CIRCUIT_OPEN_KEY);
    expect(isOpen).toBe(1);
  });

  it('does not open circuit after only 2 failures', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fail'));
    for (let i = 0; i < 2; i++) {
      await expect(runWithCircuitBreaker(redis, fn)).rejects.toThrow();
    }
    const isOpen = await redis.exists(CIRCUIT_OPEN_KEY);
    expect(isOpen).toBe(0);
  });

  it('resets failures counter on success', async () => {
    const fail = vi.fn().mockRejectedValue(new Error('fail'));
    const ok   = vi.fn().mockResolvedValue(undefined);

    await expect(runWithCircuitBreaker(redis, fail)).rejects.toThrow();
    await runWithCircuitBreaker(redis, ok);

    const failures = await redis.get(CIRCUIT_FAILURES_KEY);
    expect(failures).toBeNull();
  });

  it('opens circuit immediately on auth error (401)', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('HTTP 401 Unauthorized'));
    await expect(runWithCircuitBreaker(redis, fn)).rejects.toThrow();
    const isOpen = await redis.exists(CIRCUIT_OPEN_KEY);
    expect(isOpen).toBe(1);
  });

  it('opens circuit immediately on auth error (403)', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('HTTP 403 Forbidden'));
    await expect(runWithCircuitBreaker(redis, fn)).rejects.toThrow();
    const isOpen = await redis.exists(CIRCUIT_OPEN_KEY);
    expect(isOpen).toBe(1);
  });
});

describe('detectAlarms', () => {
  it('returns true when HRV is poor', () => {
    expect(detectAlarms({ hrvStatus: 'poor', sleepHours: 8, bodyBatteryMax: 60 })).toBe(true);
  });

  it('returns true when sleep < 6h', () => {
    expect(detectAlarms({ hrvStatus: 'balanced', sleepHours: 5.9, bodyBatteryMax: 60 })).toBe(true);
  });

  it('returns true when body battery < 20', () => {
    expect(detectAlarms({ hrvStatus: 'balanced', sleepHours: 7, bodyBatteryMax: 19 })).toBe(true);
  });

  it('returns false when all values are good', () => {
    expect(detectAlarms({ hrvStatus: 'balanced', sleepHours: 7, bodyBatteryMax: 60 })).toBe(false);
  });

  it('returns false when all values are null', () => {
    expect(detectAlarms({ hrvStatus: null, sleepHours: null, bodyBatteryMax: null })).toBe(false);
  });

  it('returns false when HRV is unbalanced (not poor)', () => {
    expect(detectAlarms({ hrvStatus: 'unbalanced', sleepHours: 7, bodyBatteryMax: 60 })).toBe(false);
  });
});
