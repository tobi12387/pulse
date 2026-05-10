import { describe, expect, it } from 'vitest';
import type { PulseAdaptationEvent } from '@coaching-os/shared/pulse';
import { PLAN_ENGINE_VERSION, buildPlanRefreshPreview } from './plan-refresh-preview.js';

const baseWorkout = {
  id: 'hard-workout',
  plannedDate: '2026-05-11',
  activityType: 'bike' as const,
  zone: 5,
  durationMin: 75,
  targetTss: 92,
  userLocked: false,
  status: 'planned',
  description: 'Warum diese Einheit: VO2-Reiz fuer kurze Anstiege.\n\n4x4 min.',
  archetypeId: 'bike_vo2_4x4',
};

function event(overrides: Partial<PulseAdaptationEvent>): PulseAdaptationEvent {
  return {
    id: 'event-1',
    userId: 'user-1',
    eventDate: '2026-05-10',
    kind: 'high_rpe',
    sourceId: 'activity-1',
    severity: 'watch',
    recommendation: 'reduce_intensity',
    summary: 'Hohe RPE spricht gegen direktes Nachlegen harter Reize.',
    evidence: ['RPE 9/10', 'bike 180 min'],
    resolvedAt: null,
    createdAt: '2026-05-10T12:00:00.000Z',
    ...overrides,
  };
}

describe('buildPlanRefreshPreview', () => {
  it('turns a hard future workout into a read-only recovery proposal after RPE 9', () => {
    const preview = buildPlanRefreshPreview({
      today: '2026-05-10',
      weekStart: '2026-05-11',
      currentWorkouts: [baseWorkout],
      adaptationEvents: [event({})],
      latestTrace: {
        createdAt: '2026-05-09T12:00:00.000Z',
        engineVersion: PLAN_ENGINE_VERSION,
      },
      latestCapabilityUpdatedAt: null,
    });

    expect(preview.stale).toBe(true);
    expect(preview.applySupported).toBe(false);
    expect(preview.triggers.map(trigger => trigger.kind)).toContain('high_rpe');
    expect(preview.comparisons).toHaveLength(1);
    expect(preview.comparisons[0]?.current?.zone).toBe(5);
    expect(preview.comparisons[0]?.proposed?.zone).toBe(2);
    expect(preview.comparisons[0]?.proposed?.durationMin).toBeLessThan(baseWorkout.durationMin);
    expect(preview.comparisons[0]?.changes).toEqual(expect.arrayContaining(['zone', 'duration', 'why']));
    expect(preview.mutationBoundary).toContain('keine DB-');
  });

  it('marks capability updates and stale engine versions without mutating unchanged locked workouts', () => {
    const preview = buildPlanRefreshPreview({
      today: '2026-05-10',
      weekStart: '2026-05-11',
      currentWorkouts: [{ ...baseWorkout, id: 'locked', userLocked: true }],
      adaptationEvents: [],
      latestTrace: {
        createdAt: '2026-05-09T12:00:00.000Z',
        engineVersion: 'older-plan-engine',
      },
      latestCapabilityUpdatedAt: '2026-05-10T08:00:00.000Z',
    });

    expect(preview.triggers.map(trigger => trigger.kind)).toEqual(expect.arrayContaining(['capability_update', 'stale_engine']));
    expect(preview.comparisons).toEqual([]);
    expect(preview.summary).toContain('1 gesperrte');
  });
});
