import { describe, it, expect, vi } from 'vitest';

vi.mock('../../lib/llm.js', () => ({
  llmComplete: vi.fn().mockResolvedValue('Diese Woche war produktiv mit 3 Einheiten...'),
  SMART_MODEL: 'test-model',
}));
vi.mock('../../lib/env.js', () => ({
  env: { SMART_MODEL: 'test-model', OPENROUTER_API_KEY: 'test', APP_URL: 'http://localhost:3000' },
}));
vi.mock('../../lib/db.js', () => ({
  db: {
    select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => Promise.resolve([])) })) })),
    insert: vi.fn(() => ({ values: vi.fn(() => ({ returning: vi.fn(() => Promise.resolve([{ id: 'rev-1', narrative: 'Test.' }])) })) })),
  },
}));
vi.mock('../../db/pulse-schema.js', () => ({
  pulseActivities: {}, pulseDailyMetrics: {}, pulseMentalCheckins: {}, pulseWeeklyReviews: {},
}));

describe('buildWeekSummary', () => {
  it('returns a summary string', async () => {
    const { buildWeekSummary } = await import('./review-engine.js');
    const summary = await buildWeekSummary('user-123', '2026-04-21', '2026-04-27');
    expect(typeof summary).toBe('string');
  });
});
