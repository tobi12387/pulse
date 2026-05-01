import { describe, expect, it, vi } from 'vitest';
import { buildBriefingUserContentRich } from './briefing-generation.job.js';
import type { PulseContext } from '../pulse/lib/pulse-context.js';

vi.mock('../lib/llm.js', () => ({
  llmComplete: vi.fn(),
  SMART_MODEL: 'test-model',
}));

vi.mock('../lib/push.js', () => ({
  isPushConfigured: vi.fn().mockReturnValue(true),
  sendPushToUser: vi.fn(),
}));

describe('buildBriefingUserContentRich', () => {
  it('keeps future workouts out of a no-training daily briefing prompt', () => {
    const ctx = {
      date: '2026-05-01',
      todayMetrics: null,
      todayCheckin: null,
      fitnessLoad: { ctl: 40, atl: 48, tsb: -8 },
      readiness: { score: 62, label: 'moderate' },
      recovery: null,
      activeHealthStates: [],
      upcomingWorkouts: [{
        plannedDate: '2026-05-04',
        activityType: 'bike',
        zone: 2,
        durationMin: 80,
        description: 'Aerobe Grundlage',
      }],
      recentActivities: [],
      nextRace: null,
      activeRiskSignals: [],
    } as unknown as PulseContext;

    const prompt = buildBriefingUserContentRich(ctx, 'check-in');
    expect(prompt).toContain('Heute ist kein Training geplant.');
    expect(prompt).toContain('Kommende Einheiten gehören in den Plan-Ausblick, nicht in die heutige Empfehlung.');
    expect(prompt).not.toContain('2026-05-04');
    expect(prompt).not.toContain('bike Z2');
    expect(prompt).not.toContain('Nächster Trainingsausblick');
  });
});
