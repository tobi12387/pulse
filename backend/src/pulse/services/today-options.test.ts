import { describe, expect, it } from 'vitest';
import { buildTodayOptions } from './today-options.js';

describe('buildTodayOptions', () => {
  it('turns a completed Garmin activity into recovery, fueling and feedback options', () => {
    const result = buildTodayOptions({
      date: '2026-05-09',
      readinessScore: 72,
      tsb: -4,
      plannedToday: null,
      completedTodayActivities: [{
        id: 'activity-1',
        activityType: 'bike',
        durationMin: 185,
        distanceKm: 92,
        tss: 145,
        rpe: null,
        feedbackLoggedAt: null,
      }],
      recentSportMix: { bike: 2, run: 1 },
      riskSignals: [],
      mental: null,
      fueling: { recentGiIssue: false, loggedToday: false },
      capabilitySummary: null,
    });

    expect(result.state).toBe('completed_activity');
    expect(result.options).toHaveLength(3);
    expect(result.options.every(option => option.kind !== 'workout')).toBe(true);
    expect(result.options.map(option => option.kind)).toEqual(['feedback', 'fueling', 'recovery']);
    expect(result.summary).toContain('abgeschlossen');
  });

  it('makes rest the first-class option when recovery risk is high', () => {
    const result = buildTodayOptions({
      date: '2026-05-09',
      readinessScore: 38,
      tsb: -18,
      plannedToday: {
        id: 'workout-1',
        activityType: 'bike',
        zone: 4,
        durationMin: 75,
        targetTss: 90,
        capabilityFit: 'stretch',
      },
      completedTodayActivities: [],
      recentSportMix: { bike: 3 },
      riskSignals: [{ severity: 'critical', title: 'HRV-Trend fällt' }],
      mental: { mood: 5, energy: 3, stress: 8, motivation: 4 },
      fueling: { recentGiIssue: true, loggedToday: false },
      capabilitySummary: null,
    });

    expect(result.state).toBe('recovery_protect');
    expect(result.options[0]).toMatchObject({
      kind: 'rest',
      priority: 'primary',
    });
    expect(result.options.some(option => option.kind === 'workout' && (option.zone ?? 0) >= 3)).toBe(false);
    expect(result.options[0]?.evidence).toEqual(expect.arrayContaining([
      'Readiness 38/100',
      'TSB -18.0',
      'Risiko: HRV-Trend fällt',
    ]));
  });

  it('returns stable explainable workout options on unplanned trainable days', () => {
    const input = {
      date: '2026-05-09',
      readinessScore: 78,
      tsb: 2,
      plannedToday: null,
      completedTodayActivities: [],
      recentSportMix: { bike: 1, run: 2 },
      riskSignals: [],
      mental: { mood: 7, energy: 7, stress: 3, motivation: 8 },
      fueling: { recentGiIssue: false, loggedToday: true },
      capabilitySummary: null,
    };

    const first = buildTodayOptions(input);
    const second = buildTodayOptions(input);

    expect(first).toEqual(second);
    expect(first.state).toBe('unplanned_trainable');
    expect(first.options).toHaveLength(3);
    expect(first.options[0]).toMatchObject({
      kind: 'workout',
      priority: 'primary',
      activityType: 'bike',
      zone: 2,
    });
    expect(first.options[0]?.evidence.length).toBeGreaterThanOrEqual(2);
  });
});
