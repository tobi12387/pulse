import { describe, it, expect, beforeEach, vi } from 'vitest';

const store = new Map<string, string>();
const expires = new Map<string, number>();

vi.mock('../../lib/redis.js', () => ({
  redis: {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    set: vi.fn(async (key: string, value: string, _mode: 'EX', ttl: number) => {
      store.set(key, value);
      expires.set(key, ttl);
      return 'OK';
    }),
    scan: vi.fn(async (_cursor: string, _match: 'MATCH', pattern: string) => {
      const prefix = pattern.replace('*', '');
      return ['0', [...store.keys()].filter(k => k.startsWith(prefix))];
    }),
    del: vi.fn(async (...keys: string[]) => {
      let deleted = 0;
      for (const key of keys) {
        if (store.delete(key)) deleted++;
        expires.delete(key);
      }
      return deleted;
    }),
  },
}));

describe('pulse-cache', () => {
  beforeEach(() => {
    store.clear();
    expires.clear();
  });

  it('round-trips JSON values with the configured key', async () => {
    const { cacheKey, getCached, setCached } = await import('./pulse-cache.js');

    await setCached('readiness', 'user-1', '2026-04-29', { score: 80 });

    expect(cacheKey('readiness', 'user-1', '2026-04-29')).toBe('pulse:user-1:readiness:2026-04-29');
    expect(await getCached<{ score: number }>('readiness', 'user-1', '2026-04-29')).toEqual({ score: 80 });
    expect(expires.get('pulse:user-1:readiness:2026-04-29')).toBe(300);
  });

  it('invalidates only keys for one user', async () => {
    const { getCached, invalidateUser, setCached } = await import('./pulse-cache.js');

    await setCached('readiness', 'user-1', '2026-04-29', { score: 80 });
    await setCached('fitness-load', 'user-1', '2026-04-29', { ctl: 40 });
    await setCached('briefing', 'user-1', '2026-04-29', 'Heute locker bleiben.');
    await setCached('readiness', 'user-2', '2026-04-29', { score: 60 });

    expect(await invalidateUser('user-1')).toBe(3);
    expect(await getCached('readiness', 'user-1', '2026-04-29')).toBeNull();
    expect(await getCached('fitness-load', 'user-1', '2026-04-29')).toBeNull();
    expect(await getCached('briefing', 'user-1', '2026-04-29')).toBeNull();
    expect(await getCached('readiness', 'user-2', '2026-04-29')).toEqual({ score: 60 });
  });
});
