import { describe, expect, it } from 'vitest';
import { buildDailyDecisionQuality } from './daily-decision-quality.js';

type QualityInput = Parameters<typeof buildDailyDecisionQuality>[0];

function decision(overrides: Partial<QualityInput['actionDecisions'][number]> = {}): QualityInput['actionDecisions'][number] {
  return {
    id: 'decision-1',
    source: 'next_best_action',
    sourceId: 'checkin',
    kind: 'checkin',
    title: 'Daily Check-in machen',
    status: 'completed',
    targetRoute: '/data',
    createdAt: '2026-05-01T07:00:00.000Z',
    resolvedAt: '2026-05-01T07:12:00.000Z',
    resolutionReason: null,
    ...overrides,
  };
}

function baseInput(overrides: Partial<QualityInput> = {}): QualityInput {
  return {
    today: '2026-05-02',
    days: 14,
    actionDecisions: [],
    outcomes: [],
    checkins: [],
    plannedWorkouts: [],
    activities: [],
    dailyMetrics: [],
    planGenerations: [],
    ...overrides,
  };
}

describe('buildDailyDecisionQuality', () => {
  it('scores a completed recommendation as helpful when outcome and next-day recovery are stable', () => {
    const quality = buildDailyDecisionQuality(baseInput({
      actionDecisions: [decision()],
      outcomes: [{
        date: '2026-05-01',
        actionId: 'decision-1',
        actionTitle: 'Daily Check-in machen',
        actionStatus: 'completed',
        status: 'reinforced',
        title: 'Empfehlung wurde durch Daten bestätigt',
        reason: 'Check-in und Tagesdaten passen zusammen.',
        evidence: ['Check-in am selben Tag vorhanden', 'Body Battery max 72'],
        suggestedAdjustment: 'Check-in Kontext weiter nutzen.',
      }],
      checkins: [
        { date: '2026-05-01', mood: 7, energy: 6, stress: 4, motivation: 8 },
        { date: '2026-05-02', mood: 7, energy: 7, stress: 3, motivation: 8 },
      ],
      plannedWorkouts: [{
        id: 'workout-1',
        plannedDate: '2026-05-01',
        activityType: 'bike',
        zone: 2,
        durationMin: 60,
        status: 'completed',
        completedActivityId: 'activity-1',
        executionStatus: 'completed_matched',
      }],
      activities: [{
        id: 'activity-1',
        startTime: '2026-05-01T17:00:00.000Z',
        activityType: 'bike',
        durationSec: 3600,
        rpe: 5,
      }],
      dailyMetrics: [
        { date: '2026-05-01', sleepHours: 7.4, hrvStatus: 'normal', bodyBatteryMax: 70, bodyBatteryAtWake: 58, stressAvg: 35, highStressSec: 600, avgWakingRespiration: 14.2, latestSpo2: 97 },
        { date: '2026-05-02', sleepHours: 7.6, hrvStatus: 'normal', bodyBatteryMax: 74, bodyBatteryAtWake: 61, stressAvg: 32, highStressSec: 480, avgWakingRespiration: 14.0, latestSpo2: 98 },
      ],
    }));

    expect(quality.status).toBe('helpful');
    expect(quality.qualityScore).toBeGreaterThanOrEqual(75);
    expect(quality.bestEvidence.join(' ')).toContain('bestätigt');
    expect(quality.suggestedAdjustment).toContain('beibehalten');
  });

  it('marks repeated unresolved recommendations as stale when no outcome evidence exists', () => {
    const quality = buildDailyDecisionQuality(baseInput({
      actionDecisions: [
        decision({ id: 'd1', title: 'Mobilität 10 Minuten', kind: 'mental', sourceId: 'mobility', status: 'open', createdAt: '2026-04-29T07:00:00.000Z', resolvedAt: null }),
        decision({ id: 'd2', title: 'Mobilität 10 Minuten', kind: 'mental', sourceId: 'mobility', status: 'open', createdAt: '2026-04-30T07:00:00.000Z', resolvedAt: null }),
        decision({ id: 'd3', title: 'Mobilität 10 Minuten', kind: 'mental', sourceId: 'mobility', status: 'open', createdAt: '2026-05-01T07:00:00.000Z', resolvedAt: null }),
      ],
      dailyMetrics: [{ date: '2026-05-01', sleepHours: 7, hrvStatus: 'normal', bodyBatteryMax: 64, bodyBatteryAtWake: 51, stressAvg: 38, highStressSec: 900, avgWakingRespiration: null, latestSpo2: null }],
    }));

    expect(quality.status).toBe('stale');
    expect(quality.repeatedThemes[0]).toMatchObject({ theme: 'Mobilität 10 Minuten', count: 3, status: 'stale' });
    expect(quality.suggestedAdjustment).toContain('anders');
  });

  it('asks for a strategy change when missed workouts, high RPE and poor recovery repeat', () => {
    const quality = buildDailyDecisionQuality(baseInput({
      actionDecisions: [
        decision({ id: 'plan-1', kind: 'workout', title: 'Bike Einheit heute ausführen', status: 'deferred', targetRoute: '/plan', createdAt: '2026-04-30T07:00:00.000Z', resolvedAt: '2026-04-30T07:05:00.000Z' }),
        decision({ id: 'plan-2', kind: 'workout', title: 'Bike Einheit heute ausführen', status: 'deferred', targetRoute: '/plan', createdAt: '2026-05-01T07:00:00.000Z', resolvedAt: '2026-05-01T07:05:00.000Z' }),
      ],
      outcomes: [{
        date: '2026-05-01',
        actionId: 'plan-2',
        actionTitle: 'Bike Einheit heute ausführen',
        actionStatus: 'deferred',
        status: 'stale_pattern',
        title: 'Wiederholte Empfehlung wird angepasst',
        reason: 'Die Empfehlung wurde wiederholt verschoben.',
        evidence: ['2x verschoben'],
        suggestedAdjustment: 'Empfehlung kleiner anbieten.',
      }],
      plannedWorkouts: [
        { id: 'w1', plannedDate: '2026-04-29', activityType: 'bike', zone: 4, durationMin: 75, status: 'skipped', completedActivityId: null, executionStatus: 'missed' },
        { id: 'w2', plannedDate: '2026-05-01', activityType: 'run', zone: 3, durationMin: 50, status: 'planned', completedActivityId: null, executionStatus: 'missed' },
      ],
      activities: [
        { id: 'a1', startTime: '2026-04-30T18:00:00.000Z', activityType: 'bike', durationSec: 4200, rpe: 9 },
        { id: 'a2', startTime: '2026-05-01T18:00:00.000Z', activityType: 'run', durationSec: 3000, rpe: 8 },
      ],
      dailyMetrics: [
        { date: '2026-04-30', sleepHours: 5.5, hrvStatus: 'below_normal', bodyBatteryMax: 32, bodyBatteryAtWake: 28, stressAvg: 68, highStressSec: 5400, avgWakingRespiration: 17.1, latestSpo2: 94 },
        { date: '2026-05-01', sleepHours: 5.2, hrvStatus: 'poor', bodyBatteryMax: 29, bodyBatteryAtWake: 24, stressAvg: 71, highStressSec: 6100, avgWakingRespiration: 17.5, latestSpo2: 94 },
      ],
      planGenerations: [{
        weekStart: '2026-04-27',
        createdAt: '2026-04-27T06:00:00.000Z',
        targetSessionCount: 4,
        skippedAvailableDays: [],
        reasons: ['Aufbauwoche'],
      }],
    }));

    expect(quality.status).toBe('needs_strategy_change');
    expect(quality.qualityScore).toBeLessThan(50);
    expect(quality.bestEvidence.join(' ')).toContain('verpasst');
    expect(quality.suggestedAdjustment).toContain('Strategie');
  });

  it('keeps quality as insufficient evidence when Garmin and check-in data are missing', () => {
    const quality = buildDailyDecisionQuality(baseInput({
      actionDecisions: [decision({ title: 'Heute locker bleiben', kind: 'plan', targetRoute: '/plan' })],
    }));

    expect(quality.status).toBe('insufficient_evidence');
    expect(quality.qualityScore).toBeLessThan(60);
    expect(quality.bestEvidence.join(' ')).toContain('zu wenig');
    expect(quality.suggestedAdjustment).toContain('Daten');
  });
});
