import { describe, it, expect, vi } from 'vitest';

vi.mock('../../lib/llm.js', () => ({
  llmComplete: vi.fn().mockResolvedValue('LLM-Antwort für unbekannten Intent.'),
  FAST_MODEL: 'test-model',
  SMART_MODEL: 'test-model',
}));

vi.mock('../../lib/env.js', () => ({
  env: {
    FAST_MODEL: 'test-model', SMART_MODEL: 'test-model',
    OPENROUTER_API_KEY: 'test', APP_URL: 'http://localhost:3000',
  },
}));

describe('detectIntent', () => {
  it('detects greeting', async () => {
    const { detectIntent } = await import('./coach-engine.js');
    expect(detectIntent('Hallo!')).toBe('greeting');
    expect(detectIntent('Hey Coach')).toBe('greeting');
    expect(detectIntent('Guten Morgen')).toBe('greeting');
  });

  it('detects sleep query', async () => {
    const { detectIntent } = await import('./coach-engine.js');
    expect(detectIntent('Wie war mein Schlaf?')).toBe('sleep');
    expect(detectIntent('Ich bin müde heute')).toBe('sleep');
  });

  it('detects hrv query', async () => {
    const { detectIntent } = await import('./coach-engine.js');
    expect(detectIntent('Was bedeutet mein HRV?')).toBe('hrv');
  });

  it('returns null for unknown input', async () => {
    const { detectIntent } = await import('./coach-engine.js');
    expect(detectIntent('Was ist der Sinn des Lebens?')).toBeNull();
  });
});

describe('getCoachReply', () => {
  it('returns rule-based reply for greeting', async () => {
    const { getCoachReply } = await import('./coach-engine.js');
    const reply = await getCoachReply('Hallo!', {
      readiness: 75, sleepHours: 7.5, hrvStatus: 'balanced',
      bodyBatteryMax: 80, tsb: 5, stressAvg: 30,
    });
    expect(reply).toContain('75');
    expect(typeof reply).toBe('string');
  });

  it('falls back to LLM for unrecognized message', async () => {
    const { llmComplete } = await import('../../lib/llm.js');
    const { getCoachReply } = await import('./coach-engine.js');
    await getCoachReply('Was ist der Sinn des Lebens?', {
      readiness: 70, sleepHours: 7, hrvStatus: 'normal',
      bodyBatteryMax: 70, tsb: 0, stressAvg: 40,
    });
    expect(llmComplete).toHaveBeenCalled();
  });
});
