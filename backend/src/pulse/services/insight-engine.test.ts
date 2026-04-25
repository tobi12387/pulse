import { describe, it, expect, vi } from 'vitest';

vi.mock('../../lib/llm.js', () => ({
  llmComplete: vi.fn().mockResolvedValue('LLM-generierter Insight.'),
  FAST_MODEL: 'test-model',
}));
vi.mock('../../lib/env.js', () => ({
  env: { FAST_MODEL: 'test-model', OPENROUTER_API_KEY: 'test', APP_URL: 'http://localhost:3000' },
}));

describe('getRuleInsight', () => {
  it('returns insight for hrv_rmssd metric', async () => {
    const { getRuleInsight } = await import('./insight-engine.js');
    const insight = getRuleInsight('hrv_rmssd', 35);
    expect(insight).not.toBeNull();
    expect(typeof insight).toBe('string');
  });

  it('returns insight for sleep_hours metric', async () => {
    const { getRuleInsight } = await import('./insight-engine.js');
    const insight = getRuleInsight('sleep_hours', 5.5);
    expect(insight).toContain('5.5');
  });

  it('returns null for unknown metric', async () => {
    const { getRuleInsight } = await import('./insight-engine.js');
    expect(getRuleInsight('unknown_metric', 42)).toBeNull();
  });
});
