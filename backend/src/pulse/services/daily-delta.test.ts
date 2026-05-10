import { describe, expect, it } from 'vitest';
import { buildDailyDelta } from './daily-delta.js';

type DeltaInput = Parameters<typeof buildDailyDelta>[0];

function baseInput(overrides: Partial<DeltaInput> = {}): DeltaInput {
  return {
    today: '2026-05-03',
    days: 7,
    plannedWorkouts: [],
    activities: [],
    dailyMetrics: [],
    ...overrides,
  };
}

describe('buildDailyDelta', () => {
  it('summarizes a matched planned workout with score and load delta', () => {
    const result = buildDailyDelta(baseInput({
      plannedWorkouts: [{
        id: 'workout-1',
        plannedDate: '2026-05-02',
        activityType: 'bike',
        zone: 2,
        durationMin: 75,
        targetTss: 65,
        status: 'completed',
        completedActivityId: 'activity-1',
        complianceScore: 0.88,
      }],
      activities: [{
        id: 'activity-1',
        startTime: '2026-05-02T15:00:00.000Z',
        activityType: 'bike',
        durationSec: 4_800,
        tss: 72,
        rpe: 7,
      }],
      dailyMetrics: [
        { date: '2026-05-01', sleepHours: 6.8, bodyBatteryMax: 68, stressAvg: 35 },
        { date: '2026-05-02', sleepHours: 7.4, bodyBatteryMax: 74, stressAvg: 30 },
      ],
    }));

    expect(result.items[0]).toMatchObject({
      date: '2026-05-02',
      status: 'matched',
      score: 88,
      loadDeltaTss: 7,
      title: 'Plan und Ausführung passen zusammen',
      nextPlanEffect: expect.stringContaining('erledigt'),
    });
    expect(result.items[0]?.evidence).toContain('Geplant: Radfahren · Z2 · 75 min');
    expect(result.items[0]?.evidence).toContain('Garmin: Radfahren · 80 min · TSS 72');
    expect(result.items[0]?.recoveryDelta).toContain('Schlaf +0.6 h');
  });

  it('surfaces off-plan activity as real load instead of a missed workout', () => {
    const result = buildDailyDelta(baseInput({
      activities: [{
        id: 'activity-1',
        startTime: '2026-05-02T15:00:00.000Z',
        activityType: 'run',
        durationSec: 2_700,
        tss: 52,
        rpe: 8,
      }],
    }));

    expect(result.items[0]).toMatchObject({
      date: '2026-05-02',
      status: 'off_plan',
      score: null,
      loadDeltaTss: null,
      title: 'Echte Aktivität ohne Plan',
      nextPlanEffect: expect.stringContaining('echte Belastung'),
    });
    expect(result.items[0]?.evidence).toContain('Garmin: Laufen · 45 min · TSS 52');
  });
});
