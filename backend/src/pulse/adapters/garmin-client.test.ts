import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

vi.mock('../../lib/env.js', () => ({
  env: {
    GARMIN_SIDECAR_URL: 'http://localhost:8001',
    GARMIN_EMAIL: 'test@test.com',
    GARMIN_PASSWORD: 'pass',
    NODE_ENV: 'test',
  },
}));

vi.mock('../../lib/db.js', () => ({
  db: {
    insert: vi.fn(() => ({ values: vi.fn(() => ({ onConflictDoUpdate: vi.fn() })) })),
  },
}));

vi.mock('../../db/pulse-schema.js', () => ({
  pulseDailyMetrics: {},
  pulseSleepSessions: {},
}));

describe('syncGarminForDate', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('calls the sidecar with correct payload', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        status: 'ok', date: '2026-04-25',
        hrv_rmssd: 45, hrv_status: 'balanced',
        resting_hr: 52, sleep_hours: 7.5, sleep_score: 78,
        body_battery_min: 20, body_battery_max: 85,
        stress_avg: 28, steps: 9200, calories_active: 450,
        sleep_deep_h: 1.2, sleep_rem_h: 1.8, sleep_light_h: 3.5, sleep_awake_h: 0.5,
      }),
    });

    const { syncGarminForDate } = await import('./garmin-client.js');
    await syncGarminForDate('user-123', '2026-04-25');

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8001/sync',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"date":"2026-04-25"'),
      }),
    );
  });

  it('throws on sidecar error', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

    const { syncGarminForDate } = await import('./garmin-client.js');
    await expect(syncGarminForDate('user-123', '2026-04-25')).rejects.toThrow('500');
  });
});
