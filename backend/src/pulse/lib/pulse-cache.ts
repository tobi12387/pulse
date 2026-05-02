import { redis } from '../../lib/redis.js';

export type PulseCacheKind = 'readiness' | 'fitness-load' | 'context' | 'context-v2' | 'context-v3' | 'briefing' | 'briefing-v2';

const TTL_SECONDS: Record<PulseCacheKind, number> = {
  'readiness': 5 * 60,
  'fitness-load': 15 * 60,
  'context': 5 * 60,
  'context-v2': 5 * 60,
  'context-v3': 5 * 60,
  'briefing': 24 * 60 * 60,
  'briefing-v2': 24 * 60 * 60,
};

export function cacheKey(kind: PulseCacheKind, userId: string, date: string): string {
  return `pulse:${userId}:${kind}:${date}`;
}

export async function getCached<T>(kind: PulseCacheKind, userId: string, date: string): Promise<T | null> {
  try {
    const raw = await redis.get(cacheKey(kind, userId, date));
    return raw ? JSON.parse(raw) as T : null;
  } catch {
    return null;
  }
}

export async function setCached<T>(kind: PulseCacheKind, userId: string, date: string, value: T): Promise<void> {
  try {
    await redis.set(cacheKey(kind, userId, date), JSON.stringify(value), 'EX', TTL_SECONDS[kind]);
  } catch {
    // Cache is an optimization only. Redis outages must not break Pulse.
  }
}

export async function invalidateUser(userId: string): Promise<number> {
  let cursor = '0';
  let deleted = 0;
  const pattern = `pulse:${userId}:*`;

  try {
    do {
      const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;
      if (keys.length > 0) {
        deleted += await redis.del(...keys);
      }
    } while (cursor !== '0');
  } catch {
    return deleted;
  }

  return deleted;
}
